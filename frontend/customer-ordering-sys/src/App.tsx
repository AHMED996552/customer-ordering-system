import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { NotificationProvider } from './context/NotificationContext';
import { CartPage as Cart } from './pages/CartPage';
import Header from './components/Header';
import './index.css';
import './App.css';

function App() {
  return (
    <Router>
      <NotificationProvider>
        <CartProvider initialCart={null}>
          <div className="min-h-screen bg-surface text-on-surface">
            <Header />
            
            <main className="layout-container mt-8">
              <Routes>
                {/* Redirect root to cart for this demonstration */}
                <Route path="/" element={<Navigate to="/cart" replace />} />
                
                <Route path="/cart" element={<Cart />} />
                
                {/* Fallback for unknown routes */}
                <Route path="*" element={<Navigate to="/cart" replace />} />
              </Routes>
            </main>
          </div>
        </CartProvider>
      </NotificationProvider>
    </Router>
  );
}

export default App;
