import React, { useEffect, useState, useCallback, Fragment } from 'react';
import { getUsers, createUser, updateUser, deleteUser, getStaffShipmentCounts } from '../services/user.service';
import { fetchAllStaffStats, fetchStaffTodayLists, fetchStats } from '../services/dashboard.service';
import * as attendanceSvc from '../services/attendance.service';
import API from '../api';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const icons = {
  cnp: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M16.5 1.5a4.5 4.5 0 0 1 4.5 4.5v12a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 18V6a4.5 4.5 0 0 1 4.5-4.5h9z"/><line x1="4" y1="4" x2="20" y2="20"/></svg>,
  callAgain: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.61 19a19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 3.09 4.18 2 2 0 0 1 5.07 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L9.91 9.91a16 16 0 0 0 6.18 6.18l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  interested: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  notInterested: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  user: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  phone: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.61 19a19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 3.09 4.18 2 2 0 0 1 5.07 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L9.91 9.91a16 16 0 0 0 6.18 6.18l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
};

const ROLES = ['manager', 'sales', 'doctor', 'staff', 'logistics', 'support'];
const DEPARTMENTS = ['migraine', 'piles'];
const DEPT_COLOR = {
  logistics: 'bg-blue-50 text-blue-600 border-blue-100',
  migraine: 'bg-purple-50 text-purple-600 border-purple-100',
  piles: 'bg-amber-50 text-amber-600 border-amber-100',
};
const EMPTY = { name: '', phone: '', password: '', role: 'manager', departments: [], baseSalary: 0, commissionRate: 5, specialization: '' };

const ROLE_GRADIENT = {
  admin:   'from-purple-500 to-violet-600',
  manager: 'from-blue-500 to-cyan-500',
  sales:   'from-green-500 to-emerald-500',
  doctor:  'from-teal-500 to-cyan-600',
  staff:   'from-orange-500 to-amber-500',
  logistics: 'from-rose-500 to-pink-500',
  support:   'from-sky-500 to-indigo-500',
};

export default function Users() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'manager';
  const [data, setData] = useState({ results: [], totalResults: 0 });
  const [shipmentCounts, setShipmentCounts] = useState({});
  const [staffStats, setStaffStats] = useState({});
  const [viewUser, setViewUser] = useState(null);
  const [viewTasks, setViewTasks] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [todayLists, setTodayLists] = useState({ cnpList: [], callAgainList: [], interestedList: [], notInterestedList: [], onHoldList: [] });
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState(null);
  const [attStatus, setAttStatus] = useState(null);
  const [attLoading, setAttLoading] = useState(false);
  const { success, error: toastError, info } = useToast();

  const load = useCallback(async () => {
    getUsers().then(res => setData(res)).catch(() => {}).finally(() => setPageLoading(false));
    
    // Fetch global stats for attendance summary
    fetchStats(selectedDate).then(setStats).catch(() => {});
    // Fetch personal attendance status
    attendanceSvc.getTodayStatus().then(setAttStatus).catch(() => {});

    fetchAllStaffStats(selectedDate).then(stats => {
      const map = {};
      stats.forEach(s => { map[s.user._id] = s; });
      setStaffStats(map);
    }).catch(() => {});
    // Load shipment counts
    API.get('/tasks', { params: { status: 'ready_to_shipment' } })
      .then(res => {
        const tasks = Array.isArray(res.data.data) ? res.data.data : [];
        const counts = tasks.reduce((acc, t) => {
          const id = t.assignedTo?._id || t.assignedTo;
          if (id) acc[String(id)] = (acc[String(id)] || 0) + 1;
          return acc;
        }, {});
        setShipmentCounts(counts);
      }).catch(() => {
        getStaffShipmentCounts().then(counts => setShipmentCounts(counts || {})).catch(() => {});
      });
  }, [selectedDate]);

  useEffect(() => { load(); }, [load]);

  const handleCheckIn = async () => {
    setAttLoading(true);
    try { 
      const res = await attendanceSvc.checkIn(); 
      setAttStatus(res); 
      success('Good morning! You have checked in successfully.', 'Clock In');
      load(); 
    }
    catch (e) { toastError(e.response?.data?.message || 'Check-in failed'); }
    setAttLoading(false);
  };

  const handleCheckOut = async () => {
    setAttLoading(true);
    try { 
      const res = await attendanceSvc.checkOut(); 
      setAttStatus(res); 
      info('Work day finished. Take care!', 'Clock Out');
      load(); 
    }
    catch (e) { toastError(e.response?.data?.message || 'Check-out failed'); }
    setAttLoading(false);
  };

  const checkedIn = !!attStatus?.checkIn;
  const checkedOut = !!attStatus?.checkOut;
  const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : null;

  const openView = async (u) => {
    setViewUser(u); setViewTasks([]); setViewLoading(true); setModal('view');
    setTodayLists({ cnpList: [], callAgainList: [], interestedList: [], notInterestedList: [], onHoldList: [] });
    try {
      const [shipmentsRes, lists] = await Promise.all([
        API.get('/ready-to-shipment/by-user/' + u._id).catch(() => API.get('/tasks', { params: { status: 'ready_to_shipment', assignedTo: u._id } })),
        fetchStaffTodayLists(selectedDate, u._id)
      ]);
      
      const tasks = Array.isArray(shipmentsRes.data?.data) ? shipmentsRes.data.data : Array.isArray(shipmentsRes.data) ? shipmentsRes.data : [];
      setViewTasks(tasks);
      setTodayLists(lists || { cnpList: [], callAgainList: [], interestedList: [], notInterestedList: [], onHoldList: [] });
    } catch (e) {
      console.error('view fetch error:', e);
    } finally {
      setViewLoading(false);
    }
  };

  const openCreate = () => { setForm(EMPTY); setError(''); setModal('create'); };
  const openEdit = (u) => {
    setSelected(u);
    setForm({ 
      name: u.name, 
      phone: u.phone || '', 
      password: '', 
      role: u.role, 
      departments: u.departments || [],
      baseSalary: u.baseSalary || 0, 
      commissionRate: u.commissionRate || 5,
      specialization: u.specialization || '' 
    });
    setError(''); setModal('edit');
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const payload = { ...form };
      if (modal === 'edit' && !payload.password) delete payload.password;
      if (modal === 'edit') await updateUser(selected._id, payload);
      else await createUser(payload);
      setModal(null); load();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this user?')) return;
    await deleteUser(id).catch(() => {});
    load();
  };

  const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition";

  if (pageLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-gray-400">
        <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        Loading staff...
      </div>
    </div>
  );

  return (
    <div className="space-y-8 bg-glow pb-10">
      {/* Attendance Stats Row - Unique Glass Design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
        {[
          { label: 'Present Today', val: stats?.attendance?.present || 0, color: 'from-emerald-400 to-teal-500', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', bg: 'bg-emerald-50/50' },
          { label: 'Checked Out', val: stats?.attendance?.checkedOut || 0, color: 'from-orange-400 to-red-400', icon: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1', bg: 'bg-orange-50/50' },
          { label: 'Absent Staff', val: stats?.attendance?.absent || 0, color: 'from-rose-500 to-red-600', icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z', bg: 'bg-rose-50/50' },
          { label: 'Total Team', val: stats?.attendance?.totalStaff || 0, color: 'from-blue-500 to-indigo-600', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2', bg: 'bg-blue-50/50' }
        ].map((item, i) => (
          <div key={i} className="relative overflow-hidden group bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100/50 hover:shadow-2xl hover:-translate-y-1 transition-all duration-500" style={{ animationDelay: `${i * 100}ms` }}>
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${item.color} opacity-[0.04] rounded-bl-full group-hover:scale-150 transition-transform duration-700`} />
            <div className="flex items-center gap-5 relative z-10">
              <div className={`w-14 h-14 rounded-[1.25rem] bg-gradient-to-br ${item.color} flex items-center justify-center text-white shadow-xl shadow-${item.color.split(' ')[1]}/20 transform group-hover:rotate-6 transition-transform duration-500`}>
                <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d={item.icon}/></svg>
              </div>
              <div>
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.25em] mb-1">{item.label}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-black text-gray-900 tracking-tight">{item.val}</span>
                  <span className="text-[11px] font-bold text-gray-300">ACTIVE</span>
                </div>
              </div>
            </div>
            {/* Animated Glow Overlay */}
            <div className={`absolute -inset-1 bg-gradient-to-r ${item.color} opacity-0 group-hover:opacity-[0.03] blur-xl transition-opacity duration-500`} />
          </div>
        ))}
      </div>

      {/* Header Section - Modern & Spaced */}
      <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6 px-2">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-green-100 text-green-600 text-[10px] font-black uppercase tracking-widest rounded-full">Management Console</span>
            <div className="h-px w-12 bg-gray-200" />
          </div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase leading-none">Staff Directory</h2>
          <p className="text-sm font-medium text-gray-400">Manage your high-performance team and monitor real-time audit logs.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="relative group flex-1 lg:flex-none">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-green-500 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            </div>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full bg-white border border-gray-100 rounded-2xl pl-11 pr-6 py-4 text-sm font-black text-gray-700 focus:ring-4 focus:ring-green-500/10 transition-all cursor-pointer shadow-sm hover:shadow-md"
            />
          </div>
          
          <button onClick={openCreate}
            className="flex-1 lg:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-[11px] font-black text-white shadow-2xl hover:shadow-green-500/30 hover:-translate-y-1 transition-all uppercase tracking-widest active:scale-95"
            style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
            <span className="text-lg leading-none">+</span> Add Team Member
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="premium-card overflow-hidden">
        {data.results?.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-20 h-20 rounded-[2.5rem] bg-gray-50 flex items-center justify-center mx-auto mb-6 text-gray-300 animate-float">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <p className="text-xl font-bold text-gray-400">No staff members found</p>
            <p className="text-sm text-gray-300 mt-2">Start by adding your first team member above.</p>
          </div>
        ) : (
          <div className="table-responsive no-scrollbar">
            <table className="w-full text-xs min-w-[1080px]">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100 text-left">
                  <th className="py-5 px-6 font-black uppercase tracking-[0.15em] text-[10px]">Staff Identity</th>
                  <th className="py-5 px-2 font-black uppercase tracking-[0.15em] text-[10px] text-center">Work</th>
                  <th className="py-5 px-2 font-black uppercase tracking-[0.15em] text-[10px] text-center">Leads</th>
                  <th className="py-5 px-2 font-black uppercase tracking-[0.15em] text-[10px] text-center">Calls</th>
                  <th className="py-5 px-2 font-black uppercase tracking-[0.15em] text-[10px] text-center">Verify / Hold</th>
                  <th className="py-5 px-2 font-black uppercase tracking-[0.15em] text-[10px] text-center">Target</th>
                  <th className="py-5 px-2 font-black uppercase tracking-[0.15em] text-[10px] text-center">Shipment</th>
                  <th className="py-5 px-2 font-black uppercase tracking-[0.15em] text-[10px] text-center">Rates (%)</th>
                  <th className="py-5 px-6 font-black uppercase tracking-[0.15em] text-[10px] text-right">Controls</th>
                </tr>
              </thead>
                {(() => {
                  const grouped = {};
                  (data.results || []).forEach(u => {
                    const role = u.role || 'unassigned';
                    if (!grouped[role]) grouped[role] = [];
                    grouped[role].push(u);
                  });
                  
                  // Preferred order
                  const order = ['sales', 'support', 'logistics', 'manager', 'doctor', 'admin'];
                  const sortedRoles = Object.keys(grouped).sort((a, b) => {
                    const iA = order.indexOf(a);
                    const iB = order.indexOf(b);
                    if (iA !== -1 && iB !== -1) return iA - iB;
                    if (iA !== -1) return -1;
                    if (iB !== -1) return 1;
                    return a.localeCompare(b);
                  });

                  return sortedRoles.map(role => (
                    <tbody key={role} className="divide-y divide-gray-50/50">
                      <tr className="">
                        <td colSpan={9} className="py-2 px-6 border-b border-white/5">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">{role} DIVISION</span>
                          </div>
                        </td>
                      </tr>
                      {grouped[role].map(u => {
                        const s = staffStats[u._id] || {};
                        const readyCount = s.readyToShipmentCount || 0;
                        return (
                          <tr key={u._id} className="hover:bg-white/5 transition-all duration-200 group relative border-b border-white/5">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${ROLE_GRADIENT[u.role] || 'from-gray-400 to-gray-500'} flex items-center justify-center text-white text-base font-black shadow-lg shadow-black/5 group-hover:scale-110 transition-transform duration-300`}>
                            {u.name?.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-800 text-sm">{u.name}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 py-0.5 px-1.5 bg-gray-50 rounded-lg">{u.role}</span>
                              {(u.departments || []).map(dept => (
                                <span key={dept} className={`text-[9px] font-bold uppercase tracking-wider py-0.5 px-1.5 rounded-lg border ${DEPT_COLOR[dept] || 'bg-gray-50 text-gray-500 border-gray-100'}`}>{dept}</span>
                              ))}
                              {readyCount > 0 && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-lg border border-emerald-100">
                                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-ping" /> SHIP READY
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      {u.role === 'doctor' ? (
                        <td className="py-4 px-2 text-center" colSpan={7}>
                          <div className="flex items-center justify-center gap-10 bg-gray-50/50 rounded-2xl py-2 px-6 w-max mx-auto border border-gray-100/50">
                            <div className="flex flex-col items-center">
                              <span className="text-xl font-black text-blue-500 leading-none">{s.totalAppointments || 0}</span>
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1.5">Total</span>
                            </div>
                            <div className="w-px h-8 bg-gray-200" />
                            <div className="flex flex-col items-center">
                              <span className="text-xl font-black text-emerald-500 leading-none">{s.completedAppointments || 0}</span>
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1.5">Completed</span>
                            </div>
                            <div className="w-px h-8 bg-gray-200" />
                            <div className="flex flex-col items-center">
                              <span className="text-xl font-black text-rose-500 leading-none">{s.cancelledAppointments || 0}</span>
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1.5">Cancelled</span>
                            </div>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td className="py-4 px-2 text-center">
                            <div className="flex flex-col gap-1 items-center">
                              <div className="w-full bg-gray-100 rounded-full h-1.5 max-w-[40px]">
                                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${s.workingPercentage || 0}%` }}></div>
                              </div>
                              <span className="text-[9px] font-bold text-gray-500">{s.workingHours ? s.workingHours.toFixed(1) + 'h' : '0h'}</span>
                            </div>
                          </td>
                          <td className="py-4 px-2 text-center">
                            <div className="flex flex-col gap-1 items-center">
                              <span className="text-[11px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                                {s.leadsAdded || 0} LEADS
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-2 text-center">
                            <div className="flex flex-col gap-1 items-center">
                              <span className="text-[11px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-full">{s.todayCnp || 0} CNP</span>
                              <span className="text-[9px] font-bold text-yellow-600 opacity-80">{s.todayCallAgain || 0} CALL</span>
                            </div>
                          </td>
                          <td className="py-4 px-2 text-center">
                             <div className="flex flex-col gap-1 items-center justify-center">
                               <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100">
                                 <span className="text-sm font-black">{s.todayVerifications || 0}</span>
                                 <span className="text-[8px] font-black uppercase">VRF</span>
                               </div>
                               <span className={`text-[10px] font-black ${s.onHoldCount > 0 ? 'text-amber-500' : 'text-gray-300'}`}>{s.onHoldCount || 0} HOLD</span>
                             </div>
                          </td>
                          <td className="py-4 px-2 text-center">
                             <div className="inline-flex flex-col items-center">
                               <span className={`text-xs font-black ${s.todayTarget > 0 ? 'text-blue-500' : 'text-gray-400'}`}>{s.todayTarget || 0}</span>
                             </div>
                          </td>
                          <td className="py-4 px-2 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] font-bold text-gray-400">RDY</span>
                                <span className={`text-xs font-black ${readyCount > 0 ? 'text-purple-600' : 'text-gray-300'}`}>{readyCount}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] font-bold text-gray-400">DEL</span>
                                <span className={`text-xs font-black ${s.deliveredCount > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>{s.deliveredCount || 0}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] font-bold text-gray-400">RTO</span>
                                <span className={`text-xs font-black ${s.rtoCount > 0 ? 'text-orange-600' : 'text-gray-300'}`}>{s.rtoCount || 0}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-2 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[9px] font-bold text-gray-500 bg-gray-50 px-1.5 rounded" title="Verify Rate (Verified/Target)">VR: {s.todayTarget > 0 ? Math.min(Math.round(((s.todayVerifications || 0) / s.todayTarget) * 100), 100) : 0}%</span>
                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 rounded" title="Monthly Delivery Rate (Month Delivered/Month Dispatched)">DR: {s.monthDispatchedCount > 0 ? Math.min(Math.round(((s.monthDeliveredCount || 0) / s.monthDispatchedCount) * 100), 100) : 0}%</span>
                              <span className="text-[9px] font-bold text-orange-600 bg-orange-50 px-1.5 rounded" title="Monthly RTO Rate (Month RTO/Month Dispatched)">RTO: {s.monthDispatchedCount > 0 ? Math.min(Math.round(((s.monthRtoCount || 0) / s.monthDispatchedCount) * 100), 100) : 0}%</span>
                            </div>
                          </td>
                        </>
                      )}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openView(u)} title="Deep Analysis" className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-900 hover:text-white transition-all shadow-sm hover:shadow-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></button>
                          {canManage && (
                            <>
                              <button onClick={() => openEdit(u)} title="Modify Staff" className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm hover:shadow-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
                              <button onClick={() => handleDelete(u._id)} title="Remove Access" className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-600 hover:text-white transition-all shadow-sm hover:shadow-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ));
          })()}
            </table>
          </div>
        )}
      </div>

      {/* View Shipment Tasks Modal */}
      {modal === 'view' && viewUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
            {/* Dark header with close button */}
            <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg, #0d1f0d, #1a3a1a)' }}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${ROLE_GRADIENT[viewUser.role] || 'from-gray-400 to-gray-500'} flex items-center justify-center text-white text-lg font-bold shadow-lg uppercase`}>
                  {viewUser.name?.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-base">{viewUser.name}</p>
                  <p className="text-green-300 text-xs mt-0.5">{viewUser.phone || viewUser.email}</p>
                </div>
                <button onClick={() => setModal(null)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-green-300 hover:text-white hover:bg-white/10 transition text-xl leading-none">
                  ×
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 max-h-[80vh] overflow-y-auto">
              {/* Staff stats if sales role */}
              {(viewUser.role === 'sales' || viewUser.role === 'support') && staffStats[viewUser._id] && (() => {
                const s = staffStats[viewUser._id];
                const done = s.verifiedCount || 0;
                const target = s.todayTarget || 0;
                const remaining = target > 0 ? Math.max(target - done, 0) : 0;
                return (
                  <div className="mb-5 space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Today's Performance</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[['Done Today', done, 'text-green-600', '#f0fdf4', 'rgba(22,163,74,0.15)'],
                        ['Remaining', target > 0 ? remaining : '—', 'text-orange-500', '#fff7ed', 'rgba(251,146,60,0.2)'],
                        ['Target', target || '—', 'text-blue-600', '#eff6ff', 'rgba(59,130,246,0.15)']
                      ].map(([label, val, tc, bg, border]) => (
                        <div key={label} className="rounded-2xl p-4 text-center bg-white shadow-sm" style={{ background: bg, border: `1px solid ${border}` }}>
                          <p className={`text-2xl font-black ${tc}`}>{val}</p>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">{label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                      {[['CNP', s.todayCnp, 'text-red-500', 'bg-red-50'],
                        ['CALL AGAIN', s.todayCallAgain, 'text-yellow-600', 'bg-yellow-50'],
                        ['INTERESTED', s.todayInterested, 'text-green-600', 'bg-green-50'],
                        ['ON HOLD', s.onHoldCount, 'text-amber-600', 'bg-amber-50'],
                        ['NOT INT.', s.todayNotInterested, 'text-gray-500', 'bg-gray-50'],
                        ['READY', s.readyToShipmentCount, 'text-purple-600', 'bg-purple-50'],
                        ['DELIVERED', s.deliveredCount, 'text-emerald-600', 'bg-emerald-50']
                      ].map(([label, val, tc, bg]) => (
                        <div key={label} className={`${bg} rounded-xl p-3 text-center border border-black/0.03 shadow-sm`}>
                          <p className={`text-xl font-black ${tc}`}>{val}</p>
                          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 px-1">
                      <span>Month verifications: <span className="font-semibold text-gray-600">{s.monthVerifications}</span></span>
                      <span>Pending tasks: <span className="font-semibold text-gray-600">{s.pendingTasks}</span></span>
                    </div>
                    <div className="border-t border-gray-100 pt-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Activity Detail Lists</p>
                      <div className="space-y-4">
                        {[
                          { label: 'CNP List', list: todayLists.cnpList, color: 'text-red-500', bg: 'bg-red-50' },
                          { label: 'Call Again List', list: todayLists.callAgainList, color: 'text-yellow-600', bg: 'bg-yellow-50' },
                          { label: 'Interested List', list: todayLists.interestedList, color: 'text-green-600', bg: 'bg-green-50' },
                          { label: 'On Hold List', list: todayLists.onHoldList, color: 'text-amber-600', bg: 'bg-amber-50' },
                          { label: 'Not Interested List', list: todayLists.notInterestedList, color: 'text-gray-500', bg: 'bg-gray-50' },
                        ].map(({ label, list, color, bg }) => (
                          <div key={label}>
                            <div className="flex items-center justify-between mb-2 px-1">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${bg} ${color}`}>{list.length}</span>
                            </div>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                              {list.length === 0 ? (
                                <p className="text-[10px] text-gray-300 italic text-center py-2">No records found</p>
                              ) : list.map((item, idx) => (
                                <div key={item._id} className="p-2 rounded-xl bg-gray-50/50 flex items-center gap-3 border border-transparent hover:border-gray-100 transition-all">
                                  <div className={`w-5 h-5 rounded-lg ${bg} flex items-center justify-center text-[8px] font-bold ${color} shrink-0`}>{idx + 1}</div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-semibold text-gray-800 truncate">{item.title || item.lead?.name || '—'}</p>
                                    {item.lead?.phone && <span className="text-[9px] text-gray-400 flex items-center gap-1">{icons.phone}{item.lead.phone}</span>}
                                  </div>
                                  <span className="text-[8px] text-gray-400 shrink-0">
                                    {new Date(item.createdAt || item.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border-t border-gray-100 mt-5 pt-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ready to Shipment Tasks</p>
                    </div>
                  </div>
                );
              })()}

              {viewUser.role === 'doctor' && staffStats[viewUser._id] && (() => {
                const s = staffStats[viewUser._id];
                return (
                  <div className="mb-5 space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Today's Appointments</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[['Total', s.totalAppointments || 0, 'text-blue-600', '#eff6ff', 'rgba(59,130,246,0.15)'],
                        ['Completed', s.completedAppointments || 0, 'text-emerald-600', '#f0fdf4', 'rgba(22,163,74,0.15)'],
                        ['Cancelled', s.cancelledAppointments || 0, 'text-rose-600', '#fff1f2', 'rgba(225,29,72,0.15)']
                      ].map(([label, val, tc, bg, border]) => (
                        <div key={label} className="rounded-2xl p-4 text-center bg-white shadow-sm" style={{ background: bg, border: `1px solid ${border}` }}>
                          <p className={`text-3xl font-black ${tc}`}>{val}</p>
                          <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mt-1">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {viewLoading ? (
                <div className="space-y-2">
                  {[1,2].map(i => (
                    <div key={i} className="rounded-2xl overflow-hidden animate-pulse" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
                      <div className="h-1 bg-green-200" />
                      <div className="px-4 py-3">
                        <div className="flex justify-between mb-2"><div className="h-3 w-32 bg-gray-200 rounded-full" /><div className="h-4 w-12 bg-gray-100 rounded-full" /></div>
                        <div className="h-2.5 w-24 bg-gray-100 rounded-full mb-1.5" />
                        <div className="h-2.5 w-40 bg-gray-100 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : viewTasks.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400">No ready to shipment tasks</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {viewTasks.map((t, i) => (
                    <div key={t._id || i} className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
                      <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-500" />
                      <div className="px-4 py-3 bg-white">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-800">{t.title}</p>
                          <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                            t.priority === 'high' ? 'bg-red-50 text-red-500' :
                            t.priority === 'medium' ? 'bg-amber-50 text-amber-600' :
                            'bg-gray-100 text-gray-500'
                          }`}>{t.priority}</span>
                        </div>
                        {t.lead?.name && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            <span className="text-xs text-gray-500">{t.lead.name}</span>
                            {t.lead.phone && <span className="text-xs text-gray-400"> · {t.lead.phone}</span>}
                          </div>
                        )}
                        {(t.cityVillage || t.district) && (
                          <div className="flex items-center gap-1 mt-1">
                            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            <span className="text-xs text-gray-400">{[t.houseNo, t.cityVillage, t.district, t.state, t.pincode].filter(Boolean).join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'edit' ? 'Edit User' : 'Add New User'} onClose={() => setModal(null)}>
          {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-3 rounded-xl mb-4">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name *</label>
              <input required className={`${inputCls} mt-1.5`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone *</label>
              <input required type="tel" className={`${inputCls} mt-1.5`} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {modal === 'edit' ? 'New Password (leave blank to keep)' : 'Password *'}
              </label>
              <input type="password" required={modal === 'create'} minLength={8} className={`${inputCls} mt-1.5`}
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</label>
              <select className={`${inputCls} mt-1.5`} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Departments</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {DEPARTMENTS.map(dept => {
                  const isSelected = form.departments.includes(dept);
                  return (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => {
                        setForm(prev => ({
                          ...prev,
                          departments: isSelected
                            ? prev.departments.filter(d => d !== dept)
                            : [...prev.departments, dept]
                        }));
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border-2 transition-all duration-200 ${
                        isSelected
                          ? `${DEPT_COLOR[dept]} border-current shadow-sm scale-105`
                          : 'bg-gray-50 text-gray-400 border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      {isSelected && <span className="mr-1">✓</span>}
                      {dept}
                    </button>
                  );
                })}
              </div>
            </div>
            {form.role === 'doctor' && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Specialization</label>
                <input className={`${inputCls} mt-1.5`} placeholder="e.g. Ayurveda, Panchakarma" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
              </div>
            )}
            {form.role !== 'admin' && form.role !== 'doctor' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Base Salary (Monthly)</label>
                  <input type="number" className={`${inputCls} mt-1.5`} value={form.baseSalary} onChange={(e) => setForm({ ...form, baseSalary: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Commission (%)</label>
                  <input type="number" className={`${inputCls} mt-1.5`} value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: Number(e.target.value) })} />
                </div>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button type="submit" disabled={loading}
                className="flex-1 py-3.5 rounded-xl text-[11px] font-bold text-white disabled:opacity-60 transition shadow-lg hover:shadow-xl active:scale-95 uppercase tracking-widest"
                style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
                {loading ? 'SAVING...' : modal === 'edit' ? 'UPDATE USER' : 'CREATE USER'}
              </button>
              <button type="button" onClick={() => setModal(null)}
                className="flex-1 border border-gray-200 bg-white py-3.5 rounded-xl text-[11px] font-bold text-gray-500 hover:bg-gray-50 transition active:scale-95 uppercase tracking-widest">
                CANCEL
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
