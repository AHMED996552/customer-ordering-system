import React from 'react';
import { Link } from 'react-router-dom';
import MenuItemCard from '../components/MenuItemCard';
import { useCart } from '../context/CartContext';
import type { MenuItem } from '../components/MenuItemCard';

const MENU_ITEMS: MenuItem[] = [
  {
    id: 'I001',
    name: 'Classic Burger',
    price: 75,
    available: true,
    description: 'Juicy beef patty with fresh toppings.',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80',
  },
  {
    id: 'I002',
    name: 'Seasonal Special',
    price: 95,
    available: false,
    description: 'Chef\'s special — currently unavailable.',
  },
];

const MenuPage: React.FC = () => {
  const { cartItems, subtotal } = useCart();
  const totalItems = cartItems.reduce((s, i) => s + i.quantity, 0);
  // unique item count for "Cart (N)" badge
  const uniqueCount = cartItems.length;

  return (
    <div className="page-wrapper">
      {/* ── Top bar ── */}
      <header style={{ padding: '16px 28px', borderBottom: '1px solid var(--clr-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 800, fontSize: '1.2rem' }}>LuxeEats</span>

        <Link to="/cart" style={{ textDecoration: 'none' }}>
          {/* aria-live so screen readers announce updates; single element for RTL */}
          <output
            aria-live="polite"
            aria-label="cart summary"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}
          >
            <span>{`Cart (${uniqueCount})`}</span>
            {subtotal > 0 && <span>{subtotal} EGP</span>}
          </output>
        </Link>
      </header>

      {/* ── Menu ── */}
      <main className="container" style={{ paddingTop: 32 }}>
        <h1 style={{ marginBottom: 24 }}>Our Menu</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {MENU_ITEMS.map(item => (
            <MenuItemCard key={item.id} item={item} />
          ))}
        </div>
      </main>
    </div>
  );
};

export default MenuPage;
