import { useEffect, useState, useCallback } from 'react';
import { getNotifications, markRead, markAllRead, deleteNotification, deleteAllNotifications } from '../services/notification.service';

const TYPE_CONFIG = {
  lead_assigned:       { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, bg: 'bg-blue-50',   text: 'text-blue-600' },
  task_due:            { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>, bg: 'bg-amber-50',  text: 'text-amber-600' },
  task_overdue:        { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>, bg: 'bg-red-50',    text: 'text-red-600' },
  lead_status_changed: { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>, bg: 'bg-purple-50', text: 'text-purple-600' },
  reminder:            { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, bg: 'bg-orange-50', text: 'text-orange-600' },
  general:             { icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>, bg: 'bg-gray-50',   text: 'text-gray-600' },
};

export default function Notifications() {
  const [data, setData] = useState({ notifications: [], unreadCount: 0, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { const res = await getNotifications({ page, limit: 20 }); setData(res); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const handleMarkRead = async (id) => { await markRead(id).catch(() => {}); load(); };
  const handleMarkAll = async () => { await markAllRead().catch(() => {}); load(); };
  const handleDelete = async (id) => { await deleteNotification(id).catch(() => {}); load(); };
  const handleDeleteAll = async () => { await deleteAllNotifications().catch(() => {}); load(); };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-gray-400">
        <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        Loading...
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Notifications</h2>
            <p className="text-sm text-gray-400 mt-0.5">{data.total} total</p>
          </div>
          {data.unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2.5 py-1 rounded-full font-bold shadow-sm">
              {data.unreadCount} unread
            </span>
          )}
        </div>
        {data.unreadCount > 0 && (
          <button onClick={handleMarkAll}
            className="text-sm font-semibold text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 px-4 py-2 rounded-xl transition">
            Mark all read
          </button>
        )}
        {data.total > 0 && (
          <button onClick={handleDeleteAll}
            className="text-sm font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-xl transition">
            Delete all
          </button>
        )}
      </div>

      <div className="space-y-2">
        {data.notifications.length === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm" style={{ border: '1px solid rgba(0,0,0,0.05)' }}>
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3 text-gray-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </div>
            <p className="text-gray-400 text-sm">No notifications yet</p>
          </div>
        )}
        {data.notifications.map(n => {
          const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.general;
          return (
            <div key={n._id}
              className={`bg-white rounded-2xl shadow-sm hover:shadow-md transition-all px-5 py-4 flex items-start gap-4 ${!n.isRead ? '' : 'opacity-60'}`}
              style={{ border: `1px solid ${n.isRead ? 'rgba(0,0,0,0.04)' : 'rgba(22,163,74,0.15)'}` }}>
              {!n.isRead && <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 shrink-0" />}
              <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                {cfg.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-800">{n.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                <p className="text-xs text-gray-300 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              {!n.isRead && (
                <button onClick={() => handleMarkRead(n._id)}
                  className="text-xs font-semibold text-green-600 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-xl transition shrink-0">
                  Read
                </button>
              )}
              <button onClick={() => handleDelete(n._id)}
                className="text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl transition shrink-0">
                Delete
              </button>
            </div>
          );
        })}
      </div>

      {data.total > 20 && (
        <div className="flex items-center justify-center gap-3">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-gray-50 transition">← Prev</button>
          <span className="text-sm text-gray-400 px-3 py-2 bg-white rounded-xl shadow-sm" style={{ border: '1px solid rgba(0,0,0,0.05)' }}>
            Page {page}
          </span>
          <button disabled={page * 20 >= data.total} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-gray-50 transition">Next →</button>
        </div>
      )}
    </div>
  );
}
