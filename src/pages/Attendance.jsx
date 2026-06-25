import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import * as svc from '../services/attendance.service';
import { fetchAllStaffCommissions, saveCommissionOverride as dashboardSaveOverride } from '../services/dashboard.service';
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
    <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-gray-100 transition-all hover:shadow-2xl max-w-2xl mx-auto">
      {/* Month nav */}
      <div className="relative flex items-center justify-between px-5 py-4 bg-gray-900 text-white">
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-green-400 uppercase tracking-[0.2em] mb-0.5">Attendance History</span>
          <h3 className="text-base font-black tracking-tight">{MONTHS[month]} {year}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => onChangeMonth(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition active:scale-95">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
          </button>
          <button onClick={() => onChangeMonth(1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition active:scale-95">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>
 
      {/* Summary Chips */}
      <div className="flex flex-wrap gap-1.5 p-3 bg-gray-50/50 border-b border-gray-100">
        {Object.entries(STATUS_THEMES).map(([key, theme]) => (
          <div key={key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${theme.bg} ${theme.border} transition-all`}>
            <span className={`${theme.text} scale-75`}>{theme.icon}</span>
            <span className={`text-[10px] font-black uppercase tracking-wider ${theme.text}`}>{counts[key]}</span>
            <span className="text-[8px] text-gray-400 font-bold uppercase">{theme.label}</span>
          </div>
        ))}
      </div>
  
      <div className="p-3">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, idx) => (
            <div key={d} className={`text-center text-[9px] font-black uppercase tracking-widest pb-2 ${idx === 0 || idx === 6 ? 'text-red-300' : 'text-gray-400'}`}>{d}</div>
          ))}
        </div>
  
        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {days.map((day, i) => {
            if (!day) return <div key={`e${i}`} className="h-8 sm:h-10 opacity-20" />;
            const key = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const rec = map[key];
            const isToday = key === todayKey;
            const theme = rec ? STATUS_THEMES[rec.status] : null;
            
            return (
              <div key={i} className={`group relative h-8 sm:h-10 flex flex-col items-center justify-center rounded-lg sm:rounded-xl transition-all duration-300 ${isToday ? 'ring-2 ring-green-500 ring-offset-1' : ''} ${theme ? `shadow-sm ${theme.bg} ${theme.border} border` : 'bg-gray-50/50 hover:bg-gray-100 border border-transparent'}`}>
                <span className={`text-[10px] sm:text-xs font-black ${theme ? theme.text : isToday ? 'text-green-600' : 'text-gray-400'}`}>
                  {day}
                </span>
                {theme && (
                   <div className={`mt-0.5 w-1 h-1 rounded-full ${theme.dot} opacity-60 transition-transform`} />
                )}
                
                {theme && (
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center bg-white/90 rounded-xl z-10">
                    <span className={`text-[8px] font-black uppercase tracking-tighter ${theme.text}`}>{theme.label}</span>
                  </div>
                )}
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
      await dashboardSaveOverride({
        userId: editingComm.userId,
        month: commMonth.month,
        year: commMonth.year,
        [editingComm.field === 'commission' ? 'manualCommission' : 'manualBasePay']: Number(editVal)
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tighter">Attendance</h2>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">Management Hub</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gray-50 border border-gray-100">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-black text-gray-600 uppercase tracking-widest">
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
          </span>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Staff', val: users.length, color: '#3b82f6', bg: 'bg-blue-50', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' },
          { label: 'Clocked In', val: records.filter(r => r.checkIn).length, color: '#16a34a', bg: 'bg-green-50', icon: 'M22 11.08V12a10 10 0 1 1-5.93-9.14' },
          { label: 'Shift Over', val: records.filter(r => r.checkOut).length, color: '#ea580c', bg: 'bg-orange-50', icon: 'M9 11l3 3L22 4' },
          { label: 'Absent', val: users.length - records.filter(r => r.checkIn).length, color: '#dc2626', bg: 'bg-red-50', icon: 'M18 6L6 18M6 6l12 12' },
        ].map(s => (
          <div key={s.label} className="group relative overflow-hidden rounded-3xl p-5 bg-white border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${s.bg}`} style={{ color: s.color }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d={s.icon}/></svg>
              </div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] leading-tight">{s.label}</p>
            </div>
            <p className="text-3xl font-black text-gray-900 tracking-tight">{s.val}</p>
            <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full opacity-[0.03] group-hover:scale-110 transition-transform" style={{ background: s.color }} />
          </div>
        ))}
      </div>

      {/* Salary Sheet */}
      <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-100">
        <button className="w-full flex items-center justify-between px-8 py-6 hover:bg-gray-50/50 transition-colors" onClick={() => setShowCommission(!showCommission)}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-emerald-50 text-emerald-600">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div className="text-left">
              <h3 className="text-xl font-black text-gray-900 tracking-tight">Salary Hub</h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Attendance-based Base Pay + Performance Commission</p>
            </div>
          </div>
          <div className={`w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 transition-transform ${showCommission ? 'rotate-180' : ''}`}>
             <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
          </div>
        </button>

        {showCommission && (
          <div className="px-8 pb-8">
            <div className="flex items-center justify-center gap-4 mb-8">
              <button onClick={() => setCommMonth(p => {
                const m = p.month - 1;
                return m < 0 ? { month: 11, year: p.year - 1 } : { month: m, year: p.year };
              })} className="w-12 h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition active:scale-90">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div className="bg-gray-900 text-white px-6 py-3 rounded-2xl text-sm font-black tracking-tight min-w-[160px] text-center shadow-lg">
                {new Date(commMonth.year, commMonth.month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </div>
              <button onClick={() => setCommMonth(p => {
                const m = p.month + 1;
                return m > 11 ? { month: 0, year: p.year + 1 } : { month: m, year: p.year };
              })} className="w-12 h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition active:scale-90">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {commLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : commData ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  {[
                    { label: 'Deliveries', val: commData.grandTotalDeliveries, text: 'text-blue-600', bg: 'bg-blue-50/50', sub: commData.unassignedDeliveries > 0 ? `${commData.unassignedDeliveries} U` : null },
                    { label: 'Revenue', val: `₹${(commData.grandTotalRevenue || 0).toLocaleString('en-IN')}`, text: 'text-green-600', bg: 'bg-green-50/50' },
                    { label: 'Commission', val: `₹${(commData.grandTotalCommission || 0).toLocaleString('en-IN')}`, text: 'text-amber-600', bg: 'bg-amber-50/50' },
                    { label: 'Total Payout', val: `₹${(commData.grandTotalPay || 0).toLocaleString('en-IN')}`, text: 'text-emerald-400', bg: 'bg-gray-900', dark: true },
                  ].map(x => (
                    <div key={x.label} className={`group relative overflow-hidden rounded-[2rem] p-5 ${x.bg} border border-black/5 transition-all hover:shadow-xl hover:-translate-y-1`}>
                      <div className="relative z-10">
                        <div className="flex items-start justify-between mb-1">
                          <p className={`text-2xl font-black ${x.text} tracking-tight`}>{x.val}</p>
                          {x.sub && (
                            <span className="text-[7px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded-md shadow-lg shadow-blue-500/20 uppercase tracking-widest">
                              {x.sub}
                            </span>
                          )}
                        </div>
                        <p className={`text-[10px] font-black uppercase tracking-[0.15em] ${x.dark ? 'text-white/40' : 'text-gray-400'}`}>{x.label}</p>
                      </div>
                      <div className={`absolute -right-6 -bottom-6 w-20 h-20 rounded-full opacity-[0.05] group-hover:scale-125 transition-transform ${x.dark ? 'bg-white' : 'bg-current'}`} style={{ color: x.text.includes('blue') ? '#3b82f6' : x.text.includes('green') ? '#22c55e' : x.text.includes('amber') ? '#f59e0b' : '#10b981' }} />
                    </div>
                  ))}
                </div>

                <div className="overflow-hidden rounded-[2rem] border border-gray-100 shadow-sm bg-gray-50/30">
                  {/* Desktop Table View */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-white text-gray-400 text-left">
                          <th className="py-5 px-6 font-black uppercase tracking-widest">Member</th>
                          <th className="text-center py-5 px-4 font-black uppercase tracking-widest">History</th>
                          <th className="text-center py-5 px-4 font-black uppercase tracking-widest">Activity</th>
                          <th className="text-right py-5 px-4 font-black uppercase tracking-widest">Base</th>
                          <th className="text-right py-5 px-4 font-black uppercase tracking-widest text-amber-600">Commission</th>
                          <th className="text-right py-5 px-6 font-black uppercase tracking-widest text-emerald-600">Final</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {commData.staff.map(s => (
                          <tr key={s.user._id} className="hover:bg-white transition-colors group">
                            <td className="py-5 px-6">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${ROLE_GRADIENT[s.user.role] || 'from-gray-400 to-gray-500'} flex items-center justify-center text-white text-sm font-black uppercase shadow-lg group-hover:scale-110 transition-transform`}>
                                  {s.user.name?.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-black text-gray-900 text-sm">{s.user.name}</p>
                                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{s.user.role}</p>
                                </div>
                              </div>
                            </td>
                            <td className="text-center py-5 px-4">
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-[10px] font-black">
                                <span className="text-green-600">{s.attendance.present + s.attendance.late}P</span>
                                <span className="w-1 h-1 rounded-full bg-gray-300" />
                                <span className="text-amber-500">{s.attendance.half_day}H</span>
                              </div>
                            </td>
                            <td className="text-center py-5 px-4">
                              <div className="flex flex-col">
                                 <span className="font-black text-blue-600 text-sm">{s.totalDeliveries || 0}</span>
                                 <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">delivered</span>
                              </div>
                            </td>
                            <td className="text-right py-5 px-4 text-gray-400 font-bold text-[10px]">
                              {editingComm?.userId === s.user._id && editingComm?.field === 'base' ? (
                                <div className="flex items-center justify-end gap-1">
                                  <input type="number" className="w-16 px-2 py-1 bg-white border border-gray-200 rounded text-right text-[10px] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                    value={editVal} onChange={e => setEditVal(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && handleSaveOverride()} />
                                  <button onClick={handleSaveOverride} className="text-emerald-500">✓</button>
                                  <button onClick={() => setEditingComm(null)} className="text-red-400">×</button>
                                </div>
                              ) : (
                                <div className="cursor-pointer hover:text-gray-900 group/cell" onClick={() => {
                                  setEditingComm({ userId: s.user._id, field: 'base' });
                                  setEditVal(s.basePay);
                                }}>
                                  ₹{s.basePay?.toLocaleString()}
                                  <div className="text-[8px] opacity-0 group-hover/cell:opacity-60 font-black">EDIT BASE</div>
                                  <div className="text-[8px] opacity-60 font-black group-hover/cell:hidden">BASE</div>
                                </div>
                              )}
                            </td>
                            <td className="text-right py-5 px-4">
                              <div className="flex flex-col items-end">
                                {editingComm?.userId === s.user._id && editingComm?.field === 'commission' ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <input type="number" className="w-20 px-2 py-1 bg-white border border-gray-200 rounded text-right text-xs font-black focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                      value={editVal} onChange={e => setEditVal(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && handleSaveOverride()} />
                                    <button onClick={handleSaveOverride} className="text-emerald-500">✓</button>
                                    <button onClick={() => setEditingComm(null)} className="text-red-400">×</button>
                                  </div>
                                ) : (
                                  <div className="cursor-pointer hover:bg-amber-50 rounded-lg p-1 transition-colors group/comm" onClick={() => {
                                    setEditingComm({ userId: s.user._id, field: 'commission' });
                                    setEditVal(s.totalCommission);
                                  }}>
                                    <span className="font-black text-amber-600 text-sm">₹{(s.totalCommission || 0).toLocaleString()}</span>
                                    <div className="text-[9px] text-amber-400 font-bold uppercase tracking-tighter">
                                      @{s.user.commissionRate || 5}% <span className="opacity-0 group-hover/comm:opacity-100">· EDIT</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="text-right py-5 px-6">
                              <span className="text-base font-black text-gray-900 tracking-tight">₹{s.totalPay?.toLocaleString()}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="lg:hidden divide-y divide-gray-100">
                    {commData.staff.map(s => (
                      <div key={s.user._id} className="p-5 bg-white space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${ROLE_GRADIENT[s.user.role] || 'from-gray-400 to-gray-500'} flex items-center justify-center text-white text-sm font-black uppercase shadow-lg`}>
                              {s.user.name?.charAt(0)}
                            </div>
                            <div>
                              <p className="font-black text-gray-900 text-sm">{s.user.name}</p>
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{s.user.role}</p>
                            </div>
                          </div>
                          <div className="text-right">
                             <p className="text-sm font-black text-emerald-600 tracking-tight">₹{s.totalPay?.toLocaleString()}</p>
                             <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Total Payout</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
                             <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Attendance</p>
                             <div className="flex items-center gap-2">
                               <span className="text-[11px] font-black text-green-600">{s.attendance.present + s.attendance.late}P</span>
                               <span className="text-[11px] font-black text-amber-500">{s.attendance.half_day}H</span>
                             </div>
                          </div>
                          <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
                             <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Performance</p>
                             <p className="text-[11px] font-black text-blue-600">{s.totalDeliveries || 0} Delivered</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-1">
                             <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Base Pay</p>
                             <p className="text-xs font-black text-gray-800">₹{s.basePay?.toLocaleString()}</p>
                          </div>
                          <div className="p-1 text-right">
                             <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Commission</p>
                             <p className="text-xs font-black text-amber-600">₹{(s.totalCommission || 0).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {commData.unassignedDeliveries > 0 && (
                    <div className="bg-gray-50/50 italic border-t-2 border-dashed border-gray-200 p-5 lg:p-0">
                      {/* Desktop unassigned */}
                      <table className="hidden lg:table w-full text-xs opacity-60">
                        <tbody>
                          <tr>
                            <td className="py-5 px-6 w-[20%]">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-gray-200 flex items-center justify-center text-gray-400 text-sm font-black uppercase shadow-sm">U</div>
                                <div>
                                  <p className="font-black text-gray-500 text-sm">Unassigned Orders</p>
                                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">No Staff Assigned</p>
                                </div>
                              </div>
                            </td>
                            <td className="text-center py-5 px-4 w-[15%]">—</td>
                            <td className="text-center py-5 px-4 w-[15%]">
                              <div className="flex flex-col">
                                 <span className="font-black text-gray-400 text-sm">{commData.unassignedDeliveries}</span>
                                 <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">delivered</span>
                              </div>
                            </td>
                            <td className="text-right py-5 px-4 w-[15%]">
                              <div className="flex flex-col items-end opacity-40">
                                 <span className="font-black text-gray-500 text-[10px]">₹{commData.unassignedRevenue?.toLocaleString()}</span>
                                 <span className="text-[8px] font-black uppercase tracking-tighter">revenue</span>
                               </div>
                            </td>
                            <td className="text-right py-5 px-4 w-[15%]">—</td>
                            <td className="text-right py-5 px-6 w-[20%]">—</td>
                          </tr>
                        </tbody>
                      </table>
                      {/* Mobile unassigned */}
                      <div className="lg:hidden flex items-center justify-between opacity-60">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-gray-200 flex items-center justify-center text-gray-400 text-xs font-black">U</div>
                            <div>
                              <p className="font-black text-gray-500 text-[10px]">Unassigned Orders</p>
                              <p className="text-[8px] text-gray-400 font-bold uppercase">{commData.unassignedDeliveries} Delivered</p>
                            </div>
                         </div>
                         <p className="text-[10px] font-black text-gray-500">₹{commData.unassignedRevenue?.toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400 text-center py-10 italic">No salary data available for this month</p>
            )}
          </div>
        )}
      </div>

      {/* Staff Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {users.map(u => {
          const att = getAttendanceForUser(u._id);
          const status = att?.checkIn
            ? att.checkOut
              ? { label: 'SHIFT OVER', bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-100', icon: <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg> }
              : { label: 'WORKING', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100', icon: <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 2"/></svg> }
            : { label: 'ABSENT', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100', icon: <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg> };
          
          return (
            <div key={u._id} className="group relative bg-white rounded-[2rem] p-6 shadow-sm hover:shadow-2xl transition-all hover:-translate-y-1 cursor-pointer border border-gray-100"
              onClick={() => openUser(u)}>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${ROLE_GRADIENT[u.role] || 'from-gray-400 to-gray-500'} flex items-center justify-center text-white text-lg font-black uppercase shadow-lg shadow-black/10 group-hover:scale-110 transition-transform`}>
                  {u.name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-black text-gray-900 truncate tracking-tight">{u.name}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{u.role}</p>
                </div>
              </div>
              
              <div className="mt-6 flex items-center justify-between">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${status.bg} ${status.text} ${status.border}`}>
                  {status.icon}
                  <span className="text-[10px] font-black tracking-widest uppercase">{status.label}</span>
                </div>
                {att?.checkIn && (
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">In Time</p>
                      <p className="text-xs font-black text-gray-900">{formatTime(att.checkIn)}</p>
                    </div>
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
