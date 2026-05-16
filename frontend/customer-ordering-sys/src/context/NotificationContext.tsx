import React, { createContext, useContext, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationContextValue {
  notify: (message: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notification, setNotification] = useState<string | null>(null);

  const notify = useCallback((message: string) => {
    setNotification(message);
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  }, []);

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      {notification && (
        <div 
          className="fixed bottom-8 right-8 z-[9999] animate-in" 
          role="alert"
        >
          <div className="glass-island px-lg py-md rounded-xl bg-surface-container-high border-l-4 border-primary flex items-center gap-md shadow-2xl min-w-[300px]">
            <span className="text-2xl">🔔</span>
            <span className="font-bold text-primary">{notification}</span>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    // Return NOOP for tests
    return { notify: () => {} };
  }
  return ctx;
}
