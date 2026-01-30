const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

const SERVICES = {
  product: process.env.PRODUCT_SERVICE_URL || 'http://localhost:8001',
  order: process.env.ORDER_SERVICE_URL || 'http://localhost:8002',
};

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

app.get('/health', async (req, res) => {
  const healthChecks = {
    gateway: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    },
    services: {}
  };

  try {
    await axios.get(`${SERVICES.product}/health`, { timeout: 3000 });
    healthChecks.services.product = 'healthy';
  } catch (error) {
    healthChecks.services.product = 'unhealthy';
  }

  try {
    await axios.get(`${SERVICES.order}/health`, { timeout: 3000 });
    healthChecks.services.order = 'healthy';
  } catch (error) {
    healthChecks.services.order = 'unhealthy';
  }

  const allHealthy = Object.values(healthChecks.services).every(s => s === 'healthy');
  const statusCode = allHealthy ? 200 : 503;

  res.status(statusCode).json(healthChecks);
});

app.get('/', (req, res) => {
  res.json({
    name: 'FastShop API Gateway',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      products: '/api/products',
      orders: '/api/orders'
    },
    documentation: '/api/docs'
  });
});

app.use('/api/products', createProxyMiddleware({
  target: SERVICES.product,
  changeOrigin: true,
  pathRewrite: {
    '^/api/products': '/api/products'
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[PROXY] -> Product Service: ${req.method} ${req.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[PROXY] <- Product Service: ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    console.error('[PROXY ERROR] Product Service:', err.message);
    res.status(503).json({
      success: false,
      error: 'Product service is currently unavailable'
    });
  }
}));

app.use('/api/orders', createProxyMiddleware({
  target: SERVICES.order,
  changeOrigin: true,
  pathRewrite: {
    '^/api/orders': '/api/orders'
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[PROXY] -> Order Service: ${req.method} ${req.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[PROXY] <- Order Service: ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    console.error('[PROXY ERROR] Order Service:', err.message);
    res.status(503).json({
      success: false,
      error: 'Order service is currently unavailable'
    });
  }
}));

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    availableEndpoints: [
      '/health',
      '/api/products',
      '/api/orders'
    ]
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`📡 Routing to:`);
  console.log(`   - Product Service: ${SERVICES.product}`);
  console.log(`   - Order Service: ${SERVICES.order}`);
});

module.exports = app;