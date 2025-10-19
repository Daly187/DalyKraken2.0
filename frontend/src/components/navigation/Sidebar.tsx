import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import {
  LayoutDashboard,
  TrendingUp,
  Wallet,
  Bot,
  FileText,
  Settings,
  Activity,
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  User,
  LogOut,
  BarChart3,
  DollarSign,
} from 'lucide-react';

const mainNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Portfolio', href: '/portfolio', icon: Wallet },
];

const marketNavigation = [
  { name: 'Crypto Market', href: '/crypto-market', icon: TrendingUp },
  { name: 'Crypto Trends', href: '/crypto-trends', icon: Activity },
];

const strategiesNavigation = [
  { name: 'DalyDCA', href: '/daly-dca', icon: Bot },
  { name: 'DalyFunding', href: '/daly-funding', icon: DollarSign },
  { name: 'Manual Trade', href: '/manual-trade', icon: ArrowDownUp },
];

const insightNavigation = [
  { name: 'Audit Log', href: '/audit-log', icon: FileText },
  { name: 'Stats', href: '/stats', icon: BarChart3 },
];

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const user = useStore((state) => state.user);
  const logout = useStore((state) => state.logout);

  const NavSection = ({ title, items }: { title: string; items: typeof mainNavigation }) => (
    <div className="mb-4">
      {!isCollapsed && (
        <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          {title}
        </h3>
      )}
      {items.map((item) => (
        <NavLink
          key={item.name}
          to={item.href}
          className={({ isActive }) =>
            `flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-primary-900 text-primary-200 border-r-4 border-primary-500'
                : 'text-gray-300 hover:bg-slate-700 hover:text-white'
            }`
          }
          title={isCollapsed ? item.name : undefined}
        >
          <item.icon className={`h-5 w-5 ${isCollapsed ? '' : 'mr-3'}`} />
          {!isCollapsed && item.name}
        </NavLink>
      ))}
    </div>
  );

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-64'} bg-slate-800 border-r border-slate-700 transition-all duration-300`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} h-16 px-4 border-b border-slate-700`}>
          {!isCollapsed && (
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-primary-500">DalyKraken</h1>
              <span className="ml-2 text-xs bg-primary-900 text-primary-200 px-2 py-1 rounded">
                v2.0
              </span>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-slate-700 transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <NavSection title="" items={mainNavigation} />
          <NavSection title="Market" items={marketNavigation} />
          <NavSection title="Strategies" items={strategiesNavigation} />
          <NavSection title="Insight" items={insightNavigation} />
        </nav>

        {/* Bottom Section: User & Settings */}
        <div className="border-t border-slate-700">
          {/* Status */}
          <div className={`p-4 ${isCollapsed ? 'px-2' : 'px-4'}`}>
            <div className={`text-xs text-gray-400 ${isCollapsed ? 'flex justify-center' : ''}`}>
              <div className={`flex items-center ${isCollapsed ? 'flex-col gap-1' : 'justify-between mb-1'}`}>
                {!isCollapsed && <span>Status:</span>}
                <span className="inline-flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                  {!isCollapsed && 'Connected'}
                </span>
              </div>
            </div>
          </div>

          {/* User Menu */}
          <div className="relative border-t border-slate-700">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3 text-sm font-medium text-gray-300 hover:bg-slate-700 hover:text-white transition-colors`}
              title={isCollapsed ? user?.username : undefined}
            >
              <User className={`h-5 w-5 ${isCollapsed ? '' : 'mr-3'}`} />
              {!isCollapsed && <span>{user?.username}</span>}
            </button>

            {showUserMenu && (
              <div className={`absolute ${isCollapsed ? 'left-full ml-2 bottom-0' : 'left-0 bottom-full mb-1'} w-48 bg-slate-800 rounded-lg shadow-lg border border-slate-700 py-1 z-50`}>
                <button
                  onClick={() => {
                    logout();
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-slate-700"
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  Logout
                </button>
              </div>
            )}
          </div>

          {/* Settings */}
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3 text-sm font-medium transition-colors border-t border-slate-700 ${
                isActive
                  ? 'bg-primary-900 text-primary-200 border-r-4 border-primary-500'
                  : 'text-gray-300 hover:bg-slate-700 hover:text-white'
              }`
            }
            title={isCollapsed ? 'Settings' : undefined}
          >
            <Settings className={`h-5 w-5 ${isCollapsed ? '' : 'mr-3'}`} />
            {!isCollapsed && 'Settings'}
          </NavLink>
        </div>
      </div>
    </div>
  );
}
