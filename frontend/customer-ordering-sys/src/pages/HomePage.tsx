import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchRestaurants } from '../services/restaurantApi';
import type { Restaurant } from '../services/restaurantApi';

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
    <div className="min-h-screen bg-luxe-bg text-luxe-text font-sans">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-luxe-bg/90 backdrop-blur-xl border-b border-white/[0.08] px-10 flex items-center justify-between h-[60px]">
        <span className="text-xl font-extrabold tracking-tight text-white">LuxeEats</span>
        <nav className="flex items-center gap-7">
          <a href="/menu" className="text-sm font-medium text-luxe-muted no-underline transition-colors hover:text-luxe-text">Menu</a>
          <a href="/cart" className="text-sm font-medium text-luxe-muted no-underline transition-colors hover:text-luxe-text">Cart</a>
        </nav>
      </header>

      {/* ── Hero ── */}
      <div className="relative h-[380px] flex items-center justify-center overflow-hidden text-center">
        {/* background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1400&q=70')" }}
        />
        {/* dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-luxe-bg/50 to-luxe-bg" />

        <div className="relative z-10 flex flex-col items-center gap-3 px-6">
          <h1 className="text-5xl font-black tracking-tighter text-white leading-none">
            Find Your Next Favourite
          </h1>
          <p className="text-base font-medium text-luxe-accent">
            Curated restaurants, delivered to you.
          </p>

          {/* Search bar */}
          <div className="mt-2 flex items-center gap-2.5 bg-luxe-surface/85 border border-white/[0.08] rounded-full px-5 py-3 w-[480px] max-w-[90vw] backdrop-blur-xl">
            <span className="text-luxe-muted">🔍</span>
            <input
              type="text"
              placeholder="Search restaurants or cuisines..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search restaurants"
              className="bg-transparent border-none outline-none text-sm text-luxe-text placeholder-luxe-muted w-full font-sans"
            />
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <section className="px-10 py-10 pb-16">
        <p className="text-xs font-bold text-luxe-muted tracking-[0.06em] uppercase mb-6">
          {search ? `Results for "${search}"` : 'All Restaurants'}
        </p>

        {loading ? (
          <p className="text-luxe-muted">Loading...</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-[22px]">
            {filtered.map((r, idx) => (
              <button
                key={r.restaurant_id}
                aria-label={r.name}
                disabled={!r.is_open}
                style={{ animationDelay: `${idx * 60}ms` }}
                onClick={() => { if (r.is_open) navigate(`/${r.restaurant_id}/menu`); }}
                className={[
                  'fade-up group text-left w-full flex flex-col',
                  'bg-luxe-surface border border-white/[0.08] rounded-2xl overflow-hidden',
                  'transition-all duration-200 shadow-[0_2px_16px_rgba(0,0,0,0.35)]',
                  r.is_open
                    ? 'cursor-pointer hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(0,0,0,0.45)] hover:border-luxe-accent'
                    : 'cursor-not-allowed opacity-55',
                ].join(' ')}
              >
                {/* Image */}
                <div className="relative h-[200px] overflow-hidden">
                  <img
                    src={RESTAURANT_IMAGES[r.restaurant_id] ?? RESTAURANT_IMAGES.R001}
                    alt={r.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className={[
                    'absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold tracking-wider',
                    r.is_open
                      ? 'bg-luxe-green/20 text-luxe-green border border-luxe-green/30'
                      : 'bg-luxe-red/20 text-luxe-red border border-luxe-red/30',
                  ].join(' ')}>
                    {r.status_label}
                  </span>
                </div>

                {/* Body */}
                <div className="p-5 flex flex-col gap-2 flex-1">
                  <p className="text-base font-bold text-white tracking-tight">{r.name}</p>
                  <span className="inline-block px-2.5 py-1 rounded-full bg-luxe-surface2 border border-white/[0.08] text-xs font-medium text-luxe-muted">
                    {r.cuisine_category}
                  </span>
                  <div className="flex items-center gap-4 mt-1 text-[0.82rem] text-luxe-muted">
                    <span className="text-amber-400 font-semibold">⭐ {r.avg_rating}</span>
                    <span>🕐 {r.est_delivery_min} min</span>
                    <span>🛵 {r.delivery_fee_egp} EGP</span>
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
