import { useStore } from '@/store/useStore';
import { CheckCircle, AlertCircle, Info, AlertTriangle, Trash2, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useEffect, useRef } from 'react';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
  const notifications = useStore((state) => state.notifications);
  const markNotificationRead = useStore((state) => state.markNotificationRead);
  const clearNotifications = useStore((state) => state.clearNotifications);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadNotifications = notifications.filter((n) => !n.read);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const markAllAsRead = () => {
    unreadNotifications.forEach((notification) => {
      markNotificationRead(notification.id);
    });
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 mt-2 w-96 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-[32rem] overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-white">
          Notifications
          {unreadNotifications.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
              {unreadNotifications.length}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {unreadNotifications.length > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              title="Mark all as read"
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={clearNotifications}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
              title="Clear all notifications"
            >
              <Trash2 className="h-3 w-3" />
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="overflow-y-auto flex-1">
        {unreadNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <CheckCircle className="h-12 w-12 text-gray-600 mb-3" />
            <p className="text-sm text-gray-400">No unread notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {unreadNotifications.map((notification) => (
              <div
                key={notification.id}
                className="p-4 hover:bg-slate-700/50 transition-colors cursor-pointer"
                onClick={() => markNotificationRead(notification.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">{getIcon(notification.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-medium text-white">{notification.title}</h4>
                      <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                    </div>
                    <p className="mt-1 text-xs text-gray-400 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="mt-1 text-[10px] text-gray-500">
                      {formatDistanceToNow(new Date(notification.timestamp), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
