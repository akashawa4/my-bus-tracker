import { useState } from 'react';
import { Bell, X, Bus, MapPin, Info, AlertTriangle, Navigation } from 'lucide-react';
import { useStudent } from '@/context/StudentContext';
import { cn } from '@/lib/utils';
import { AppNotification } from '@/types/student';

export const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markNotificationRead, clearNotifications } = useStudent();
  const [isOpen, setIsOpen] = useState(false);

  const getNotificationIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'bus-started':
        return <Bus className="w-4 h-4 text-accent" />;
      case 'stop-approaching':
        return <Navigation className="w-4 h-4 text-warning" />;
      case 'stop-reached':
        return <MapPin className="w-4 h-4 text-success" />;
      case 'alert':
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      default:
        return <Info className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-secondary transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-medium rounded-full flex items-center justify-center animate-bounce-gentle">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-floating z-50 overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Notifications</h3>
              {notifications.length > 0 && (
                <button
                  onClick={clearNotifications}
                  className="text-xs text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => markNotificationRead(notification.id)}
                    className={cn(
                      'flex items-start gap-3 p-4 border-b border-border last:border-0 cursor-pointer hover:bg-secondary/50 transition-colors',
                      !notification.read && 'bg-primary/5'
                    )}
                  >
                    <div className="mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm',
                        notification.read ? 'text-muted-foreground' : 'text-foreground'
                      )}>
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {notification.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
