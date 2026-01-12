import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { useEffect } from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext';

// Layout components
import ProtectedLayout from '@/components/layouts/ProtectedLayout';
import PublicLayout from '@/components/layouts/PublicLayout';

// Pages
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import TOTPSetup from '@/pages/TOTPSetup';
import Dashboard from '@/pages/Dashboard';
import CryptoMarket from '@/pages/CryptoMarket';
import CryptoTrends from '@/pages/CryptoTrends';
import Portfolio from '@/pages/Portfolio';
import KrakenPortfolio from '@/pages/KrakenPortfolio';
import DalyDCA from '@/pages/DalyDCA';
import DalyDEPEG from '@/pages/DalyDEPEG';
import DalyTracker from '@/pages/DalyTracker';
import DalyFunding from '@/pages/DalyFunding';
import ManualTrade from '@/pages/ManualTrade';
import AuditLog from '@/pages/AuditLog';
import Stats from '@/pages/Stats';
import Settings from '@/pages/Settings';
import News from '@/pages/News';
import Gambling from '@/pages/Gambling';

function App() {
  const isAuthenticated = useStore((state) => state.isAuthenticated);

  return (
    <ThemeProvider>
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
            <Route path="/totp-setup" element={<TOTPSetup />} />
          </Route>

          {/* Protected routes */}
          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/crypto-market" element={<CryptoMarket />} />
            <Route path="/crypto-trends" element={<CryptoTrends />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/kraken-portfolio" element={<KrakenPortfolio />} />
            <Route path="/daly-dca" element={<DalyDCA />} />
            <Route path="/daly-depeg" element={<DalyDEPEG />} />
            <Route path="/daly-tracker" element={<DalyTracker />} />
            <Route path="/daly-funding" element={<DalyFunding />} />
            <Route path="/manual-trade" element={<ManualTrade />} />
            <Route path="/audit-log" element={<AuditLog />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/news" element={<News />} />
            <Route path="/gambling" element={<Gambling />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
