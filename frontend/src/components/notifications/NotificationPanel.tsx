import { useStore } from '@/store/useStore';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationPanel() {
  const notifications = useStore((state) => state.notifications);
  const markNotificationRead = useStore((state) => state.markNotificationRead);

  const unreadNotifications = notifications.filter((n) => !n.read).slice(0, 5);

  if (unreadNotifications.length === 0) {
    return null;
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 space-y-2 z-50">
      {unreadNotifications.map((notification) => (
        <div
          key={notification.id}
          className="bg-slate-800 border border-slate-700 rounded-lg shadow-lg p-4 animate-slide-up"
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">{getIcon(notification.type)}</div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-white">
                {notification.title}
              </h3>
              <p className="mt-1 text-sm text-gray-400">
                {notification.message}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {formatDistanceToNow(new Date(notification.timestamp), {
                  addSuffix: true,
                })}
              </p>
            </div>
            <button
              onClick={() => markNotificationRead(notification.id)}
              className="ml-3 flex-shrink-0 text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
