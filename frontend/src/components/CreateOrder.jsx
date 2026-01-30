import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './CreateOrder.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function CreateOrder() {
  const [products, setProducts] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/products`);
      if (response.data.success) {
        setProducts(response.data.data.filter(p => p.stock > 0));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addToCart = (product) => {
    const existing = cart.find(i => i.product_id === product.id);
    if (existing) {
      setCart(cart.map(i =>
        i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setCart([...cart, {
        product_id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        max_stock: product.stock
      }]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_URL}/api/orders`, {
        customer_name: customerName,
        customer_email: customerEmail,
        items: cart.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity
        }))
      });

      if (response.data.success) {
        setSuccess(true);
        setCustomerName('');
        setCustomerEmail('');
        setCart([]);
        setTimeout(() => setSuccess(false), 4000);
      }
    } catch (err) {
      setError('Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-order-container">
      <h1>Create Order</h1>

      {success && <div className="alert success">✅ Order created</div>}
      {error && <div className="alert error">❌ {error}</div>}

      <form onSubmit={handleSubmit}>
        <input
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Customer name"
          required
        />
        <input
          type="email"
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
          placeholder="Email"
          required
        />

        <button disabled={loading || cart.length === 0}>
          {loading ? 'Creating...' : 'Place Order'}
        </button>
      </form>

      <h2>Products</h2>
      {products.map(p => (
        <div key={p.id}>
          {p.name} - ${p.price}
          <button onClick={() => addToCart(p)}>Add</button>
        </div>
      ))}
    </div>
  );
}

export default CreateOrder;
