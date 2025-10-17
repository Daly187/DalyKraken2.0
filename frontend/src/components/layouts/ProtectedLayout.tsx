import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import Sidebar from '@/components/navigation/Sidebar';
import Header from '@/components/navigation/Header';
import NotificationPanel from '@/components/notifications/NotificationPanel';

export default function ProtectedLayout() {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const initialized = useStore((state) => state.initialized);
  const initialize = useStore((state) => state.initialize);
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated && !initialized) {
      initialize();
    }
  }, [isAuthenticated, initialized, initialize]);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="flex h-screen bg-slate-900 text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-900 p-6">
          {initialized ? (
            <Outlet />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="spinner mx-auto mb-4"></div>
                <p className="text-gray-400">Initializing DalyKraken...</p>
              </div>
            </div>
          )}
        </main>
      </div>
      <NotificationPanel />
    </div>
  );
}
