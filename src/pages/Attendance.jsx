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
function GlassCard({ label, value, color, icon, subtext }) {
  return (
    <div
      className="group relative overflow-hidden transition-all duration-300 ease-out active:scale-95 flex flex-col justify-between"
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
                {checkedIn && checkedOut ? (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 text-center backdrop-blur-xl">
                     <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                       <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/></svg>
                     </div>
                     <p className="text-white font-black text-base tracking-tight">Shift Ended</p>
                     <p className="text-green-400/60 text-[9px] font-bold uppercase tracking-wider mt-0.5">See you tomorrow!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative group/input">
                      <input type="text" placeholder="Note (optional)" value={notes} onChange={e => setNotes(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white text-xs focus:outline-none focus:ring-2 focus:ring-green-500 transition-all placeholder:text-gray-600" />
                    </div>
                    {!checkedIn ? (
                      <button onClick={handleCheckIn} disabled={actionLoading}
                        className="w-full py-5 rounded-xl text-sm font-black text-white shadow-2xl hover:-translate-y-1 active:scale-95 transition-all disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                        {actionLoading ? 'SYCING...' : '🕐 CLOCK IN'}
                      </button>
                    ) : (
                      <button onClick={handleCheckOut} disabled={actionLoading}
                        className="w-full py-5 rounded-xl text-sm font-black text-white shadow-2xl hover:-translate-y-1 active:scale-95 transition-all disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
                        {actionLoading ? 'SYCING...' : '🌙 CLOCK OUT'}
                      </button>
                    )}
                    {error && <p className="text-center text-red-400 text-[8px] font-bold uppercase tracking-widest">{error}</p>}
                  </div>
                )}
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
        getUsers(),
        svc.getAllAttendance({ startDate: todayStart.toISOString(), endDate: todayEnd.toISOString(), limit: 200 }),
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
        <GlassCard label="Total staff" value={users.length} color="#3b82f6" icon="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <GlassCard label="Clocked in" value={records.filter(r => r.checkIn).length} color="#10b981" icon="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <GlassCard label="Shift over" value={records.filter(r => r.checkOut).length} color="#f59e0b" icon="M9 11l3 3L22 4" />
        <GlassCard label="Absent" value={users.length - records.filter(r => r.checkIn).length} color="#ef4444" icon="M18 6L6 18M6 6l12 12" />
      </div>

      {/* Salary Sheet */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <button className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors" onClick={() => setShowCommission(!showCommission)}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100 text-gray-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div className="text-left">
              <h3 className="text-[18px] font-medium text-gray-900 leading-tight">Salary Hub</h3>
              <p className="text-sm text-gray-500 mt-0.5">Attendance-based Base Pay + Performance Commission</p>
            </div>
          </div>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 transition-transform ${showCommission ? 'rotate-180' : ''}`}>
             <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
          </div>
        </button>

        {showCommission && (
          <div className="px-5 pb-5">
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => setCommMonth(p => {
                const m = p.month - 1;
                return m < 0 ? { month: 11, year: p.year - 1 } : { month: m, year: p.year };
              })} className="w-8 h-8 rounded border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div className="text-base font-medium text-gray-900">
                {new Date(commMonth.year, commMonth.month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </div>
              <button onClick={() => setCommMonth(p => {
                const m = p.month + 1;
                return m > 11 ? { month: 0, year: p.year + 1 } : { month: m, year: p.year };
              })} className="w-8 h-8 rounded border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {commLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : commData ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <GlassCard label="Deliveries" value={commData.grandTotalDeliveries} color="#3b82f6" icon="M5 13l4 4L19 7" subtext={commData.unassignedDeliveries > 0 ? `${commData.unassignedDeliveries} Unassigned` : null} />
                  <GlassCard label="Revenue" value={`₹${(commData.grandTotalRevenue || 0).toLocaleString('en-IN')}`} color="#10b981" icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <GlassCard label="Avg. commission" value={`₹${commData.staff.length ? Math.round((commData.grandTotalCommission || 0) / commData.staff.length).toLocaleString('en-IN') : 0}`} color="#f59e0b" icon="M13 10V3L4 14h7v7l9-11h-7z" />
                  <GlassCard label="Total payout" value={`₹${(commData.grandTotalPay || 0).toLocaleString('en-IN')}`} color="#6366f1" icon="M12 8v4l3 2" />
                </div>

                <div className="mt-12">
                  {/* Desktop Table View */}
                  <div className="hidden lg:block overflow-x-auto pb-8 px-2">
                    <table className="w-full text-left border-separate" style={{ borderSpacing: '0 20px' }}>
                      <thead>
                        <tr className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em]">
                          <th className="px-8 pb-2">Member</th>
                          <th className="px-4 pb-2">Joined</th>
                          <th className="px-4 pb-2">History</th>
                          <th className="px-4 pb-2 text-right">Deliveries</th>
                          <th className="px-4 pb-2 text-right">Base</th>
                          <th className="px-4 pb-2 text-right">Commission</th>
                          <th className="px-8 pb-2 text-right">Final</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commData.staff.map((s, idx) => {
                          const isNewRole = idx === 0 || commData.staff[idx - 1].user.role !== s.user.role;
                          const roleColor = ROLE_COLORS[s.user.role?.toLowerCase()] || 'bg-gray-500 text-white';
                          const roleColorHex = s.user.role === 'sales' ? '#3b82f6' : s.user.role === 'support' ? '#10b981' : s.user.role === 'verification' ? '#a855f7' : s.user.role === 'management' ? '#f59e0b' : '#ef4444';
                          
                          return (
                            <React.Fragment key={s.user._id}>
                              {isNewRole && (
                                <tr>
                                  <td colSpan={7} className="pt-4 pb-0 px-6">
                                    <div className="flex items-center gap-3">
                                      <div className="h-1.5 w-1.5 rounded-full" style={{ background: roleColorHex }} />
                                      <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: roleColorHex }}>
                                        {s.user.role || 'Other'} Department
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              )}
                              <tr className="group bg-white shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 cursor-default">
                                <td className="py-5 px-8 rounded-l-[2.5rem] border-y border-l border-gray-100/50 relative overflow-hidden">
                                  <div className="absolute inset-y-0 left-0 w-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: roleColorHex }} />
                                  <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black shadow-sm ${s.user.avatar ? 'bg-gray-100' : roleColor} group-hover:scale-110 transition-transform overflow-hidden`}>
                                      {s.user.avatar ? (
                                        <img src={s.user.avatar} alt={s.user.name} className="w-full h-full object-cover" />
                                      ) : (
                                        s.user.name?.charAt(0)
                                      )}
                                    </div>
                                    <div className="flex flex-col">
                                      <p className="font-black text-gray-900 text-[15px] tracking-tight">{s.user.name}</p>
                                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{s.user.role}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-5 px-4 border-y border-gray-100/50">
                                  {(() => {
                                    const jd = s.user.joiningDate || s.user.createdAt;
                                    return jd ? (
                                      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                        {new Date(jd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                      </span>
                                    ) : <span className="text-gray-300">—</span>;
                                  })()}
                                </td>
                                <td className="py-5 px-4 border-y border-gray-100/50">
                                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100">
                                    <span className="text-[11px] font-black text-emerald-600 tracking-wider">{s.attendance.present + s.attendance.late}P</span>
                                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
                                    <span className="text-[11px] font-black text-amber-500 tracking-wider">{s.attendance.half_day}H</span>
                                  </div>
                                </td>
                                <td className="py-5 px-4 border-y border-gray-100/50 text-right">
                                  <span className="text-base font-black text-gray-900">{s.totalDeliveries || 0}</span>
                                </td>
                                <td className="text-right py-5 px-4 border-y border-gray-100/50">
                                  {editingComm?.userId === s.user._id && editingComm?.field === 'base' ? (
                                    <div className="flex items-center justify-end gap-1.5">
                                      <input type="number" className="w-16 px-2 py-1 bg-gray-50 border border-indigo-200 rounded-lg text-right text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={editVal} onChange={e => setEditVal(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && handleSaveOverride()} />
                                      <button onClick={handleSaveOverride} className="w-7 h-7 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 font-bold">✓</button>
                                      <button onClick={() => setEditingComm(null)} className="w-7 h-7 flex items-center justify-center bg-gray-50 text-gray-500 rounded-lg hover:bg-gray-100 font-bold">×</button>
                                    </div>
                                  ) : (
                                    <div className="cursor-pointer group/cell flex items-center justify-end gap-2" onClick={() => {
                                      setEditingComm({ userId: s.user._id, field: 'base' });
                                      setEditVal(s.basePay);
                                    }}>
                                      <span className="text-sm font-black text-gray-700 group-hover/cell:text-indigo-600 transition-colors">₹{s.basePay?.toLocaleString()}</span>
                                      <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest opacity-0 group-hover/cell:opacity-100 transition-opacity">edit</span>
                                    </div>
                                  )}
                                </td>
                                <td className="text-right py-5 px-4 border-y border-gray-100/50">
                                  <div className="flex flex-col items-end">
                                    {editingComm?.userId === s.user._id && editingComm?.field === 'commission' ? (
                                      <div className="flex items-center justify-end gap-1.5">
                                        <input type="number" className="w-20 px-2 py-1 bg-gray-50 border border-indigo-200 rounded-lg text-right text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                          value={editVal} onChange={e => setEditVal(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && handleSaveOverride()} />
                                        <button onClick={handleSaveOverride} className="w-7 h-7 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 font-bold">✓</button>
                                        <button onClick={() => setEditingComm(null)} className="w-7 h-7 flex items-center justify-center bg-gray-50 text-gray-500 rounded-lg hover:bg-gray-100 font-bold">×</button>
                                      </div>
                                    ) : (
                                      <div className="cursor-pointer group/comm flex flex-col items-end" onClick={() => {
                                        setEditingComm({ userId: s.user._id, field: 'commission' });
                                        setEditVal(s.totalCommission);
                                      }}>
                                        <span className="text-sm font-black text-gray-700 group-hover/comm:text-indigo-600 transition-colors">₹{(s.totalCommission || 0).toLocaleString()}</span>
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                          {s.isManualCommission ? 'manual' : (s.user.role === 'support' ? '@₹50/order' : `@${s.user.commissionRate || 5}%`)} 
                                          <span className="text-indigo-400 opacity-0 group-hover/comm:opacity-100 transition-opacity ml-1">· edit</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="py-5 px-8 rounded-r-[2.5rem] border-y border-r border-gray-100/50 text-right">
                                  <span className="text-xl font-black text-indigo-600">₹{s.totalPay?.toLocaleString()}</span>
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                    
                    {/* Desktop unassigned */}
                    {commData.unassignedDeliveries > 0 && (
                      <table className="w-full text-left border-separate mt-6" style={{ borderSpacing: '0' }}>
                        <tbody>
                           <tr className="bg-gray-50 hover:bg-gray-100 transition-colors rounded-[2.5rem] cursor-pointer group" onClick={openUnassigned}>
                             <td className="py-5 px-8 rounded-l-[2.5rem] border-y border-l border-gray-200 w-1/3">
                               <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 rounded-2xl bg-gray-200 flex items-center justify-center text-gray-500 font-black text-xl group-hover:scale-110 transition-transform">U</div>
                                  <div className="flex flex-col">
                                    <span className="font-black text-gray-900 text-[15px]">Unassigned Orders</span>
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">No staff assigned</span>
                                  </div>
                               </div>
                             </td>
                             <td className="py-5 px-4 border-y border-gray-200 text-right">
                                <span className="text-base font-black text-gray-900">{commData.unassignedDeliveries}</span>
                             </td>
                             <td className="py-5 px-4 border-y border-gray-200 text-right text-gray-400">—</td>
                             <td className="py-5 px-4 border-y border-gray-200 text-right text-gray-400">—</td>
                             <td className="py-5 px-8 rounded-r-[2.5rem] border-y border-r border-gray-200 text-right text-gray-400">—</td>
                           </tr>
                        </tbody>
                      </table>
                    )}
                  </div>
                  
                  {/* Mobile Card View */}
                  <div className="lg:hidden flex flex-col gap-6">
                    {commData.staff.map((s, idx) => {
                      const isNewRole = idx === 0 || commData.staff[idx - 1].user.role !== s.user.role;
                      const roleColorHex = s.user.role === 'sales' ? '#3b82f6' : s.user.role === 'support' ? '#10b981' : s.user.role === 'verification' ? '#a855f7' : s.user.role === 'management' ? '#f59e0b' : '#ef4444';
                      const roleColor = ROLE_COLORS[s.user.role?.toLowerCase()] || 'bg-gray-500 text-white';
                      return (
                        <React.Fragment key={s.user._id}>
                          {isNewRole && (
                            <div className="pt-2 pb-0 px-2 flex items-center gap-2">
                              <div className="h-1.5 w-1.5 rounded-full" style={{ background: roleColorHex }} />
                              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: roleColorHex }}>
                                {s.user.role || 'Other'} Department
                              </span>
                            </div>
                          )}
                          <div className="p-6 bg-white shadow-[0_4px_20px_rgb(0,0,0,0.04)] rounded-[2rem] border border-gray-100 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1.5" style={{ background: roleColorHex }}></div>
                            <div className="flex items-center justify-between mb-6 mt-2">
                              <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black shadow-sm ${s.user.avatar ? 'bg-gray-100' : roleColor} overflow-hidden`}>
                                  {s.user.avatar ? (
                                    <img src={s.user.avatar} alt={s.user.name} className="w-full h-full object-cover" />
                                  ) : (
                                    s.user.name?.charAt(0)
                                  )}
                                </div>
                                <div className="flex flex-col">
                                  <p className="font-black text-gray-900 text-base">{s.user.name}</p>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{s.user.role}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                 <p className="text-2xl font-black text-indigo-600 leading-none">₹{s.totalPay?.toLocaleString()}</p>
                                 <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1.5">Total payout</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                              <div className="flex flex-col border-b border-dashed border-gray-200 pb-4">
                                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Attendance</p>
                                 <div className="flex items-center gap-2">
                                   <span className="text-sm font-black text-emerald-600">{s.attendance.present + s.attendance.late}P</span>
                                   <span className="text-sm font-black text-amber-500">{s.attendance.half_day}H</span>
                                 </div>
                              </div>
                              <div className="flex flex-col border-b border-dashed border-gray-200 pb-4">
                                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Performance</p>
                                 <p className="text-sm font-black text-gray-900">{s.totalDeliveries || 0} Delivered</p>
                              </div>
                              <div className="flex flex-col">
                                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Base pay</p>
                                 <p className="text-sm font-black text-gray-900">₹{s.basePay?.toLocaleString()}</p>
                              </div>
                              <div className="flex flex-col text-right">
                                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Commission</p>
                                 <p className="text-sm font-black text-gray-900">₹{(s.totalCommission || 0).toLocaleString()}</p>
                               </div>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                    {commData.unassignedDeliveries > 0 && (
                      <div className="mt-2">
                        {/* Mobile unassigned */}
                        <div className="p-6 bg-gray-50 shadow-sm rounded-[2rem] border border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-100" onClick={openUnassigned}>
                           <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-gray-200 flex items-center justify-center text-gray-500 font-black text-xl">U</div>
                              <div className="flex flex-col">
                                <p className="font-black text-gray-900 text-base">Unassigned Orders</p>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">{commData.unassignedDeliveries} Delivered</p>
                              </div>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400 text-center py-10 italic">No salary data available for this month</p>
            )}
          </div>
        )}
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
              
              <div className="mt-10 flex items-center justify-between relative z-10">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${status.bg} ${status.text} ${status.border} shadow-sm backdrop-blur-md bg-white/50`}>
                  {status.icon}
                  <span className="text-[10px] font-black tracking-widest uppercase">{status.label}</span>
                </div>
                {att?.checkIn && (
                  <div className="text-right">
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">In Time</p>
                    <p className="text-sm font-black text-gray-900 leading-none mt-1">{formatTime(att.checkIn)}</p>
                  </div>
                )}
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
