import { useState, useEffect, useCallback } from 'react';
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
  Filter
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
  const [summary, setSummary] = useState({
    totalCalls: 0,
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

  // Calculate Date Filters
  const getDateRange = useCallback(() => {
    const now = new Date();
    let startDate = null;
    let endDate = null;

    if (timeFilter === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
    } else if (timeFilter === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      startDate = new Date(y.getFullYear(), y.getMonth(), y.getDate()).toISOString();
      endDate = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999).toISOString();
    } else if (timeFilter === 'week') {
      const w = new Date(now);
      w.setDate(w.getDate() - 7);
      startDate = w.toISOString();
      endDate = now.toISOString();
    } else if (timeFilter === 'month') {
      const m = new Date(now);
      m.setDate(m.getDate() - 30);
      startDate = m.toISOString();
      endDate = now.toISOString();
    }

    return { startDate, endDate };
  }, [timeFilter]);

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
    setLoading(true);
    refreshAll().finally(() => setLoading(false));
  }, [timeFilter, deptFilter]);

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
            onChange={(e) => setTimeFilter(e.target.value)}
            className="border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>

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
          value={summary.totalCalls || 0}
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-8 text-gray-400">
                      No call logs recorded for the selected time period.
                    </td>
                  </tr>
                ) : (
                  leaderboard.map((agent, index) => {
                    const connectRate = agent.totalCalls > 0 ? Math.round((agent.connectedCalls / agent.totalCalls) * 100) : 0;
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
                          {agent.totalCalls}
                        </td>
                        <td className="px-4 py-3 text-center text-emerald-600 font-semibold">
                          {agent.connectedCalls} ({connectRate}%)
                        </td>
                        <td className="px-4 py-3 text-center text-amber-600 font-medium">
                          {agent.cnpCalls}
                        </td>
                        <td className="px-4 py-3 text-center text-rose-500 font-medium">
                          {agent.missedCalls}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-purple-600 dark:text-purple-400">
                          {fmtDuration(agent.totalTalkTime)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          {fmtDuration(agent.avgDuration)}
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
                <p className="text-xs text-gray-500">Version 1.0.0 • Size: ~12 MB • Android 8.0+</p>
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
                href="/downloads/triven-calling-tracker.apk"
                download="triven-calling-tracker.apk"
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition"
              >
                <Download className="w-5 h-5" />
                Download APK Directly (v1.0.0)
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
    </div>
  );
}

