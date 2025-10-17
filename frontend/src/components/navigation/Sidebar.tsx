import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Wallet,
  Bot,
  ScanSearch,
  FileText,
  Settings,
  BarChart3,
  Activity,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Crypto Market', href: '/crypto-market', icon: TrendingUp },
  { name: 'Crypto Trends', href: '/crypto-trends', icon: Activity },
  { name: 'Portfolio', href: '/portfolio', icon: Wallet },
  { name: 'DalyDCA', href: '/daly-dca', icon: Bot },
  { name: 'Scanner', href: '/scanner', icon: ScanSearch },
  { name: 'Audit Log', href: '/audit-log', icon: FileText },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  return (
    <div className="w-64 bg-slate-800 border-r border-slate-700">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-center h-16 px-4 border-b border-slate-700">
          <h1 className="text-2xl font-bold text-primary-500">DalyKraken</h1>
          <span className="ml-2 text-xs bg-primary-900 text-primary-200 px-2 py-1 rounded">
            v2.0
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `flex items-center px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-900 text-primary-200 border-r-4 border-primary-500'
                    : 'text-gray-300 hover:bg-slate-700 hover:text-white'
                }`
              }
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="text-xs text-gray-400">
            <div className="flex items-center justify-between mb-1">
              <span>Status:</span>
              <span className="inline-flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                Connected
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
