import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import Sidebar from '@/components/navigation/Sidebar';
import Header from '@/components/navigation/Header';
import NotificationPanel from '@/components/notifications/NotificationPanel';

export default function ProtectedLayout() {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const initialized = useStore((state) => state.initialized);
  const initialize = useStore((state) => state.initialize);
  const checkAuth = useStore((state) => state.checkAuth);
  const location = useLocation();
  const [authChecking, setAuthChecking] = useState(true);

  // Check JWT token on mount
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const hasValidToken = await checkAuth();
        if (hasValidToken && !initialized) {
          await initialize();
        }
      } catch (error) {
        console.error('[ProtectedLayout] Auth check failed:', error);
      } finally {
        setAuthChecking(false);
      }
    };

    verifyAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated && !initialized && !authChecking) {
      initialize();
    }
  }, [isAuthenticated, initialized, initialize, authChecking]);

  // Show loading while checking auth
  if (authChecking) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-slate-500 dark:text-gray-400">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white transition-colors duration-200">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 dark:bg-slate-900 p-6">
          {initialized ? (
            <Outlet />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="spinner mx-auto mb-4"></div>
                <p className="text-slate-500 dark:text-gray-400">Initializing DalyKraken...</p>
              </div>
            </div>
          )}
        </main>
      </div>
      <NotificationPanel />
    </div>
  );
}
