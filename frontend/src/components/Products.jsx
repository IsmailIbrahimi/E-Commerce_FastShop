// Products.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import "./Products.css";

// Vite (import.meta.env) + fallback (CRA/Node) + localhost
const API_URL =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) ||
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_URL) ||
  "http://localhost:8000";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState({ category: "", minPrice: "", maxPrice: "" });

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {};
      if (filter.category) params.category = filter.category;
      if (filter.minPrice) params.minPrice = filter.minPrice;
      if (filter.maxPrice) params.maxPrice = filter.maxPrice;

      const response = await axios.get(`${API_URL}/api/products`, { params });

      if (response.data?.success) {
        setProducts(response.data.data ?? []);
      } else {
        setProducts([]);
      }
    } catch (err) {
      setError("Failed to fetch products. Please try again later.");
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilter((prev) => ({ ...prev, [name]: value }));
  };

  const resetFilters = () => {
    setFilter({ category: "", minPrice: "", maxPrice: "" });
  };

  if (loading) {
    return (
      <div className="products-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading products...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="products-container">
        <div className="error">
          <p>❌ {error}</p>
          <button onClick={fetchProducts} className="btn btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="products-container">
      <div className="products-header">
        <h1>Our Products</h1>
        <p className="subtitle">{products.length} products available</p>
      </div>

      <div className="filters">
        <div className="filter-group">
          <label>Category:</label>
          <select name="category" value={filter.category} onChange={handleFilterChange}>
            <option value="">All Categories</option>
            <option value="Electronics">Electronics</option>
            <option value="Accessories">Accessories</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Min Price:</label>
          <input
            type="number"
            name="minPrice"
            value={filter.minPrice}
            onChange={handleFilterChange}
            placeholder="$0"
          />
        </div>

        <div className="filter-group">
          <label>Max Price:</label>
          <input
            type="number"
            name="maxPrice"
            value={filter.maxPrice}
            onChange={handleFilterChange}
            placeholder="$999"
          />
        </div>

        <button onClick={resetFilters} className="btn btn-secondary">
          Reset
        </button>
      </div>

      <div className="products-grid">
        {products.map((product) => (
          <div key={product.id} className="product-card">
            <div className="product-image">
              <img src={product.image_url} alt={product.name} />
              {product.stock < 10 && product.stock > 0 && (
                <span className="badge badge-warning">Only {product.stock} left!</span>
              )}
              {product.stock === 0 && <span className="badge badge-danger">Out of Stock</span>}
            </div>

            <div className="product-info">
              <span className="product-category">{product.category}</span>
              <h3 className="product-name">{product.name}</h3>
              <p className="product-description">{product.description}</p>

              <div className="product-footer">
                <span className="product-price">
                  ${Number.parseFloat(product.price).toFixed(2)}
                </span>
                <span className="product-stock">Stock: {product.stock}</span>
              </div>

              <button className="btn btn-primary btn-block" disabled={product.stock === 0}>
                {product.stock === 0 ? "Out of Stock" : "Add to Cart"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {products.length === 0 && (
        <div className="empty-state">
          <p>No products found matching your filters.</p>
          <button onClick={resetFilters} className="btn btn-primary">
            Show All Products
          </button>
        </div>
      )}
    </div>
  );
}
