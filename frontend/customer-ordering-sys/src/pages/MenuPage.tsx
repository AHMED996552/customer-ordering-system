import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import MenuItemCard from '../components/MenuItemCard';
import { useCart } from '../context/CartContext';
import type { MenuItem } from '../components/MenuItemCard';
import './MenuPage.css';

const ALL_ITEMS: MenuItem[] = [
  {
    id: 'I001', name: 'Classic Burger', price: 75, available: true,
    category: 'Burgers',
    description: 'Juicy beef patty, aged cheddar, crispy lettuce, tomato and house sauce.',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80',
  },
  {
    id: 'I002', name: 'Crispy Chicken Wrap', price: 65, available: true,
    category: 'Specials',
    description: 'Golden fried chicken, romaine, pickles and garlic aioli in a warm tortilla.',
    image: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=600&q=80',
  },
  {
    id: 'I003', name: 'Truffle Pasta', price: 110, available: true,
    category: 'Pasta',
    description: 'Hand-cut tagliatelle, black truffle oil, parmesan and fresh herbs.',
    image: 'https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?w=600&q=80',
  },
  {
    id: 'I004', name: 'Seasonal Special', price: 95, available: false,
    category: 'Specials',
    description: "Chef's daily creation — currently unavailable.",
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80',
  },
  {
    id: 'I005', name: 'Mushroom Risotto', price: 90, available: true,
    category: 'Pasta',
    description: 'Creamy Arborio rice, wild mushrooms, white wine and aged parmesan.',
    image: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=600&q=80',
  },
  {
    id: 'I006', name: 'Smash Burger', price: 80, available: true,
    category: 'Burgers',
    description: 'Double smash patty, American cheese, caramelised onions, pickles.',
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&q=80',
  },
];

const CATEGORIES = ['All', 'Burgers', 'Pasta', 'Specials'];

const MenuPage: React.FC = () => {
  const { cartItems, subtotal } = useCart();
  const [activeCategory, setActiveCategory] = useState('All');

  const uniqueCount = cartItems.length;
  const filtered = activeCategory === 'All'
    ? ALL_ITEMS
    : ALL_ITEMS.filter(i => i.category === activeCategory);

  return (
    <div className="page-wrapper">

      {/* ── Sticky header ── */}
      <header className="menu-header">
        <span className="menu-header__brand">LuxeEats</span>
        <Link to="/cart" className="menu-cart-badge">
          🛒 {`Cart (${uniqueCount})`}
          {subtotal > 0 && (
            <><span className="menu-cart-badge__sep"> | </span>{subtotal} EGP</>
          )}
        </Link>
      </header>

      {/* ── Hero ── */}
      <div className="menu-hero">
        <div className="menu-hero__bg" />
        <div className="menu-hero__overlay" />
        <div className="menu-hero__content">
          <h1 className="menu-hero__title">Explore Our Menu</h1>
          <p className="menu-hero__sub">Premium ingredients, crafted with precision.</p>
        </div>
      </div>

      {/* ── Category filters ── */}
      <div className="menu-filters">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`menu-filter-btn${activeCategory === cat ? ' menu-filter-btn--active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Menu grid ── */}
      <div className="menu-grid">
        {filtered.map((item, idx) => (
          <div key={item.id} className="fade-up" style={{ animationDelay: `${idx * 60}ms` }}>
            <MenuItemCard item={item} />
          </div>
        ))}
      </div>

    </div>
  );
};

export default MenuPage;
