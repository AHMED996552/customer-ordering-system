import React from 'react';
import { ShoppingCart, BellRing } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="sticky top-base z-50 flex justify-between items-center px-lg py-sm bg-surface-container/60 backdrop-blur-md rounded-full mt-md mx-auto w-[95%] max-w-container-max border border-on-surface-variant/20 shadow-2xl">
      <div className="flex items-center gap-md">
        <span className="font-display-xl text-headline-md tracking-tighter text-primary dark:text-primary-fixed-dim">
          LuxeEats
        </span>
      </div>
      <nav className="hidden md:flex gap-lg">
        <a
          className="text-on-surface-variant font-medium hover:text-primary transition-all duration-300 font-body-md text-body-md"
          href="/"
        >
          Explore
        </a>
        <a
          className="text-on-surface-variant font-medium hover:text-primary transition-all duration-300 font-body-md text-body-md"
          href="/"
        >
          Restaurants
        </a>
        <a
          className="text-on-surface-variant font-medium hover:text-primary transition-all duration-300 font-body-md text-body-md"
          href="/"
        >
          Connoisseur Club
        </a>
      </nav>
      <div className="flex items-center gap-md">
        <div className="flex gap-sm">
          <span className="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer transition-colors duration-200">
            <ShoppingCart />
          </span>
          <span className="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer transition-colors duration-200">
            <BellRing />
          </span>
        </div>
        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/20 hover:border-primary transition-all duration-300 cursor-pointer shadow-lg active:scale-95">
          <img 
            src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100&h=100" 
            alt="User Profile" 
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
