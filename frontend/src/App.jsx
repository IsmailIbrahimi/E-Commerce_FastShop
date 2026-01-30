import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import Products from './components/Products';
import Orders from './components/Orders';
import CreateOrder from './components/CreateOrder';

function App() {
  const [apiStatus, setApiStatus] = useState('checking');

  useEffect(() => {
    checkApiHealth();
    const interval = setInterval(checkApiHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const checkApiHealth = async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/health`
      );
      if (response.ok) {
        setApiStatus('healthy');
      } else {
        setApiStatus('unhealthy');
      }
    } catch (error) {
      setApiStatus('unhealthy');
    }
  };

  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <nav className="navbar">
            <div className="nav-container">
              <Link to="/" className="nav-logo">
                🛒 FastShop
              </Link>
              <ul className="nav-menu">
                <li className="nav-item">
                  <Link to="/products" className="nav-link">Products</Link>
                </li>
                <li className="nav-item">
                  <Link to="/orders" className="nav-link">Orders</Link>
                </li>
                <li className="nav-item">
                  <Link to="/create-order" className="nav-link">New Order</Link>
                </li>
              </ul>
              <div className={`api-status ${apiStatus}`}>
                <span className="status-dot"></span>
                API: {apiStatus}
              </div>
            </div>
          </nav>
        </header>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<Products />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/create-order" element={<CreateOrder />} />
          </Routes>
        </main>

        <footer className="footer">
          <p>© 2025 FastShop - E-Commerce Microservices Platform</p>
          <p className="footer-tech">Built with React, Node.js & PostgreSQL</p>
        </footer>
      </div>
    </Router>
  );
}

function Home() {
  return (
    <div className="home">
      <div className="hero">
        <h1>Welcome to FastShop</h1>
        <p className="hero-subtitle">
          Modern E-Commerce Microservices Platform
        </p>
        <div className="hero-features">
          <div className="feature">
            <h3>🚀 Fast & Scalable</h3>
            <p>Microservices architecture for high performance</p>
          </div>
          <div className="feature">
            <h3>🔒 Secure</h3>
            <p>Built with security best practices</p>
          </div>
          <div className="feature">
            <h3>📦 Zero Downtime</h3>
            <p>Continuous deployment without interruption</p>
          </div>
        </div>
        <div className="hero-cta">
          <Link to="/products" className="btn btn-primary">
            Browse Products
          </Link>
          <Link to="/orders" className="btn btn-secondary">
            View Orders
          </Link>
        </div>
      </div>
    </div>
  );
}

export default App;
