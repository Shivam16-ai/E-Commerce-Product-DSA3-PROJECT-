import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Bell, CheckCheck, Sparkles, AlertCircle, TrendingDown, Server, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PageId } from '../../types';

export const NotificationCenter: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { notifications, markNotificationRead, clearAllNotifications, navigateTo } = useApp();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filteredNotifications = notifications.filter((n) => (filter === 'unread' ? !n.read : true));

  if (!isOpen) return null;

  const handleActionClick = (page?: PageId, notifId?: string) => {
    if (notifId) markNotificationRead(notifId);
    if (page) {
      navigateTo(page);
      onClose();
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'match':
        return <Sparkles className="w-4 h-4 text-purple-500" />;
      case 'duplicate':
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case 'price':
        return <TrendingDown className="w-4 h-4 text-emerald-500" />;
      case 'system':
      default:
        return <Server className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        id="notification-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs"
        onClick={onClose}
      />
      <motion.div
        id="notification-panel"
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        className="fixed top-16 right-4 md:right-8 z-50 w-full max-w-sm sm:max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Live Intelligence Feed</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{unreadCount} unread system notifications</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="clear-all-notif-btn"
              onClick={clearAllNotifications}
              className="text-xs flex items-center gap-1 text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          </div>
        </div>

        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/50 flex gap-2 border-b border-slate-100 dark:border-slate-800 text-xs font-medium">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full transition-colors ${
              filter === 'all'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1 rounded-full transition-colors ${
              filter === 'unread'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No notifications to display in this view.
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleActionClick(notif.actionPage, notif.id)}
                className={`p-3.5 flex gap-3 cursor-pointer transition-colors ${
                  notif.read
                    ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40 opacity-75'
                    : 'bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-50 dark:hover:bg-purple-950/30 font-medium'
                }`}
              >
                <div className="mt-0.5 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 h-fit">
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {notif.title}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">{notif.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
                    {notif.description}
                  </p>
                  {notif.actionPage && (
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-purple-600 dark:text-purple-400 font-semibold">
                      <span>View in {notif.actionPage.replace('-', ' ')}</span>
                      <ExternalLink className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
