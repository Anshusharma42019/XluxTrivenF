import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Phone, 
  PhoneCall, 
  PhoneOff, 
  PhoneMissed, 
  Clock, 
  AlertTriangle, 
  Download, 
  RefreshCw, 
  Search, 
  UserCheck, 
  CheckCircle2, 
  Smartphone,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
  Filter,
  Eye,
  X,
  Copy,
  Check
} from 'lucide-react';
import * as callSvc from '../services/callLog.service';
import StatCard from '../components/ui/StatCard';
import { useToast } from '../context/ToastContext';

export default function TelecallingDesk() {
  const { showToast } = useToast();
  const [tab, setTab] = useState('leaderboard'); // 'leaderboard' | 'logs' | 'missed' | 'duplicates' | 'apk'
  const [timeFilter, setTimeFilter] = useState('today');
  const [deptFilter, setDeptFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffLogs, setStaffLogs] = useState([]);
  const [staffLogsLoading, setStaffLogsLoading] = useState(false);
  const [staffLogsPage, setStaffLogsPage] = useState(1);
  const [staffLogsTotal, setStaffLogsTotal] = useState(0);
  const [staffLogsFilter, setStaffLogsFilter] = useState('all');
  const [staffLogsSearch, setStaffLogsSearch] = useState('');
  const [staffTimeScope, setStaffTimeScope] = useState('today');
  const [mainCustomStart, setMainCustomStart] = useState('');
  const [mainCustomEnd, setMainCustomEnd] = useState('');
  const [staffCustomStart, setStaffCustomStart] = useState('');
  const [staffCustomEnd, setStaffCustomEnd] = useState('');
  const [staffStats, setStaffStats] = useState(null);
  const [missedSubFilter, setMissedSubFilter] = useState('pending'); // 'pending' | 'all'
  const [copiedPhone, setCopiedPhone] = useState(null);
  const [summary, setSummary] = useState({
    totalCalls: 0,
    dialedCalls: 0,
    connectedCalls: 0,
    cnpCalls: 0,
    missedCalls: 0,
    totalTalkTime: 0,
    duplicateCalls: 0,
  });
  const [leaderboard, setLeaderboard] = useState([]);
  const [logs, setLogs] = useState([]);
  const [missedCalls, setMissedCalls] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  const getTodayInputStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getScopeLabel = (scope, start, end) => {
    if (scope === 'today') return 'Today';
    if (scope === 'yesterday') return 'Yesterday';
    if (scope === 'week') return 'Last 7 Days';
    if (scope === 'this_month') return 'This Month';
    if (scope === 'last_month') return 'Last Month';
    if (scope === 'custom') return `${start || 'Start'} to ${end || 'End'}`;
    return 'All-Time History';
  };

  // Comprehensive Date Range Helper
  const computeDateRange = (filterType, customStart, customEnd) => {
    const now = new Date();
    let startDate = null;
    let endDate = null;

    if (filterType === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
    } else if (filterType === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      startDate = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0).toISOString();
      endDate = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999).toISOString();
    } else if (filterType === 'week') {
      const w = new Date(now);
      w.setDate(w.getDate() - 7);
      w.setHours(0, 0, 0, 0);
      startDate = w.toISOString();
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
    } else if (filterType === 'this_month' || filterType === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString();
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
    } else if (filterType === 'last_month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0).toISOString();
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).toISOString();
    } else if (filterType === 'custom') {
      if (customStart) {
        const s = new Date(customStart + 'T00:00:00');
        startDate = s.toISOString();
      }
      if (customEnd) {
        const e = new Date(customEnd + 'T23:59:59.999');
        endDate = e.toISOString();
      }
    } else if (filterType === 'all') {
      startDate = null;
      endDate = null;
    }

    return { startDate, endDate };
  };

  const getDateRange = useCallback(() => {
    return computeDateRange(timeFilter, mainCustomStart, mainCustomEnd);
  }, [timeFilter, mainCustomStart, mainCustomEnd]);

  // Load Overview Stats & Leaderboard
  const loadStats = useCallback(async () => {
    try {
      const { startDate, endDate } = getDateRange();
      const res = await callSvc.getCallingStats({
        startDate,
        endDate,
        department: deptFilter !== 'all' ? deptFilter : undefined,
      });
      if (res.data?.data) {
        setSummary(res.data.data.summary || {});
        setLeaderboard(res.data.data.leaderboard || []);
      }
    } catch (err) {
      console.error('[TelecallingDesk] Error fetching stats:', err);
    }
  }, [getDateRange, deptFilter]);

  // Load Detailed Logs
  const loadLogs = useCallback(async () => {
    try {
      const res = await callSvc.getCallLogs({
        page,
        limit: 30,
        department: deptFilter !== 'all' ? deptFilter : undefined,
        search: search.trim() || undefined,
      });
      if (res.data?.data) {
        setLogs(res.data.data.logs || []);
        setTotalLogs(res.data.data.total || 0);
      }
    } catch (err) {
      console.error('[TelecallingDesk] Error fetching logs:', err);
    }
  }, [page, deptFilter, search]);

  // Load Missed Calls
  const loadMissed = useCallback(async () => {
    try {
      const res = await callSvc.getPendingMissedCalls({ page: 1, limit: 50 });
      if (res.data?.data) {
        setMissedCalls(res.data.data.logs || []);
      }
    } catch (err) {
      console.error('[TelecallingDesk] Error fetching missed calls:', err);
    }
  }, []);

  // Load Duplicates
  const loadDuplicates = useCallback(async () => {
    try {
      const res = await callSvc.getCallLogs({
        page: 1,
        limit: 50,
        isDuplicate: true,
      });
      if (res.data?.data) {
        setDuplicates(res.data.data.logs || []);
      }
    } catch (err) {
      console.error('[TelecallingDesk] Error fetching duplicates:', err);
    }
  }, []);

  const refreshAll = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadLogs(), loadMissed(), loadDuplicates()]);
    setRefreshing(false);
  };

  useEffect(() => {
    if (timeFilter === 'custom' && (!mainCustomStart || !mainCustomEnd)) return;
    setLoading(true);
    refreshAll().finally(() => setLoading(false));

    // Auto-refresh every 30s so Admin CRM always stays updated with staff calls
    const liveInterval = setInterval(() => {
      refreshAll();
    }, 30000);
    return () => clearInterval(liveInterval);
  }, [timeFilter, deptFilter, mainCustomStart, mainCustomEnd]);

  useEffect(() => {
    if (tab === 'logs') loadLogs();
    if (tab === 'missed') loadMissed();
    if (tab === 'duplicates') loadDuplicates();
  }, [tab, page, search]);

  // Format Duration seconds into HH:MM:SS or MM:SS
  const fmtDuration = (sec = 0) => {
    if (!sec || sec <= 0) return '0s';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const loadStaffLogs = useCallback(async (staff, pageNum = 1, filterType = 'all', searchTxt = '', scope = 'today', customStart = '', customEnd = '') => {
    if (!staff) return;
    setStaffLogsLoading(true);
    try {
      const { startDate, endDate } = computeDateRange(scope, customStart, customEnd);
      let callType = undefined;

      if (filterType === 'outgoing_connected' || filterType === 'outgoing_cnp') {
        callType = 'outgoing';
      } else if (filterType === 'missed') {
        callType = 'missed';
      }

      // Parallel fetch: logs list + aggregated metrics for this exact date scope
      const [res, statsRes] = await Promise.all([
        callSvc.getCallLogs({
          page: pageNum,
          limit: 150,
          staffId: staff.staffId,
          callType,
          search: searchTxt.trim() || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
        callSvc.getCallingStats({
          staffId: staff.staffId,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      ]);

      if (res.data?.data) {
        let list = res.data.data.logs || [];
        if (filterType === 'outgoing_connected') {
          list = list.filter((l) => l.duration > 0);
        } else if (filterType === 'outgoing_cnp') {
          list = list.filter((l) => l.duration === 0);
        }
        setStaffLogs(list);
        setStaffLogsTotal(res.data.data.total || 0);
        setStaffLogsPage(pageNum);
      }

      if (statsRes.data?.data?.summary) {
        const s = statsRes.data.data.summary;
        const dialedCalls = s.dialedCalls !== undefined ? s.dialedCalls : ((s.connectedCalls || 0) + (s.cnpCalls || 0));
        const avgDuration = s.connectedCalls > 0 ? Math.round((s.totalTalkTime || 0) / s.connectedCalls) : 0;
        setStaffStats({
          dialedCalls,
          totalDialAttempts: s.totalDialAttempts || dialedCalls,
          connectedCalls: s.connectedCalls || 0,
          cnpCalls: s.cnpCalls || 0,
          totalCnpAttempts: s.totalCnpAttempts || s.cnpCalls || 0,
          missedCalls: s.missedCalls || 0,
          pendingMissedCalls: s.pendingMissedCalls || 0,
          resolvedMissedCalls: s.resolvedMissedCalls || 0,
          totalTalkTime: s.totalTalkTime || 0,
          avgDuration,
        });
      }
    } catch (err) {
      console.error('[TelecallingDesk] Error fetching staff logs:', err);
    } finally {
      setStaffLogsLoading(false);
    }
  }, []);

  // Group and process logs:
  // 1. Missed calls grouped by customer number
  // 2. Not Picked (CNP) calls grouped by customer number (3 attempts on 1 number = 1 row with attempt badge)
  // 3. All Calls grouped for repeated CNP calls to same customer
  const displayedStaffLogs = useMemo(() => {
    // A. Missed Calls grouping
    if (staffLogsFilter === 'missed') {
      const groups = {};
      staffLogs.forEach((log) => {
        const phone = log.phoneNumber;
        if (!groups[phone]) {
          groups[phone] = {
            ...log,
            missedCount: 1,
            allTimestamps: [log.timestamp],
            isResolved: log.status === 'missed_resolved',
          };
        } else {
          groups[phone].missedCount += 1;
          groups[phone].allTimestamps.push(log.timestamp);
          if (log.status === 'missed_resolved') {
            groups[phone].isResolved = true;
          }
        }
      });

      const list = Object.values(groups);
      // Auto-detect if staff called back this customer afterwards in logs
      list.forEach((item) => {
        const earliestMissed = Math.min(...item.allTimestamps.map((t) => new Date(t).getTime()));
        const callbackCall = staffLogs.find(
          (l) => l.phoneNumber === item.phoneNumber && l.callType === 'outgoing' && new Date(l.timestamp).getTime() >= earliestMissed
        );
        if (callbackCall) {
          item.isResolved = true;
          item.callbackCall = callbackCall;
        }
      });

      if (missedSubFilter === 'pending') {
        return list.filter((item) => !item.isResolved);
      }
      return list;
    }

    // B. Not Picked (CNP) grouping: 1 number called up to 3 times = 1 row with badge (e.g. 3x Attempts)
    if (staffLogsFilter === 'outgoing_cnp') {
      const groups = {};
      staffLogs.forEach((log) => {
        const phone = log.phoneNumber;
        if (!groups[phone]) {
          groups[phone] = {
            ...log,
            attemptCount: 1,
            allTimestamps: [log.timestamp],
            latestTimestamp: log.timestamp,
            earliestTimestamp: log.timestamp,
          };
        } else {
          groups[phone].attemptCount += 1;
          groups[phone].allTimestamps.push(log.timestamp);
          if (new Date(log.timestamp).getTime() > new Date(groups[phone].latestTimestamp).getTime()) {
            groups[phone].latestTimestamp = log.timestamp;
            groups[phone].timestamp = log.timestamp;
            groups[phone]._id = log._id;
          }
          if (new Date(log.timestamp).getTime() < new Date(groups[phone].earliestTimestamp).getTime()) {
            groups[phone].earliestTimestamp = log.timestamp;
          }
        }
      });
      return Object.values(groups).sort(
        (a, b) => new Date(b.latestTimestamp).getTime() - new Date(a.latestTimestamp).getTime()
      );
    }

    // C. All Calls view: group repeated CNP calls from the same customer so duplicates don't clutter the view
    if (staffLogsFilter === 'all') {
      const cnpGroups = {};
      const nonCnpList = [];

      staffLogs.forEach((log) => {
        const isCNP = log.callType === 'outgoing' && log.duration === 0;
        if (!isCNP) {
          nonCnpList.push(log);
        } else {
          const phone = log.phoneNumber;
          if (!cnpGroups[phone]) {
            cnpGroups[phone] = {
              ...log,
              attemptCount: 1,
              allTimestamps: [log.timestamp],
              latestTimestamp: log.timestamp,
              earliestTimestamp: log.timestamp,
            };
          } else {
            cnpGroups[phone].attemptCount += 1;
            cnpGroups[phone].allTimestamps.push(log.timestamp);
            if (new Date(log.timestamp).getTime() > new Date(cnpGroups[phone].latestTimestamp).getTime()) {
              cnpGroups[phone].latestTimestamp = log.timestamp;
              cnpGroups[phone].timestamp = log.timestamp;
              cnpGroups[phone]._id = log._id;
            }
            if (new Date(log.timestamp).getTime() < new Date(cnpGroups[phone].earliestTimestamp).getTime()) {
              cnpGroups[phone].earliestTimestamp = log.timestamp;
            }
          }
        }
      });

      const combined = [...nonCnpList, ...Object.values(cnpGroups)];
      return combined.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }

    return staffLogs;
  }, [staffLogs, staffLogsFilter, missedSubFilter]);

  const openStaffCallModal = (agent) => {
    setSelectedStaff(agent);
    setStaffLogsFilter('all');
    setMissedSubFilter('pending');
    setStaffLogsSearch('');
    const initialScope = timeFilter === 'custom' ? 'custom' : timeFilter;
    setStaffTimeScope(initialScope);
    const startStr = mainCustomStart || getTodayInputStr();
    const endStr = mainCustomEnd || getTodayInputStr();
    setStaffCustomStart(startStr);
    setStaffCustomEnd(endStr);

    const initialDialed = agent.dialedCalls !== undefined ? agent.dialedCalls : ((agent.connectedCalls || 0) + (agent.cnpCalls || 0));
    setStaffStats({
      dialedCalls: initialDialed,
      totalDialAttempts: agent.totalDialAttempts || initialDialed,
      connectedCalls: agent.connectedCalls || 0,
      cnpCalls: agent.cnpCalls || 0,
      totalCnpAttempts: agent.totalCnpAttempts || agent.cnpCalls || 0,
      missedCalls: agent.missedCalls || 0,
      pendingMissedCalls: agent.pendingMissedCalls || 0,
      resolvedMissedCalls: agent.resolvedMissedCalls || 0,
      totalTalkTime: agent.totalTalkTime || 0,
      avgDuration: agent.avgDuration || 0,
    });

    loadStaffLogs(agent, 1, 'all', '', initialScope, startStr, endStr);
  };

  const handleResolveMissed = async (id) => {
    try {
      await callSvc.resolveMissedCall(id);
      showToast?.('Missed call marked as resolved', 'success');
      loadMissed();
    } catch (e) {
      showToast?.('Failed to resolve missed call', 'error');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Telecalling & Live Calling Desk
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700/50 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Sync Active
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Real-time Android APK call tracking, auto-CNP updates, and staff talk-time leaderboard
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          >
            <option value="all">All Departments</option>
            <option value="migraine">Migraine</option>
            <option value="piles">Piles</option>
          </select>

          {/* Time Filter */}
          <select
            value={timeFilter}
            onChange={(e) => {
              const val = e.target.value;
              setTimeFilter(val);
              if (val === 'custom' && (!mainCustomStart || !mainCustomEnd)) {
                setMainCustomStart(getTodayInputStr());
                setMainCustomEnd(getTodayInputStr());
              }
            }}
            className="border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">Last 7 Days</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="custom">📅 Custom Range</option>
          </select>

          {timeFilter === 'custom' && (
            <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 px-2.5 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 shadow-sm text-xs">
              <span className="text-gray-400 font-medium">From:</span>
              <input
                type="date"
                value={mainCustomStart}
                onChange={(e) => setMainCustomStart(e.target.value)}
                className="px-2 py-0.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none"
              />
              <span className="text-gray-400 font-medium">To:</span>
              <input
                type="date"
                value={mainCustomEnd}
                onChange={(e) => setMainCustomEnd(e.target.value)}
                className="px-2 py-0.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none"
              />
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={refreshAll}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="Total Calls Dialed"
          value={summary.dialedCalls !== undefined ? summary.dialedCalls : ((summary.connectedCalls || 0) + (summary.cnpCalls || 0))}
          color="border-blue-500"
          icon={<Phone className="w-5 h-5 text-blue-500" />}
        />
        <StatCard
          label="Connected (Talked)"
          value={summary.connectedCalls || 0}
          color="border-green-500"
          icon={<PhoneCall className="w-5 h-5 text-emerald-500" />}
        />
        <StatCard
          label="Not Picked (CNP)"
          value={summary.cnpCalls || 0}
          color="border-amber-500"
          icon={<PhoneOff className="w-5 h-5 text-amber-500" />}
        />
        <StatCard
          label="Inbound Missed Calls"
          value={summary.missedCalls || 0}
          color="border-pink-500"
          icon={<PhoneMissed className="w-5 h-5 text-rose-500" />}
        />
        <StatCard
          label="Total Talk Time"
          value={fmtDuration(summary.totalTalkTime)}
          color="border-purple-500"
          icon={<Clock className="w-5 h-5 text-purple-500" />}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 gap-1 overflow-x-auto pb-1">
        <button
          onClick={() => setTab('leaderboard')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition whitespace-nowrap flex items-center gap-2 ${
            tab === 'leaderboard'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Staff Calling Leaderboard
        </button>
        <button
          onClick={() => setTab('logs')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition whitespace-nowrap flex items-center gap-2 ${
            tab === 'logs'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Phone className="w-4 h-4" />
          Live Call Feed ({totalLogs})
        </button>
        <button
          onClick={() => setTab('missed')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition whitespace-nowrap flex items-center gap-2 ${
            tab === 'missed'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <PhoneMissed className="w-4 h-4" />
          Pending Missed Calls
          {missedCalls.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-xs bg-rose-500 text-white">
              {missedCalls.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('duplicates')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition whitespace-nowrap flex items-center gap-2 ${
            tab === 'duplicates'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Duplicate Calls ({duplicates.length})
        </button>
        <button
          onClick={() => setTab('apk')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition whitespace-nowrap flex items-center gap-2 ${
            tab === 'apk'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          Download Android APK
        </button>
      </div>

      {/* Tab 1: Staff Calling Leaderboard */}
      {tab === 'leaderboard' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900 dark:text-white text-base">
              Staff Calling Performance & Talk-Time
            </h2>
            <span className="text-xs text-gray-500">Sorted by Total Talk-Time</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3">Rank & Agent</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3 text-center">Total Dialed</th>
                  <th className="px-4 py-3 text-center">Connected</th>
                  <th className="px-4 py-3 text-center">Not Picked (CNP)</th>
                  <th className="px-4 py-3 text-center">Missed Received</th>
                  <th className="px-4 py-3 text-right">Total Talk-Time</th>
                  <th className="px-4 py-3 text-right">Avg Call Duration</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-8 text-gray-400">
                      No call logs recorded for the selected time period.
                    </td>
                  </tr>
                ) : (
                  leaderboard.map((agent, index) => {
                    const dialed = agent.dialedCalls !== undefined ? agent.dialedCalls : ((agent.connectedCalls || 0) + (agent.cnpCalls || 0));
                    const connectRate = dialed > 0 ? Math.round((agent.connectedCalls / dialed) * 100) : 0;
                    return (
                      <tr key={agent.staffId} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            index === 0 ? 'bg-amber-100 text-amber-700' : index === 1 ? 'bg-slate-200 text-slate-700' : 'text-gray-400'
                          }`}>
                            #{index + 1}
                          </span>
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white">{agent.name}</div>
                            <div className="text-xs text-gray-400">{agent.employeeId || 'Telecaller'}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 capitalize text-xs">
                          <span className={`px-2 py-0.5 rounded-md font-medium ${
                            agent.departments?.includes('migraine') ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          }`}>
                            {agent.departments?.join(', ') || 'Sales'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-gray-800 dark:text-gray-200">
                          <div>{dialed}</div>
                          {agent.totalDialAttempts && agent.totalDialAttempts > dialed && (
                            <div className="text-[10px] text-gray-400 font-normal">{agent.totalDialAttempts} dials</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-emerald-600 font-semibold">
                          {agent.connectedCalls} ({connectRate}%)
                        </td>
                        <td className="px-4 py-3 text-center text-amber-600 font-medium">
                          <div className="font-bold">{agent.cnpCalls}</div>
                          {agent.totalCnpAttempts && agent.totalCnpAttempts > agent.cnpCalls && (
                            <div className="text-[10px] text-amber-500/80 font-normal">{agent.totalCnpAttempts} attempts</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-medium">
                          {agent.pendingMissedCalls > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-300">
                              {agent.pendingMissedCalls} Pending
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">
                              0 {agent.missedCalls > 0 ? `(${agent.missedCalls} handled)` : ''}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-purple-600 dark:text-purple-400">
                          {fmtDuration(agent.totalTalkTime)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          {fmtDuration(agent.avgDuration)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => openStaffCallModal(agent)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white transition shadow-sm group"
                            title={`View all calls made by ${agent.name}`}
                          >
                            <Eye className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                            <span>Calls List</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Live Call Feed */}
      {tab === 'logs' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
          {/* Search Bar */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search phone number or customer name..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Staff</th>
                  <th className="px-4 py-3">Customer Phone / Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-center">Duration</th>
                  <th className="px-4 py-3 text-right">Status / Alert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-gray-400">
                      No matching call logs found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const isConnected = log.duration > 0;
                    return (
                      <tr key={log._id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition">
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          <div className="text-[10px] text-gray-400">{new Date(log.timestamp).toLocaleDateString()}</div>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                          {log.staffId?.name || 'Staff'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900 dark:text-white font-mono">
                            {log.phoneNumber}
                          </div>
                          <div className="text-xs text-gray-400">{log.leadName || 'Customer'}</div>
                        </td>
                        <td className="px-4 py-3 capitalize text-xs">
                          <span className={`px-2 py-0.5 rounded-md font-semibold ${
                            log.callType === 'outgoing' ? 'bg-blue-100 text-blue-700' :
                            log.callType === 'incoming' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-rose-100 text-rose-700'
                          }`}>
                            {log.callType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-medium">
                          {isConnected ? (
                            <span className="text-emerald-600">{fmtDuration(log.duration)}</span>
                          ) : (
                            <span className="text-amber-600">0s (Not Picked)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {log.isDuplicate ? (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 font-semibold border border-amber-300">
                              ⚠️ Duplicate Dialed
                            </span>
                          ) : isConnected ? (
                            <span className="text-xs text-emerald-600 font-semibold">Connected</span>
                          ) : (
                            <span className="text-xs text-gray-400">Unanswered</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Pending Missed Calls */}
      {tab === 'missed' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white text-base">
                Inbound Missed Calls Pending Resolution
              </h2>
              <p className="text-xs text-gray-400">Customers who called your staff but were not answered</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Called Agent</th>
                  <th className="px-4 py-3">Customer Phone</th>
                  <th className="px-4 py-3">Lead Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {missedCalls.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-emerald-600 font-medium">
                      🎉 Great job! No pending missed calls. All customer calls are handled.
                    </td>
                  </tr>
                ) : (
                  missedCalls.map((m) => (
                    <tr key={m._id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <div className="text-[10px] text-gray-400">{new Date(m.timestamp).toLocaleDateString()}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                        {m.staffId?.name || 'Staff'}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-gray-900 dark:text-white">
                        {m.phoneNumber}
                        <div className="text-xs font-normal text-gray-400">{m.leadName || 'Inbound Lead'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-rose-100 text-rose-700 font-semibold border border-rose-300">
                          Urgent Callback Needed
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleResolveMissed(m._id)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1.5 ml-auto"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mark Resolved
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Duplicate Call Alerts */}
      {tab === 'duplicates' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-white text-base flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              Duplicate Calling Watchlist (Multiple Agents Dialed Same Lead)
            </h2>
            <p className="text-xs text-gray-400">
              Detects when two different telecallers dial the same customer within 48 hours to prevent customer annoyance
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3">Customer Phone</th>
                  <th className="px-4 py-3">Latest Caller</th>
                  <th className="px-4 py-3">Also Called By (Previous Agent)</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {duplicates.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-gray-400">
                      No duplicate calls detected. Team lead distribution is well-coordinated!
                    </td>
                  </tr>
                ) : (
                  duplicates.map((d) => (
                    <tr key={d._id} className="hover:bg-amber-50/40 dark:hover:bg-gray-800/40 transition">
                      <td className="px-4 py-3 font-mono font-bold text-gray-900 dark:text-white">
                        {d.phoneNumber}
                        <div className="text-xs font-normal text-gray-400">{d.leadName || 'Customer'}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-emerald-600">
                        {d.staffId?.name || 'Agent'}
                      </td>
                      <td className="px-4 py-3 text-xs text-amber-700 dark:text-amber-400 font-medium">
                        {d.duplicateWithStaff?.map((s) => s.staffId?.name).filter(Boolean).join(', ') || 'Another Agent'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(d.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="px-2.5 py-1 rounded-full text-xs bg-amber-100 text-amber-800 font-semibold border border-amber-300">
                          ⚠️ Collision Flagged
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Android APK Download & Installation Desk */}
      {tab === 'apk' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Triven Calling Tracker App (APK)
                </h3>
                <p className="text-xs text-gray-500">Version 1.0.3 • Size: ~62 MB • Android 8.0+</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              Install this lightweight background tracker on company/employee Android phones. It silently monitors outgoing calls, auto-updates CNP counts on customer leads, calculates actual customer talk-time, and captures inbound missed calls.
            </p>

            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
              <div className="font-semibold text-emerald-900 dark:text-emerald-300 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Zero Configuration Required
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Staff logs in once with their standard CRM email and password. All call logs will automatically sync with this web desk.
              </p>
            </div>

            <div className="pt-2">
              <a
                href="https://expo.dev/artifacts/eas/1qcjNlOQuaCMHvDNtAIq5ucX9hJH1g4JzbkIB3alirc.apk"
                target="_blank"
                rel="noreferrer"
                download="triven-calling-tracker-v1.0.3.apk"
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition"
              >
                <Download className="w-5 h-5" />
                Download Auto-Sync APK (v1.0.3 — 3x CNP Deduplication & Grouping)
              </a>
            </div>
          </div>

          {/* Installation Instructions */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Installation & Permission Guide for Staff
            </h3>
            
            <ol className="space-y-3 text-sm text-gray-600 dark:text-gray-300 list-decimal pl-4">
              <li className="leading-relaxed">
                <strong>Download File:</strong> Click the green button or share the APK file on WhatsApp with your staff team.
              </li>
              <li className="leading-relaxed">
                <strong>Allow Unknown Sources:</strong> When prompted by Android ("File might be harmful / Install unknown apps"), click <em>Settings</em> and toggle <em>Allow from this source</em> to ON.
              </li>
              <li className="leading-relaxed">
                <strong>Grant Call Permissions:</strong> Open the app and grant <em>Call Log</em> and <em>Phone State</em> permissions when prompted.
              </li>
              <li className="leading-relaxed">
                <strong>Disable Battery Optimization:</strong> In phone settings, set Triven Calling App to <em>"Unrestricted / Don't Optimize"</em> so the app stays active in the background.
              </li>
              <li className="leading-relaxed">
                <strong>Login with CRM credentials:</strong> Enter your existing employee email and password.
              </li>
            </ol>
          </div>
        </div>
      )}
    
      {/* Staff Call History Modal */}
      {selectedStaff && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-fadeIn">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/60 dark:bg-gray-800/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-base shadow-inner">
                  {selectedStaff.name?.[0]?.toUpperCase() || 'E'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {selectedStaff.name} — Call History
                    </h3>
                    <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                      {selectedStaff.employeeId || 'Telecaller'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Showing calls made by {selectedStaff.name} ({getScopeLabel(staffTimeScope, staffCustomStart, staffCustomEnd)})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStaff(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics Bar inside Modal */}
            {(() => {
              const activeStats = staffStats || {
                dialedCalls: selectedStaff.dialedCalls !== undefined ? selectedStaff.dialedCalls : ((selectedStaff.connectedCalls || 0) + (selectedStaff.cnpCalls || 0)),
                connectedCalls: selectedStaff.connectedCalls || 0,
                cnpCalls: selectedStaff.cnpCalls || 0,
                missedCalls: selectedStaff.missedCalls || 0,
                totalTalkTime: selectedStaff.totalTalkTime || 0,
                avgDuration: selectedStaff.avgDuration || 0,
              };
              const connectRate = activeStats.dialedCalls > 0 ? Math.round((activeStats.connectedCalls / activeStats.dialedCalls) * 100) : 0;

              return (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-gray-50/30 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-800">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-900/40">
                    <div className="text-[11px] text-blue-600 dark:text-blue-400 font-bold">Total Dialed (Outgoing)</div>
                    <div className="text-base font-bold text-gray-900 dark:text-white">
                      {activeStats.dialedCalls}
                    </div>
                    <div className="text-[10px] text-gray-400 font-medium">
                      {activeStats.connectedCalls} Connected + {activeStats.cnpCalls} CNP
                      {activeStats.totalDialAttempts && activeStats.totalDialAttempts > activeStats.dialedCalls ? ` (${activeStats.totalDialAttempts} dials)` : ''}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-900/40">
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">Connected (Talked)</div>
                    <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                      {activeStats.connectedCalls}
                    </div>
                    <div className="text-[10px] text-emerald-600/80 font-medium">
                      {connectRate}% Connect Rate
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-900/40">
                    <div className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">Not Picked (CNP)</div>
                    <div className="text-base font-bold text-amber-600 dark:text-amber-400">
                      {activeStats.cnpCalls}
                    </div>
                    <div className="text-[10px] text-amber-600/80 font-medium">
                      {activeStats.totalCnpAttempts && activeStats.totalCnpAttempts > activeStats.cnpCalls
                        ? `${activeStats.totalCnpAttempts} total attempts (${activeStats.cnpCalls} leads)`
                        : "Customer didn't answer"}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-rose-200 dark:border-rose-900/40">
                    <div className="text-[11px] text-rose-500 font-bold">Inbound Missed</div>
                    <div className="text-base font-bold text-rose-500">
                      {(activeStats.pendingMissedCalls !== undefined ? activeStats.pendingMissedCalls : 0)} Pending
                    </div>
                    <div className="text-[10px] text-rose-500/80 font-medium">
                      {(activeStats.resolvedMissedCalls || activeStats.missedCalls || 0)} called back by employee
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-900/40">
                    <div className="text-[11px] text-purple-600 dark:text-purple-400 font-bold">Total Talk Time</div>
                    <div className="text-base font-bold text-purple-600 dark:text-purple-400">
                      {fmtDuration(activeStats.totalTalkTime)}
                    </div>
                    <div className="text-[10px] text-purple-600/80 font-medium">Avg {fmtDuration(activeStats.avgDuration)} / call</div>
                  </div>
                </div>
              );
            })()}

            {/* Filters & Search Toolbar inside Modal */}
            {(() => {
              const activeStats = staffStats || {
                dialedCalls: selectedStaff.dialedCalls !== undefined ? selectedStaff.dialedCalls : ((selectedStaff.connectedCalls || 0) + (selectedStaff.cnpCalls || 0)),
                connectedCalls: selectedStaff.connectedCalls || 0,
                cnpCalls: selectedStaff.cnpCalls || 0,
                missedCalls: selectedStaff.missedCalls || 0,
              };

              return (
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-900">
                  {/* Type Filter Pills */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { id: 'all', label: `All Calls (${(activeStats.dialedCalls || 0) + (activeStats.missedCalls || 0)})` },
                      { id: 'outgoing_connected', label: `Connected (${activeStats.connectedCalls || 0})` },
                      { id: 'outgoing_cnp', label: `Not Picked (${activeStats.cnpCalls || 0})` },
                      { id: 'missed', label: activeStats.pendingMissedCalls > 0 ? `Missed Inbound (${activeStats.pendingMissedCalls} Pending)` : `Missed Inbound (${activeStats.missedCalls || 0})` },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => {
                          setStaffLogsFilter(f.id);
                          loadStaffLogs(selectedStaff, 1, f.id, staffLogsSearch, staffTimeScope, staffCustomStart, staffCustomEnd);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                          staffLogsFilter === f.id
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Time Scope & Search */}
                  <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-initial justify-end">
                    <select
                      value={staffTimeScope}
                      onChange={(e) => {
                        const newScope = e.target.value;
                        setStaffTimeScope(newScope);
                        if (newScope === 'custom' && (!staffCustomStart || !staffCustomEnd)) {
                          const today = getTodayInputStr();
                          setStaffCustomStart(today);
                          setStaffCustomEnd(today);
                          loadStaffLogs(selectedStaff, 1, staffLogsFilter, staffLogsSearch, 'custom', today, today);
                        } else {
                          loadStaffLogs(selectedStaff, 1, staffLogsFilter, staffLogsSearch, newScope, staffCustomStart, staffCustomEnd);
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-medium border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none"
                    >
                      <option value="today">Today</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="week">Last 7 Days</option>
                      <option value="this_month">This Month</option>
                      <option value="last_month">Last Month</option>
                      <option value="custom">📅 Custom Range</option>
                      <option value="all">All-Time History</option>
                    </select>

                    {staffTimeScope === 'custom' && (
                      <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800/80 px-2 py-1 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
                        <input
                          type="date"
                          value={staffCustomStart}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStaffCustomStart(val);
                            if (val && staffCustomEnd) {
                              loadStaffLogs(selectedStaff, 1, staffLogsFilter, staffLogsSearch, 'custom', val, staffCustomEnd);
                            }
                          }}
                          className="px-2 py-0.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none"
                        />
                        <span className="text-gray-400">to</span>
                        <input
                          type="date"
                          value={staffCustomEnd}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStaffCustomEnd(val);
                            if (staffCustomStart && val) {
                              loadStaffLogs(selectedStaff, 1, staffLogsFilter, staffLogsSearch, 'custom', staffCustomStart, val);
                            }
                          }}
                          className="px-2 py-0.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none"
                        />
                      </div>
                    )}

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search phone or name..."
                        value={staffLogsSearch}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStaffLogsSearch(val);
                          loadStaffLogs(selectedStaff, 1, staffLogsFilter, val, staffTimeScope, staffCustomStart, staffCustomEnd);
                        }}
                        className="pl-8 pr-3 py-1.5 rounded-xl text-xs border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44"
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Missed Calls Sub-filter Bar: Pending vs Handled */}
            {staffLogsFilter === 'missed' && (
              <div className="px-4 py-2 bg-rose-50/60 dark:bg-rose-950/20 border-b border-rose-100 dark:border-rose-900/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-300 font-semibold">Missed Filter:</span>
                  <button
                    onClick={() => setMissedSubFilter('pending')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                      missedSubFilter === 'pending'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    🔴 Pending Callback
                  </button>
                  <button
                    onClick={() => setMissedSubFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                      missedSubFilter === 'all'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    📋 All Missed History
                  </button>
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  {missedSubFilter === 'pending' ? 'Calls staff has NOT yet dialed back' : 'Showing all missed callers with total attempts & callback status'}
                </div>
              </div>
            )}

            {/* Calls List / Table */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {staffLogsLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-gray-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                  <span className="text-xs">Loading calls...</span>
                </div>
              ) : displayedStaffLogs.length === 0 ? (
                <div className="py-12 text-center text-gray-400 space-y-2">
                  {staffLogsFilter === 'missed' && missedSubFilter === 'pending' ? (
                    <div className="space-y-1">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto text-xl font-bold">
                        ✓
                      </div>
                      <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        No Pending Missed Calls!
                      </div>
                      <p className="text-xs text-gray-500">
                        All incoming missed calls were successfully called back by {selectedStaff.name}.
                      </p>
                    </div>
                  ) : (
                    <>
                      <PhoneOff className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600" />
                      <div className="text-sm font-medium">No calls found for this filter</div>
                      <p className="text-xs text-gray-400">Try changing the filter or time scope.</p>
                    </>
                  )}
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50/70 dark:bg-gray-800/50 text-[11px] font-semibold text-gray-500 uppercase sticky top-0 backdrop-blur-sm z-10">
                    <tr>
                      <th className="px-4 py-2.5">Customer / Number</th>
                      <th className="px-4 py-2.5 text-center">Call Type</th>
                      <th className="px-4 py-2.5 text-center">Duration</th>
                      <th className="px-4 py-2.5 text-right">Time & Date</th>
                      <th className="px-4 py-2.5 text-center">{staffLogsFilter === 'missed' ? 'Callback Status' : 'Alerts'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                    {displayedStaffLogs.map((log) => {
                      const isConnected = log.callType === 'outgoing' && log.duration > 0;
                      const isCNP = log.callType === 'outgoing' && log.duration === 0;
                      const isMissed = log.callType === 'missed';
                      return (
                        <tr key={log._id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                              <span>{log.leadName || 'Customer Lead'}</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(log.phoneNumber);
                                  setCopiedPhone(log._id);
                                  setTimeout(() => setCopiedPhone(null), 1500);
                                }}
                                className="text-gray-400 hover:text-emerald-500 transition p-0.5"
                                title="Copy Phone Number"
                              >
                                {copiedPhone === log._id ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            <div className="text-gray-500 dark:text-gray-400 font-mono text-[11px]">
                              {log.phoneNumber}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isConnected && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                                CONNECTED
                              </span>
                            )}
                            {isCNP && (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                                  <span>NOT PICKED</span>
                                  {log.attemptCount > 1 && (
                                    <span className="px-1.5 py-0.2 rounded-full bg-amber-600 text-white text-[9px] font-black">
                                      {log.attemptCount}x Attempts
                                    </span>
                                  )}
                                </span>
                              </div>
                            )}
                            {isMissed && (
                              <div className="flex flex-col items-center gap-1">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-300 dark:border-rose-800 flex items-center gap-1">
                                  <span>MISSED</span>
                                  {log.missedCount > 1 && (
                                    <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[9px] font-black">
                                      {log.missedCount}x Calls
                                    </span>
                                  )}
                                </span>
                              </div>
                            )}
                            {!isConnected && !isCNP && !isMissed && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                {log.callType?.toUpperCase()}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold">
                            {isConnected ? (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {fmtDuration(log.duration)}
                              </span>
                            ) : (
                              <span className="text-gray-400">0s</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500">
                            <div className="font-medium text-gray-700 dark:text-gray-300">
                              {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                            <div className="text-[10px] text-gray-400">
                              {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                            {log.attemptCount > 1 && log.earliestTimestamp && log.earliestTimestamp !== log.latestTimestamp && (
                              <div className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">
                                1st dial: {new Date(log.earliestTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {staffLogsFilter === 'missed' ? (
                              log.isResolved ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  ✓ Called Back
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 animate-pulse">
                                  Pending Callback
                                </span>
                              )
                            ) : isCNP && log.attemptCount > 1 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                {log.attemptCount} dial attempts
                              </span>
                            ) : log.isDuplicate ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center gap-1 mx-auto w-max" title="Duplicate Call within 48h">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Duplicate
                              </span>
                            ) : (
                              <span className="text-gray-300 dark:text-gray-600 text-[10px]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-gray-50/50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500">
              <div>
                Showing <strong>{displayedStaffLogs.length}</strong> unique rows ({staffLogs.length} total calls) logged for {selectedStaff.name}
              </div>
              <button
                onClick={() => setSelectedStaff(null)}
                className="px-4 py-1.5 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
