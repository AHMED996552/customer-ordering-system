import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchRestaurants } from '../services/restaurantApi';
import type { Restaurant } from '../services/restaurantApi';
import './HomePage.css';

const RESTAURANT_IMAGES: Record<string, string> = {
  R001: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80',
  R002: 'https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?w=600&q=80',
  R003: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&q=80',
  R004: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80',
};

const MOCK_RESTAURANTS: Restaurant[] = [
  {
    restaurant_id: 'R001', name: 'Burger Palace',
    cuisine_category: 'American', avg_rating: 4.5,
    est_delivery_min: 25, delivery_fee_egp: 15.0,
    is_open: true, status_label: 'Open',
    operating_hours_display: '10:00 AM – 10:00 PM',
  },
  {
    restaurant_id: 'R002', name: 'Pizza Kingdom',
    cuisine_category: 'Italian', avg_rating: 4.2,
    est_delivery_min: 35, delivery_fee_egp: 20.0,
    is_open: true, status_label: 'Open',
    operating_hours_display: '11:00 AM – 11:00 PM',
  },
  {
    restaurant_id: 'R003', name: 'Sushi House',
    cuisine_category: 'Japanese', avg_rating: 4.8,
    est_delivery_min: 45, delivery_fee_egp: 25.0,
    is_open: true, status_label: 'Open',
    operating_hours_display: '12:00 PM – 9:00 PM',
  },
  {
    restaurant_id: 'R004', name: 'Night Bites',
    cuisine_category: 'Street Food', avg_rating: 3.9,
    est_delivery_min: 20, delivery_fee_egp: 10.0,
    is_open: false, status_label: 'Currently Closed',
    operating_hours_display: '8:00 PM – 4:00 AM',
  },
];

const HomePage: React.FC = () => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchRestaurants()
      .then(data => setRestaurants(data.restaurants))
      .catch(() => setRestaurants(MOCK_RESTAURANTS))
      .finally(() => setLoading(false));
  }, []);

  const filtered = restaurants.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.cuisine_category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-wrapper">

      {/* Header */}
      <header className="home-header">
        <span className="home-header__brand">LuxeEats</span>
        <nav className="home-header__nav">
          <a href="/menu" className="home-header__link">Menu</a>
          <a href="/cart" className="home-header__link">Cart</a>
        </nav>
      </header>

      {/* Hero */}
      <div className="home-hero">
        <div className="home-hero__bg" />
        <div className="home-hero__overlay" />
        <div className="home-hero__content">
          <h1 className="home-hero__title">Find Your Next Favourite</h1>
          <p className="home-hero__sub">Curated restaurants, delivered to you.</p>
          <div className="home-hero__search">
            <span className="home-hero__search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search restaurants or cuisines..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search restaurants"
            />
          </div>
        </div>
      </div>

      {/* Restaurant grid */}
      <section className="home-section">
        <p className="home-section-title">
          {search ? `RESULTS FOR "${search.toUpperCase()}"` : 'ALL RESTAURANTS'}
        </p>

        {loading ? (
          <p style={{ color: 'var(--clr-text-muted)' }}>Loading...</p>
        ) : (
          <div className="restaurant-grid">
            {filtered.map((r, idx) => (
              <button
                key={r.restaurant_id}
                className="restaurant-card fade-up"
                aria-label={r.name}
                disabled={!r.is_open}
                style={{ animationDelay: `${idx * 60}ms` }}
                onClick={() => {
                  if (r.is_open) navigate(`/restaurant/${r.restaurant_id}`);
                }}
              >
                {/* Image */}
                <div className="restaurant-card__img-wrap">
                  <img
                    src={RESTAURANT_IMAGES[r.restaurant_id] ?? RESTAURANT_IMAGES.R001}
                    alt={r.name}
                    className="restaurant-card__img"
                  />
                  <span className={`restaurant-card__status-badge restaurant-card__status-badge--${r.is_open ? 'open' : 'closed'}`}>
                    {r.status_label}
                  </span>
                </div>

                {/* Body */}
                <div className="restaurant-card__body">
                  <p className="restaurant-card__name">{r.name}</p>
                  <span className="restaurant-card__cuisine">{r.cuisine_category}</span>
                  <div className="restaurant-card__meta">
                    <span className="restaurant-card__rating">⭐ {r.avg_rating}</span>
                    <span className="restaurant-card__meta-item">🕐 {r.est_delivery_min} min</span>
                    <span className="restaurant-card__meta-item">🛵 {r.delivery_fee_egp} EGP</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

    </div>
  );
};

export default HomePage;
