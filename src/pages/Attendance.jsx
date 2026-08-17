import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import * as svc from '../services/attendance.service';
import { fetchAllStaffCommissions, saveCommissionOverride as dashboardSaveOverride, fetchUnassignedOrders, assignOrder } from '../services/dashboard.service';
import { getUsers } from '../services/user.service';
import Modal from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';

const STATUS_THEMES = {
  present: { 
    bg: 'bg-green-50/50', 
    text: 'text-green-600', 
    border: 'border-green-100', 
    dot: 'bg-green-500',
    label: 'Present',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
  },
  absent: { 
    bg: 'bg-red-50/50', 
    text: 'text-red-600', 
    border: 'border-red-100', 
    dot: 'bg-red-500',
    label: 'Absent',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
  },
  half_day: { 
    bg: 'bg-amber-50/50', 
    text: 'text-amber-600', 
    border: 'border-amber-100', 
    dot: 'bg-amber-500',
    label: 'Half Day',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M20 12l-8 8-8-8"/></svg>
  },
  late: { 
    bg: 'bg-indigo-50/60', 
    text: 'text-indigo-600', 
    border: 'border-indigo-100', 
    dot: 'bg-indigo-500',
    label: 'Late',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
  },
};

const ROLE_COLORS = {
  sales: 'bg-blue-500 text-white',
  support: 'bg-emerald-500 text-white',
  verification: 'bg-purple-500 text-white',
  management: 'bg-amber-500 text-white',
  admin: 'bg-rose-500 text-white'
};

/* ─── Glass Card Component ─── */
function GlassCard({ label, value, color, icon, subtext, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden transition-all duration-300 ease-out active:scale-95 flex flex-col justify-between ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        background: `linear-gradient(135deg, ${color}0A, ${color}14)`,
        border: `1px solid ${color}25`,
        borderRadius: 16, padding: '20px',
        boxShadow: `0 4px 12px -2px ${color}15`,
        minHeight: 110,
      }}
      onMouseEnter={e => { 
        e.currentTarget.style.boxShadow = `0 8px 24px -4px ${color}40`; 
        e.currentTarget.style.transform = 'translateY(-4px)'; 
        e.currentTarget.style.borderColor = `${color}40`;
      }}
      onMouseLeave={e => { 
        e.currentTarget.style.boxShadow = `0 4px 12px -2px ${color}15`; 
        e.currentTarget.style.transform = 'none'; 
        e.currentTarget.style.borderColor = `${color}25`;
      }}
    >
      <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700 pointer-events-none" style={{ background: color, opacity: 0.1 }}></div>
      <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
      
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', zIndex: 10, width: '100%', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}>{label}</div>
        </div>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }} className="group-hover:scale-110 transition-transform text-white">
          <svg className="w-4 h-4" fill="none" stroke={color} strokeWidth={2.5} viewBox="0 0 24 24"><path d={icon}/></svg>
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', position: 'relative', zIndex: 10, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: color, lineHeight: 1, letterSpacing: '-0.02em', textShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            {value}
          </div>
        </div>
        {subtext && (
          <div className="text-[10px] px-2 py-0.5 rounded font-bold uppercase" style={{ background: `${color}1A`, color: color }}>
            {subtext}
          </div>
        )}
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-1 transition-opacity pointer-events-none group-hover:opacity-30" style={{ background: color, opacity: 0.15 }}></div>
    </div>
  );
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function formatTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function getMonthDays(year, month) {
  const days = [];
  const firstDay = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= total; i++) days.push(i);
  return days;
}

function toDateKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

/* ─── Calendar Component ─── */
function AttendanceCalendar({ records, year, month, onChangeMonth }) {
  const days = getMonthDays(year, month);
  const map = {};
  records.forEach(r => { map[toDateKey(r.date)] = r; });
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const counts = { present: 0, absent: 0, half_day: 0, late: 0 };
  records.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });

  return (
    <div className="bg-white rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden border border-gray-100 max-w-2xl mx-auto">
      {/* Month nav */}
      <div className="relative flex items-center justify-between px-8 py-6 bg-gradient-to-r from-gray-900 to-gray-800 text-white overflow-hidden">
        <div className="absolute right-0 top-0 w-48 h-48 bg-emerald-500/20 blur-[60px] rounded-full" />
        <div className="relative z-10 flex flex-col">
          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-1">Attendance History</span>
          <h3 className="text-2xl font-black tracking-tighter">{MONTHS[month]} {year}</h3>
        </div>
        <div className="relative z-10 flex items-center gap-2">
          <button onClick={() => onChangeMonth(-1)} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all active:scale-95">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
          </button>
          <button onClick={() => onChangeMonth(1)} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all active:scale-95">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>
 
      {/* Summary Chips */}
      <div className="flex flex-wrap gap-2 px-8 py-5 bg-gray-50/50 border-b border-gray-100">
        {Object.entries(STATUS_THEMES).map(([key, theme]) => (
          <div key={key} className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border ${theme.bg} ${theme.border} transition-all shadow-sm`}>
            <span className={`${theme.text} scale-75`}>{theme.icon}</span>
            <span className={`text-[11px] font-black uppercase tracking-wider ${theme.text}`}>{counts[key]}</span>
            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{theme.label}</span>
          </div>
        ))}
      </div>
  
      <div className="p-8">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-4">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, idx) => (
            <div key={d} className={`text-center text-[10px] font-black uppercase tracking-[0.2em] ${idx === 0 || idx === 6 ? 'text-rose-400' : 'text-gray-400'}`}>{d}</div>
          ))}
        </div>
  
        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-y-4 gap-x-2">
          {days.map((day, i) => {
            if (!day) return <div key={`e${i}`} className="h-10 sm:h-12 opacity-0" />;
            const key = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const rec = map[key];
            const isToday = key === todayKey;
            const theme = rec ? STATUS_THEMES[rec.status] : null;
            
            return (
              <div key={i} className="flex justify-center">
                <div className={`group relative w-10 h-10 sm:w-12 sm:h-12 flex flex-col items-center justify-center rounded-full transition-all duration-300 cursor-pointer ${isToday ? 'ring-2 ring-gray-900 ring-offset-2' : ''} ${theme ? `shadow-md ${theme.bg.replace('/50','')} ${theme.border} border` : 'bg-gray-50/80 hover:bg-gray-100 border border-transparent hover:scale-110'}`}>
                  <span className={`text-[13px] font-black ${theme ? theme.text : isToday ? 'text-gray-900' : 'text-gray-400'}`}>
                    {day}
                  </span>
                  
                  {theme && (
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center bg-white/95 rounded-full z-10 backdrop-blur-sm shadow-xl scale-125">
                      <span className={`text-[8px] font-black uppercase tracking-tighter ${theme.text}`}>{theme.label}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Logs list */}
      {records && records.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/30 p-6 sm:p-8">
          <h4 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-4">Daily Logs</h4>
          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {records.map((r, index) => {
              const theme = STATUS_THEMES[r.status] || STATUS_THEMES.present;
              const formattedDate = new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short' });
              return (
                <div key={r._id || index} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-2xl shadow-sm transition-all hover:border-gray-200">
                  <div className="flex items-center gap-3">
                    {/* Status Dot/Icon */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${theme.bg} ${theme.text}`}>
                      {theme.icon}
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-900">{formattedDate}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{theme.label}</span>
                        {r.notes && (
                          <span className="inline-block text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium truncate max-w-[150px]" title={r.notes}>
                            📝 {r.notes}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">In</p>
                      <p className="text-xs font-black text-gray-900">{r.checkIn ? formatTime(r.checkIn) : '--:--'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Out</p>
                      <p className="text-xs font-black text-gray-900">{r.checkOut ? formatTime(r.checkOut) : '--:--'}</p>
                    </div>
                    {r.sessionDuration && (
                      <div className="text-center min-w-[50px]">
                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Total</p>
                        <p className="text-xs font-black text-emerald-600 font-mono">{r.sessionDuration}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Staff View ─── */
function StaffAttendance() {
  const { success, error: toastError, info } = useToast();
  const [todayRec, setTodayRec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const load = useCallback(async () => {
    try {
      const [status, hist] = await Promise.all([
        svc.getTodayStatus(),
        svc.getMyAttendance({ startDate: new Date(year, month, 1).toISOString(), endDate: new Date(year, month + 1, 0, 23, 59, 59).toISOString() }),
      ]);
      setTodayRec(status);
      setRecords(hist?.results || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  // Reset at midnight
  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const t = setTimeout(() => { setTodayRec(null); load(); }, midnight - now);
    return () => clearTimeout(t);
  }, [load]);

  const handleCheckIn = async () => {
    setActionLoading(true); setError('');
    try { 
      await svc.checkIn({ notes }); 
      setNotes(''); 
      success('Good morning! Check-in successful.', 'Clock In');
      load(); 
    }
    catch (e) { 
      const msg = e.response?.data?.message || 'Check-in failed';
      setError(msg);
      toastError(msg);
    }
    setActionLoading(false);
  };

  const handleCheckOut = async () => {
    setActionLoading(true); setError('');
    try { 
      await svc.checkOut({ notes }); 
      setNotes(''); 
      info('Work day finished. Take care!', 'Clock Out');
      load(); 
    }
    catch (e) { 
      const msg = e.response?.data?.message || 'Check-out failed';
      setError(msg);
      toastError(msg);
    }
    setActionLoading(false);
  };

  const changeMonth = (dir) => {
    let m = month + dir, y = year;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  };

  const checkedIn = !!todayRec?.checkIn;
  const checkedOut = !!todayRec?.checkOut;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-gray-400">
        <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        Loading...
      </div>
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Clock-in Section - Takes 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          <div className="relative group overflow-hidden rounded-[2rem] bg-gray-900 shadow-2xl p-6 sm:p-8 border border-white/5 h-full">
            {/* Background blobs */}
            <div className="absolute top-0 -right-20 w-60 h-60 bg-green-500/10 blur-[80px] rounded-full group-hover:bg-green-500/15 transition-colors" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-blue-500/10 blur-[80px] rounded-full group-hover:bg-blue-500/15 transition-colors" />
            
            <div className="relative h-full flex flex-col justify-between">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                  <span className={`w-1.5 h-1.5 rounded-full ${checkedIn && !checkedOut ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                  <span className="text-[8px] font-black text-white uppercase tracking-[0.2em]">
                    {checkedIn && !checkedOut ? 'System Online' : 'System Offline'}
                  </span>
                </div>
                <div>
                  <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tighter leading-none mb-1">My Time</h2>
                  <p className="text-gray-400 text-xs font-medium">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                
                <div className="flex flex-wrap gap-4 pt-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Check In</span>
                    <span className={`text-xl font-black ${checkedIn ? 'text-green-400' : 'text-white/10'}`}>
                      {checkedIn ? formatTime(todayRec.checkIn) : '--:--'}
                    </span>
                  </div>
                  <div className="w-px h-10 bg-white/10 self-center" />
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Check Out</span>
                    <span className={`text-xl font-black ${checkedOut ? 'text-green-400' : 'text-white/10'}`}>
                      {checkedOut ? formatTime(todayRec.checkOut) : '--:--'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <div className="space-y-4">
                  <div className="relative group/input">
                    <input type="text" placeholder="Note (optional)" value={notes} onChange={e => setNotes(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white text-xs focus:outline-none focus:ring-2 focus:ring-green-500 transition-all placeholder:text-gray-600" />
                  </div>
                  {checkedIn && !checkedOut ? (
                    <button onClick={handleCheckOut} disabled={actionLoading}
                      className="w-full py-5 rounded-xl text-sm font-black text-white shadow-2xl hover:-translate-y-1 active:scale-95 transition-all disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
                      {actionLoading ? 'SYCING...' : '🌙 CLOCK OUT'}
                    </button>
                  ) : (
                    <button onClick={handleCheckIn} disabled={actionLoading}
                      className="w-full py-5 rounded-xl text-sm font-black text-white shadow-2xl hover:-translate-y-1 active:scale-95 transition-all disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                      {actionLoading ? 'SYCING...' : '🕐 CLOCK IN'}
                    </button>
                  )}
                  {error && <p className="text-center text-red-400 text-[8px] font-bold uppercase tracking-widest">{error}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar Section - Takes 3 columns */}
        <div className="lg:col-span-3">
          <AttendanceCalendar records={records} year={year} month={month} onChangeMonth={changeMonth} />
        </div>
      </div>
    </div>
  );
}

/* ─── Admin View ─── */
function AdminAttendance() {
  const [users, setUsers] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logsModalType, setLogsModalType] = useState(null); // 'all' | 'working' | 'completed' | 'absent'
  const [logsMonth, setLogsMonth] = useState({ month: new Date().getMonth(), year: new Date().getFullYear() });
  const [logsData, setLogsData] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsSearch, setLogsSearch] = useState('');
  const [expandedUserId, setExpandedUserId] = useState(null);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedUser, setSelectedUser] = useState(null);
  const [userRecords, setUserRecords] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [commData, setCommData] = useState(null);
  const [commMonth, setCommMonth] = useState({ month: now.getMonth(), year: now.getFullYear() });
  const [commLoading, setCommLoading] = useState(false);
  const [showCommission, setShowCommission] = useState(true);
  const [editingComm, setEditingComm] = useState(null); // { userId, field: 'commission' | 'base' }
  const [editVal, setEditVal] = useState('');
  const [unassignedModalOpen, setUnassignedModalOpen] = useState(false);
  const [unassignedOrders, setUnassignedOrders] = useState([]);
  const [unassignedLoading, setUnassignedLoading] = useState(false);
  const { success, error: toastError, info } = useToast();


  const load = useCallback(async () => {
    setLoading(true);
    try {
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
      const [uRes, aRes] = await Promise.all([
        getUsers({ limit: 1000 }),
        svc.getAllAttendance({ startDate: todayStart.toISOString(), endDate: todayEnd.toISOString(), limit: 1000 }),
      ]);
      const filteredUsers = (uRes?.results || []).filter(u => u.role !== 'admin');
      setUsers(filteredUsers);
      setRecords(aRes?.results || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load commission data
  useEffect(() => {
    let cancelled = false;
    setCommLoading(true);
    fetchAllStaffCommissions(commMonth.month, commMonth.year)
      .then(d => { if (!cancelled) setCommData(d); })
      .catch(e => console.error('Commission fetch failed:', e.message))
      .finally(() => { if (!cancelled) setCommLoading(false); });
    return () => { cancelled = true; };
  }, [commMonth]);

  const handleSaveOverride = async () => {
    if (!editingComm) return;
    try {
      const val = editVal === '' ? null : Number(editVal);
      await dashboardSaveOverride({
        userId: editingComm.userId,
        month: commMonth.month,
        year: commMonth.year,
        [editingComm.field === 'commission' ? 'manualCommission' : 'manualBasePay']: val
      });
      success('Override saved successfully');
      setEditingComm(null);
      setCommLoading(true);
      const d = await fetchAllStaffCommissions(commMonth.month, commMonth.year);
      setCommData(d);
      setCommLoading(false);
    } catch (e) {
      toastError(e.response?.data?.message || 'Failed to save override');
    }
  };

  const openUnassigned = async () => {
    setUnassignedModalOpen(true);
    setUnassignedLoading(true);
    try {
      const orders = await fetchUnassignedOrders(commMonth.month, commMonth.year);
      setUnassignedOrders(orders);
    } catch {
      toastError('Failed to fetch unassigned orders');
    }
    setUnassignedLoading(false);
  };

  const handleAssignOrder = async (orderId, staffId, platform) => {
    if (!staffId) return;
    try {
      await assignOrder(orderId, staffId, platform);
      success('Order assigned successfully');
      setUnassignedOrders(prev => prev.filter(o => o._id !== orderId));
      
      // Reload stats
      setCommLoading(true);
      const d = await fetchAllStaffCommissions(commMonth.month, commMonth.year);
      setCommData(d);
      setCommLoading(false);
    } catch (e) {
      toastError(e.response?.data?.message || 'Failed to assign order');
    }
  };
  const handleAdminCheckIn = async (e, userId) => {
    e.stopPropagation();
    try {
      await svc.checkIn({ userId, notes: 'Checked in by Admin' });
      success('Staff checked in successfully');
      load();
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to check in staff');
    }
  };

  const handleAdminCheckOut = async (e, userId) => {
    e.stopPropagation();
    try {
      await svc.checkOut({ userId, notes: 'Checked out by Admin' });
      success('Staff checked out successfully');
      load();
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to check out staff');
    }
  };


  const openUser = async (u) => {
    setSelectedUser(u); setModalLoading(true);
    try {
      const res = await svc.getAllAttendance({
        userId: u._id,
        startDate: new Date(year, month, 1).toISOString(),
        endDate: new Date(year, month + 1, 0, 23, 59, 59).toISOString(),
        limit: 50,
      });
      setUserRecords(res?.results || []);
    } catch { setUserRecords([]); }
    setModalLoading(false);
  };

  const changeMonth = (dir) => {
    let m = month + dir, y = year;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  };

  // Reload user modal data when month changes
  useEffect(() => { if (selectedUser) openUser(selectedUser); }, [year, month]);

  // Load monthly logs for statistics card modal click
  useEffect(() => {
    if (!logsModalType) return;
    let cancelled = false;
    setLogsLoading(true);
    const startDate = new Date(logsMonth.year, logsMonth.month, 1).toISOString();
    const endDate = new Date(logsMonth.year, logsMonth.month + 1, 0, 23, 59, 59).toISOString();
    
    svc.getAllAttendance({ startDate, endDate, limit: 1000 })
      .then(res => {
        if (!cancelled) {
          setLogsData(res?.results || []);
        }
      })
      .catch(err => {
        console.error('Failed to load logs:', err);
      })
      .finally(() => {
        if (!cancelled) setLogsLoading(false);
      });

    return () => { cancelled = true; };
  }, [logsModalType, logsMonth]);

  const changeLogsMonth = (dir) => {
    setLogsMonth(prev => {
      let m = prev.month + dir;
      let y = prev.year;
      if (m < 0) { m = 11; y--; }
      else if (m > 11) { m = 0; y++; }
      return { month: m, year: y };
    });
  };

  const getAttendanceForUser = (uid) => records.find(r => (r.user?._id || r.user) === uid);

  const ROLE_GRADIENT = { admin: 'from-purple-500 to-violet-600', manager: 'from-blue-500 to-cyan-500', sales: 'from-green-500 to-emerald-500' };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-gray-400">
        <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        Loading...
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-10">
      <div className="relative overflow-hidden flex items-center justify-between p-8 bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl shadow-xl text-white">
        <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/20 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute left-0 bottom-0 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none" />
        <div className="relative z-10 flex flex-col">
          <h2 className="text-3xl font-black tracking-tight text-white/90">Attendance</h2>
          <p className="text-emerald-400 font-medium tracking-wide mt-1 uppercase text-xs">Track attendance and performance</p>
        </div>
        <div className="relative z-10 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md shadow-lg border border-white/20">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-bold tracking-widest uppercase">
            {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard 
          label="Total staff" 
          value={users.length} 
          color="#3b82f6" 
          icon="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" 
          onClick={() => { setLogsModalType('all'); setLogsMonth({ month, year }); }}
        />
        <GlassCard 
          label="Clocked in" 
          value={records.filter(r => r.checkIn && !r.checkOut).length} 
          color="#10b981" 
          icon="M22 11.08V12a10 10 0 1 1-5.93-9.14" 
          onClick={() => { setLogsModalType('working'); setLogsMonth({ month, year }); }}
        />
        <GlassCard 
          label="Shift over" 
          value={records.filter(r => r.checkOut).length} 
          color="#f59e0b" 
          icon="M9 11l3 3L22 4" 
          onClick={() => { setLogsModalType('completed'); setLogsMonth({ month, year }); }}
        />
        <GlassCard 
          label="Absent" 
          value={users.length - records.filter(r => r.checkIn).length} 
          color="#ef4444" 
          icon="M18 6L6 18M6 6l12 12" 
          onClick={() => { setLogsModalType('absent'); setLogsMonth({ month, year }); }}
        />
      </div>


      {/* Staff Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {users.map(u => {
          const att = getAttendanceForUser(u._id);
          const status = att?.checkIn
            ? att.checkOut
              ? { label: 'Shift over', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg> }
              : { label: 'Working', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 2"/></svg> }
            : { label: 'Absent', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg> };
          
          const rc = ROLE_COLORS[u.role?.toLowerCase()] || 'bg-gray-500 text-white';
          const colorHex = u.role === 'sales' ? '#3b82f6' : u.role === 'support' ? '#10b981' : u.role === 'verification' ? '#a855f7' : u.role === 'management' ? '#f59e0b' : '#ef4444';

          return (
            <div key={u._id} className="group relative overflow-hidden transition-all duration-300 ease-out active:scale-95 flex flex-col justify-between cursor-pointer"
              style={{
                background: `linear-gradient(135deg, ${colorHex}0A, ${colorHex}14)`,
                border: `1px solid ${colorHex}25`,
                borderRadius: 24, padding: '24px',
                boxShadow: `0 4px 12px -2px ${colorHex}15`,
              }}
              onClick={() => openUser(u)}
              onMouseEnter={e => { 
                e.currentTarget.style.boxShadow = `0 8px 24px -4px ${colorHex}40`; 
                e.currentTarget.style.transform = 'translateY(-4px)'; 
                e.currentTarget.style.borderColor = `${colorHex}40`;
              }}
              onMouseLeave={e => { 
                e.currentTarget.style.boxShadow = `0 4px 12px -2px ${colorHex}15`; 
                e.currentTarget.style.transform = 'none'; 
                e.currentTarget.style.borderColor = `${colorHex}25`;
              }}
            >
              {/* Giant Background Initial */}
              <div className="absolute -right-4 -bottom-8 text-[160px] leading-none font-black italic select-none pointer-events-none transition-transform duration-700 group-hover:scale-110 group-hover:-rotate-12" style={{ color: colorHex, opacity: 0.05 }}>
                {u.name?.charAt(0)}
              </div>
              
              <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700 pointer-events-none" style={{ background: colorHex, opacity: 0.1 }}></div>
              <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

              <div className="flex items-start justify-between relative z-10">
                <div className="flex flex-col">
                  <p className="text-xl font-black text-gray-900 truncate tracking-tight">{u.name}</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] mt-1" style={{ color: colorHex }}>{u.role}</p>
                </div>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: u.avatar ? 'transparent' : 'rgba(255,255,255,0.7)', backdropFilter: u.avatar ? 'none' : 'blur(8px)', border: u.avatar ? 'none' : '1px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }} className={`group-hover:scale-110 transition-transform text-lg font-black ${u.avatar ? '' : rc}`}>
                  {u.avatar ? (
                    <img src={u.avatar} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    u.name?.charAt(0)
                  )}
                </div>
              </div>
              
              <div className="mt-10 flex flex-col gap-3 relative z-10">
                <div className="flex items-center justify-between">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${status.bg} ${status.text} ${status.border} shadow-sm backdrop-blur-md bg-white/50`}>
                    {status.icon}
                    <span className="text-[10px] font-black tracking-widest uppercase">{status.label}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {att?.checkIn && (
                      <div className="text-right">
                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">In Time</p>
                        <p className="text-sm font-black text-gray-900 leading-none mt-1">{formatTime(att.checkIn)}</p>
                      </div>
                    )}
                    {att?.checkOut && (
                      <div className="text-right">
                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Out Time</p>
                        <p className="text-sm font-black text-gray-900 leading-none mt-1">{formatTime(att.checkOut)}</p>
                      </div>
                    )}
                    {att?.checkOut && att?.sessionDuration && (
                      <div className="text-right">
                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Duration</p>
                        <p className="text-sm font-black text-emerald-600 leading-none mt-1 font-mono">{att.sessionDuration}</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <button 
                  onClick={(e) => (att?.checkIn && !att?.checkOut) ? handleAdminCheckOut(e, u._id) : handleAdminCheckIn(e, u._id)}
                  className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md hover:opacity-90 active:scale-95`}
                  style={{ background: (att?.checkIn && !att?.checkOut) ? 'linear-gradient(135deg, #ea580c, #c2410c)' : 'linear-gradient(135deg, #16a34a, #15803d)' }}
                >
                  {att?.checkIn && !att?.checkOut ? 'Clock Out' : (att?.checkOut ? 'Clock In Again' : 'Clock In')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* User detail modal */}
      {selectedUser && (
        <Modal title={`${selectedUser.name}'s Attendance`} onClose={() => setSelectedUser(null)}>
          <div className="p-2">
            {modalLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <AttendanceCalendar records={userRecords} year={year} month={month} onChangeMonth={changeMonth} />
            )}
          </div>
        </Modal>
      )}

      {unassignedModalOpen && (
        <Modal title="Unassigned Orders" onClose={() => setUnassignedModalOpen(false)}>
          <div className="p-4 max-h-[70vh] overflow-y-auto space-y-4 bg-gray-50/50">
            {unassignedLoading ? (
              <div className="flex items-center justify-center py-10"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : unassignedOrders.length === 0 ? (
              <p className="text-center text-sm font-bold text-gray-400 py-10">No unassigned orders found.</p>
            ) : (
              <div className="grid gap-3">
                {unassignedOrders.map(o => (
                  <div key={o._id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-black text-gray-900">{o.billing_customer_name || 'Unknown Customer'}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">{o.platform} • {o.tracking_id || 'No AWB'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-gray-900">₹{o.sub_total?.toLocaleString()}</p>
                        <p className="text-[9px] font-black text-gray-400 uppercase">Revenue</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <select 
                        className="flex-1 text-xs font-bold text-gray-600 bg-gray-50 border-0 rounded-lg p-2 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-green-500 transition-all cursor-pointer"
                        onChange={(e) => {
                          const staffId = e.target.value;
                          if (staffId) handleAssignOrder(o._id, staffId, o.platform);
                        }}
                        value=""
                      >
                        <option value="" disabled>Assign to Staff...</option>
                        {users.filter(u => u.role === 'sales').map(u => (
                          <option key={u._id} value={u._id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Monthly Filtered Logs Modal */}
      {logsModalType && (
        <Modal 
          title="Monthly Attendance Report" 
          onClose={() => { setLogsModalType(null); setLogsSearch(''); setExpandedUserId(null); }}
        >
          <div className="space-y-4 p-4 max-h-[80vh] overflow-y-auto bg-gray-50/50">
            {/* Month Filter Selector */}
            <div className="flex items-center justify-between px-4 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.25em]">Monthly Filter</span>
                <span className="text-sm font-black text-gray-900">{MONTHS[logsMonth.month]} {logsMonth.year}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => changeLogsMonth(-1)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-all active:scale-95">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
                </button>
                <button onClick={() => changeLogsMonth(1)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-all active:scale-95">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
                </button>
              </div>
            </div>

            {/* Quick Status Sub-filters */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-gray-200/40 rounded-2xl border border-black/5">
              {[
                { type: 'all', label: 'All Staff' },
                { type: 'working', label: 'Clocked In' },
                { type: 'completed', label: 'Shift Over' },
                { type: 'absent', label: 'Absent' }
              ].map(tab => (
                <button
                  key={tab.type}
                  onClick={() => { setLogsModalType(tab.type); setExpandedUserId(null); }}
                  className={`flex-1 py-2 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all ${
                    logsModalType === tab.type 
                      ? 'bg-white text-gray-900 shadow-sm font-black' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search by staff name..." 
                value={logsSearch} 
                onChange={e => setLogsSearch(e.target.value)}
                className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-3 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-gray-400 shadow-sm"
              />
            </div>

            {/* Logs List grouped by User */}
            {logsLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (() => {
              // Helper to resolve today's status for a user
              const getTodayStatusForUser = (userId) => {
                const att = records.find(r => (r.user?._id || r.user) === userId);
                if (!att || !att.checkIn) return 'absent';
                if (att.checkOut) return 'completed';
                return 'working';
              };

              // Filter users matching search & stats category
              const filteredUsers = users.filter(u => {
                // Search filter
                if (logsSearch && !u.name.toLowerCase().includes(logsSearch.toLowerCase())) {
                  return false;
                }
                
                // Status type filter for today
                const todayStatus = getTodayStatusForUser(u._id);
                if (logsModalType === 'working' && todayStatus !== 'working') return false;
                if (logsModalType === 'completed' && todayStatus !== 'completed') return false;
                if (logsModalType === 'absent' && todayStatus !== 'absent') return false;
                
                return true;
              });

              if (filteredUsers.length === 0) {
                return (
                  <div className="text-center text-sm font-bold text-gray-400 py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    No staff found matching these filters.
                  </div>
                );
              }

              // Helper to fetch log summaries for the month
              const getEmployeeStats = (userId) => {
                const empRecords = logsData.filter(r => (r.user?._id || r.user) === userId);
                const counts = { present: 0, late: 0, half_day: 0, absent: 0 };
                empRecords.forEach(r => {
                  if (counts[r.status] !== undefined) counts[r.status]++;
                });
                return { empRecords, counts };
              };

              return (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50/75 border-b border-gray-100 text-gray-400 font-black uppercase text-[10px] tracking-[0.1em]">
                          <th className="py-4 px-5">Staff Identity</th>
                          <th className="py-4 px-2 text-center">Today's Status</th>
                          <th className="py-4 px-2 text-center">Monthly Summary</th>
                          <th className="py-4 px-5 text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-150">
                        {filteredUsers.map(u => {
                          const { counts, empRecords } = getEmployeeStats(u._id);
                          const todayStatus = getTodayStatusForUser(u._id);
                          const todayStatusTheme = 
                            todayStatus === 'working' ? { label: 'Working', bg: 'bg-blue-50 text-blue-700 border-blue-200' } :
                            todayStatus === 'completed' ? { label: 'Shift Over', bg: 'bg-green-50 text-green-700 border-green-200' } :
                            { label: 'Absent Today', bg: 'bg-red-50 text-red-700 border-red-200' };

                          const isExpanded = expandedUserId === u._id;

                          return (
                            <React.Fragment key={u._id}>
                              <tr className="hover:bg-gray-50/50 transition-all">
                                {/* Staff Identity */}
                                <td className="py-4 px-5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden font-black text-white bg-gradient-to-tr from-gray-500 to-gray-600">
                                      {u.avatar ? <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" /> : u.name?.charAt(0)}
                                    </div>
                                    <div>
                                      <p className="text-sm font-black text-gray-900 leading-tight">{u.name}</p>
                                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{u.role || 'Staff'}</p>
                                    </div>
                                  </div>
                                </td>

                                {/* Today's Status */}
                                <td className="py-4 px-2 text-center">
                                  <span className={`inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${todayStatusTheme.bg} ${todayStatusTheme.border}`}>
                                    {todayStatusTheme.label}
                                  </span>
                                </td>

                                {/* Monthly Summary Counts */}
                                <td className="py-4 px-2 text-center">
                                  <div className="flex items-center justify-center gap-3 text-[11px]">
                                    <span className="text-green-600 font-bold" title="Present">P: {counts.present}</span>
                                    <span className="text-indigo-600 font-bold" title="Late">L: {counts.late}</span>
                                    <span className="text-amber-600 font-bold" title="Half Day">H: {counts.half_day}</span>
                                    <span className="text-red-600 font-bold" title="Absent">A: {counts.absent}</span>
                                  </div>
                                </td>

                                {/* Expand Toggle Button */}
                                <td className="py-4 px-5 text-right">
                                  <button 
                                    onClick={() => setExpandedUserId(isExpanded ? null : u._id)}
                                    className="py-1.5 px-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-[9px] font-black uppercase tracking-wider text-gray-600 transition-all inline-flex items-center gap-1"
                                  >
                                    <span>{isExpanded ? 'Hide' : `Logs (${empRecords.length})`}</span>
                                    <svg className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                      <path d="M19 9l-7 7-7-7"/>
                                    </svg>
                                  </button>
                                </td>
                              </tr>

                              {/* Expanded Row showing Daily Sub-Table */}
                              {isExpanded && (
                                <tr>
                                  <td colSpan="4" className="bg-gray-50/50 p-4">
                                    <div className="border border-gray-100 rounded-xl overflow-hidden bg-white shadow-inner">
                                      {empRecords.length === 0 ? (
                                        <p className="text-center text-[10px] font-bold text-gray-400 py-6">No daily records found for this month.</p>
                                      ) : (
                                        <table className="w-full text-[11px] text-left border-collapse">
                                          <thead>
                                            <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-black uppercase text-[9px] tracking-wider">
                                              <th className="py-2.5 px-4">Date</th>
                                              <th className="py-2.5 px-2 text-center">Status</th>
                                              <th className="py-2.5 px-2 text-center">In Time</th>
                                              <th className="py-2.5 px-2 text-center">Out Time</th>
                                              <th className="py-2.5 px-2 text-center font-mono">Total Hours</th>
                                              <th className="py-2.5 px-4">Notes</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-50">
                                            {empRecords.map((r, idx) => {
                                              const logTheme = STATUS_THEMES[r.status] || STATUS_THEMES.present;
                                              const logDateStr = new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short' });
                                              return (
                                                <tr key={r._id || idx} className="hover:bg-gray-50/20">
                                                  <td className="py-2.5 px-4 font-black text-gray-900">{logDateStr}</td>
                                                  <td className="py-2.5 px-2 text-center">
                                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${logTheme.bg} ${logTheme.border} ${logTheme.text}`}>
                                                      {logTheme.label}
                                                    </span>
                                                  </td>
                                                  <td className="py-2.5 px-2 text-center text-gray-600">{r.checkIn ? formatTime(r.checkIn) : '--:--'}</td>
                                                  <td className="py-2.5 px-2 text-center text-gray-600">{r.checkOut ? formatTime(r.checkOut) : '--:--'}</td>
                                                  <td className="py-2.5 px-2 text-center font-mono text-emerald-600 font-bold">{r.sessionDuration || '--'}</td>
                                                  <td className="py-2.5 px-4 text-gray-500 font-medium">{r.notes ? `📝 ${r.notes}` : '—'}</td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── Main Export ─── */
export default function Attendance() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const [activeTab, setActiveTab] = useState(isAdmin || isManager ? 'team' : 'personal');

  // Admin sees management only, no personal attendance needed
  if (isAdmin) return <div className="container mx-auto px-4 py-8"><AdminAttendance /></div>;
  
  // Sales sees personal only
  if (!isManager) return <div className="container mx-auto px-4 py-8"><StaffAttendance /></div>;

  // Managers see the toggle
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Tab Switcher */}
      <div className="flex items-center gap-1 p-1 bg-gray-200/50 backdrop-blur-md rounded-[1.25rem] w-fit mx-auto shadow-inner border border-black/5">
        <button 
          onClick={() => setActiveTab('team')}
          className={`flex items-center gap-2 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${
            activeTab === 'team' 
              ? 'bg-gray-900 text-white shadow-xl scale-105' 
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          Team Hub
        </button>
        <button 
          onClick={() => setActiveTab('personal')}
          className={`flex items-center gap-2 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${
            activeTab === 'personal' 
              ? 'bg-gray-900 text-white shadow-xl scale-105' 
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          My Attendance
        </button>
      </div>
      
      <div className="transition-all duration-500">
        {activeTab === 'team' ? <AdminAttendance /> : <StaffAttendance />}
      </div>
    </div>
  );
}
