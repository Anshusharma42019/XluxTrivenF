import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api';
import { 
  fetchStats, 
  fetchStaffStats,
  saveStaffTarget, 
  fetchStaffVerifications, 
  fetchStaffTodayLists, 
  fetchStaffMonthlyChart, 
  fetchStaffCommission,
  fetchTargetHistory 
} from '../services/dashboard.service';
import * as attendanceSvc from '../services/attendance.service';
import { useToast } from '../context/ToastContext';

/* ─── Live Working Timer Hook ──────────────────────────────────── */
function useLiveTimer(checkInTime) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!checkInTime) return;
    const update = () => {
      const diff = Math.floor((Date.now() - new Date(checkInTime)) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(`${h}h ${m}m ${String(s).padStart(2,'0')}s`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [checkInTime]);
  return elapsed;
}

/* ─── Weekly Bar Chart ─────────────────────────────────────────── */
function WeeklyBarChart({ monthlyChart }) {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  // Build last 7 days
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const dayNum = d.getDate();
    const label = days[d.getDay()];
    const found = monthlyChart?.find(c => c.day === dayNum);
    return { label, day: dayNum, count: found?.count || 0, isToday: i === 6 };
  });
  const max = Math.max(...week.map(w => w.count), 1);
  return (
    <div className="flex items-end justify-between gap-1 h-24 px-1">
      {week.map((w, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[9px] font-black text-gray-500">{w.count > 0 ? w.count : ''}</span>
          <div className="w-full flex items-end" style={{ height: 60 }}>
            <div
              className={`w-full rounded-t-lg transition-all duration-500 ${
                w.isToday ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-gray-200 group-hover:bg-gray-300'
              }`}
              style={{ height: `${Math.max((w.count / max) * 60, w.count > 0 ? 8 : 3)}px` }}
            />
          </div>
          <span className={`text-[9px] font-bold ${w.isToday ? 'text-emerald-600' : 'text-gray-400'}`}>{w.label}</span>
        </div>
      ))}
    </div>
  );
}

const cardCls = "bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow";
const cardStyle = { border: '1px solid rgba(0,0,0,0.05)' };

const icons = {
  cnp: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M16.5 1.5a4.5 4.5 0 0 1 4.5 4.5v12a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 18V6a4.5 4.5 0 0 1 4.5-4.5h9z"/><line x1="4" y1="4" x2="20" y2="20"/></svg>,
  callAgain: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.61 19a19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 3.09 4.18 2 2 0 0 1 5.07 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L9.91 9.91a16 16 0 0 0 6.18 6.18l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  interested: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  notInterested: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  verification: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  user: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  phone: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.61 19a19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 3.09 4.18 2 2 0 0 1 5.07 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L9.91 9.91a16 16 0 0 0 6.18 6.18l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  location: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
};

export default function StaffDashboard() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const { success, error, info } = useToast();
  const [stats, setStats] = useState(null);
  const [todayLists, setTodayLists] = useState({ cnpList: [], callAgainList: [], interestedList: [], notInterestedList: [] });
  const [monthlyChart, setMonthlyChart] = useState([]);
  const [openSection, setOpenSection] = useState(null);
  const [targetInput, setTargetInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [streak, setStreak] = useState(0);
  const [attStatus, setAttStatus] = useState(null);
  const [attLoading, setAttLoading] = useState(false);
  const [commission, setCommission] = useState(null);
  const [commMonth, setCommMonth] = useState(() => { const n = new Date(); return { month: n.getMonth(), year: n.getFullYear() }; });
  const [commLoading, setCommLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [targetHistory, setTargetHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyMode, setHistoryMode] = useState('days'); // 'days' or 'month'
  const [historyDays, setHistoryDays] = useState(7);
  const [historyMonth, setHistoryMonth] = useState(() => { const n = new Date(); return { month: n.getMonth(), year: n.getFullYear() }; });

  const workingTime = useLiveTimer(attStatus?.checkIn && !attStatus?.checkOut ? attStatus.checkIn : null);

  const MOTIVATIONS = [
    'Sunday warrior — legends don\'t take days off! 💪🔥',
    'MONDAY BEAST MODE ON — Own the week before it owns you! ⚡🚀',
    'Tuesday TAKEOVER — Every call is a chance to WIN! 🎯💥',
    'Hump day HUSTLE — You\'re unstoppable, keep PUSHING! 🔥💪',
    'Thursday THUNDER — Go harder than yesterday! ⚡🌩️',
    'FRIDAY FIRE — Close strong, finish like a champion! 🔥🏆',
    'Saturday GRIND — Champions are made when no one\'s watching! 🌟💼',
  ];
  const motiveLine = MOTIVATIONS[new Date().getDay()];

  const load = useCallback(async () => {
    try {
      // Sync fresh user profile from DB to dynamically reflect any department changes by Admin in real-time
      API.get('/users/me').then(res => {
        if (res.data && res.data.data) {
          updateUser(res.data.data);
        }
      }).catch(() => {});

      const [s, staffS, lists, chart, att] = await Promise.allSettled([
        fetchStats(), 
        fetchStaffStats(),
        fetchStaffTodayLists(),
        fetchStaffMonthlyChart(), 
        attendanceSvc.getTodayStatus()
      ]);
      
      if (s.status === 'fulfilled' || staffS.status === 'fulfilled') {
        setStats({
          ...(s.status === 'fulfilled' ? s.value : {}),
          ...(staffS.status === 'fulfilled' ? staffS.value : {})
        });
      }
      if (lists?.status === 'fulfilled') setTodayLists(lists.value || { cnpList: [], callAgainList: [], interestedList: [], notInterestedList: [], onHoldList: [], verificationList: [] });
      if (chart.status === 'fulfilled') setMonthlyChart(Array.isArray(chart.value) ? chart.value : []);
      if (att.status === 'fulfilled') setAttStatus(att.value);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  // Calculate streak from target history
  useEffect(() => {
    fetchTargetHistory(null, null, 30)
      .then(history => {
        if (!Array.isArray(history)) return;
        const sorted = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
        let s = 0;
        for (const row of sorted) {
          if (row.target > 0 && row.achieved) s++;
          else if (row.target > 0) break;
        }
        setStreak(s);
      }).catch(() => {});
  }, [stats?.todayVerifications]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  // Reset check-in gate at midnight (day change)
  useEffect(() => {
    const msUntilMidnight = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      return midnight - now;
    };
    const t = setTimeout(() => {
      setAttStatus(null);
      load();
    }, msUntilMidnight());
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    setCommLoading(true);
    fetchStaffCommission(commMonth.month, commMonth.year)
      .then(d => { if (!cancelled) setCommission(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCommLoading(false); });
    return () => { cancelled = true; };
  }, [commMonth]);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    const promise = historyMode === 'days' 
      ? fetchTargetHistory(null, null, historyDays)
      : fetchTargetHistory(historyMonth.month, historyMonth.year, null);
      
    promise
      .then(d => { if (!cancelled) setTargetHistory(Array.isArray(d) ? d : []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [historyMode, historyDays, historyMonth]);

  const handleSaveTarget = async (e) => {
    e.preventDefault();
    if (!targetInput || Number(targetInput) < 1) return;
    setSaving(true);
    try {
      const data = await saveStaffTarget(Number(targetInput));
      setStats(prev => ({ ...prev, todayTarget: data.todayTarget }));
      setEditing(false);
      setTargetInput('');
      success(`Today's target set to ${data.todayTarget} verifications.`, 'Target Set');
      load();
      const promise = historyMode === 'days' 
        ? fetchTargetHistory(null, null, historyDays)
        : fetchTargetHistory(historyMonth.month, historyMonth.year, null);
      promise.then(d => setTargetHistory(Array.isArray(d) ? d : [])).catch(() => {});
    } catch (err) {
      error(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const DEPT_COLOR = {
    migraine: 'bg-purple-50 text-purple-600 border-purple-100',
    piles: 'bg-amber-50 text-amber-600 border-amber-100',
    logistics: 'bg-blue-50 text-blue-600 border-blue-100',
  };

  const done = stats?.todayVerifications ?? stats?.verifiedCount ?? 0;
  const target = stats?.todayTarget || 0;
  const remaining = target > 0 ? Math.max(target - done, 0) : 0;
  const achieved = target > 0 && done >= target;
  const progressPct = target > 0 ? Math.min(Math.round((done / target) * 100), 100) : 0;
  const progressTone = achieved ? 'emerald' : progressPct >= 60 ? 'amber' : 'rose';
  const onHoldList = todayLists.onHoldList || [];
  const dueWorkCount = (todayLists.verificationList || []).filter(v => ['pending', 'on_hold'].includes(v.status)).length + (todayLists.callAgainList?.length || 0);
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const checkedIn = !!attStatus?.checkIn;
  const checkedOut = !!attStatus?.checkOut;
  const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : null;

  const handleCheckIn = async () => {
    setAttLoading(true);
    try { 
      const res = await attendanceSvc.checkIn(); 
      setAttStatus(res);
      const isReCheckIn = !!attStatus?.checkOut;
      success(isReCheckIn ? 'Welcome back! Second session started.' : 'Good morning! You have checked in successfully.', 'Clock In');
    }
    catch (e) { error(e.response?.data?.message || 'Check-in failed'); }
    setAttLoading(false);
  };
  const handleCheckOut = async () => {
    setAttLoading(true);
    try { 
      const res = await attendanceSvc.checkOut(); 
      setAttStatus(res); 
      info('Work day finished. Take care!', 'Clock Out');
    }
    catch (e) { error(e.response?.data?.message || 'Check-out failed'); }
    setAttLoading(false);
  };

  const openByPhone = (path, item) => {
    const phone = item?.lead?.phone || item?.phone || '';
    navigate(phone ? `${path}?phone=${encodeURIComponent(phone)}` : path);
  };

  const [chartFilter, setChartFilter] = useState('month');
  const [chartCustomFrom, setChartCustomFrom] = useState('');
  const [chartCustomTo, setChartCustomTo] = useState('');

  const filteredChartData = useMemo(() => {
    if (!monthlyChart.length) return [];
    const today = new Date();
    const todayDay = today.getDate();
    const yesterdayDay = new Date(today.getTime() - 86400000).getDate();
    if (chartFilter === 'today') return monthlyChart.filter(d => d.day === todayDay);
    if (chartFilter === 'yesterday') return monthlyChart.filter(d => d.day === yesterdayDay);
    if (chartFilter === '7d') return monthlyChart.filter(d => d.day >= todayDay - 6);
    if (chartFilter === 'custom' && chartCustomFrom && chartCustomTo) {
      const from = new Date(chartCustomFrom).getDate();
      const to = new Date(chartCustomTo).getDate();
      return monthlyChart.filter(d => d.day >= from && d.day <= to);
    }
    return monthlyChart;
  }, [monthlyChart, chartFilter, chartCustomFrom, chartCustomTo]);

  const [workFilter, setWorkFilter] = useState('today');
  const [workCustomDate, setWorkCustomDate] = useState('');
  const [workLists, setWorkLists] = useState({ cnpList: [], callAgainList: [], interestedList: [], notInterestedList: [], onHoldList: [], verificationList: [] });
  const [workLoading, setWorkLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setWorkLoading(true);
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const sevenDaysStr = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];

    let date, from, to;
    if (workFilter === 'today') { date = todayStr; from = todayStr; to = todayStr; }
    else if (workFilter === 'yesterday') { date = yesterdayStr; from = yesterdayStr; to = yesterdayStr; }
    else if (workFilter === '7d') { from = sevenDaysStr; to = todayStr; }
    else if (workFilter === 'custom' && workCustomDate) { date = workCustomDate; from = workCustomDate; to = workCustomDate; }

    fetchStaffTodayLists(date, null, from, to)
      .then(d => {
        if (!cancelled) {
          setWorkLists(d || { cnpList: [], callAgainList: [], interestedList: [], notInterestedList: [], onHoldList: [], verificationList: [] });
          setOpenSection(null); // reset open section on filter change
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setWorkLoading(false); });
    return () => { cancelled = true; };
  }, [workFilter, workCustomDate]);

  const workQueues = [
    { key: 'verifications', label: 'Verification Tasks', icon: icons.verification, color: 'text-blue-600', bg: 'bg-blue-50', list: workLists.verificationList || [], path: '/verification' },
    { key: 'callAgain', label: 'Call Again', icon: icons.callAgain, color: 'text-yellow-600', bg: 'bg-yellow-50', list: workLists.callAgainList || [], path: '/call-again' },
    { key: 'cnp', label: 'CNP', icon: icons.cnp, color: 'text-red-500', bg: 'bg-red-50', list: workLists.cnpList || [], path: '/cnp' },
    { key: 'interested', label: 'Interested', icon: icons.interested, color: 'text-green-600', bg: 'bg-green-50', list: workLists.interestedList || [], path: '/pipeline' },
    { key: 'onHold', label: 'On Hold', icon: icons.callAgain, color: 'text-gray-600', bg: 'bg-gray-50', list: workLists.onHoldList || [], path: '/verification' },
  ];

  const openWorkItem = (queue, item) => {
    if (queue.key === 'verifications' || queue.key === 'onHold') {
      navigate(`/verification?openId=${item._id}`);
      return;
    }
    if (queue.key === 'interested' && item?._id) {
      navigate(`/tasks?openId=${item._id}`);
      return;
    }
    openByPhone(queue.path, item);
  };

  if (loading && !stats) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-gray-400">
        <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        Loading your dashboard...
      </div>
    </div>
  );

  // No full-page gate — the attendance card below handles check-in/check-out inline.

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">My Dashboard</h2>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <p className="text-sm text-gray-400">Welcome back, {user?.name}! · {today}</p>
            {user?.departments?.length > 0 && (
              <div className="flex gap-1">
                {user.departments.map(d => (
                  <span key={d} className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${DEPT_COLOR[d] || 'bg-blue-50 text-blue-600 border-blue-100'}`}>{d}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ PERSONAL ATTENDANCE CARD — TOP ═══ */}
      <div className="relative rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #052e16 0%, #14532d 50%, #166534 100%)', boxShadow: '0 8px 32px rgba(5,150,105,0.2)' }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #4ade80, transparent)' }} />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #86efac, transparent)' }} />
        <div className="relative px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
                {checkedIn && !checkedOut && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-emerald-900 animate-pulse" />
                )}
                <svg className="w-7 h-7 text-emerald-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/70 mb-0.5">Personal Attendance</p>
                <p className="text-white font-bold text-base leading-tight">
                  {checkedIn && checkedOut ? 'Day Complete 🎉'
                    : checkedIn ? `Working since ${fmtTime(attStatus.checkIn)}`
                    : '⚠️ Not checked in yet'}
                </p>
                {checkedIn && checkedOut && (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-emerald-300/70 text-xs">🕐 In: <span className="font-bold text-emerald-300">{fmtTime(attStatus.checkIn)}</span> &nbsp;·&nbsp; 🕔 Out: <span className="font-bold text-emerald-300">{fmtTime(attStatus.checkOut)}</span></p>
                    {attStatus.sessionDuration && <p className="text-emerald-300/60 text-xs font-mono">⏱ Total: <span className="font-bold text-emerald-200">{attStatus.sessionDuration}</span></p>}
                  </div>
                )}
                {workingTime && !checkedOut && (
                  <p className="text-emerald-300/80 text-xs font-mono mt-0.5">⏱ {workingTime}</p>
                )}
                {/* Day-based motivation line */}
                <p className="text-amber-300/90 text-[11px] font-bold mt-1 tracking-wide">{motiveLine}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {checkedIn && (
                <div className="hidden sm:flex items-center gap-3">
                  <div className="text-center px-4 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <p className="text-lg font-black text-white">{done}</p>
                    <p className="text-[9px] text-emerald-300/60 uppercase tracking-widest">Done</p>
                  </div>
                  <div className="text-center px-4 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <p className="text-lg font-black text-white">{target || '—'}</p>
                    <p className="text-[9px] text-emerald-300/60 uppercase tracking-widest">Target</p>
                  </div>
                  <div className="text-center px-4 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <p className={`text-lg font-black ${achieved ? 'text-emerald-300' : 'text-amber-300'}`}>{progressPct}%</p>
                    <p className="text-[9px] text-emerald-300/60 uppercase tracking-widest">Progress</p>
                  </div>
                </div>
              )}
              {!checkedIn ? (
                <button onClick={handleCheckIn} disabled={attLoading}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-black text-emerald-900 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #4ade80, #22c55e)' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                  {attLoading ? 'Processing...' : 'Clock In'}
                </button>
              ) : !checkedOut ? (
                <button onClick={handleCheckOut} disabled={attLoading}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-black text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  {attLoading ? 'Processing...' : 'Clock Out'}
                </button>
              ) : (
                <button onClick={handleCheckIn} disabled={attLoading}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-black text-emerald-900 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #4ade80, #22c55e)' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                  {attLoading ? 'Processing...' : 'Clock In Again'}
                </button>
              )}
            </div>
          </div>
          {checkedIn && target > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-emerald-400/60 uppercase tracking-widest">Today's Target Progress</span>
                <span className={`text-[10px] font-black ${achieved ? 'text-emerald-400' : 'text-amber-400'}`}>{done}/{target} · {progressPct}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div className={`h-full rounded-full transition-all duration-700 ${achieved ? 'bg-emerald-400' : progressPct >= 60 ? 'bg-amber-400' : 'bg-rose-400'}`}
                  style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ STREAK BANNER (if streak > 2) ═══ */}
      {streak >= 3 && (
        <div className="rounded-2xl px-5 py-3 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #78350f, #92400e)', border: '1px solid #b45309' }}>
          <span className="text-2xl">🔥</span>
          <div>
            <p className="text-white font-black text-sm">{streak} Day Streak! Keep it up!</p>
            <p className="text-amber-300/70 text-xs">You've hit your target {streak} days in a row. Amazing consistency!</p>
          </div>
        </div>
      )}

      {/* Today Command Center */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className={`${cardCls} xl:col-span-1`} style={cardStyle}>
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Today Progress</h3>
              <p className="text-xs text-gray-400 mt-0.5">{target > 0 ? `${remaining} remaining from ${target}` : 'Set target to start tracking'}</p>
            </div>
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase ${
              achieved ? 'bg-emerald-50 text-emerald-600' : target > 0 ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-500'
            }`}>
              {achieved ? 'Achieved' : target > 0 ? 'In Progress' : 'No Target'}
            </span>
          </div>
          <div className="flex items-end justify-between gap-4 mb-3">
            <div>
              <p className="text-4xl font-black text-gray-900 leading-none">{done}<span className="text-xl text-gray-300">/{target || '-'}</span></p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-2">Verifications</p>
            </div>
            <div className={`text-3xl font-black ${
              progressTone === 'emerald' ? 'text-emerald-600' : progressTone === 'amber' ? 'text-amber-500' : 'text-rose-500'
            }`}>
              {progressPct}%
            </div>
          </div>
          <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                progressTone === 'emerald' ? 'bg-emerald-500' : progressTone === 'amber' ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-5">
            <div className="rounded-xl bg-blue-50 text-blue-700 px-3 py-3">
              <p className="text-lg font-black">{stats?.monthVerifications ?? 0}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider">Month</p>
            </div>
            <div className="rounded-xl bg-purple-50 text-purple-700 px-3 py-3">
              <p className="text-lg font-black">{stats?.pendingTasks ?? stats?.tasks?.pending ?? 0}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider">Tasks</p>
            </div>
            <div className="rounded-xl bg-amber-50 text-amber-700 px-3 py-3">
              <p className="text-lg font-black">{stats?.leadsAdded ?? 0}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider">Leads</p>
            </div>
          </div>
        </div>

        <div className={`${cardCls} xl:col-span-2`} style={cardStyle}>
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Today's Work</h3>
              <p className="text-xs text-gray-400 mt-0.5">Open the queue and continue from the exact customer.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
                {[{id:'today',label:'Today'},{id:'yesterday',label:'Yesterday'},{id:'7d',label:'7 Days'}].map(f => (
                  <button key={f.id} onClick={() => setWorkFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
                      workFilter === f.id ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}>{f.label}</button>
                ))}
                <button onClick={() => setWorkFilter('custom')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
                    workFilter === 'custom' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}>Date</button>
              </div>
              {workFilter === 'custom' && (
                <input type="date" value={workCustomDate} onChange={e => setWorkCustomDate(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-green-400 bg-gray-50" />
              )}
              {workLoading
                ? <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                : <button onClick={() => setWorkFilter(prev => prev)} className="text-xs font-bold text-green-600 bg-green-50 hover:bg-green-100 px-3 py-2 rounded-xl transition">Refresh</button>
              }
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {workQueues.map(queue => (
              <div key={queue.key} className="rounded-2xl border border-gray-100 bg-gray-50/40 overflow-hidden">
                <button className="w-full flex items-center justify-between gap-3 p-3"
                  onClick={() => setOpenSection(openSection === queue.key ? null : queue.key)}>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={`w-8 h-8 rounded-xl ${queue.bg} ${queue.color} flex items-center justify-center shrink-0`}>{queue.icon}</span>
                    <span className="text-sm font-bold text-gray-700 truncate">{queue.label}</span>
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-full ${queue.bg} ${queue.color}`}>{queue.list.length}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-lg ${
                      workFilter === 'today' ? 'bg-green-50 text-green-600' :
                      workFilter === 'yesterday' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {workFilter === 'today' ? 'Today' : workFilter === 'yesterday' ? 'Yest.' : '7D'}
                    </span>
                  </div>
                </button>
                {(openSection === queue.key) && (
                  <div className="px-3 pb-3 max-h-56 overflow-y-auto custom-scrollbar">
                    {queue.list.length === 0 ? (
                      <div className="rounded-xl bg-white border border-dashed border-gray-200 py-5 text-center">
                        <p className="text-xs font-medium text-gray-400">No records right now</p>
                      </div>
                    ) : queue.list.slice(0, 50).map((item, i) => {
                      const phone = item.lead?.phone || item.phone;
                      return (
                        <div key={item._id || i} className="rounded-xl bg-white border border-gray-100 p-3 mb-2 last:mb-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-gray-800 truncate">{item.title || item.lead?.name || 'Customer'}</p>
                              <div className="flex items-center gap-2 flex-wrap mt-1">
                                {item.lead?.name && <span className="text-[10px] text-gray-500">{item.lead.name}</span>}
                                {phone && <span className="text-[10px] text-gray-400">{phone}</span>}
                                {item.department && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 uppercase">{item.department}</span>}
                              </div>
                            </div>
                            {item.status && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 uppercase shrink-0">
                                {item.status.replace(/_/g, ' ')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                            <button onClick={() => openWorkItem(queue, item)} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-[10px] font-bold hover:bg-gray-800 transition">
                              Open
                            </button>
                            {phone && (
                              <a href={`tel:${phone}`} className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-[10px] font-bold hover:bg-green-100 transition">
                                Call
                              </a>
                            )}
                            <button onClick={() => navigate('/verification')} className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-bold hover:bg-blue-100 transition">
                              Verify
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Target Setter */}
      <div className={cardCls} style={cardStyle}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-800 tracking-tight">Daily Target</h3>
              <p className="text-[10px] text-gray-400">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
            </div>
          </div>
          {target > 0 && !editing && (
            <button onClick={() => { setEditing(true); setTargetInput(String(target)); }}
              className="text-[11px] font-black text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-all border border-emerald-100">
              ✏ Change
            </button>
          )}
        </div>

        {(!target || editing) ? (
          <form onSubmit={handleSaveTarget} className="space-y-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Quick Select</p>
              <div className="flex items-center gap-2 flex-wrap">
                {[5, 10, 15, 20, 25].map(q => (
                  <button key={q} type="button"
                    onClick={() => setTargetInput(String(q))}
                    className={`w-12 h-12 rounded-2xl text-sm font-black border-2 transition-all ${
                      targetInput === String(q)
                        ? 'bg-emerald-600 text-white border-emerald-600 scale-105 shadow-lg shadow-emerald-100'
                        : 'bg-gray-50 text-gray-600 border-gray-100 hover:border-emerald-300 hover:text-emerald-600'
                    }`}>
                    {q}
                  </button>
                ))}
                <span className="text-gray-300 font-bold">|</span>
                <input type="number" min="1" max="500" value={targetInput}
                  onChange={e => setTargetInput(e.target.value)}
                  placeholder="Custom"
                  className="w-20 h-12 border-2 border-gray-100 rounded-2xl px-3 text-sm font-black text-center focus:outline-none focus:border-emerald-400 bg-gray-50" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="submit" disabled={saving || !targetInput}
                className="flex-1 py-3 rounded-2xl text-sm font-black text-white disabled:opacity-50 transition-all hover:-translate-y-0.5 hover:shadow-lg"
                style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
                {saving ? 'Saving...' : '🎯 Set Target'}
              </button>
              {editing && target > 0 && (
                <button type="button" onClick={() => setEditing(false)}
                  className="px-5 py-3 rounded-2xl text-sm font-bold text-gray-500 border-2 border-gray-100 hover:bg-gray-50">
                  Cancel
                </button>
              )}
            </div>
          </form>
        ) : (
          <>
            {/* Progress ring + stats */}
            <div className="flex items-center gap-5 mb-5">
              {/* Circular progress */}
              <div className="relative shrink-0" style={{ width: 80, height: 80 }}>
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="#f3f4f6" strokeWidth="8"/>
                  <circle cx="40" cy="40" r="32" fill="none"
                    stroke={achieved ? '#10b981' : progressPct >= 60 ? '#f59e0b' : '#f43f5e'}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 32}`}
                    strokeDashoffset={`${2 * Math.PI * 32 * (1 - progressPct / 100)}`}
                    transform="rotate(-90 40 40)"
                    style={{ transition: 'stroke-dashoffset 0.7s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-lg font-black leading-none ${
                    achieved ? 'text-emerald-600' : progressPct >= 60 ? 'text-amber-500' : 'text-rose-500'
                  }`}>{progressPct}%</span>
                </div>
              </div>
              {/* Stats */}
              <div className="flex-1 grid grid-cols-3 gap-3">
                <div className="rounded-2xl p-3 text-center bg-emerald-50 border border-emerald-200">
                  <p className="text-2xl font-black text-emerald-700 leading-none">{done}</p>
                  <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mt-1">Done</p>
                </div>
                <div className={`rounded-2xl p-3 text-center border ${achieved ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'}`}>
                  <p className={`text-2xl font-black leading-none ${achieved ? 'text-emerald-700' : 'text-orange-700'}`}>
                    {achieved ? '✓' : remaining}
                  </p>
                  <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${achieved ? 'text-emerald-700' : 'text-orange-700'}`}>
                    {achieved ? 'Done!' : 'Left'}
                  </p>
                </div>
                <div className="rounded-2xl p-3 text-center bg-blue-50 border border-blue-200">
                  <p className="text-2xl font-black text-blue-700 leading-none">{target}</p>
                  <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest mt-1">Target</p>
                </div>
              </div>
            </div>
            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1.5">
                <span className="text-gray-400">Progress</span>
                <span className={achieved ? 'text-emerald-600' : progressPct >= 60 ? 'text-amber-500' : 'text-rose-500'}>
                  {achieved ? '🎉 Target Achieved!' : `${done} of ${target} done`}
                </span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    achieved ? 'bg-emerald-500' : progressPct >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Target History */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {/* Header */}
        <div className="px-5 pt-5 pb-4 flex items-center justify-between" style={{ borderBottom: '1px solid #f3f4f6' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            </div>
            <h3 className="text-sm font-black text-gray-800">Target History</h3>
          </div>
          <div className="flex items-center gap-2">
            {/* Days filter */}
            <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
              {[7, 15].map(d => (
                <button key={d} onClick={() => { setHistoryMode('days'); setHistoryDays(d); }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                    historyMode === 'days' && historyDays === d
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}>{d}D</button>
              ))}
            </div>
            {/* Month nav */}
            <div className="flex items-center gap-1">
              <button onClick={() => { setHistoryMode('month'); setHistoryMonth(p => { const m = p.month-1; return m<0?{month:11,year:p.year-1}:{month:m,year:p.year}; }); }}
                className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className={`text-[11px] font-black min-w-[72px] text-center uppercase tracking-tight ${ historyMode === 'month' ? 'text-violet-600' : 'text-gray-500'}`}>
                {new Date(historyMonth.year, historyMonth.month).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
              </span>
              <button onClick={() => { setHistoryMode('month'); setHistoryMonth(p => { const m = p.month+1; return m>11?{month:0,year:p.year+1}:{month:m,year:p.year}; }); }}
                className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>
        </div>

        {historyLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : targetHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            </div>
            <p className="text-xs font-bold text-gray-400">No target history found</p>
          </div>
        ) : (
          <>
            {/* Summary strip */}
            {(() => {
              const withTarget = targetHistory.filter(r => r.target > 0);
              const totalTarget = withTarget.reduce((s, r) => s + r.target, 0);
              const totalDone = targetHistory.reduce((s, r) => s + r.completed, 0);
              const achievedDays = withTarget.filter(r => r.achieved).length;
              const overallPct = totalTarget > 0 ? Math.round((totalDone / totalTarget) * 100) : 0;
              return withTarget.length > 0 ? (
                <div className="grid grid-cols-3 divide-x divide-gray-100 bg-gray-50 border-b border-gray-100">
                  {[
                    { label: 'Total Done', value: `${totalDone}`, sub: `of ${totalTarget}`, color: 'text-gray-800' },
                    { label: 'Days Achieved', value: `${achievedDays}`, sub: `of ${withTarget.length}`, color: 'text-emerald-700' },
                    { label: 'Overall', value: `${overallPct}%`, sub: overallPct >= 80 ? '🎉 Great!' : overallPct >= 50 ? '📈 Keep going' : '💪 Push more', color: overallPct >= 80 ? 'text-emerald-700' : overallPct >= 50 ? 'text-amber-700' : 'text-rose-700' },
                  ].map((s, i) => (
                    <div key={i} className="px-5 py-3 text-center">
                      <p className={`text-xl font-black ${s.color}`}>{s.value} <span className="text-xs font-bold text-gray-400">{s.sub}</span></p>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              ) : null;
            })()}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Date', 'Target', 'Done', 'Remaining', 'Verified', 'Status'].map(h => (
                      <th key={h} className={`py-3 px-5 text-[10px] font-black uppercase tracking-widest text-gray-400 ${h === 'Date' ? 'text-left' : 'text-center'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {targetHistory.map((row) => {
                    const rem = row.target > 0 ? Math.max(row.target - row.completed, 0) : 0;
                    const pct = row.target > 0 ? Math.min(Math.round((row.completed / row.target) * 100), 100) : 0;
                    const isToday = row.date === new Date().toISOString().slice(0, 10);
                    const barColor = row.achieved ? '#10b981' : pct >= 50 ? '#f59e0b' : '#f43f5e';
                    return (
                      <tr key={row.date}
                        className="transition-colors hover:bg-violet-50/30"
                        style={{ borderBottom: '1px solid #f9fafb', background: isToday ? 'rgba(124,58,237,0.03)' : undefined }}>
                        {/* Date */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2">
                            {isToday && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse shrink-0" />}
                            <div>
                              <span className={`text-xs font-black ${isToday ? 'text-violet-700' : 'text-gray-700'}`}>
                                {new Date(row.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                              <span className="text-[10px] text-gray-400 font-bold ml-1.5">
                                {new Date(row.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}
                              </span>
                            </div>
                          </div>
                        </td>
                        {/* Target */}
                        <td className="py-3.5 px-5 text-center">
                          {row.target > 0
                            ? <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-blue-50 text-blue-700 text-xs font-black">{row.target}</span>
                            : <span className="text-gray-300 font-bold">—</span>}
                        </td>
                        {/* Done */}
                        <td className="py-3.5 px-5 text-center">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-xl text-xs font-black ${
                            row.completed > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-300'
                          }`}>{row.completed}</span>
                        </td>
                        {/* Remaining */}
                        <td className="py-3.5 px-5 text-center">
                          {row.target > 0
                            ? <span className={`inline-flex items-center justify-center w-8 h-8 rounded-xl text-xs font-black ${
                                rem === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'
                              }`}>{rem === 0 ? '✓' : rem}</span>
                            : <span className="text-gray-300 font-bold">—</span>}
                        </td>
                        {/* Verified */}
                        <td className="py-3.5 px-5 text-center">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-xl text-xs font-black ${
                            row.verified > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-300'
                          }`}>{row.verified || 0}</span>
                        </td>
                        {/* Status */}
                        <td className="py-3.5 px-5">
                          {row.target > 0 ? (
                            <div className="flex flex-col items-center gap-1 min-w-[80px]">
                              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${pct}%`, background: barColor }} />
                              </div>
                              <span className="text-[10px] font-black" style={{ color: barColor }}>
                                {row.achieved ? '✓ Done' : `${pct}%`}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[9px] font-black text-gray-300 uppercase tracking-wide">No Target</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Earnings & Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`lg:col-span-1 ${cardCls}`} style={cardStyle}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-gray-700">Earnings</h3>
            <div className="flex items-center gap-1">
              <button onClick={() => setCommMonth(p => {
                const m = p.month - 1;
                return m < 0 ? { month: 11, year: p.year - 1 } : { month: m, year: p.year };
              })} className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"><svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>
              <span className="text-[10px] font-bold text-gray-600 min-w-[70px] text-center uppercase tracking-tight">
                {new Date(commMonth.year, commMonth.month).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
              </span>
              <button onClick={() => setCommMonth(p => {
                const m = p.month + 1;
                return m > 11 ? { month: 0, year: p.year + 1 } : { month: m, year: p.year };
              })} className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"><svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></button>
            </div>
          </div>
          {commLoading ? (
             <div className="flex items-center justify-center py-10"><div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : commission ? (
            <div className="space-y-4">
              <div className="bg-gray-900 rounded-2xl p-5 text-center shadow-lg">
                <p className="text-2xl font-bold text-white">₹{(commission.totalPay || 0).toLocaleString('en-IN')}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Total Salary</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100/50 flex flex-col justify-between min-h-[90px]">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-2">
                    <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  </div>
                  <div>
                    <p className="text-base font-black text-emerald-700 leading-none">₹{(commission.basePay || 0).toLocaleString('en-IN')}</p>
                    <p className="text-[8px] text-emerald-600/70 font-bold uppercase tracking-wider mt-1">Base Salary</p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100/50 flex flex-col justify-between min-h-[90px]">
                  <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center mb-2">
                    <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z"/></svg>
                  </div>
                  <div>
                    <p className="text-base font-black text-blue-700 leading-none">₹{(commission.revenueCommission || 0).toLocaleString('en-IN')}</p>
                    <p className="text-[8px] text-blue-600/70 font-bold uppercase tracking-wider mt-1">Sales Comm.</p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-purple-50 border border-purple-100/50 flex flex-col justify-between min-h-[90px]">
                  <div className="w-6 h-6 rounded-lg bg-purple-500/10 flex items-center justify-center mb-2">
                    <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
                  </div>
                  <div>
                    <p className="text-base font-black text-purple-700 leading-none">₹{(commission.reorderCommission || 0).toLocaleString('en-IN')}</p>
                    <p className="text-[8px] text-purple-600/70 font-bold uppercase tracking-wider mt-1">Re-Order Comm.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : <p className="text-xs text-gray-400 text-center py-6">No data</p>}
        </div>

        <div className={`lg:col-span-2 ${cardCls}`} style={cardStyle}>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Activity Chart</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Verifications done vs target</p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Filter pills */}
              <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
                {[{id:'today',label:'Today'},{id:'yesterday',label:'Yest.'},{id:'7d',label:'7D'},{id:'month',label:'Month'}].map(f => (
                  <button key={f.id} onClick={() => setChartFilter(f.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
                      chartFilter === f.id ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}>{f.label}</button>
                ))}
                <button onClick={() => setChartFilter('custom')}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
                    chartFilter === 'custom' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}>Custom</button>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"/><span className="text-[9px] font-bold text-gray-400">Done</span></span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-200"/><span className="text-[9px] font-bold text-gray-400">Target</span></span>
              </div>
            </div>
          </div>
          {/* Custom date inputs */}
          {chartFilter === 'custom' && (
            <div className="flex items-center gap-2 mb-3">
              <input type="date" value={chartCustomFrom} onChange={e => setChartCustomFrom(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-400 bg-gray-50" />
              <span className="text-gray-300 font-bold">—</span>
              <input type="date" value={chartCustomTo} onChange={e => setChartCustomTo(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-400 bg-gray-50" />
            </div>
          )}
          {filteredChartData.length > 0 ? (
            <>
              <div className="flex items-end gap-0.5 px-1" style={{ height: 140 }}>
                {filteredChartData.map((d, i) => {
                  const maxVal = Math.max(...filteredChartData.map(x => Math.max(x.count, x.target || 0)), 1);
                  const doneH = Math.max((d.count / maxVal) * 100, d.count > 0 ? 4 : 0);
                  const targetH = Math.max(((d.target || 0) / maxVal) * 100, (d.target || 0) > 0 ? 4 : 0);
                  const isToday = d.day === new Date().getDate();
                  const achieved = d.target > 0 && d.count >= d.target;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center group relative" style={{ height: 140 }}>
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] px-2 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 z-20 whitespace-nowrap pointer-events-none shadow-xl">
                        <p className="font-bold">{new Date(new Date().getFullYear(), new Date().getMonth(), d.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                        <p className="text-emerald-300">Done: {d.count}</p>
                        {d.target > 0 && <p className="text-blue-300">Target: {d.target}</p>}
                      </div>
                      <div className="w-full flex items-end gap-px" style={{ height: 140 }}>
                        {d.target > 0 && (
                          <div className="flex-1 rounded-t-sm transition-all duration-500"
                            style={{ height: `${targetH}%`, background: isToday ? '#93c5fd' : '#dbeafe', minHeight: 2 }} />
                        )}
                        <div className="flex-1 rounded-t-sm transition-all duration-500"
                          style={{
                            height: `${doneH}%`,
                            background: achieved ? '#10b981' : isToday ? '#34d399' : d.count > 0 ? '#6ee7b7' : '#f3f4f6',
                            minHeight: d.count > 0 ? 2 : 0,
                            boxShadow: isToday && d.count > 0 ? '0 0 6px #10b981' : 'none'
                          }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-2 px-1">
                <span className="text-[9px] font-bold text-gray-400">
                  {filteredChartData[0] ? `${filteredChartData[0].day} ${new Date().toLocaleString('default',{month:'short'})}` : ''}
                </span>
                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
                  {filteredChartData.reduce((s,d) => s+d.count, 0)} done
                </span>
                <span className="text-[9px] font-bold text-gray-400">
                  {filteredChartData.at(-1) ? `${filteredChartData.at(-1).day} ${new Date().toLocaleString('default',{month:'short'})}` : ''}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-300 text-xs font-bold">No data for selected range</div>
          )}
        </div>
      </div>

    </div>
  );
}
