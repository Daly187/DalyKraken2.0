import { Link } from 'react-router-dom';
import { TrendingUp, Shield, Zap, BarChart3 } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-white mb-4">
            Daly<span className="text-primary-500">Kraken</span> 2.0
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Professional Crypto Trading Dashboard with Automated DCA Strategy
          </p>
          <div className="flex justify-center gap-4">
            <Link to="/login" className="btn btn-primary btn-lg">
              Get Started
            </Link>
            <Link
              to="/login"
              className="btn btn-secondary btn-lg"
            >
              Learn More
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mt-16">
          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <TrendingUp className="h-12 w-12 text-primary-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Real-Time Data</h3>
            <p className="text-gray-400">
              Live market data from Kraken with WebSocket streaming
            </p>
          </div>

          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <BarChart3 className="h-12 w-12 text-green-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Portfolio Tracking</h3>
            <p className="text-gray-400">
              Monitor your holdings with real-time P&L calculations
            </p>
          </div>

          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <Zap className="h-12 w-12 text-yellow-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Automated DCA</h3>
            <p className="text-gray-400">
              Smart dollar-cost averaging strategy with bot scoring
            </p>
          </div>

          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <Shield className="h-12 w-12 text-blue-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Offline-First</h3>
            <p className="text-gray-400">
              Multi-layer fallback system for maximum reliability
            </p>
          </div>
        </div>

        {/* Architecture Highlights */}
        <div className="mt-16 card">
          <h2 className="text-3xl font-bold mb-6 text-center">
            Resilient Architecture
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-primary-400">
                WebSocket-First
              </h3>
              <p className="text-gray-400 text-sm">
                Primary real-time data flow via Socket.IO with automatic
                reconnection
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-primary-400">
                Multi-Tier Fallback
              </h3>
              <p className="text-gray-400 text-sm">
                Cache API → Snapshot Service → Legacy REST with localStorage
                backup
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-primary-400">
                Cross-Page Sharing
              </h3>
              <p className="text-gray-400 text-sm">
                Live price service eliminates duplicate WebSocket connections
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
