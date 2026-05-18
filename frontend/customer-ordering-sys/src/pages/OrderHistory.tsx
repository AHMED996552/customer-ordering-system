// ============================================================
// src/pages/OrderHistory.tsx
// UC-8 — View Personal Order History
// Full production page. All test selectors (data-testid, ARIA
// roles, exact text) have been mapped directly from the test suite.
// ============================================================

import React, { useState } from 'react';
import { useOrderHistory, Order } from '../hooks/useOrderHistory';
import { formatOrderDate, formatCurrency, getStatusColor } from '../utils/orderHistory.utils';

// ----------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------

/** Glassmorphism skeleton card shown while data is loading */
function SkeletonCard() {
  return (
    <div
      className="glass-island rounded-2xl p-6 flex gap-6 items-center animate-pulse"
      aria-hidden="true"
    >
      <div className="w-24 h-24 rounded-xl bg-white/10 shrink-0" />
      <div className="flex-1 space-y-3">
        <div className="h-4 bg-white/10 rounded w-2/3" />
        <div className="h-3 bg-white/10 rounded w-1/2" />
        <div className="h-3 bg-white/10 rounded w-1/3" />
      </div>
    </div>
  );
}

/** Error fallback displayed for 401 / 403 / 422 / network errors */
interface ErrorBannerProps {
  status: number;
  code: string;
  message: string;
}

function ErrorBanner({ status, code, message }: ErrorBannerProps) {
  // 401 — show login prompt
  if (status === 401) {
    return (
      <div
        role="alert"
        className="glass-island rounded-2xl p-8 text-center flex flex-col items-center gap-4"
      >
        <span className="material-symbols-outlined text-5xl text-primary">lock</span>
        <p className="text-on-surface text-lg font-semibold">{message}</p>
        <p className="text-on-surface-variant text-sm">Please sign in to continue.</p>
        <button
          className="px-8 py-3 rounded-xl bg-primary text-on-secondary font-bold shimmer-btn shadow-lg"
          onClick={() => { window.location.href = '/login'; }}
          aria-label="Login"
        >
          Login
        </button>
      </div>
    );
  }

  // 403 — IDOR access denied
  if (status === 403) {
    return (
      <div role="alert" className="glass-island rounded-2xl p-8 text-center flex flex-col items-center gap-4">
        <span className="material-symbols-outlined text-5xl text-error">block</span>
        <p className="text-on-surface text-lg font-semibold">{message}</p>
        <p className="text-on-surface-variant text-sm">
          You can only view orders associated with your account.
        </p>
      </div>
    );
  }

  // 422 — Validation error
  if (status === 422) {
    return (
      <div role="alert" className="glass-island rounded-2xl p-8 text-center flex flex-col items-center gap-4">
        <span className="material-symbols-outlined text-5xl text-error">warning</span>
        <p className="text-on-surface text-lg font-semibold">{message}</p>
        <p className="text-on-surface-variant text-sm">
          Check your page or limit parameters and try again.
        </p>
      </div>
    );
  }

  // Generic fallback
  return (
    <div role="alert" className="glass-island rounded-2xl p-8 text-center flex flex-col items-center gap-4">
      <span className="material-symbols-outlined text-5xl text-error">error</span>
      <p className="text-on-surface text-lg font-semibold">{code}</p>
      <p className="text-on-surface-variant">{message}</p>
    </div>
  );
}

/** Empty-state panel shown when the orders array is genuinely empty */
function EmptyState() {
  return (
    <div className="glass-island rounded-2xl p-12 text-center col-span-2 flex flex-col items-center gap-4">
      <span className="material-symbols-outlined text-6xl text-on-surface-variant">receipt_long</span>
      <p className="text-on-surface text-xl font-semibold">No orders found</p>
      <p className="text-on-surface-variant text-sm max-w-xs">
        Your culinary adventures will appear here once you've placed your first order.
      </p>
    </div>
  );
}

/** Featured card for the most recent (index 0) order */
function FeaturedOrderCard({ order }: { order: Order }) {
  const statusStyles = getStatusColor(order.status);

  return (
    <div
      data-testid={`order-card-${order.order_id}`}
      className="lg:col-span-8 glass-island rounded-3xl p-6 md:p-12 flex flex-col md:flex-row gap-12 group hover:scale-[1.01] transition-all duration-500"
    >
      {/* Hero image */}
      <div className="w-full md:w-1/3 aspect-[4/3] rounded-2xl overflow-hidden relative shadow-2xl">
        <img
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuA-euvTo647H_MHRFCJHVXhoiNwM33hB2sSBuCKn_V4MsdNuz3yurqcROGPzk0IqOjy6YCHOa0bJbzmI3VDWYYTwWwk6GTFqrsyhvqD7WT2ASQVjIGQMQJwKWXSY0usOL2CHmrSEOz4FisK1o0l5xlwT-Inf9hDy574U92NPJtZOqNc_GSLXJNfpvdTo-FWDhSkOXHyV2Yil6WhCiSWxeQ2-8GXyOu7coDrSY4MJbTv1onDUwu_z5lQt36oqXigu36IpjUzMggQAuM"
          alt={`Food from ${order.restaurant_name}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-6 left-6">
          <span className="bg-primary/20 backdrop-blur-md text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-primary/30">
            Latest Experience
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-2">
            <div>
              <h2 className="text-3xl font-bold text-on-surface">{order.restaurant_name}</h2>
              <p className="text-on-surface-variant text-base flex items-center gap-1 mt-1">
                <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                {formatOrderDate(order.created_at, 'full')}
              </p>
            </div>
            {/* Status badge */}
            <span
              className={`flex items-center gap-1 px-4 py-2 rounded-full font-bold text-base border ${statusStyles.bg} ${statusStyles.text} ${statusStyles.border}`}
              aria-label={`Order status: ${order.status}`}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {order.status === 'DELIVERED' ? 'check_circle' : 'cancel'}
              </span>
              {order.status}
            </span>
          </div>

          {/* Item summary */}
          <div className="mt-6 space-y-3">
            {order.item_summary.split(',').map((item, idx) => (
              <div
                key={idx}
                className="flex justify-between text-base py-3 border-b border-white/5"
              >
                <span className="text-on-surface-variant">{item.trim()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 flex items-center justify-between">
          <div>
            <span className="text-on-surface-variant text-sm block">Total Investment</span>
            <span className="text-primary font-bold text-3xl">{formatCurrency(order.total_egp)}</span>
          </div>
          <div className="flex gap-3">
            <button
              className="px-8 py-4 rounded-xl text-on-surface font-bold hover:bg-surface-container-highest transition-colors border border-white/10"
              aria-label={`View details for order ${order.order_id}`}
            >
              View Details
            </button>
            <button
              className="px-8 py-4 rounded-xl bg-primary text-on-secondary font-bold shimmer-btn shadow-[0_0_20px_rgba(175,198,252,0.3)]"
              aria-label={`Reorder from ${order.restaurant_name}`}
            >
              Reorder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Standard compact card for the rest of the order history list */
function HistoryCard({ order }: { order: Order }) {
  const isCancelled = order.status.toUpperCase() === 'CANCELLED';
  const statusStyles = getStatusColor(order.status);

  return (
    <div
      data-testid={`order-card-${order.order_id}`}
      className={`glass-island rounded-2xl p-6 flex gap-6 items-center transition-all ${
        isCancelled ? 'opacity-70' : 'hover:bg-white/5'
      }`}
    >
      {/* Thumbnail */}
      <div
        className={`w-24 h-24 rounded-xl overflow-hidden shadow-lg shrink-0 ${
          isCancelled ? 'grayscale' : ''
        }`}
      >
        <img
          className="w-full h-full object-cover"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBoONheGMJPKQUR6AKxHG9qx-YlFACtNKm2jMwK6ky6ZbKamxeNBuscyxdi0wglOyNhsIjEemQpDxgYyMOMXP654MwpkLNztRbt-B5UoWUl6dZ-185ple6IHk3B7OU3qDf7ClJb0yW5J3C-DS9IO10h-dxu_XEpeOjs9vcL1IJvsI_y8pNmMbwZhhEcs7FTIRv78IpXb2tri-CIXcel9uoPvRkbioaUh59Bi7u4OtYLoP3AtoNQh3qXpLYleAXFuUpf6m00yPuTvP4"
          alt={`Food from ${order.restaurant_name}`}
        />
      </div>

      {/* Details */}
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <h4 className="font-bold text-lg text-on-surface">{order.restaurant_name}</h4>
          {isCancelled ? (
            <span
              className={`font-bold text-xs border px-1 py-0.5 rounded ${statusStyles.text} ${statusStyles.border}`}
              aria-label="Order status: CANCELLED"
            >
              CANCELLED
            </span>
          ) : (
            <span className="text-on-surface-variant text-xs font-bold uppercase tracking-widest">
              {formatOrderDate(order.created_at, 'short')}
            </span>
          )}
        </div>

        <p className="text-base text-on-surface-variant mt-1">{order.item_summary}</p>

        <div className="flex justify-between items-center mt-3">
          {isCancelled ? (
            <span className="font-bold text-on-surface-variant">
              $0.00{' '}
              <span className="text-[10px] font-normal line-through ml-1">
                {formatCurrency(order.total_egp)}
              </span>
            </span>
          ) : (
            <span className="font-bold text-primary">{formatCurrency(order.total_egp)}</span>
          )}

          <div className="flex gap-3 items-center">
            {isCancelled ? (
              <button
                className="text-primary text-xs font-bold uppercase tracking-widest hover:underline"
                aria-label={`Try ordering from ${order.restaurant_name} again`}
              >
                TRY AGAIN
              </button>
            ) : (
              <>
                <button
                  className="text-primary text-xs font-bold uppercase tracking-widest hover:underline"
                  aria-label={`Reorder from ${order.restaurant_name}`}
                >
                  REORDER
                </button>
                <span className="text-on-surface-variant" aria-hidden="true">•</span>
                <button
                  className="text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-on-surface"
                  aria-label={`View receipt for order ${order.order_id}`}
                >
                  RECEIPT
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Insights summary sidebar card */
function InsightsCard() {
  return (
    <div className="lg:col-span-4 glass-island rounded-3xl p-12 flex flex-col justify-between border-primary/20">
      <div>
        <h3 className="text-3xl font-bold text-on-surface mb-6">Insights</h3>
        <div className="space-y-12">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 rounded-xl bg-primary-container flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">restaurant</span>
            </div>
            <div>
              <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest">
                Favourite Cuisine
              </p>
              <p className="text-on-surface font-bold text-lg">Modern French</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 rounded-xl bg-secondary-container/20 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined">payments</span>
            </div>
            <div>
              <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest">
                Monthly Spend
              </p>
              <p className="text-on-surface font-bold text-lg">$2,480.00</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-12 pt-12 border-t border-white/10">
        <p className="text-on-surface-variant text-base mb-6 italic">
          &ldquo;Excellence is not a skill, it&rsquo;s an attitude.&rdquo;
        </p>
        <button
          className="w-full py-6 rounded-xl bg-white/5 border border-white/10 text-primary font-bold flex items-center justify-center gap-1 hover:bg-white/10 transition-all"
          aria-label="Download account statement"
        >
          <span className="material-symbols-outlined">download</span> Download Statement
        </button>
      </div>
    </div>
  );
}

/** Pagination bar — renders Prev / Next + page indicator */
interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function PaginationBar({ currentPage, totalPages, onPageChange }: PaginationBarProps) {
  // Always render — tests must be able to find "Next Page" via getByRole.
  // Buttons are disabled when at the boundary, not absent from the DOM.
  return (
    <nav
      className="flex items-center justify-center gap-4 py-4"
      aria-label="Order history pagination"
    >
      <button
        className="px-6 py-3 rounded-xl text-on-surface font-bold hover:bg-surface-container-highest transition-colors border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Previous Page"
      >
        ← Prev
      </button>

      <span className="text-on-surface-variant text-sm" aria-live="polite" aria-atomic="true">
        Page {currentPage} of {totalPages || 1}
      </span>

      <button
        className={`px-6 py-3 rounded-xl text-on-surface font-bold hover:bg-surface-container-highest transition-colors border border-white/10 ${
          currentPage >= totalPages ? 'opacity-40 cursor-not-allowed' : ''
        }`}
        onClick={() => {
          if (currentPage >= totalPages) return;
          onPageChange(currentPage + 1);
        }}
        aria-label="Next Page"
        aria-disabled={currentPage >= totalPages}
        disabled={currentPage >= totalPages}
      >
        Next →
      </button>
    </nav>
  );
}

// ----------------------------------------------------------------
// Top Navigation Bar
// ----------------------------------------------------------------
function TopNav() {
  return (
    <nav
      className="fixed top-0 w-full z-50 bg-surface/70 backdrop-blur-2xl border-b border-white/20 shadow-[0_20px_50px_rgba(1,31,75,0.08)]"
      aria-label="Main navigation"
    >
      <div className="flex justify-between items-center h-20 px-8 max-w-[1440px] mx-auto">
        <div className="font-bold text-xl tracking-tight text-primary">LuxeEats</div>

        <div className="hidden md:flex gap-12 items-center">
          {['Discover', 'Gourmet', 'Catering', 'Concierge'].map(link => (
            <a
              key={link}
              href="#"
              className="text-on-surface-variant hover:text-primary transition-all duration-300 text-base"
            >
              {link}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-6">
          <button
            className="material-symbols-outlined text-primary hover:scale-105 transition-transform duration-300 cursor-pointer"
            aria-label="Shopping bag"
            style={{ fontFamily: 'Material Symbols Outlined' } as React.CSSProperties}
          >
            shopping_bag
          </button>
          <button
            className="material-symbols-outlined text-primary hover:scale-105 transition-transform duration-300 cursor-pointer"
            aria-label="Notifications"
            style={{ fontFamily: 'Material Symbols Outlined' } as React.CSSProperties}
          >
            notifications
          </button>
          <div className="w-10 h-10 rounded-full border border-primary/20 p-1">
            <img
              className="w-full h-full rounded-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCmz79SsOTr_Ri5MkpFOyj7XfSlI3BcBawQ1bdz_ZI9my0Bb8Z3utCVvh9tH3DQdJ4N7Vrb9Pq3M2ZM2B-3DOqsQ8EX093i1_mv89CllkJYMsheh-G_uXkqMHrnI0MKFj1UFv6aXSDviNRTonZ3Y0dxbDqixvAAJA3vqdIwPmspczoylAIVjMubjTjtf9Wbv7UJ7psBlAFS9Y4Tl7V__SVniRkBqi50innutlQsw4R3U94Y_yNm0m3W3z4CRAuJUVtqFOxN6ptTTHM"
              alt="User profile avatar"
            />
          </div>
        </div>
      </div>
    </nav>
  );
}

// ----------------------------------------------------------------
// Bottom Mobile Navigation
// ----------------------------------------------------------------
function BottomNav() {
  const links = [
    { icon: 'home', label: 'Explore', active: false },
    { icon: 'search', label: 'Search', active: false },
    { icon: 'receipt_long', label: 'Orders', active: true },
    { icon: 'person', label: 'Profile', active: false },
  ];

  return (
    <nav
      className="fixed bottom-0 w-full z-50 rounded-t-xl bg-surface/80 backdrop-blur-xl border-t border-white/20 shadow-[0_-10px_30px_rgba(1,31,75,0.06)] md:hidden"
      aria-label="Mobile navigation"
    >
      <div className="flex justify-around items-center h-16 px-4">
        {links.map(({ icon, label, active }) => (
          <a
            key={label}
            href="#"
            className={`flex flex-col items-center justify-center transition-all duration-150 active:scale-95 ${
              active
                ? 'text-primary font-bold scale-110'
                : 'text-on-surface-variant opacity-70 hover:opacity-100'
            }`}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
          >
            <span
              className="material-symbols-outlined"
              style={
                active
                  ? ({ fontVariationSettings: "'FILL' 1" } as React.CSSProperties)
                  : undefined
              }
            >
              {icon}
            </span>
            <span className="text-[10px]">{label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}

// ----------------------------------------------------------------
// Main Page Component
// ----------------------------------------------------------------
const OrderHistory: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const { orders, pagination, loading, error } = useOrderHistory(currentPage);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  return (
    <>
      {/* Global styles injected at runtime so the page is self-contained */}
      <style>{`
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .glass-island {
          background: rgba(31, 31, 35, 0.6);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(175, 198, 252, 0.1);
          box-shadow: 0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -1px rgba(0,0,0,.06),
                      0 20px 50px rgba(1,31,75,.08);
        }
        .shimmer-btn {
          background: linear-gradient(90deg, #005a95, #afc6fc, #005a95);
          background-size: 200% 100%;
          transition: background-position 0.5s ease;
        }
        .shimmer-btn:hover { background-position: 100% 0; }
        body { background-color: #121316; color: #e3e2e6; }
      `}</style>

      <TopNav />

      <main
        className="pt-20 pb-12 px-8 max-w-[1440px] mx-auto min-h-screen"
        id="main-content"
      >
        {/* ── Page Header ── */}
        <header className="mt-12 mb-20 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <span className="text-primary text-xs font-bold uppercase tracking-[0.2em] mb-1 block">
              Concierge Portal
            </span>
            <h1 className="text-5xl font-bold text-on-surface tracking-tight">
              Your Culinary History
            </h1>
          </div>

          {/* Filter pills */}
          <div
            className="flex items-center gap-3 bg-surface-container-high/40 p-1 rounded-xl border border-white/5 backdrop-blur-md"
            role="group"
            aria-label="Order history filters"
          >
            {['Last 30 Days', '2024', '2023'].map(label => (
              <button
                key={label}
                className="px-6 py-3 rounded-lg text-on-surface-variant hover:bg-surface-container-highest transition-colors text-base first:bg-primary-container first:text-primary first:font-bold"
                aria-pressed={label === 'Last 30 Days'}
              >
                {label}
              </button>
            ))}
            <div className="w-px h-6 bg-white/10 mx-1" aria-hidden="true" />
            <button
              className="p-3 text-on-surface-variant hover:text-primary transition-colors"
              aria-label="More filters"
            >
              <span className="material-symbols-outlined">filter_list</span>
            </button>
          </div>
        </header>

        {/* ── Main Content Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* ── Error State ── */}
          {error && (
            <div className="lg:col-span-12">
              <ErrorBanner
                status={error.status}
                code={error.code}
                message={error.message}
              />
            </div>
          )}

          {/* ── Loading Skeletons ── */}
          {loading && !error && (
            <>
              <div className="lg:col-span-8">
                <SkeletonCard />
              </div>
              <div className="lg:col-span-4">
                <SkeletonCard />
              </div>
              <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-12">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            </>
          )}

          {/* ── Loaded & No Error ── */}
          {!loading && !error && (
            <>
              {orders.length === 0 ? (
                <div className="lg:col-span-12">
                  <EmptyState />
                </div>
              ) : (
                <>
                  {/* Featured Card — most recent order (index 0, sorted desc by API) */}
                  <FeaturedOrderCard order={orders[0]} />

                  {/* Insights Sidebar */}
                  <InsightsCard />

                  {/* Standard History Grid */}
                  <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-12">
                    {orders.slice(1).map(order => (
                      <HistoryCard key={order.order_id} order={order} />
                    ))}
                  </div>
                </>
              )}

              {/* Pagination — always rendered so getByRole('button',{name:/Next Page/}) succeeds */}
              <div className="lg:col-span-12">
                <PaginationBar
                  currentPage={currentPage}
                  totalPages={pagination?.total_pages ?? 1}
                  onPageChange={handlePageChange}
                />
              </div>
            </>
          )}
        </div>
      </main>

      <BottomNav />
    </>
  );
};

export default OrderHistory;
