import { useEffect, useState, useCallback, useMemo } from 'react';
import StatCard from '../components/ui/StatCard';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import {
  fetchStats,
  fetchStaffTodayLists,
  fetchAllStaffStats,
  fetchStaffStats,
  fetchStaffMonthlyChart,
  fetchStaffCommission,
  fetchAllStaffCommissions
} from '../services/dashboard.service';
import * as attendanceSvc from '../services/attendance.service';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { getLeads, exportLeads } from '../services/lead.service';
import * as smxSvc from '../services/shipmaxx.service';
import ShipmentAnalyticsPanel from '../components/ShipmentAnalyticsPanel';

const cardCls = "bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow";
const cardStyle = { border: '1px solid rgba(0,0,0,0.05)' };
const inp = 'border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-green-500 bg-white';

const DATE_FILTERS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 Days' },
  { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All Time' },
  { id: 'custom', label: 'Custom' },
];

const DEPARTMENTS = ['migraine', 'piles'];

const formatDateInput = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getDateParams = (preset, customFrom, customTo) => {
  if (preset === 'all') return { filterType: 'all', from: 'all', to: 'all' };
  const today = new Date();
  const to = formatDateInput(today);
  if (preset === 'today') return { filterType: 'range', from: to, to };
  if (preset === 'yesterday') {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    const day = formatDateInput(d);
    return { filterType: 'range', from: day, to: day };
  }
  if (preset === 'last7') {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    return { filterType: 'range', from: formatDateInput(d), to };
  }
  if (preset === 'month') {
    const d = new Date(today.getFullYear(), today.getMonth(), 1);
    return { filterType: 'range', from: formatDateInput(d), to };
  }
  if (preset === 'custom' && customFrom && customTo) {
    return { filterType: 'range', from: customFrom, to: customTo };
  }
  return {};
};

const icons = {
  cnp: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M16.5 1.5a4.5 4.5 0 0 1 4.5 4.5v12a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 18V6a4.5 4.5 0 0 1 4.5-4.5h9z" /><line x1="4" y1="4" x2="20" y2="20" /></svg>,
  callAgain: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.61 19a19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 3.09 4.18 2 2 0 0 1 5.07 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L9.91 9.91a16 16 0 0 0 6.18 6.18l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
  interested: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>,
  notInterested: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>,
  user: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  phone: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.61 19a19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 3.09 4.18 2 2 0 0 1 5.07 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L9.91 9.91a16 16 0 0 0 6.18 6.18l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
  leadAdd: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>,
  verify: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
};


export default function Dashboard() {
  const { user } = useAuth();
  const { success, error, info } = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [deliveredStats, setDeliveredStats] = useState({ count: 0, revenue: 0, statusBreakdown: [] });
  const [todayLists, setTodayLists] = useState({ cnpList: [], callAgainList: [], interestedList: [], notInterestedList: [], onHoldList: [] });
  const [staffStats, setStaffStats] = useState(null);
  const [monthlyChart, setMonthlyChart] = useState([]);
  const [attStatus, setAttStatus] = useState(null);
  const [attLoading, setAttLoading] = useState(false);
  const [commission, setCommission] = useState(null);
  const [commMonth, setCommMonth] = useState(() => { const n = new Date(); return { month: n.getMonth(), year: n.getFullYear() }; });
  const [commLoading, setCommLoading] = useState(false);
  const [openSection, setOpenSection] = useState(null);
  const [allStaffStats, setAllStaffStats] = useState([]);
  const [teamOverviewPeriod, setTeamOverviewPeriod] = useState('today');

  const [datePreset, setDatePreset] = useState('today');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [department, setDepartment] = useState('');
  const canManage = user?.role === 'admin' || user?.role === 'manager';

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const params = getDateParams(datePreset, filterFrom, filterTo);
    const { from, to } = params;
    const selectedDate = (datePreset === 'today' || datePreset === 'all' || !from) ? new Date().toISOString().split('T')[0] : from;

    try {

      const [s, personal, att] = await Promise.allSettled([
        fetchStats(selectedDate, from, to, department),
        fetchStaffStats(selectedDate, null, from, to, department),
        attendanceSvc.getTodayStatus(),
      ]);

      if (s.status === 'fulfilled') {
        setStats(s.value);
      }
      if (personal.status === 'fulfilled') {
        setStaffStats(personal.value || null);
      }
      if (att.status === 'fulfilled') setAttStatus(att.value);
      setLastUpdated(new Date());
      if (!silent) setLoading(false);

      if (silent) return;

      Promise.allSettled([
        user?.role === 'sales'
          ? fetchStaffTodayLists(selectedDate, null, from, to, department)
          : Promise.resolve(null),
        fetchStaffMonthlyChart(),
        smxSvc.getDeliveredStats({}),
      ]).then(([lists, chart, smxStats]) => {
        if (lists.status === 'fulfilled' && lists.value) {
          const val = lists.value || { cnpList: [], callAgainList: [], interestedList: [], notInterestedList: [], onHoldList: [] };
          setTodayLists(val);
        }
        if (chart.status === 'fulfilled') {
          const val = Array.isArray(chart.value) ? chart.value : [];
          setMonthlyChart(val);
        }
        if (smxStats.status === 'fulfilled') {
          const { count, revenue, statusBreakdown } = smxStats.value.data?.data || {};
          const val = { count: count || 0, revenue: revenue || 0, statusBreakdown: statusBreakdown || [] };
          setDeliveredStats(val);
        }
      }).catch((e) => console.error('Dashboard secondary load error:', e));
    } catch (e) {
      console.error('Dashboard load error:', e);
      if (!silent) setLoading(false);
    }
  }, [datePreset, filterFrom, filterTo, department, user?.role, user?._id]);

  useAutoRefresh(load, 300000); // refresh every 5 minutes — reduces server load significantly

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    setCommLoading(true);

    const isPrivileged = user?.role === 'admin' || user?.role === 'manager';
    const fetchFunc = isPrivileged ? fetchAllStaffCommissions : fetchStaffCommission;

    fetchFunc(commMonth.month, commMonth.year)
      .then(d => {
        if (!cancelled) {
          if (isPrivileged) {
            setCommission({
              totalPay: d.grandTotalPay,
              basePay: (d.grandTotalPay || 0) - (d.grandTotalCommission || 0),
              totalCommission: d.grandTotalCommission,
              revenue: d.grandTotalRevenue
            });
          } else {
            setCommission(d);
          }
        }
      })
      .catch(e => { if (!cancelled) console.error(e); })
      .finally(() => { if (!cancelled) setCommLoading(false); });

    return () => { cancelled = true; };
  }, [commMonth, user?.role]);

  useEffect(() => {
    let cancelled = false;
    let timer;

    if (canManage) {
      let from, to;
      const today = new Date();
      if (teamOverviewPeriod === '7d') {
        const past = new Date(today);
        past.setDate(past.getDate() - 6);
        from = past.toISOString().split('T')[0];
        to = today.toISOString().split('T')[0];
      } else if (teamOverviewPeriod === '15d') {
        const past = new Date(today);
        past.setDate(past.getDate() - 14);
        from = past.toISOString().split('T')[0];
        to = today.toISOString().split('T')[0];
      } else if (teamOverviewPeriod === 'month') {
        const past = new Date(today.getFullYear(), today.getMonth(), 1);
        from = past.toISOString().split('T')[0];
        to = today.toISOString().split('T')[0];
      } else {
        from = today.toISOString().split('T')[0];
        to = from;
      }

      timer = setTimeout(() => {
        fetchAllStaffStats(null, from, to).then(data => {
          if (!cancelled) setAllStaffStats(data || []);
        }).catch(e => console.error(e));
      }, 500);
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [teamOverviewPeriod, canManage]);

  const [csvLoading, setCsvLoading] = useState(false);

  const downloadLeadsCSV = async (allLeads = false) => {
    setCsvLoading(allLeads ? 'all' : 'filtered');
    try {
      let allLeadsList = [];

      if (allLeads) {
        // Use dedicated export endpoint — no filters, all leads
        allLeadsList = await exportLeads();
      } else {
        // Paginate through filtered leads
        const fp = getDateParams(datePreset, filterFrom, filterTo);
        const baseParams = { limit: 500 };
        if (fp.from) baseParams.dateFrom = fp.from;
        if (fp.to) baseParams.dateTo = fp.to;
        if (department) baseParams.department = department;
        let page = 1, totalPages = 1;
        do {
          const data = await getLeads({ ...baseParams, page });
          allLeadsList = [...allLeadsList, ...(data?.leads || [])];
          totalPages = data?.totalPages || 1;
          page++;
        } while (page <= totalPages);
      }

      const headers = ['Name', 'Phone', 'Status', 'Problem', 'Age', 'Weight', 'Height', 'Price', 'City/Village', 'District', 'Pincode', 'State', 'Assigned To', 'Created At'];
      const rows = allLeadsList.map(l => [
        l.name || '', l.phone || '', l.status || '', l.problem || '',
        l.age || '', l.weight || '', l.height || '', l.price || l.revenue || '',
        l.cityVillage || '', l.district || '', l.pincode || '', l.state || '',
        l.assignedTo?.name || '',
        l.createdAt ? new Date(l.createdAt).toLocaleString() : '',
      ]);
      const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = allLeads ? `all_leads_${new Date().toISOString().slice(0, 10)}.csv` : `leads_${datePreset}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } catch (e) { error('Failed to download CSV'); }
    finally { setCsvLoading(false); }
  };

  const checkedIn = !!attStatus?.checkIn;
  const checkedOut = !!attStatus?.checkOut;
  const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : null;

  const handleCheckIn = async () => {
    setAttLoading(true);
    try {
      const res = await attendanceSvc.checkIn();
      setAttStatus(res);
      success('Good morning! You have checked in successfully.', 'Clock In');
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

  const selectDatePreset = (preset) => {
    setDatePreset(preset);
    if (preset === 'custom') {
      const today = new Date();
      const from = formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
      const to = formatDateInput(today);
      setFilterFrom(from);
      setFilterTo(to);
    }
  };

  const filterParams = useMemo(() => ({ ...getDateParams(datePreset, filterFrom, filterTo), department }), [datePreset, filterFrom, filterTo, department]);

  if (loading && !stats) {
    // Show a skeleton or just empty stats instead of blocking
  }

  // Calculate some derived metrics
  const getPeriodLabel = () => {
    if (datePreset === 'today') return t('Today');
    if (datePreset === 'yesterday') return t('Yesterday');
    if (datePreset === 'last7') return t('Last 7 Days');
    if (datePreset === 'month') return t('This Month');
    if (datePreset === 'all') return t('All Time');
    return `${filterFrom} to ${filterTo}`;
  };
  const migraineLeadCount = stats?.departmentLeads?.migraine || 0;
  const pilesLeadCount = stats?.departmentLeads?.piles || 0;
  const newLeadsTotal = stats?.newLeadsToday || 0;
  // % of new leads in period that belong to each department (vs total new leads)
  const migraineLeadPercent = newLeadsTotal > 0 ? Math.round((migraineLeadCount / newLeadsTotal) * 100) : 0;
  const pilesLeadPercent = newLeadsTotal > 0 ? Math.round((pilesLeadCount / newLeadsTotal) * 100) : 0;
  // Conversion rates from backend (closed_won / dept leads in period)
  const overallConversionRate = stats?.conversionRate || 0;
  const migraineConversionRate = stats?.migraineConversionRate || 0;
  const pilesConversionRate = stats?.pilesConversionRate || 0;
  const migraineConverted = stats?.migraineConverted || 0;
  const pilesConverted = stats?.pilesConverted || 0;

  return (
    <div className="space-y-6">
      {/* Date Filter Bar */}
      <div className={`flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-4 ${cardCls}`} style={cardStyle}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{t('Dashboard Overview')}</h2>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{t('Filtering for')}: {getPeriodLabel().toUpperCase()}</p>
              {lastUpdated && (
                <span className="text-[9px] text-gray-300 font-medium">· Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              )}
            </div>
          </div>
        </div>

        <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar shrink-0">
            <div className="inline-flex items-center gap-1 rounded-xl bg-gray-100 p-1">
              {DATE_FILTERS.map(filter => (
                <button key={filter.id} onClick={() => selectDatePreset(filter.id)}
                  className={`h-8 px-3 rounded-lg text-[10px] sm:text-[11px] font-black transition-all whitespace-nowrap ${datePreset === filter.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                  {t(filter.label).toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {canManage && (
            <select
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className={`${inp} min-w-[120px] shrink-0 font-bold text-gray-700`}
            >
              <option value="">{t('All Depts')}</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
            </select>
          )}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input type="date" className={`${inp} flex-1 sm:w-32 py-2`} value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
              <input type="date" className={`${inp} flex-1 sm:w-32 py-2`} value={filterTo} onChange={e => setFilterTo(e.target.value)} />
              <button onClick={load} className="h-9 px-4 rounded-xl bg-green-600 text-white text-[10px] font-bold hover:bg-green-700 transition active:scale-95">{t('APPLY')}</button>
            </div>
          )}
          <button onClick={() => downloadLeadsCSV(false)} disabled={!!csvLoading}
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition disabled:opacity-60 shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            {csvLoading === 'filtered' ? `${t('Downloading...')} ` : `${t('Leads CSV')}`}
          </button>
        </div>
      </div>

      {/* Filter-Based Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-bold text-gray-700">Delivered Orders</h4>
            <span className="text-[10px] text-gray-700 font-bold bg-gray-100 px-2 py-1 rounded-md border border-gray-200">{getPeriodLabel()}</span>
          </div>
          <div className="flex items-end gap-3">
            <div className="text-3xl font-black text-emerald-600 tracking-tight">
              {stats?.deliveredCount || 0}
            </div>
            <div className="mb-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded">Total</div>
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-bold text-gray-700">New Order Deliveries</h4>
            <span className="text-[10px] text-gray-700 font-bold bg-gray-100 px-2 py-1 rounded-md border border-gray-200">{getPeriodLabel()}</span>
          </div>
          <div className="flex items-end gap-3">
            <div className="text-3xl font-black text-blue-600 tracking-tight">
              {stats?.newDeliveredCount || 0}
            </div>
            <div className="mb-1 bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-1 rounded">1st Kit</div>
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-bold text-gray-700">Old Order Deliveries</h4>
            <span className="text-[10px] text-gray-700 font-bold bg-gray-100 px-2 py-1 rounded-md border border-gray-200">{getPeriodLabel()}</span>
          </div>
          <div className="flex items-end gap-3">
            <div className="text-3xl font-black text-purple-600 tracking-tight">
              {stats?.oldDeliveredCount || 0}
            </div>
            <div className="mb-1 bg-purple-50 text-purple-700 text-[10px] font-bold px-2 py-1 rounded">2nd+ Kit</div>
          </div>
        </div>
      </div>

      {/* ═══ Today at a Glance ═══ */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 40%, #047857 100%)', boxShadow: '0 4px 20px rgba(5,150,105,0.15)' }}>
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
              <svg className="w-5 h-5 text-emerald-200" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            </div>
            <div>
              <h2 className="text-white font-bold text-base">{t('Today at a Glance')}</h2>
              <p className="text-emerald-200/60 text-xs">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
              <p className="text-xl font-black text-white">{stats?.newLeadsToday || 0}</p>
              <p className="text-[9px] font-bold text-emerald-200/70 uppercase tracking-widest">{t('New Leads')}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
              <p className="text-xl font-black text-white">{stats?.readyToShipmentCount || 0}</p>
              <p className="text-[9px] font-bold text-emerald-200/70 uppercase tracking-widest">{t('Pending Ship')}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 text-center flex flex-col justify-center">
              <p className="text-xl font-black text-white">{stats?.deliveredCount || 0}</p>
              <p className="text-[9px] font-bold text-emerald-200/70 uppercase tracking-widest mb-1">{t('Delivered')}</p>
              <div className="flex justify-center gap-2 text-[10px] font-medium text-emerald-100">
                <span title="1st Kit">New: {stats?.newDeliveredCount || 0}</span>
                <span title="2nd Kit+">Old: {stats?.oldDeliveredCount || 0}</span>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
              <p className="text-xl font-black text-white">₹{(stats?.deliveredRevenue || 0).toLocaleString('en-IN')}</p>
              <p className="text-[9px] font-bold text-emerald-200/70 uppercase tracking-widest">{t('Revenue')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Quick Actions ═══ */}
      {canManage && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t('Leads'), icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>, path: '/leads', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
            { label: t('Verification'), icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, path: '/verification', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { label: t('Ready to Ship'), icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="1" /><path d="M16 8h4l3 5v3h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>, path: '/ready-to-shipment', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
            { label: t('Notifications'), icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>, path: '/notifications', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
          ].map(action => (
            <button key={action.path} onClick={() => navigate(action.path)}
              className={`${cardCls} flex items-center gap-3 !py-3.5 !px-4 cursor-pointer border ${action.border} hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-[0.98]`}
              style={{ ...cardStyle, borderColor: undefined }}>
              <div className={`w-10 h-10 rounded-xl ${action.bg} ${action.color} flex items-center justify-center shrink-0`}>{action.icon}</div>
              <span className="text-sm font-bold text-gray-700">{action.label}</span>
              <svg className="w-4 h-4 text-gray-300 ml-auto" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          ))}
        </div>
      )}

      {/* Stat Cards Grouped Logically by Rows */}
      <div className="space-y-6 sm:space-y-8">

        {/* Row 1: Lead Pipeline */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e] animate-pulse" />
            <span className="text-[10px] font-black tracking-widest text-gray-400 dark:text-slate-400 uppercase select-none">{t('Lead Pipeline')}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
            <div onClick={() => downloadLeadsCSV(true)} className="cursor-pointer relative" title="Download all leads as CSV">
              <StatCard
                label={t('Total Leads')}
                value={stats?.totalLeads}
                icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
                color="border-green-500"
                sub={csvLoading === 'all' ? `⏳ ${t('Downloading...')}` : `⬇ ${t('Click to download CSV')}`}
              />
            </div>
            <StatCard
              label={datePreset === 'all' ? t('New Leads (Total)') : `${t('New Leads')} (${getPeriodLabel()})`}
              value={stats?.newLeadsToday}
              icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
              color="border-blue-500"
            />
            <StatCard
              label={`${t('Migraine')} ${t('Leads')}`}
              value={migraineLeadCount}
              icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 4.5c-2.5 0-4.5 2-4.5 4.5v1.25A3.25 3.25 0 0 0 5 13.4c0 1.8 1.45 3.25 3.25 3.25h.25V19h7v-2.35h.25A3.25 3.25 0 0 0 19 13.4a3.25 3.25 0 0 0-2.5-3.15V9c0-2.5-2-4.5-4.5-4.5z" /><path d="M10 9.25h4M9.5 12h5M10 14.75h4" /></svg>}
              color="border-pink-500"
              progress={migraineLeadPercent}
              progressLabel={`${migraineLeadPercent}% of new leads · VR: ${migraineConversionRate}%`}
            />
            <StatCard
              label={`${t('Piles')} ${t('Leads')}`}
              value={pilesLeadCount}
              icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11z" /><circle cx="12" cy="10" r="2.5" /></svg>}
              color="border-amber-500"
              progress={pilesLeadPercent}
              progressLabel={`${pilesLeadPercent}% of new leads · VR: ${pilesConversionRate}%`}
            />
            <StatCard
              label={t('Ready to Shipment')}
              value={stats?.readyToShipmentCount}
              icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="1" /><path d="M16 8h4l3 5v3h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>}
              color="border-purple-500"
            />
          </div>
        </div>

        {/* Lead Conversion Rate Row — Admin/Manager only */}
        {canManage && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e] animate-pulse" />
              <span className="text-[10px] font-black tracking-widest text-gray-400 dark:text-slate-400 uppercase select-none">{t('Lead Verification Rate')}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <StatCard
                label={`${t('Overall Conversion')} (${getPeriodLabel()})`}
                value={`${overallConversionRate}%`}
                icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
                color="border-emerald-500"
                progress={overallConversionRate}
                progressLabel={`${stats?.convertedLeads || 0} verified / ${stats?.newLeadsToday || 0} new leads`}
              />
              <StatCard
                label={`${t('Migraine')} ${t('Conversion Rate')}`}
                value={`${migraineConversionRate}%`}
                icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 4.5c-2.5 0-4.5 2-4.5 4.5v1.25A3.25 3.25 0 0 0 5 13.4c0 1.8 1.45 3.25 3.25 3.25h.25V19h7v-2.35h.25A3.25 3.25 0 0 0 19 13.4a3.25 3.25 0 0 0-2.5-3.15V9c0-2.5-2-4.5-4.5-4.5z" /><path d="M10 9.25h4M9.5 12h5M10 14.75h4" /></svg>}
                color="border-pink-500"
                progress={migraineConversionRate}
                progressLabel={`${migraineConverted} verified / ${migraineLeadCount} migraine leads`}
              />
              <StatCard
                label={`${t('Piles')} ${t('Conversion Rate')}`}
                value={`${pilesConversionRate}%`}
                icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11z" /><circle cx="12" cy="10" r="2.5" /></svg>}
                color="border-amber-500"
                progress={pilesConversionRate}
                progressLabel={`${pilesConverted} verified / ${pilesLeadCount} piles leads`}
              />
            </div>
          </div>
        )}

        {/* Row 2: Shipping Preparation */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_#6366f1] animate-pulse" />
            <span className="text-[10px] font-black tracking-widest text-gray-400 dark:text-slate-400 uppercase select-none">{t('Shipping Preparation')}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <StatCard
              label={t('New Ready to Ship')}
              value={stats?.newReadyToShipCount || 0}
              icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>}
              color="border-indigo-500"
              progress={stats?.readyToShipmentCount ? Math.round(((stats?.newReadyToShipCount || 0) / stats?.readyToShipmentCount) * 100) : 0}
              progressLabel={t('Share of Backlog')}
            />
            <StatCard
              label={t('Old Ready to Ship')}
              value={stats?.oldReadyToShipCount || 0}
              icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M2.5 2v6h6M21.5 22v-6h-6" /><path d="M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2" /></svg>}
              color="border-pink-500"
              progress={stats?.readyToShipmentCount ? Math.round(((stats?.oldReadyToShipCount || 0) / stats?.readyToShipmentCount) * 100) : 0}
              progressLabel={t('Share of Backlog')}
            />
          </div>
        </div>

        {/* Row 3: Orders Intake */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4] animate-pulse" />
            <span className="text-[10px] font-black tracking-widest text-gray-400 dark:text-slate-400 uppercase select-none">{t('Orders Intake')}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <StatCard
              label={t('New Orders')}
              value={stats?.newOrdersCount || 0}
              icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>}
              color="border-cyan-500"
              progress={((stats?.newOrdersCount || 0) + (stats?.oldOrdersCount || 0)) ? Math.round(((stats?.newOrdersCount || 0) / ((stats?.newOrdersCount || 0) + (stats?.oldOrdersCount || 0))) * 100) : 0}
              progressLabel={t('Share of Orders')}
            />
            <StatCard
              label={t('Old Orders')}
              value={stats?.oldOrdersCount || 0}
              icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M2.5 2v6h6M21.5 22v-6h-6" /><path d="M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2" /></svg>}
              color="border-amber-500"
              progress={((stats?.newOrdersCount || 0) + (stats?.oldOrdersCount || 0)) ? Math.round(((stats?.oldOrdersCount || 0) / ((stats?.newOrdersCount || 0) + (stats?.oldOrdersCount || 0))) * 100) : 0}
              progressLabel={t('Share of Orders')}
            />
          </div>
        </div>

        {/* Row 4: Fulfillment & Revenue */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
            <span className="text-[10px] font-black tracking-widest text-gray-400 dark:text-slate-400 uppercase select-none">{t('Fulfillment & Revenue')}</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              label={`${t('Delivered')} (${getPeriodLabel()})`}
              value={stats?.deliveredCount || 0}
              icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
              color="border-emerald-500"
            />
            <StatCard
              label={`${t('New Order Delivered')} (${getPeriodLabel()})`}
              value={stats?.newDeliveredCount || 0}
              icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
              color="border-emerald-400"
              progress={stats?.deliveredCount ? Math.round(((stats?.newDeliveredCount || 0) / stats?.deliveredCount) * 100) : 0}
              progressLabel={t('Share of Deliveries')}
            />
            <StatCard
              label={`${t('Old Order Delivered')} (${getPeriodLabel()})`}
              value={stats?.oldDeliveredCount || 0}
              icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
              color="border-teal-400"
              progress={stats?.deliveredCount ? Math.round(((stats?.oldDeliveredCount || 0) / stats?.deliveredCount) * 100) : 0}
              progressLabel={t('Share of Deliveries')}
            />
            <StatCard
              label={`${t('Revenue')} (${getPeriodLabel()})`}
              value={`₹${(stats?.deliveredRevenue || 0).toLocaleString()}`}
              icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>}
              color="border-teal-500"
            />
          </div>
        </div>

      </div>

      {/* Attendance Quick Card (Managers Only) */}
      {user?.role === 'manager' && (
        <div className={cardCls} style={{ ...cardStyle, background: 'linear-gradient(135deg, #0d1f0d, #1a3a1a)', border: 'none' }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Personal Attendance</p>
                <p className="text-green-300/60 text-xs mt-0.5">
                  {checkedIn && checkedOut ? `In: ${fmtTime(attStatus.checkIn)} · Out: ${fmtTime(attStatus.checkOut)}`
                    : checkedIn ? `Checked in at ${fmtTime(attStatus.checkIn)}`
                      : 'Not checked in yet'}
                </p>
              </div>
            </div>
            <div>
              {!checkedIn ? (
                <button onClick={handleCheckIn} disabled={attLoading}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
                  {attLoading ? 'Processing...' : <><svg className="w-4 h-4 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg> Clock In</>}
                </button>
              ) : !checkedOut ? (
                <button onClick={handleCheckOut} disabled={attLoading}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #ea580c, #c2410c)' }}>
                  {attLoading ? 'Processing...' : <><svg className="w-4 h-4 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg> Clock Out</>}
                </button>
              ) : (
                <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-500/20 text-green-300 text-sm font-semibold">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M9 11l3 3L22 4" /></svg>
                  Day Complete
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* My Activity Counts (Staff Only) */}
      {user?.role === 'sales' && (
        <>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-widest">My Activity Counts</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "CNP", value: staffStats?.todayCnp ?? 0, icon: icons.cnp, bg: "bg-red-50", text: "text-red-500" },
              { label: "Call Again", value: staffStats?.todayCallAgain ?? 0, icon: icons.callAgain, bg: "bg-yellow-50", text: "text-yellow-600" },
              { label: "Lead Add", value: staffStats?.leadsAdded ?? 0, icon: icons.leadAdd, bg: "bg-blue-50", text: "text-blue-600" },
              { label: "Verified", value: staffStats?.verifiedCount ?? 0, icon: icons.verify, bg: "bg-emerald-50", text: "text-emerald-600" },
              { label: "On Hold", value: staffStats?.onHoldCount ?? 0, icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, bg: "bg-amber-50", text: "text-amber-600" },
              { label: "Interested", value: staffStats?.todayInterested ?? 0, icon: icons.interested, bg: "bg-green-50", text: "text-green-600" },
              { label: "Not Interested", value: staffStats?.todayNotInterested ?? 0, icon: icons.notInterested, bg: "bg-gray-50", text: "text-gray-500" },
            ].map(({ label, value, icon, bg, text }) => (
              <div key={label} className={`${cardCls} flex flex-col items-center justify-center text-center gap-1.5 py-4 px-2`} style={cardStyle}>
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0 mb-1`}>
                  <span className={text}>{icon}</span>
                </div>
                <p className={`text-2xl font-extrabold ${text}`}>{value}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Earnings & Activity Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`lg:col-span-1 ${cardCls}`} style={cardStyle}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-gray-700">Company Earnings</h3>
            <div className="flex items-center gap-1">
              <button onClick={() => setCommMonth(p => {
                const m = p.month - 1;
                return m < 0 ? { month: 11, year: p.year - 1 } : { month: m, year: p.year };
              })} className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"><svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg></button>
              <span className="text-[10px] font-bold text-gray-600 min-w-[70px] text-center uppercase tracking-tight">
                {new Date(commMonth.year, commMonth.month).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
              </span>
              <button onClick={() => setCommMonth(p => {
                const m = p.month + 1;
                return m > 11 ? { month: 0, year: p.year + 1 } : { month: m, year: p.year };
              })} className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"><svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg></button>
            </div>
          </div>
          {commLoading ? (
            <div className="flex items-center justify-center py-10"><div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : commission ? (
            <div className="space-y-4">
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <div className="bg-emerald-600 rounded-2xl p-5 text-center shadow-lg border border-emerald-500/50">
                  <p className="text-2xl font-bold text-white">₹{(commission.revenue || 0).toLocaleString('en-IN')}</p>
                  <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-widest mt-1">Total Revenue</p>
                </div>
              )}
              <div className="bg-gray-900 rounded-2xl p-5 text-center shadow-lg">
                <p className="text-2xl font-bold text-white">₹{(commission.totalPay || 0).toLocaleString('en-IN')}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Total Payouts</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-green-50 border border-green-100">
                  <p className="text-lg font-bold text-green-600">₹{(commission.basePay || 0).toLocaleString('en-IN')}</p>
                  <p className="text-[9px] text-green-700 font-bold uppercase">Base</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <p className="text-lg font-bold text-amber-600">₹{(commission.totalCommission || 0).toLocaleString('en-IN')}</p>
                  <p className="text-[9px] text-amber-700 font-bold uppercase">Comm.</p>
                </div>
              </div>
            </div>
          ) : <p className="text-xs text-gray-400 text-center py-6">No data</p>}
        </div>

        <div className={`lg:col-span-2 ${cardCls}`} style={cardStyle}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-gray-700">Company Activity Trend</h3>
            <div className="flex items-center gap-2">
              {monthlyChart.length > 0 && (
                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
                  {monthlyChart.reduce((s, d) => s + d.count, 0)} Total
                </span>
              )}
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Verifications</span>
            </div>
          </div>
          {monthlyChart.length > 0 && (
            <div className="h-48 relative group px-2">
              {(() => {
                const max = Math.max(...monthlyChart.map(d => d.count), 5);
                const todayDay = new Date().getDate();
                const points = monthlyChart.map((d, i) => {
                  const x = (i / (monthlyChart.length - 1)) * 100;
                  const y = 92 - (d.count / max) * 84;
                  return `${x},${y}`;
                }).join(' L ');

                return (
                  <>
                    {/* Y-axis scale labels (HTML, outside SVG to avoid distortion) */}
                    <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between py-[3%] pointer-events-none z-10" style={{ top: '0%', bottom: '8%' }}>
                      <span className="text-[9px] font-bold text-gray-300 text-right pr-1 leading-none">{max}</span>
                      <span className="text-[9px] font-bold text-gray-300 text-right pr-1 leading-none">{Math.round(max / 2)}</span>
                      <span className="text-[9px] font-bold text-gray-300 text-right pr-1 leading-none">0</span>
                    </div>
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {[0, 25, 50, 75, 100].map(v => (
                        <line key={v} x1="0" y1={v} x2="100" y2={v} stroke="#f3f4f6" strokeWidth="0.5" />
                      ))}
                      <path d={`M 0 100 L ${points} L 100 100 Z`} fill="url(#chartGrad)" />
                      <path d={`M ${points}`} fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {/* Today marker dot (HTML positioned, avoids SVG distortion) */}
                    {monthlyChart.map((d, i) => {
                      if (d.day === todayDay) {
                        const leftPct = (i / (monthlyChart.length - 1)) * 100;
                        const bottomPct = 8 + (d.count / max) * 84;
                        return (
                          <div key="today-marker" className="absolute w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-md z-10 pointer-events-none"
                            style={{ left: `${leftPct}%`, bottom: `${bottomPct}%`, transform: 'translate(-50%, 50%)' }} />
                        );
                      }
                      return null;
                    })}
                    <div className="absolute inset-0 flex">
                      {monthlyChart.map((d, i) => (
                        <div key={i} className="flex-1 group/dot relative h-full">
                          <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] px-2.5 py-1.5 rounded-lg opacity-0 group-hover/dot:opacity-100 transition-opacity z-20 whitespace-nowrap pointer-events-none shadow-xl">
                            <span className="text-gray-400">{new Date(new Date().getFullYear(), new Date().getMonth(), d.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>{' '}
                            <span className="font-bold text-white">{d.count} {d.count === 1 ? 'verification' : 'verifications'}</span>
                          </div>
                          <div
                            className={`absolute w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm transition-all ${d.day === todayDay
                                ? 'bg-emerald-500 opacity-100 scale-110'
                                : 'bg-green-500 opacity-0 group-hover/dot:opacity-100 scale-0 group-hover/dot:scale-110'
                              }`}
                            style={{
                              left: '50%',
                              bottom: `${8 + (d.count / max) * 84}%`,
                              transform: 'translate(-50%, 50%)'
                            }}
                          />
                          <div className="absolute inset-y-0 left-0 w-full cursor-crosshair" />
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
          {/* X-axis labels with week markers */}
          <div className="mt-4 flex items-center justify-between px-2 pt-4 border-t border-gray-50 relative">
            {[1, 7, 14, 21, 28].filter(d => d <= monthlyChart.length).map(d => (
              <span key={d} className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">
                {d} {new Date().toLocaleString('default', { month: 'short' })}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Staff Activity Detail Lists (Staff Only) */}
      {user?.role === 'sales' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[
            { key: 'cnp', label: `CNP List (${getPeriodLabel()})`, icon: icons.cnp, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100', list: todayLists.cnpList },
            { key: 'callAgain', label: `Call Again List (${getPeriodLabel()})`, icon: icons.callAgain, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-100', list: todayLists.callAgainList },
            { key: 'interested', label: `Interested List (${getPeriodLabel()})`, icon: icons.interested, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', list: todayLists.interestedList },
            { key: 'onHold', label: `On Hold List (${getPeriodLabel()})`, icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', list: todayLists.onHoldList },
            { key: 'notInterested', label: `Not Interested List (${getPeriodLabel()})`, icon: icons.notInterested, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-100', list: todayLists.notInterestedList },
          ].map(({ key, label, icon, color, bg, border, list }) => (
            <div key={key} className={cardCls} style={cardStyle}>
              <button className="w-full flex items-center justify-between"
                onClick={() => setOpenSection(openSection === key ? null : key)}>
                <div className="flex items-center gap-2">
                  <span className={`w-8 h-8 rounded-xl ${bg} ${color} flex items-center justify-center`}>{icon}</span>
                  <span className="text-sm font-semibold text-gray-700">{label}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${bg} ${color} border ${border}`}>{list.length}</span>
                </div>
                <span className="text-gray-400 text-sm">{openSection === key ? '▲' : '▼'}</span>
              </button>
              {openSection === key && (
                <div className="mt-4 divide-y divide-gray-50 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                  {list.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No records for {getPeriodLabel()}</p>
                  ) : list.map((item, i) => (
                    <div key={item._id} className="py-3 flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center text-[10px] font-bold ${color} shrink-0`}>{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{item.title || item.lead?.name || '—'}</p>
                        <div className="flex gap-3 mt-0.5">
                          {item.assignedTo?.name && <span className="text-[10px] text-blue-600 font-medium flex items-center gap-1">{icons.user}{item.assignedTo.name}</span>}
                          {item.lead?.phone && <span className="text-[10px] text-gray-500 flex items-center gap-1">{icons.phone}{item.lead.phone}</span>}
                        </div>
                      </div>
                      <span className="text-[9px] text-gray-400 shrink-0">
                        {new Date(item.createdAt || item.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tasks Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">


      </div>

      {/* Shipment Analytics — Admin/Manager only */}
      {canManage && (
        <ShipmentAnalyticsPanel department={department} />
      )}

      {/* Admin Monitoring Staff Overview */}
      {canManage && (
        <div className={cardCls} style={cardStyle}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Team Performance Overview</h3>
            <div className="flex bg-gray-100/80 p-0.5 rounded-lg border border-gray-200/50">
              {['today', '7d', '15d', 'month'].map(period => (
                <button
                  key={period}
                  onClick={() => setTeamOverviewPeriod(period)}
                  className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${teamOverviewPeriod === period
                      ? 'bg-white text-blue-600 shadow-sm border border-gray-200/50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                    }`}
                >
                  {period === 'today' ? 'Today' : period === 'month' ? 'Monthly' : period.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="table-responsive no-scrollbar max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="text-gray-400 border-b border-gray-100 text-left">
                  <th className="py-3 px-4 font-black uppercase tracking-[0.15em] text-[10px] w-12 text-center">#</th>
                  <th className="py-3 px-4 font-black uppercase tracking-[0.15em] text-[10px]">Staff</th>
                  <th className="py-3 px-2 font-black uppercase tracking-[0.15em] text-[10px] text-center">Work</th>
                  <th className="py-3 px-2 font-black uppercase tracking-[0.15em] text-[10px] text-center">Leads</th>
                  <th className="py-3 px-2 font-black uppercase tracking-[0.15em] text-[10px] text-center">Calls</th>
                  <th className="py-3 px-2 font-black uppercase tracking-[0.15em] text-[10px] text-center">VR %</th>
                  <th className="py-3 px-2 font-black uppercase tracking-[0.15em] text-[10px] text-center">DR %</th>
                  <th className="py-3 px-2 font-black uppercase tracking-[0.15em] text-[10px] text-center">RTO %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50/50">
                {allStaffStats.filter(s => s.user?.role !== 'doctor').map((s, i) => {
                  const readyCount = s.readyToShipmentCount || 0;
                  const vrBase = s.todayTarget || 0;
                  // Calculate VR% based on Daily Target for Verifications
                  const vr = vrBase > 0 ? Math.min(Math.round(((s.todayVerifications || 0) / vrBase) * 100), 100) : 0;
                  const dr = s.monthDispatchedCount > 0 ? Math.min(Math.round(((s.monthDeliveredCount || 0) / s.monthDispatchedCount) * 100), 100) : 0;
                  const rto = s.monthDispatchedCount > 0 ? Math.min(Math.round(((s.monthRtoCount || 0) / s.monthDispatchedCount) * 100), 100) : 0;
                  const vrColor = vr >= 80 ? 'text-emerald-600 bg-emerald-50' : vr >= 50 ? 'text-amber-600 bg-amber-50' : vr > 0 ? 'text-red-500 bg-red-50' : 'text-gray-400 bg-gray-50';
                  const drColor = dr >= 70 ? 'text-emerald-600 bg-emerald-50' : dr >= 40 ? 'text-amber-600 bg-amber-50' : dr > 0 ? 'text-red-500 bg-red-50' : 'text-gray-400 bg-gray-50';
                  const rtoColor = rto === 0 ? 'text-emerald-600 bg-emerald-50' : rto <= 15 ? 'text-amber-600 bg-amber-50' : 'text-red-500 bg-red-50';
                  return (
                    <tr key={s.user?._id || i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4 text-center font-bold text-gray-400">{i + 1}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${s.workingHours > 0 ? 'bg-emerald-500 shadow-[0_0_6px_#22c55e]' : 'bg-gray-300'}`} />
                          <div>
                            <p className="font-bold text-gray-800 text-sm">{s.user?.name}</p>
                            <span className="text-[10px] font-bold text-gray-400 uppercase">{s.user?.role}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <div className="flex flex-col gap-1 items-center">
                          <div className="w-full bg-gray-100 rounded-full h-1.5 max-w-[40px]">
                            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${s.workingPercentage || 0}%` }}></div>
                          </div>
                          <span className="text-[9px] font-bold text-gray-500">{s.workingHours ? s.workingHours.toFixed(1) + 'h' : '0h'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-blue-600">{s.leadsAdded || 0}</td>
                      <td className="py-3 px-2 text-center font-bold text-red-500">{s.todayCnp > 0 ? `${s.todayCnp} CNP` : '0 CNP'}</td>
                      <td className="py-3 px-2 text-center" title={`${s.todayVerifications || 0} Done / ${vrBase} Target`}>
                        <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-black ${vrColor}`}>{vr}%</span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-black ${drColor}`}>{dr}%</span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-black ${rtoColor}`}>{rto}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


