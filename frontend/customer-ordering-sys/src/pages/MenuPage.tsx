import React from 'react';
import { useParams } from 'react-router-dom';

interface Restaurant {
  restaurant_id: string;
  name: string;
  is_open: boolean;
}

interface MenuItem {
  item_id: string;
  name: string;
  description: string;
  price_egp: number;
  available: boolean;
}

interface MenuCategory {
  category: string;
  items: MenuItem[];
}

interface MenuData {
  restaurant: Restaurant;
  menu: MenuCategory[];
  server_utc_time_at_request: string;
}

interface ApiError {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

const normalizeApiError = (err: unknown): ApiError => {
  if (
    err &&
    typeof err === 'object' &&
    'error' in err &&
    typeof (err as any).error === 'object' &&
    (err as any).error !== null
  ) {
    return err as ApiError;
  }

  return {
    error: {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred.',
    },
  };
};

interface MenuPageProps {
  restaurantId?: string;
}

const MenuPage: React.FC<MenuPageProps> = ({ restaurantId: propRestaurantId }) => {
  const { id } = useParams<{ id: string }>();
  const restaurantId = propRestaurantId || id;
  const [data, setData] = React.useState<MenuData | null>(null);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    if (!restaurantId) return;
    fetch(`/api/v1/restaurants/${restaurantId}/menu`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw json;
        setData(json);
      })
      .catch((err: unknown) => setError(normalizeApiError(err)))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  if (loading) return <div role="status">Loading...</div>;
  if (error) {
    if (error.error?.code === 'RESTAURANT_CLOSED') {
      return <div role="alert">{error.error.message}</div>;
    }
    if (error.error?.code === 'RESTAURANT_NOT_FOUND') {
      return <div role="alert">Restaurant Not Found</div>;
    }
    return <div role="alert">An error occurred</div>;
  }

  if (!data) return null;

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-surface/70 dark:bg-surface-dim/70 backdrop-blur-2xl saturate-[180%] border-b border-white/20 dark:border-outline-variant/10 shadow-[0_20px_50px_rgba(1,31,75,0.08)]">
        <div className="flex justify-between items-center h-20 px-gutter max-w-container-max mx-auto">
          <div className="flex justify-between items-center h-20 px-gutter w-full">
            <div className="flex items-center gap-xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary-container text-xl">restaurant_menu</span>
                </div>
                <span className="text-xl font-bold tracking-tight text-on-surface">Luxe<span className="text-primary">Eats</span></span>
              </div>
              <nav className="hidden md:flex gap-md">
                <a className="font-body-md text-primary font-bold border-b-2 border-primary transition-all duration-300" href="/">Explore</a>
                <a className="font-body-md text-on-surface-variant hover:text-primary transition-all duration-300" href="/restaurants">Restaurants</a>
                <a className="font-body-md text-on-surface-variant hover:text-primary transition-all duration-300" href="/club">Connoisseur Club</a>
              </nav>
            </div>
            <div className="flex items-center gap-md">
              <div className="hidden lg:flex items-center bg-surface-container-high px-sm py-xs rounded-full border border-outline-variant/20 group focus-within:border-primary/50 transition-all">
                <span className="material-symbols-outlined text-outline text-sm">search</span>
                <input className="bg-transparent border-none focus:ring-0 text-body-md px-xs w-48 text-on-surface placeholder:text-outline-variant" placeholder="Search restaurants..." type="text" />
              </div>
              <div className="flex items-center gap-sm">
                <button className="p-2 hover:bg-surface-container-high rounded-full transition-colors relative">
                  <span className="material-symbols-outlined text-on-surface-variant">shopping_bag</span>
                  <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full border-2 border-surface"></span>
                </button>
                <button className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
                  <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
                </button>
                <button className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
                  <span className="material-symbols-outlined text-on-surface-variant">account_circle</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="pt-20">
        <section className="relative h-[60vh] min-h-[500px] w-full overflow-hidden">
          <img className="absolute inset-0 w-full h-full object-cover" alt="Hero background" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCvL0uzCa7zlsRkGs7c3YKqZkJnLioWDbDCgHf5z4kI1lUt058WeOT1XJkIG_0KW4yxj3JQ7FELWZddjQ7G-EQXb7HEY4mZr-LLmASkFgtoWYtLvlhs7FAzcE4tbTeBOw2Kisdxy2L8yIEEQlgZUKvm8zDw4VTErI_tPd1mVudADKQVPt4Vo5xefRxlNDzxgLopbnYG3H9fNBbkYEuxiR8K5cn-oaVHSWxrZUrs_0TEkTIingrCl5VIm0UypR1IjO7T737ECs4ESY4" />
          <div className="absolute inset-0 hero-gradient"></div>
          <div className="absolute inset-0 flex flex-col justify-end px-gutter pb-xl max-w-container-max mx-auto">
            <div className="flex items-center gap-xs mb-sm">
              <span className="bg-primary/20 text-primary px-sm py-xs rounded-full font-label-caps text-label-caps border border-primary/30 backdrop-blur-md">MICHELIN STARRED</span>
            </div>
            <h1 className="font-display-xl text-display-xl text-on-surface mb-xs">{data.restaurant.name} Menu</h1>
            <div className="flex flex-wrap items-center gap-md text-on-surface-variant">
              <div className="flex items-center gap-xs">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: '"FILL" 1' }}>star</span>
                <span className="font-bold text-on-surface">4.9</span>
                <span>(1.2k+ Reviews)</span>
              </div>
              <div className="flex items-center gap-xs">
                <span className="material-symbols-outlined">schedule</span>
                <span>35 - 50 min</span>
              </div>
              <div className="flex items-center gap-xs">
                <span className="material-symbols-outlined">payments</span>
                <span>Premium Delivery</span>
              </div>
            </div>
            <p className="mt-md max-w-2xl font-body-lg text-body-lg text-on-surface-variant/80">
              An avant-garde sanctuary of culinary art where traditional techniques meet futuristic flavor profiles. Experience the depths of epicurean mastery curated for the most discerning palates.
            </p>
          </div>
        </section>

        <div className="sticky top-20 z-40 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10">
          <div className="max-w-container-max mx-auto px-gutter py-md">
            <div className="flex items-center gap-lg overflow-x-auto no-scrollbar">
              {data.menu.map((section, idx) => (
                <button key={`nav-${section.category}`} className={`whitespace-nowrap font-label-caps text-label-caps pb-xs px-xs transition-colors ${idx === 0 ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-primary'}`}>
                  {section.category.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-container-max mx-auto px-gutter py-xl flex flex-col gap-xl">
          {data.menu.map((section) => (
            <section key={section.category} aria-labelledby={`category-${section.category}`}>
              <h2 id={`category-${section.category}`} className="font-headline-md text-headline-md text-on-surface mb-md">{section.category}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                {section.items.map((item) => (
                  <article key={item.item_id} aria-label={item.name} className={`glass-card rounded-xl overflow-hidden group transition-all duration-300 shadow-[0_24px_48px_rgba(1,31,75,0.12)] ${item.available ? 'cursor-pointer hover:scale-[1.02]' : 'opacity-50 grayscale'}`}>
                    <div className="relative h-64 overflow-hidden">
                      <img className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={item.name} src="https://lh3.googleusercontent.com/aida-public/AB6AXuBuqAEMBaXSPHwFRUGh5dDEiiujM9eSgGLU9w35tQ5A2Z62tPncW3A_7THDczXnZ_6ubNI6giQ5gWreJhvgbdFonje1A3sttPQM5Y0ttiSfWyLnmhuRMOfKN3Q_hejrHmdUoPfPs9NUB5w8Di-2lDXg0PffRqD64rMOOMkQjGT74uJ6to_t87MaIo-hMqg4hGbYFTY5-QwliSZrY795gxn-sH4RZfSe-WHBzhTDfcRj8ildj4iZZ_DHnNrJLpizqVzJzFnGoxZ5-5o" />
                      <div className="absolute top-sm right-sm">
                        {item.available ? (
                          <button 
                            aria-label="Add to Cart"
                            onClick={() => fetch('/api/v1/cart/items', { method: 'POST' })}
                            className="w-10 h-10 rounded-full bg-primary text-primary-container flex items-center justify-center shadow-lg hover:scale-110 transition-transform active:scale-95"
                          >
                            <span className="material-symbols-outlined">add</span>
                          </button>
                        ) : (
                          <button 
                            aria-disabled="true" 
                            disabled
                            aria-label="Add to Cart"
                            className="w-10 h-10 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center shadow-lg cursor-not-allowed"
                          >
                            <span className="material-symbols-outlined">block</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="p-md">
                      <div className="flex justify-between items-start mb-xs">
                        <h3 className="font-headline-md text-body-lg font-bold text-on-surface">{item.name}</h3>
                        <span className="text-primary font-bold font-body-md">{item.price_egp} EGP</span>
                      </div>
                      <p className="text-on-surface-variant text-body-md line-clamp-2">
                        {item.description.length > 200 ? item.description.slice(0, 200) + '...' : item.description}
                      </p>
                      <div className="mt-md flex items-center gap-xs">
                        {!item.available && (
                          <span className="bg-error/20 px-xs py-[2px] rounded text-[10px] font-label-caps text-error border border-error/30">UNAVAILABLE</span>
                        )}
                        <span className="bg-surface-container-high px-xs py-[2px] rounded text-[10px] font-label-caps text-on-tertiary-container border border-outline-variant/10">SIGNATURE</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <nav className="fixed bottom-0 w-full z-50 rounded-t-xl bg-surface/80 dark:bg-surface-dim/80 backdrop-blur-xl border-t border-white/20 dark:border-outline-variant/10 shadow-[0_-10px_30px_rgba(1,31,75,0.06)] flex justify-around items-center h-16 px-4 md:hidden">
        <button className="text-on-surface-variant dark:text-surface-variant flex flex-col items-center justify-center opacity-70 active:scale-95 transition-transform duration-150">
          <span className="material-symbols-outlined">home</span>
          <span className="font-label-caps text-[10px]">Explore</span>
        </button>
        <button className="text-primary dark:text-primary-fixed-dim font-bold flex flex-col items-center justify-center scale-110 active:scale-95 transition-transform duration-150">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: '"FILL" 1' }}>restaurant</span>
          <span className="font-label-caps text-[10px]">Menu</span>
        </button>
        <button className="text-on-surface-variant dark:text-surface-variant flex flex-col items-center justify-center opacity-70 active:scale-95 transition-transform duration-150">
          <span className="material-symbols-outlined">receipt_long</span>
          <span className="font-label-caps text-[10px]">Orders</span>
        </button>
        <button className="text-on-surface-variant dark:text-surface-variant flex flex-col items-center justify-center opacity-70 active:scale-95 transition-transform duration-150">
          <span className="material-symbols-outlined">person</span>
          <span className="font-label-caps text-[10px]">Profile</span>
        </button>
      </nav>

      <button className="md:hidden fixed bottom-20 right-md w-14 h-14 rounded-full bg-primary text-primary-container flex items-center justify-center shadow-xl z-50">
        <span className="material-symbols-outlined">shopping_cart</span>
      </button>
    </>
  );
};

export default MenuPage;
