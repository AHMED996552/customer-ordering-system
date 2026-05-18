import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RegisterPage from './pages/RegisterPage';
import VerifyOTPPage from './pages/VerifyOTPPage';
import { ShoppingBag } from 'lucide-react';

const DashboardPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col items-center justify-center p-md">
      <div className="glass-island max-w-lg w-full rounded-[32px] p-xl text-center space-y-md border border-primary/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20">
          <span className="material-symbols-outlined text-primary text-3xl"><ShoppingBag /></span>
        </div>
        <h2 className="font-headline-md text-headline-md text-on-surface">Welcome to LuxeEats</h2>
        <p className="font-body-md text-on-surface-variant">
          Your private culinary access is successfully activated. Explore exclusive gastronomy, custom private chefs, and hidden dining gems.
        </p>
        <div className="pt-md">
          <button className="shimmer-btn px-6 py-3 rounded-xl text-on-primary font-bold shadow-[0_8px_30px_rgba(175,198,252,0.3)] transition-all">
            Explore Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

const LoginPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col items-center justify-center p-md">
      <div className="glass-island max-w-lg w-full rounded-[32px] p-xl text-center space-y-md border border-primary/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20">
          <span className="material-symbols-outlined text-primary text-3xl">lock</span>
        </div>
        <h2 className="font-headline-md text-headline-md text-on-surface">Login to LuxeEats</h2>
        <p className="font-body-md text-on-surface-variant">
          Please enter your registered credentials to access your luxury dining concierge.
        </p>
        <div className="pt-md">
          <a
            href="/register"
            className="text-primary font-bold hover:underline underline-offset-4"
          >
            Don't have an account? Sign Up
          </a>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      {/* Decorative Orbs */}
      <div className="fixed top-1/4 -left-20 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="fixed bottom-1/4 -right-20 w-96 h-96 bg-secondary-container/10 rounded-full blur-[120px] pointer-events-none z-0"></div>

      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-otp" element={<VerifyOTPPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/login" element={<LoginPage />} />
        {/* Fallback to register */}
        <Route path="*" element={<Navigate to="/register" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
