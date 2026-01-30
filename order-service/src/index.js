const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8002;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5433,
  database: process.env.DB_NAME || 'orders',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:8001';

// Initialize database
const initDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        total_amount DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Insert sample data if table is empty
    const { rows } = await pool.query('SELECT COUNT(*) as count FROM orders');
    if (parseInt(rows[0].count) === 0) {
      const orderResult = await pool.query(`
        INSERT INTO orders (customer_name, customer_email, status, total_amount) VALUES
        ('John Doe', 'john.doe@example.com', 'delivered', 1329.98),
        ('Jane Smith', 'jane.smith@example.com', 'shipped', 89.99),
        ('Bob Johnson', 'bob.johnson@example.com', 'pending', 449.98)
        RETURNING id
      `);
      
      const orderIds = orderResult.rows.map(r => r.id);
      
      await pool.query(`
        INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES
        ($1, 1, 'Laptop Pro 15', 1, 1299.99),
        ($1, 2, 'Wireless Mouse', 1, 29.99),
        ($2, 4, 'Mechanical Keyboard', 1, 89.99),
        ($3, 3, 'USB-C Hub', 2, 49.99),
        ($3, 5, '4K Monitor 27"', 1, 399.99)
      `, [orderIds[0], orderIds[1], orderIds[2]]);
      
      console.log('✅ Sample order data inserted');
    }
    
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    process.exit(1);
  }
};

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'order-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Get all orders
app.get('/api/orders', async (req, res) => {
  try {
    const { status, customer_email } = req.query;
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    
    if (customer_email) {
      params.push(customer_email);
      query += ` AND customer_email = $${params.length}`;
    }
    
    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    
    // Get items for each order
    for (let order of result.rows) {
      const items = await pool.query(
        'SELECT * FROM order_items WHERE order_id = $1',
        [order.id]
      );
      order.items = items.rows;
    }
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
});

// Get single order
app.get('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    const itemsResult = await pool.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [id]
    );
    
    const order = orderResult.rows[0];
    order.items = itemsResult.rows;
    
    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order'
    });
  }
});

// Create order
app.post('/api/orders', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { customer_name, customer_email, items } = req.body;
    
    // Validation
    if (!customer_name || !customer_email || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Customer name, email, and items are required'
      });
    }
    
    await client.query('BEGIN');
    
    // Verify products exist and calculate total
    let total = 0;
    const validatedItems = [];
    
    for (let item of items) {
      try {
        const productResponse = await axios.get(
          `${PRODUCT_SERVICE_URL}/api/products/${item.product_id}`
        );
        
        if (productResponse.data.success) {
          const product = productResponse.data.data;
          const itemTotal = product.price * item.quantity;
          total += itemTotal;
          
          validatedItems.push({
            product_id: product.id,
            product_name: product.name,
            quantity: item.quantity,
            price: product.price
          });
        }
      } catch (error) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `Product ${item.product_id} not found`
        });
      }
    }
    
    // Create order
    const orderResult = await client.query(
      `INSERT INTO orders (customer_name, customer_email, status, total_amount)
       VALUES ($1, $2, 'pending', $3) RETURNING *`,
      [customer_name, customer_email, total]
    );
    
    const order = orderResult.rows[0];
    
    // Create order items
    for (let item of validatedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, price)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, item.product_id, item.product_name, item.quantity, item.price]
      );
    }
    
    await client.query('COMMIT');
    
    // Fetch complete order with items
    const itemsResult = await pool.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [order.id]
    );
    
    order.items = itemsResult.rows;
    
    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order'
    });
  } finally {
    client.release();
  }
});

// Update order status
app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }
    
    const result = await pool.query(
      `UPDATE orders 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order status'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});

// Start server
const startServer = async () => {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`🚀 Order Service running on port ${PORT}`);
  });
};

startServer();

module.exports = app;