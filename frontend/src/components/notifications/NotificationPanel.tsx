import { useStore } from '@/store/useStore';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationPanel() {
  const notifications = useStore((state) => state.notifications);
  const markNotificationRead = useStore((state) => state.markNotificationRead);

  const unreadNotifications = notifications.filter((n) => !n.read).slice(0, 3);

  if (unreadNotifications.length === 0) {
    return null;
  }

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

  return (
    <div className="fixed top-4 right-4 w-80 space-y-2 z-50">
      {unreadNotifications.map((notification) => (
        <div
          key={notification.id}
          className="bg-slate-800 border border-slate-700 rounded-lg shadow-lg p-3 animate-slide-up"
        >
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0">{getIcon(notification.type)}</div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-medium text-white">
                {notification.title}
              </h3>
              <p className="mt-0.5 text-xs text-gray-400 line-clamp-2">
                {notification.message}
              </p>
              <p className="mt-0.5 text-[10px] text-gray-500">
                {formatDistanceToNow(new Date(notification.timestamp), {
                  addSuffix: true,
                })}
              </p>
            </div>
            <button
              onClick={() => markNotificationRead(notification.id)}
              className="flex-shrink-0 text-gray-400 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
