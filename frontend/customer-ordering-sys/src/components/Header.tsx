import React from 'react';
import { ShoppingCart, BellRing } from 'lucide-react';
import { Link } from 'react-router-dom';

const Header: React.FC = () => {
  return (
    <header className="glass-island sticky top-4 z-50 flex justify-between items-center layout-container rounded-full mt-4 mx-auto w-[95%] px-lg py-3">
      <div className="flex items-center gap-md">
        <Link to="/" className="no-underline">
          <span className="text-2xl font-bold text-primary tracking-tighter">
            LuxeEats
          </span>
        </Link>
      </div>
      
      <nav className="hidden md:flex gap-lg">
        <a className="text-on-surface-variant font-medium hover:text-primary transition-colors no-underline text-sm" href="/">Explore</a>
        <a className="text-on-surface-variant font-medium hover:text-primary transition-colors no-underline text-sm" href="/">Restaurants</a>
        <a className="text-on-surface-variant font-medium hover:text-primary transition-colors no-underline text-sm" href="/">Connoisseur</a>
      </nav>

      <div className="flex items-center gap-md">
        <div className="flex gap-md">
          <Link to="/cart" className="text-on-surface-variant hover:text-primary transition-colors">
            <ShoppingCart size={20} />
          </Link>
          <button className="text-on-surface-variant hover:text-primary transition-colors bg-transparent border-none p-0 cursor-pointer">
            <BellRing size={20} />
          </button>
        </div>
        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/20 hover:border-primary transition-all cursor-pointer shadow-lg active:scale-95">
          <img 
            src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100&h=100" 
            alt="User" 
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
