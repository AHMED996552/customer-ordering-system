import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/AuthContext";
import { CartProvider } from "./context/CartContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyOTPPage from "./pages/VerifyOTPPage";
import HomePage from "./pages/HomePage";
import MenuPage from "./pages/MenuPage";

const RootRedirect: React.FC = () => {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? "/home" : "/register"} replace />;
};

const DashboardPage: React.FC = () => {
  const { user, isAuthenticated, clearUser } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col items-center justify-center p-6">
      <div className="glass-island max-w-lg w-full rounded-[32px] p-8 text-center space-y-6 border border-primary/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20 shadow-inner">
          <span className="material-symbols-outlined text-primary text-4xl">restaurant_menu</span>
        </div>
        <div>
          <h2 className="font-headline-md text-2xl font-bold text-on-surface">Welcome to LuxeEats</h2>
          <p className="text-sm text-on-surface-variant mt-1">Your premium culinary access dashboard</p>
        </div>
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10 space-y-2 text-left">
          <p className="text-[10px] font-bold tracking-widest text-primary uppercase">Customer Profile</p>
          <h3 className="text-lg font-semibold text-on-surface">{user?.full_name}</h3>
          <p className="text-sm text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-base">mail</span> {user?.email}
          </p>
        </div>
        <div className="pt-2">
          <button
            onClick={clearUser}
            className="w-full shimmer-btn py-4 rounded-xl font-semibold tracking-widest shadow-glow hover:shadow-glow-lg text-[11px] flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            SIGN OUT
          </button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <div className="fixed top-1/4 -left-20 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none z-0"></div>
          <div className="fixed bottom-1/4 -right-20 w-96 h-96 bg-secondary-container/10 rounded-full blur-[120px] pointer-events-none z-0"></div>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-otp" element={<VerifyOTPPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="*" element={<Navigate to="/register" replace />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
