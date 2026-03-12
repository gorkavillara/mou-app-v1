'use client';

import { X, AlertTriangle, Bell, Info } from 'lucide-react';
import { useEffect, useState } from 'react';

export type NotificationType = 'info' | 'warning' | 'lowback';

export type Notification = {
  id: string;
  message: string;
  type: NotificationType;
  timestamp: number;
};

type NotificationBannerProps = {
  notifications: Notification[];
  onDismiss: (id: string) => void;
};

export function NotificationBanner({ notifications, onDismiss }: NotificationBannerProps) {
  if (notifications.length === 0) return null;

  const config = {
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: Bell,
      iconColor: 'text-blue-600',
      textColor: 'text-blue-800',
    },
    warning: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      icon: AlertTriangle,
      iconColor: 'text-orange-600',
      textColor: 'text-orange-800',
    },
    lowback: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      icon: Info,
      iconColor: 'text-purple-600',
      textColor: 'text-purple-800',
    },
  };

  return (
    <div className="fixed top-4 left-4 right-4 z-40 flex flex-col gap-2 max-w-md mx-auto">
      {notifications.map((notification) => {
        const style = config[notification.type];
        const Icon = style.icon;

        return (
          <div
            key={notification.id}
            className={`${style.bg} ${style.border} border rounded-xl p-4 flex items-start gap-3 shadow-lg`}
          >
            <Icon size={20} className={style.iconColor} />
            <p className={`${style.textColor} flex-1 text-sm`}>
              {notification.message}
            </p>
            <button
              onClick={() => onDismiss(notification.id)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function useNotificationHandler() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (message: string, type: NotificationType) => {
    const id = `notif-${Date.now()}`;
    setNotifications((prev) => [...prev, { id, message, type, timestamp: Date.now() }]);
  };

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  useEffect(() => {
    const timers = notifications.map((notif) => {
      return setTimeout(() => {
        dismissNotification(notif.id);
      }, 10000);
    });

    return () => timers.forEach(clearTimeout);
  }, [notifications]);

  return {
    notifications,
    addNotification,
    dismissNotification,
    clearAll,
  };
}
