import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { useEffect } from 'react';

// Layout components
import ProtectedLayout from '@/components/layouts/ProtectedLayout';
import PublicLayout from '@/components/layouts/PublicLayout';

// Pages
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import CryptoMarket from '@/pages/CryptoMarket';
import CryptoTrends from '@/pages/CryptoTrends';
import Portfolio from '@/pages/Portfolio';
import DalyDCA from '@/pages/DalyDCA';
import ManualTrade from '@/pages/ManualTrade';
import AuditLog from '@/pages/AuditLog';
import Settings from '@/pages/Settings';

function App() {
  const isAuthenticated = useStore((state) => state.isAuthenticated);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route
            path="/login"
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
            }
          />
        </Route>

        {/* Protected routes */}
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/crypto-market" element={<CryptoMarket />} />
          <Route path="/crypto-trends" element={<CryptoTrends />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/daly-dca" element={<DalyDCA />} />
          <Route path="/manual-trade" element={<ManualTrade />} />
          <Route path="/audit-log" element={<AuditLog />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
