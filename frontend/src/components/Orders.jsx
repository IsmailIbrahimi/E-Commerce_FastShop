import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Orders.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedOrder, setExpandedOrder] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const response = await axios.get(`${API_URL}/api/orders`, { params });
      if (response.data.success) {
        setOrders(response.data.data);
      }
    } catch (err) {
      setError('Failed to fetch orders. Please try again later.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const response = await axios.put(
        `${API_URL}/api/orders/${orderId}/status`,
        { status: newStatus }
      );
      if (response.data.success) {
        fetchOrders();
      }
    } catch (err) {
      alert('Failed to update order status');
      console.error(err);
    }
  };

  const toggleOrderDetails = (orderId) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'orange',
      processing: 'blue',
      shipped: 'purple',
      delivered: 'green',
      cancelled: 'red'
    };
    return colors[status] || 'gray';
  };

  if (loading) {
    return (
      <div className="orders-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading orders...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="orders-container">
        <div className="error">
          <p>❌ {error}</p>
          <button onClick={fetchOrders} className="btn btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="orders-container">
      <div className="orders-header">
        <h1>Orders Management</h1>
        <p className="subtitle">{orders.length} orders found</p>
      </div>

      <div className="filters">
        <label>Filter by Status:</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="orders-list">
        {orders.map(order => (
          <div key={order.id} className="order-card">
            <div className="order-header" onClick={() => toggleOrderDetails(order.id)}>
              <h3>Order #{order.id}</h3>
              <span
                className="status-badge"
                style={{ backgroundColor: getStatusColor(order.status) }}
              >
                {order.status}
              </span>
            </div>

            {expandedOrder === order.id && (
              <div className="order-details">
                <p>Customer: {order.customer_name}</p>
                <p>Email: {order.customer_email}</p>

                <div className="order-actions">
                  {['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map(status => (
                    <button
                      key={status}
                      onClick={() => updateOrderStatus(order.id, status)}
                      disabled={order.status === status}
                      style={{ backgroundColor: getStatusColor(status) }}
                      className="btn btn-sm"
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Orders;
