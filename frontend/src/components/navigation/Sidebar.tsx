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
  ChevronDown,
  ChevronUp,
  User,
  LogOut,
  BarChart3,
  DollarSign,
  AlertTriangle,
  Users,
  Newspaper,
  Dice5,
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
  { name: 'DalyDEPEG', href: '/daly-depeg', icon: AlertTriangle },
  { name: 'DalyTracker', href: '/daly-tracker', icon: Users },
  { name: 'DalyFunding', href: '/daly-funding', icon: DollarSign },
  { name: 'Manual Trade', href: '/manual-trade', icon: ArrowDownUp },
];

const insightNavigation = [
  { name: 'Audit Log', href: '/audit-log', icon: FileText },
  { name: 'Stats', href: '/stats', icon: BarChart3 },
];

const newsNavigation = [
  { name: 'News & Updates', href: '/news', icon: Newspaper },
];

const gamblingNavigation = [
  { name: 'Gambling', href: '/gambling', icon: Dice5 },
  { name: 'Wallet Tracker', href: '/gambling/tracker', icon: Users },
];

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const user = useStore((state) => state.user);
  const logout = useStore((state) => state.logout);

  const toggleSection = (title: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  const NavSection = ({ title, items }: { title: string; items: typeof mainNavigation }) => {
    const isSectionCollapsed = collapsedSections[title];
    const hasTitle = title !== '';

    return (
      <div className="mb-2">
        {!isCollapsed && hasTitle && (
          <button
            onClick={() => toggleSection(title)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wider hover:text-slate-600 dark:hover:text-gray-300 transition-colors"
          >
            <span>{title}</span>
            {isSectionCollapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </button>
        )}
        {(!hasTitle || !isSectionCollapsed) && items.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              `flex items-center ${isCollapsed ? 'justify-center px-2 mx-2' : 'px-4 mx-2'} py-2.5 text-sm font-medium transition-all rounded-lg ${
                isActive
                  ? 'bg-primary-50 dark:bg-primary-900 text-primary-600 dark:text-primary-200 shadow-sm'
                  : 'text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
              }`
            }
            title={isCollapsed ? item.name : undefined}
          >
            <item.icon className={`h-5 w-5 ${isCollapsed ? '' : 'mr-3'} ${''}`} />
            {!isCollapsed && item.name}
          </NavLink>
        ))}
      </div>
    );
  };

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-64'} bg-white dark:bg-slate-800 border-r border-gray-100 dark:border-slate-700 transition-all duration-300 shadow-sm`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} h-16 px-4 border-b border-gray-100 dark:border-slate-700`}>
          {!isCollapsed && (
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-primary-600">DalyKraken</h1>
              <span className="ml-2 text-xs bg-primary-50 dark:bg-primary-900 text-primary-600 dark:text-primary-200 px-2 py-1 rounded-full font-medium">
                v2.0
              </span>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-slate-400 dark:text-gray-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
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
          <NavSection title="News" items={newsNavigation} />
          <NavSection title="Gambling" items={gamblingNavigation} />
        </nav>

        {/* Bottom Section: User & Settings */}
        <div className="border-t border-gray-100 dark:border-slate-700">
          {/* Status */}
          <div className={`p-4 ${isCollapsed ? 'px-2' : 'px-4'}`}>
            <div className={`text-xs text-slate-400 dark:text-gray-400 ${isCollapsed ? 'flex justify-center' : ''}`}>
              <div className={`flex items-center ${isCollapsed ? 'flex-col gap-1' : 'justify-between mb-1'}`}>
                {!isCollapsed && <span>Status:</span>}
                <span className="inline-flex items-center">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full mr-1 animate-pulse"></span>
                  {!isCollapsed && 'Connected'}
                </span>
              </div>
            </div>
          </div>

          {/* User Menu */}
          <div className="relative border-t border-gray-100 dark:border-slate-700">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3 text-sm font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors`}
              title={isCollapsed ? user?.username : undefined}
            >
              <User className={`h-5 w-5 ${isCollapsed ? '' : 'mr-3'}`} />
              {!isCollapsed && <span>{user?.username}</span>}
            </button>

            {showUserMenu && (
              <div className={`absolute ${isCollapsed ? 'left-full ml-2 bottom-0' : 'left-0 bottom-full mb-1'} w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-100 dark:border-slate-700 py-1 z-50`}>
                <button
                  onClick={() => {
                    logout();
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center px-4 py-2 text-sm text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-700"
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
              `flex items-center ${isCollapsed ? 'justify-center px-2 mx-2' : 'px-4 mx-2'} py-2.5 mb-2 text-sm font-medium transition-all rounded-lg border-t-0 ${
                isActive
                  ? 'bg-primary-50 dark:bg-primary-900 text-primary-600 dark:text-primary-200 shadow-sm'
                  : 'text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
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
