import React, { useState, useRef, useEffect } from 'react';
import { Bell, Clock, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { notificationsApi } from '../../api/profile';

export interface NotificationItem {
  id: string | number;
  title: string;
  message: string;
  time: string;
  type: 'leave' | 'od' | 'attendance' | 'system' | string;
  unread?: boolean;
  link?: string;
}

export interface NotificationMenuProps {
  notifications?: NotificationItem[];
  unreadCount?: number;
  onMarkAllAsRead?: () => void;
  className?: string;
}

export const NotificationMenu: React.FC<NotificationMenuProps> = ({
  notifications: propsNotifications,
  unreadCount: propsUnreadCount,
  onMarkAllAsRead: propsOnMarkAllAsRead,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>(propsNotifications || []);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = () => {
    notificationsApi
      .getNotifications()
      .then((data) => {
        const mapped: NotificationItem[] = data.map((n) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          time: n.time,
          type: n.type,
          unread: n.unread,
          link: (n as any).link || (n.type === 'leave' ? '/my-leaves' : n.type === 'od' ? '/my-ods' : '/notifications'),
        }));
        setItems(mapped);
      })
      .catch((err) => {
        console.error('Failed to load menu notifications:', err);
      });
  };

  useEffect(() => {
    if (!propsNotifications) {
      fetchNotifications();
    }
  }, [propsNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeNotifications = propsNotifications || items;
  const computedUnread = propsUnreadCount !== undefined ? propsUnreadCount : activeNotifications.filter((n) => n.unread).length;

  const handleMarkAllRead = async () => {
    if (propsOnMarkAllAsRead) {
      propsOnMarkAllAsRead();
    } else {
      try {
        await notificationsApi.markAllAsRead();
        setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
      } catch (err) {
        console.error('Failed to mark notifications read:', err);
      }
    }
  };

  const handleNavigate = (link?: string, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setIsOpen(false);
    const targetPath = link || '/notifications';
    window.history.pushState({}, '', targetPath);
    window.dispatchEvent(new Event('popstate'));
  };

  return (
    <div ref={menuRef} className={`relative inline-block ${className}`}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => {
          if (!isOpen && !propsNotifications) fetchNotifications();
          setIsOpen(!isOpen);
        }}
        className="relative p-2.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="View notifications"
        aria-expanded={isOpen}
      >
        <Bell className="w-5 h-5" />
        {computedUnread > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary text-[#07151F] text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {computedUnread > 9 ? '9+' : computedUnread}
          </span>
        )}
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface border border-border rounded-xl shadow-lg py-2 z-50 animate-fadeIn overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-text-primary">Notifications</span>
              {computedUnread > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-bold bg-primary-subtle text-primary rounded-pill">
                  {computedUnread} new
                </span>
              )}
            </div>
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-primary hover:underline font-medium transition-colors"
            >
              Mark all as read
            </button>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
            {activeNotifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-text-muted">
                No notifications right now.
              </div>
            ) : (
              activeNotifications.map((n) => (
                <a
                  key={n.id}
                  href={n.link || '/notifications'}
                  onClick={(e) => handleNavigate(n.link, e)}
                  className={`flex items-start gap-3 p-3.5 hover:bg-surface-elevated transition-colors block ${
                    n.unread ? 'bg-primary-subtle/10' : ''
                  }`}
                >
                  <div className="p-2 rounded-lg bg-surface-elevated text-primary shrink-0 mt-0.5">
                    {n.type === 'leave' ? (
                      <Clock className="w-4 h-4 text-primary" />
                    ) : n.type === 'od' ? (
                      <CheckCircle className="w-4 h-4 text-info" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-warning" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-text-primary truncate">{n.title}</span>
                      <span className="text-[10px] text-text-muted shrink-0">{n.time}</span>
                    </div>
                    <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">{n.message}</p>
                  </div>
                </a>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-border text-center bg-surface-elevated/30">
            <a
              href="/notifications"
              onClick={(e) => handleNavigate('/notifications', e)}
              className="text-xs font-medium text-text-muted hover:text-primary transition-colors flex items-center justify-center gap-1"
            >
              View All Notifications <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
