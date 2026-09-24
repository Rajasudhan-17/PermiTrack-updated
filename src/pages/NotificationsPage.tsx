import React, { useState, useEffect } from 'react';
import { Bell, Clock, CheckCircle2, AlertCircle, FileText, Check } from 'lucide-react';
import { Card, PageHeader, Badge, Button, EmptyState } from '../components/ui';
import { notificationsApi } from '../api/profile';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'leave' | 'od' | 'attendance' | 'system';
  unread: boolean;
  link?: string;
}

export const NotificationsPage: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = () => {
    setLoading(true);
    notificationsApi.getNotifications()
      .then((data) => {
        const mapped: NotificationItem[] = data.map((item) => ({
          id: String(item.id),
          title: item.title,
          message: item.message,
          timestamp: item.time,
          type: (item.type as any) || 'system',
          unread: item.unread,
          link: item.type === 'leave' ? '/my-leaves' : item.type === 'od' ? '/my-ods' : undefined,
        }));
        setNotifications(mapped);
      })
      .catch((err) => console.error('Failed to load notifications:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const filteredNotifications = notifications.filter((n) => filter === 'all' || n.unread);

  const markAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    } catch (err) {
      console.error('Failed to mark notifications as read:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <PageHeader
        title="Notification Center"
        subtitle="View all system notifications, approval alerts, and attendance updates."
        badge={<Badge variant="primary">{notifications.filter(n => n.unread).length} Unread</Badge>}
        actions={
          <Button variant="outline" size="sm" icon={<Check className="w-4 h-4" />} onClick={markAllAsRead}>
            Mark All as Read
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-pill transition-colors ${
            filter === 'all' ? 'bg-primary text-[#07151F]' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
          }`}
        >
          All Notifications ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-pill transition-colors ${
            filter === 'unread' ? 'bg-primary text-[#07151F]' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
          }`}
        >
          Unread ({notifications.filter((n) => n.unread).length})
        </button>
      </div>

      {/* List Container */}
      {filteredNotifications.length === 0 ? (
        <EmptyState
          title="No Notifications"
          description="You have no notifications in this category."
        />
      ) : (
        <Card className="divide-y divide-border/50 p-0 overflow-hidden">
          {filteredNotifications.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                if (n.link) {
                  window.history.pushState({}, '', n.link);
                  window.dispatchEvent(new Event('popstate'));
                }
              }}
              className={`p-4 flex items-start gap-4 transition-colors cursor-pointer group ${
                n.unread ? 'bg-primary-subtle/10 hover:bg-primary-subtle/20' : 'hover:bg-surface-elevated/40'
              }`}
              title="Click to view associated request"
            >
              <div className="p-2.5 rounded-lg bg-surface-elevated text-primary shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                {n.type === 'leave' ? (
                  <Clock className="w-5 h-5 text-primary" />
                ) : n.type === 'od' ? (
                  <CheckCircle2 className="w-5 h-5 text-info" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-warning" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors">{n.title}</h4>
                  <span className="text-xs text-text-muted shrink-0">{n.timestamp}</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed mt-1">{n.message}</p>
                {n.link && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:underline mt-2">
                    View Associated Request &rarr;
                  </span>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};
