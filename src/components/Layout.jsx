import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { getNotifications } from '../services/notification.service';
import { globalSearch, getLead } from '../services/lead.service';
import * as attendanceSvc from '../services/attendance.service';
import API from '../api';

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/leads': 'Leads',
  '/pipeline': 'Action Required',
  '/cnp': 'CNP',
  '/tasks': 'Tasks',
  '/verification': 'Verification',
  '/ready-to-shipment': 'Ready to Shipment',
  '/shiprocket': 'Shiprocket',
  '/shiprocket/orders': 'Orders',
  '/shiprocket/shipments': 'Shipments & Tracking',
  '/shiprocket/returns': 'Returns / Wallet / NDR',
  '/shiprocket/ndr': 'NDR',
  '/shiprocket/ndr/detail': 'NDR Details',
  '/notifications': 'Notifications',
  '/users': 'Staff',
  '/commission-settings': 'Commission Settings',
  '/shipmaxx': 'ShipMaxx',
  '/shipmaxx/ndr': 'ShipMaxx NDR Management',
  '/shipmaxx/followup': 'ShipMaxx Follow Up',
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);
  const searchRef = useRef(null);
  const [phoneQuery, setPhoneQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [quickDetail, setQuickDetail] = useState(null);
  const [quickLoading, setQuickLoading] = useState(false);
  const [showFullDetail, setShowFullDetail] = useState(false);
  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const pageTitle = PAGE_TITLES[location.pathname] || '';
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // Premium dropdown states
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: user?.name || '', phone: user?.phone || '', email: user?.email || '' });
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const THEMES = [
    { id: 'light',    label: 'Light',    colors: ['#f8fafc','#ffffff','#16a34a'] },
    { id: 'dark',     label: 'Forest',   colors: ['#080d09','#0d1f0d','#22c55e'] },
    { id: 'ocean',    label: 'Ocean',    colors: ['#0a1628','#071e38','#38bdf8'] },
    { id: 'rose',     label: 'Rose',     colors: ['#1a0a0f','#200d13','#fb7185'] },
    { id: 'violet',   label: 'Violet',   colors: ['#0d0a1a','#130f22','#a78bfa'] },
    { id: 'amber',    label: 'Amber',    colors: ['#1a1200','#201700','#fbbf24'] },
    { id: 'slate',    label: 'Slate',    colors: ['#0f172a','#141e33','#94a3b8'] },
    { id: 'teal',     label: 'Teal',     colors: ['#021a18','#04201e','#2dd4bf'] },
    { id: 'crimson',  label: 'Crimson',  colors: ['#1a0505','#200808','#f87171'] },
    { id: 'indigo',   label: 'Indigo',   colors: ['#06061a','#0b0b22','#818cf8'] },
    { id: 'mint',     label: 'Mint',     colors: ['#f0fdf4','#dcfce7','#059669'] },
    { id: 'midnight', label: 'Midnight', colors: ['#020617','#0a0f1e','#6366f1'] },
    { id: 'sunset',   label: 'Sunset',   colors: ['#1a0a00','#2a1000','#f97316'] },
    { id: 'aurora',   label: 'Aurora',   colors: ['#030d12','#051520','#06b6d4'] },
    { id: 'sakura',   label: 'Sakura',   colors: ['#1a0812','#22091a','#f472b6'] },
    { id: 'gold',     label: 'Gold',     colors: ['#120e00','#1c1500','#eab308'] },
    { id: 'nordic',   label: 'Nordic',   colors: ['#0d1117','#161b22','#58a6ff'] },
    { id: 'lava',     label: 'Lava',     colors: ['#150500','#200800','#ef4444'] },
    { id: 'lime',     label: 'Lime',     colors: ['#0a1200','#111a00','#84cc16'] },
    { id: 'dusk',     label: 'Dusk',     colors: ['#12080f','#1c0f18','#c084fc'] },
  ];
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const { lang, setLang, t: translate } = useLanguage();
  const { success: toastSuccess, info: toastInfo } = useToast();
  const [attStatus, setAttStatus] = useState(null);
  const [attLoading, setAttLoading] = useState(false);
  const lastNotifRef = useRef(null);
  const [commissionStats, setCommissionStats] = useState(null);
  const [shiftTime, setShiftTime] = useState('00h 00m 00s');

  const DEPT_COLOR = {
    migraine: 'bg-purple-50 text-purple-600 border-purple-100',
    piles: 'bg-amber-50 text-amber-600 border-amber-100',
    logistics: 'bg-blue-50 text-blue-600 border-blue-100',
  };

  // Sync profile details if user changes
  useEffect(() => {
    if (user) {
      setProfileForm({ name: user.name || '', phone: user.phone || '', email: user.email || '' });
    }
  }, [user]);

  // Sync Theme
  useEffect(() => {
    const html = document.documentElement;
    const allThemeClasses = ['dark','theme-ocean','theme-rose','theme-violet','theme-amber','theme-slate','theme-teal','theme-crimson','theme-indigo','theme-mint','theme-midnight','theme-sunset','theme-aurora','theme-sakura','theme-gold','theme-nordic','theme-lava','theme-lime','theme-dusk'];
    html.classList.remove(...allThemeClasses);
    if (theme === 'light') { /* default */ }
    else if (theme === 'dark') { html.classList.add('dark'); }
    else { html.classList.add('dark', `theme-${theme}`); }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Fetch Attendance & Commission
  const loadAttendance = useCallback(async () => {
    try {
      const status = await attendanceSvc.getTodayStatus();
      setAttStatus(status);
    } catch {}
  }, []);

  useEffect(() => {
    loadAttendance();
    const t = setInterval(loadAttendance, 60000);
    return () => clearInterval(t);
  }, [loadAttendance]);

  useEffect(() => {
    if (user && ['sales', 'support', 'logistics'].includes(user.role)) {
      const now = new Date();
      API.get(`/dashboard/staff-commission?month=${now.getMonth()}&year=${now.getFullYear()}`)
        .then(res => {
          if (res.data && res.data.data) {
            setCommissionStats(res.data.data);
          }
        }).catch(() => {});
    }
  }, [user]);

  // Running Shift Timer
  useEffect(() => {
    if (!attStatus?.checkIn || attStatus?.checkOut) {
      setShiftTime('00h 00m 00s');
      return;
    }
    const checkInTime = new Date(attStatus.checkIn).getTime();
    const interval = setInterval(() => {
      const diffMs = Date.now() - checkInTime;
      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);
      const pad = (n) => String(n).padStart(2, '0');
      setShiftTime(`${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [attStatus]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setAvatarLoading(true);
    try {
      const res = await API.patch('/users/me', {
        name: profileForm.name,
        phone: profileForm.phone,
        email: profileForm.email || undefined
      });
      updateUser(res.data.data);
      setProfileModalOpen(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    setAvatarLoading(true);
    try {
      await API.patch('/users/me', {
        password: passwordForm.newPassword
      });
      setPasswordModalOpen(false);
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      alert("Password updated successfully!");
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update password');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleQuickCheckIn = async () => {
    setAttLoading(true);
    try {
      const res = await attendanceSvc.checkIn();
      setAttStatus(res);
      loadAttendance();
    } catch (e) {
      alert(e.response?.data?.message || 'Check-in failed');
    }
    setAttLoading(false);
  };

  const handleQuickCheckOut = async () => {
    setAttLoading(true);
    try {
      const res = await attendanceSvc.checkOut();
      setAttStatus(res);
      loadAttendance();
    } catch (e) {
      alert(e.response?.data?.message || 'Check-out failed');
    }
    setAttLoading(false);
  };

  const STATUS_COLORS = {
    // Lead statuses
    new: 'bg-blue-100 text-blue-700',
    contacted: 'bg-yellow-100 text-yellow-700',
    interested: 'bg-green-100 text-green-700',
    follow_up: 'bg-purple-100 text-purple-700',
    closed_won: 'bg-emerald-100 text-emerald-700',
    closed_lost: 'bg-red-100 text-red-700',
    on_hold: 'bg-gray-100 text-gray-600',
    old: 'bg-orange-100 text-orange-700',
    verification: 'bg-violet-100 text-violet-700',
    ready_to_shipment: 'bg-orange-100 text-orange-700',
    verified: 'bg-violet-100 text-violet-700',
    // Order statuses
    delivered: 'bg-emerald-100 text-emerald-700',
    'rto delivered': 'bg-teal-100 text-teal-700',
    'in transit': 'bg-blue-100 text-blue-700',
    canceled: 'bg-red-100 text-red-700',
    'rto in transit': 'bg-orange-100 text-orange-700',
    'out for delivery': 'bg-cyan-100 text-cyan-700',
    'reached back at seller city': 'bg-amber-100 text-amber-700',
    'undelivered 1st attempt': 'bg-rose-100 text-rose-700',
    'pickup exception': 'bg-red-100 text-red-600',
    'undelivered 2nd attempt': 'bg-rose-100 text-rose-700',
    'undelivered 3rd attempt': 'bg-rose-200 text-rose-800',
    undelivered: 'bg-red-100 text-red-700',
    'undelivered attempt failure': 'bg-red-200 text-red-800',
    'rto initiated': 'bg-orange-100 text-orange-700',
    'reached at destination hub': 'bg-indigo-100 text-indigo-700',
    shipped: 'bg-blue-100 text-blue-600',
    'rto ofd': 'bg-amber-100 text-amber-700',
    'pickup scheduled': 'bg-sky-100 text-sky-700',
    misrouted: 'bg-red-100 text-red-600',
  };

  const doSearch = useCallback(async (q) => {
    if (q.trim().length < 3) { setSearchResults([]); setSearchOpen(false); return; }
    setSearchLoading(true);
    try {
      const data = await globalSearch(q.trim());
      setSearchResults(data);
      setSearchOpen(true);
    } catch { setSearchResults([]); }
    finally { setSearchLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(phoneQuery), 350);
    return () => clearTimeout(t);
  }, [phoneQuery, doSearch]);

  useEffect(() => {
    const handler = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await getNotifications({ limit: 1 });
        if (active) {
          setUnreadCount(res.unreadCount || 0);
          if (res.notifications && res.notifications.length > 0) {
            const latest = res.notifications[0];
            console.log('Polled Notification:', latest._id, 'Last:', lastNotifRef.current, 'Type:', latest.type);
            if (lastNotifRef.current && lastNotifRef.current !== latest._id) {
              console.log('NEW NOTIFICATION DETECTED!', latest);
              if (latest.type === 'task' || latest.type === 'lead_assigned') {
                console.log('TRIGGERING TOAST AND BEEP!');
                toastSuccess(latest.message || 'New Lead or Task Assigned!', '🔔 NEW ALERT');
                try {
                  const AudioContext = window.AudioContext || window.webkitAudioContext;
                  if (AudioContext) {
                    const ctx = new AudioContext();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(800, ctx.currentTime);
                    gain.gain.setValueAtTime(0.1, ctx.currentTime);
                    osc.start();
                    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
                    osc.stop(ctx.currentTime + 0.5);
                  }
                } catch(e){
                  console.error('Audio beep error:', e);
                }
              } else {
                toastInfo(latest.message || 'You have a new notification', latest.title || 'Notification');
              }
            }
            lastNotifRef.current = latest._id;
          }
        }
      } catch (e) {
        if (e?.response?.status === 401) { active = false; clearInterval(t); }
      }
    };
    poll();
    const t = setInterval(poll, Number(import.meta.env.VITE_NOTIFICATION_POLL_INTERVAL) || 30000);
    return () => { active = false; clearInterval(t); };
  }, []);

  const handleResultClick = async (item) => {
    setSearchOpen(false); setPhoneQuery(''); setSearchResults([]);
    // Lead result
    if (item.type === 'lead') {
      const s = item.meta?.toLowerCase();
      if (s === 'verification') { navigate(`/verification?openId=${item._id}`); return; }
      if (s === 'follow_up') { navigate(`/follow-up?phone=${encodeURIComponent(item.subtitle || '')}`); return; }
      if (item.cnp || s === 'cnp') { navigate(`/cnp?phone=${encodeURIComponent(item.subtitle || '')}`); return; }
      if (s === 'ready_to_shipment') { navigate(`/ready-to-shipment?phone=${encodeURIComponent(item.subtitle || '')}`); return; }
      navigate(`/leads?openId=${item._id}`); return;
    }
    // Task result
    if (item.type === 'task') {
      if (item.category === 'verification' || item.meta?.toLowerCase() === 'verification') {
        navigate(`/verification?openId=${item._id}`);
        return;
      }
      if (item.meta?.toLowerCase() === 'ready_to_shipment') {
        navigate(`/ready-to-shipment?phone=${encodeURIComponent(item.subtitle || '')}`);
        return;
      }
      if (item.meta?.toLowerCase() === 'on_hold' || item.meta?.toLowerCase() === 'pending') {
        try {
          const res = await API.get(`/verification/by-task/${item._id}`).catch(() => null);
          if (res?.data?.data?._id) {
            navigate(`/verification?openId=${res.data.data._id}`);
            return;
          }
        } catch { }
      }
      setQuickLoading(true); setQuickDetail(null); setShowFullDetail(false);
      try { setQuickDetail({ type: 'task', data: item }); }
      finally { setQuickLoading(false); }
      return;
    }
    // Call Again result
    if (item.type === 'callagain') {
      navigate(`/cnp?tab=callAgain&phone=${encodeURIComponent(item.subtitle || '')}`);
      return;
    }
    // RTS result
    if (item.type === 'rts') {
      navigate(`/ready-to-shipment?phone=${encodeURIComponent(item.subtitle || '')}`);
      return;
    }
    // Order result — navigate to full order detail page
    if (item.type === 'order') {
      navigate(`/orders/${item._id}`);
      return;
    }
  };

  const handleAvatarFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Image must be under 5 MB.');
      return;
    }
    setAvatarError('');
    setAvatarLoading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const { data } = await API.patch('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser(data.data);
      setAvatarOpen(false);
    } catch {
      setAvatarError('Upload failed. Please try again.');
    } finally {
      setAvatarLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex h-screen overflow-hidden theme-root" style={{ background: 'var(--theme-bg, #f0f4f0)' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} unreadCount={unreadCount} />

      <div className="flex-1 md:ml-64 flex flex-col h-screen min-w-0 overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between glass shadow-sm shadow-black/5"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
          <button onClick={() => setSidebarOpen(true)} 
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white shadow-sm text-gray-500 hover:text-green-700 hover:scale-105 active:scale-95 transition-all md:hidden">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          
          {/* Mobile brand */}
          <div className="flex items-center gap-2 md:hidden">
            <span className="text-lg font-extrabold tracking-tight text-green-800">Triven</span>
          </div>

          <div className={`${mobileSearchOpen ? 'flex absolute inset-x-0 top-0 h-full bg-white z-20 items-center px-4 gap-2 animate-slide-up' : 'hidden'} md:flex md:static md:bg-transparent md:h-auto md:px-0 md:flex-1 md:items-center md:gap-4`}>
            {mobileSearchOpen && (
              <button onClick={() => setMobileSearchOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 md:hidden">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
              </button>
            )}
            
            {pageTitle && (
              <h1 className="hidden md:block text-xl font-bold text-gray-800 tracking-tight">{pageTitle}</h1>
            )}
            {/* Global Phone Search */}
            <div ref={searchRef} className="relative flex-1 md:ml-4">
              <div className="flex items-center gap-2.5 bg-gray-50 md:bg-white/50 rounded-2xl shadow-sm px-4 py-2.5 md:py-2 border border-gray-100 md:border-gray-200 focus-within:border-green-400 focus-within:ring-4 focus-within:ring-green-500/10 transition-all w-full md:w-72">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  value={phoneQuery}
                  onChange={e => setPhoneQuery(e.target.value)}
                  onFocus={() => phoneQuery.trim().length >= 3 && setSearchOpen(true)}
                  placeholder="Search lead or order..."
                  className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"
                />
                {searchLoading && (
                  <svg className="w-3.5 h-3.5 animate-spin text-green-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                )}
                {phoneQuery && !searchLoading && (
                  <button onClick={() => { setPhoneQuery(''); setSearchResults([]); setSearchOpen(false); }} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                )}
              </div>
              {searchOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-[92vw] sm:w-[420px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                  {searchResults.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">No results found</div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto">
                      {['lead', 'order', 'rts', 'callagain', 'task'].map(type => {
                        const items = searchResults.filter(r => r.type === type && r.category !== 'verification');
                        if (!items.length) return null;
                        const labels = { lead: '👤 Leads', order: '📦 Orders', rts: '🚚 Ready to Ship', callagain: '📞 Call Again', task: '✅ Tasks' };
                        return (
                          <div key={type}>
                            <div className="px-4 py-1.5 bg-gray-50 text-[10px] font-extrabold uppercase tracking-widest text-gray-400 sticky top-0">
                              {labels[type]}
                            </div>
                            {items.map(item => (
                              <button key={item._id} onClick={() => handleResultClick(item)}
                                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-gray-800 truncate">{item.title}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                                      STATUS_COLORS[item.meta?.toLowerCase()] || 'bg-gray-100 text-gray-500'
                                    }`}>{item.type === 'rts' ? (item.meta || 'Ready to Ship') : item.meta?.replace(/_/g, ' ')}</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {item.subtitle && <span className="text-xs text-green-700 font-medium">{item.subtitle}</span>}
                                    {item.orderId && <span className="text-xs text-gray-400">#{item.orderId}</span>}
                                    {item.awb && <span className="text-xs text-gray-400">AWB: {item.awb}</span>}
                                    {item.assignedTo && <span className="text-xs text-blue-500">→ {item.assignedTo}</span>}
                                  </div>
                                </div>
                                <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                      {/* Verification section */}
                      {(() => {
                        const vItems = searchResults.filter(r => r.category === 'verification');
                        if (!vItems.length) return null;
                        return (
                          <div>
                            <div className="px-4 py-1.5 bg-gray-50 text-[10px] font-extrabold uppercase tracking-widest text-gray-400 sticky top-0">✅ Verification</div>
                            {vItems.map(item => (
                              <button key={item._id} onClick={() => handleResultClick(item)}
                                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-gray-800 truncate">{item.title}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                                      STATUS_COLORS[item.meta?.toLowerCase()] || 'bg-violet-100 text-violet-600'
                                    }`}>{item.meta?.replace(/_/g, ' ')}</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {item.subtitle && <span className="text-xs text-green-700 font-medium">{item.subtitle}</span>}
                                    {item.assignedTo && <span className="text-xs text-blue-500">→ {item.assignedTo}</span>}
                                  </div>
                                </div>
                                <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Search Toggle (Mobile Only) */}
            <button onClick={() => setMobileSearchOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-sm text-gray-500 hover:text-green-700 md:hidden">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </button>

            {/* Notifications */}
            <button onClick={() => navigate('/notifications')}
              className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-sm hover:shadow-md transition-all text-gray-500 hover:text-green-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Avatar button */}
            <div className="relative">
              <button
                id="avatar-btn"
                onClick={() => { setAvatarOpen(p => !p); setAvatarError(''); }}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-sm hover:shadow-md transition-all overflow-hidden"
                style={user?.avatar ? {} : { background: 'linear-gradient(135deg, #16a34a, #4ade80)' }}
              >
                {user?.avatar
                  ? <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
                  : initials
                }
              </button>

              {avatarOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAvatarOpen(false)} />
                  <div className="absolute right-0 top-12 z-20 w-80 rounded-3xl shadow-2xl border border-gray-100 overflow-hidden"
                    style={{ background: 'linear-gradient(160deg, #ffffff 0%, #f8fffe 100%)' }}>

                    {/* Hero Header */}
                    <div className="relative px-5 pt-5 pb-4 overflow-hidden"
                      style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)' }}>
                      {/* Decorative circles */}
                      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #6ee7b7, transparent)' }} />
                      <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #34d399, transparent)' }} />

                      <div className="relative flex items-center gap-3.5">
                        <button onClick={() => setAvatarOpen(false)}
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center transition-colors border border-white/20">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                        <div className="relative group/avatar cursor-pointer shrink-0" onClick={() => fileInputRef.current?.click()}>
                          <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center text-lg font-black text-white ring-2 ring-white/20 shadow-xl"
                            style={user?.avatar ? {} : { background: 'linear-gradient(135deg, #10b981, #34d399)' }}>
                            {user?.avatar ? <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" /> : initials}
                          </div>
                          <div className="absolute inset-0 bg-black/50 rounded-2xl opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-opacity">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-white font-black text-base tracking-tight truncate leading-tight">{user?.name}</p>
                          <p className="text-emerald-300 text-[10px] font-extrabold uppercase tracking-widest mt-0.5">{user?.role}</p>
                          {user?.departments?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {user.departments.map(d => (
                                <span key={d} className="text-[8px] font-extrabold px-2 py-0.5 rounded-full bg-white/15 text-white/90 uppercase tracking-wide border border-white/20">{d}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Shift status bar */}
                      <div className="relative mt-4 flex items-center justify-between bg-white/10 rounded-2xl px-3.5 py-2.5 border border-white/10">
                        <div>
                          <p className="text-[8px] font-extrabold text-emerald-300 uppercase tracking-widest">{translate('ACTIVE SHIFT')}</p>
                          <p className="text-sm font-black text-white tracking-tight font-mono mt-0.5">{shiftTime}</p>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full border border-white/10">
                          <span className={`w-1.5 h-1.5 rounded-full ${attStatus?.checkIn && !attStatus?.checkOut ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'}`} />
                          <span className="text-[9px] font-black text-white/80 uppercase tracking-wider">
                            {attStatus?.checkIn && !attStatus?.checkOut ? translate('ONLINE') : translate('OFFLINE')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      {/* Commission */}
                      {['sales', 'support', 'logistics'].includes(user?.role) && commissionStats && (
                        <div className="flex items-center justify-between rounded-2xl px-3.5 py-2.5 border border-emerald-100"
                          style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)' }}>
                          <div>
                            <p className="text-[8px] font-extrabold text-emerald-600 uppercase tracking-widest">ESTIMATED EARNINGS</p>
                            <p className="text-sm font-black text-emerald-800 mt-0.5">₹{(commissionStats.commission || 0).toLocaleString('en-IN')}</p>
                          </div>
                          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-base shadow-md shadow-emerald-200">
                            💰
                          </div>
                        </div>
                      )}

                      {/* Theme Picker */}
                      <div className="rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-gray-50">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-xs">🎨</span>
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Appearance</span>
                          </div>
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider"
                            style={{ color: THEMES.find(t=>t.id===theme)?.colors[2], background: `${THEMES.find(t=>t.id===theme)?.colors[2]}18`, borderColor: `${THEMES.find(t=>t.id===theme)?.colors[2]}30` }}>
                            {THEMES.find(t=>t.id===theme)?.label}
                          </span>
                        </div>
                        <div className="px-3 py-2.5 overflow-x-auto no-scrollbar">
                          <div className="grid grid-rows-2 grid-flow-col gap-2" style={{ gridTemplateRows: 'repeat(2, auto)' }}>
                            {THEMES.map(t => {
                              const isActive = theme === t.id;
                              const [base, surface, accent] = t.colors;
                              return (
                                <button key={t.id} onClick={() => setTheme(t.id)}
                                  className="flex flex-col items-center gap-1 transition-all duration-200"
                                  style={{ width: 56 }}>
                                  <div className="w-full rounded-xl overflow-hidden relative"
                                    style={{
                                      height: 40,
                                      background: base,
                                      outline: isActive ? `2px solid ${accent}` : '2px solid transparent',
                                      outlineOffset: 1,
                                      boxShadow: isActive ? `0 2px 12px ${accent}50` : '0 1px 3px rgba(0,0,0,0.15)',
                                      transition: 'all 0.2s',
                                    }}>
                                    <div className="absolute left-0 top-0 bottom-0 w-2.5 flex flex-col items-center py-1 gap-0.5"
                                      style={{ background: surface }}>
                                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
                                      <div className="w-1 h-0.5 rounded-full" style={{ background: `${accent}50` }} />
                                      <div className="w-1 h-0.5 rounded-full" style={{ background: `${accent}30` }} />
                                    </div>
                                    <div className="absolute left-3 right-1 top-1 bottom-1 flex flex-col gap-0.5">
                                      <div className="h-1.5 rounded-full w-4/5" style={{ background: `${accent}70` }} />
                                      <div className="h-1 rounded-full w-full" style={{ background: `${accent}20` }} />
                                      <div className="h-1 rounded-full w-3/5" style={{ background: `${accent}20` }} />
                                      <div className="mt-auto h-2.5 rounded-md w-full flex items-center justify-center" style={{ background: accent }}>
                                        <div className="w-2 h-0.5 rounded-full bg-white/80" />
                                      </div>
                                    </div>
                                    {isActive && (
                                      <div className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full flex items-center justify-center" style={{ background: accent }}>
                                        <svg className="w-2 h-2" fill="none" stroke="white" strokeWidth={3} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-[8px] font-bold leading-none truncate w-full text-center"
                                    style={{ color: isActive ? accent : '#9ca3af' }}>{t.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                        <button onClick={() => { setProfileModalOpen(true); setAvatarOpen(false); }}
                          className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-gray-50 transition-colors group">
                          <span className="w-7 h-7 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 group-hover:bg-blue-100 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          </span>
                          <span className="text-xs font-bold text-gray-600">{translate('My Profile')}</span>
                          <svg className="w-3.5 h-3.5 text-gray-300 ml-auto" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                        </button>
                        <button onClick={() => { setPasswordModalOpen(true); setAvatarOpen(false); }}
                          className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-gray-50 transition-colors group">
                          <span className="w-7 h-7 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 group-hover:bg-amber-100 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          </span>
                          <span className="text-xs font-bold text-gray-600">{translate('Change Password')}</span>
                          <svg className="w-3.5 h-3.5 text-gray-300 ml-auto" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                        </button>
                      </div>

                      {/* Sign Out */}
                      <button onClick={() => { logout(); setAvatarOpen(false); }}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border border-red-100 hover:bg-red-50 transition-colors group">
                        <span className="w-7 h-7 rounded-xl bg-red-50 flex items-center justify-center text-red-400 group-hover:bg-red-100 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        </span>
                        <span className="text-xs font-black text-red-500">{translate('Sign out')}</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFileChange}
              />
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-main md:p-6 min-w-0 pb-safe">
          <Outlet />
        </main>
      </div>

      {/* Edit Profile Modal */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden p-6 space-y-4 border border-gray-100/50">
            <div className="flex justify-between items-center pb-2 border-b border-gray-50">
              <h3 className="text-base font-black text-gray-900 tracking-tight">{'Edit Profile'}</h3>
              <button onClick={() => setProfileModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-sm font-bold">✕</button>
            </div>
            <form onSubmit={handleProfileSubmit} className="space-y-3.5">
              <div>
                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">{'Name'}</label>
                <input required className="w-full border border-gray-100 rounded-xl px-3.5 py-2.5 text-xs bg-gray-50 font-bold text-gray-700 mt-1" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">{'Phone'}</label>
                <input required type="tel" className="w-full border border-gray-100 rounded-xl px-3.5 py-2.5 text-xs bg-gray-50 font-bold text-gray-700 mt-1" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">{'Email (Optional)'}</label>
                <input type="email" className="w-full border border-gray-100 rounded-xl px-3.5 py-2.5 text-xs bg-gray-50 font-bold text-gray-700 mt-1" value={profileForm.email} onChange={e => setProfileForm({...profileForm, email: e.target.value})} />
              </div>
              <button type="submit" className="w-full py-3.5 rounded-xl text-[11px] font-black text-white bg-gradient-to-r from-green-500 to-emerald-600 shadow-md active:scale-95 transition-all mt-4 uppercase tracking-widest">
                {'SAVE CHANGES'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {passwordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden p-6 space-y-4 border border-gray-100/50">
            <div className="flex justify-between items-center pb-2 border-b border-gray-50">
              <h3 className="text-base font-black text-gray-900 tracking-tight">{'Change Password'}</h3>
              <button onClick={() => setPasswordModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-sm font-bold">✕</button>
            </div>
            <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
              <div>
                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">{'New Password'}</label>
                <input required type="password" minLength={8} className="w-full border border-gray-100 rounded-xl px-3.5 py-2.5 text-xs bg-gray-50 font-bold text-gray-700 mt-1" value={passwordForm.newPassword} onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">{'Confirm New Password'}</label>
                <input required type="password" minLength={8} className="w-full border border-gray-100 rounded-xl px-3.5 py-2.5 text-xs bg-gray-50 font-bold text-gray-700 mt-1" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} />
              </div>
              <button type="submit" className="w-full py-3.5 rounded-xl text-[11px] font-black text-white bg-gradient-to-r from-green-500 to-emerald-600 shadow-md active:scale-95 transition-all mt-4 uppercase tracking-widest">
                {'UPDATE PASSWORD'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Quick Detail Modal */}
      {(quickLoading || quickDetail) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setQuickDetail(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {quickLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : quickDetail?.type === 'lead' ? (
              <>
                <div className="h-1.5 bg-emerald-600 shrink-0" />
                <div className="px-6 py-4 flex items-center justify-between border-b border-gray-50 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {quickDetail.data.name?.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{quickDetail.data.name}</p>
                      <p className="text-xs text-emerald-600 font-medium">{quickDetail.data.phone}</p>
                    </div>
                  </div>
                  <button onClick={() => setQuickDetail(null)} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 text-xl">×</button>
                </div>
                <div className="overflow-y-auto flex-1 px-6 py-4">
                  {(showFullDetail ? [
                    ['Status', quickDetail.data.status?.replace(/_/g,' ')],
                    ['Phone', quickDetail.data.phone],
                    ['Email', quickDetail.data.email],
                    ['Source', quickDetail.data.source],
                    ['Type', quickDetail.data.type],
                    ['Assigned To', quickDetail.data.assignedTo?.name],
                    ['Problem', quickDetail.data.problem],
                    ['House No', quickDetail.data.houseNo],
                    ['City/Village', quickDetail.data.cityVillage],
                    ['Post Office', quickDetail.data.postOffice],
                    ['Landmark', quickDetail.data.landmark],
                    ['District', quickDetail.data.district],
                    ['State', quickDetail.data.state],
                    ['Pincode', quickDetail.data.pincode],
                    ['Revenue', quickDetail.data.revenue > 0 ? `₹${quickDetail.data.revenue.toLocaleString()}` : null],
                    ['CNP', quickDetail.data.cnp ? 'Yes' : null],
                    ['Added', new Date(quickDetail.data.createdAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})],
                  ] : [
                    ['Status', quickDetail.data.status?.replace(/_/g,' ')],
                    ['Email', quickDetail.data.email],
                    ['Source', quickDetail.data.source],
                    ['Type', quickDetail.data.type],
                    ['Assigned To', quickDetail.data.assignedTo?.name],
                    ['Problem', quickDetail.data.problem],
                    ['Address', [quickDetail.data.houseNo, quickDetail.data.cityVillage, quickDetail.data.district, quickDetail.data.state, quickDetail.data.pincode].filter(Boolean).join(', ')],
                    ['Revenue', quickDetail.data.revenue > 0 ? `₹${quickDetail.data.revenue.toLocaleString()}` : null],
                    ['Added', new Date(quickDetail.data.createdAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})],
                  ]).filter(([,v])=>v).map(([label,value])=>(
                    <div key={label} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-24 shrink-0 mt-0.5">{label}</span>
                      <span className="text-sm text-gray-800 font-medium capitalize flex-1 break-words">{value}</span>
                    </div>
                  ))}
                  {showFullDetail && quickDetail.data.notes?.length > 0 && (
                    <div className="pt-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-2">All Notes</p>
                      {[...quickDetail.data.notes].reverse().map((n,i)=>(
                        <div key={i} className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100/30 mb-2">
                          <p className="text-xs text-gray-700">{n.text}</p>
                          <p className="text-[9px] text-gray-400 mt-1 font-bold uppercase">{new Date(n.createdAt).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {!showFullDetail && quickDetail.data.notes?.length > 0 && (
                    <div className="pt-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-2">Recent Notes</p>
                      {[...quickDetail.data.notes].reverse().slice(0,2).map((n,i)=>(
                        <div key={i} className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100/30 mb-2">
                          <p className="text-xs text-gray-700">{n.text}</p>
                          <p className="text-[9px] text-gray-400 mt-1 font-bold uppercase">{new Date(n.createdAt).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="px-6 py-4 border-t border-gray-50 shrink-0 flex gap-2">
                  <button onClick={() => setShowFullDetail(f => !f)}
                    className="flex-1 py-3 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    {showFullDetail ? 'Less' : 'Details'}
                  </button>
                  {(() => {
                    const s = quickDetail.data.status?.toLowerCase();
                    const route = s === 'follow_up' || s === 'on_hold' ? '/follow-up' : s === 'cnp' ? '/cnp' : null;
                    const routeLabel = route === '/follow-up' ? 'Follow Up' : 'CNP';
                    if (!route) return null;
                    return (
                      <button onClick={() => { setQuickDetail(null); navigate(route); }}
                        className="flex-1 py-3 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2"
                        style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
                        Go to {routeLabel}
                      </button>
                    );
                  })()}
                </div>
              </>
            ) : quickDetail?.type === 'order' ? (
              <>
                <div className="h-1.5 bg-blue-500 shrink-0" />
                <div className="px-6 py-4 flex items-center justify-between border-b border-gray-50 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-blue-500 flex items-center justify-center text-white text-lg">📦</div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{quickDetail.data.title}</p>
                      <p className="text-xs text-blue-600 font-medium">{quickDetail.data.subtitle}</p>
                    </div>
                  </div>
                  <button onClick={() => setQuickDetail(null)} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 text-xl">×</button>
                </div>
                <div className="overflow-y-auto flex-1 px-6 py-4">
                  {[['Status', quickDetail.data.meta],['Order ID', quickDetail.data.orderId],['AWB', quickDetail.data.awb],['Phone', quickDetail.data.subtitle]].filter(([,v])=>v).map(([label,value])=>(
                    <div key={label} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-24 shrink-0 mt-0.5">{label}</span>
                      <span className="text-sm text-gray-800 font-medium flex-1">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="px-6 py-4 border-t border-gray-50 shrink-0">
                  <button onClick={() => { setQuickDetail(null); navigate(`/shiprocket/orders?openId=${quickDetail.data._id}`); }}
                    className="w-full py-3 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
                    View in Orders List
                  </button>
                </div>
              </>
            ) : quickDetail?.type === 'task' ? (
              <>
                <div className="h-1.5 bg-amber-500 shrink-0" />
                <div className="px-6 py-4 flex items-center justify-between border-b border-gray-50 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-amber-500 flex items-center justify-center text-white text-lg">✅</div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{quickDetail.data.title}</p>
                      <p className="text-xs text-amber-600 font-medium">{quickDetail.data.subtitle}</p>
                    </div>
                  </div>
                  <button onClick={() => setQuickDetail(null)} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 text-xl">×</button>
                </div>
                <div className="overflow-y-auto flex-1 px-6 py-4">
                  {[['Status', quickDetail.data.meta],['Phone', quickDetail.data.subtitle],['Assigned To', quickDetail.data.assignedTo]].filter(([,v])=>v).map(([label,value])=>(
                    <div key={label} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-24 shrink-0 mt-0.5">{label}</span>
                      <span className="text-sm text-gray-800 font-medium capitalize flex-1">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="px-6 py-4 border-t border-gray-50 shrink-0">
                  <button onClick={() => { setQuickDetail(null); navigate(`/tasks?openId=${quickDetail.data._id}`); }}
                    className="w-full py-3 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
                    View in Tasks List
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
