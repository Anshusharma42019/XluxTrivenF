import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import * as srSvc from '../services/shiprocket.service';
import * as smxSvc from '../services/shipmaxx.service';

const cardCls = 'bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow';
const cardStyle = { border: '1px solid rgba(0,0,0,0.05)' };
const inp = 'border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-green-500 bg-white';

const STATUS_LIST = [
  'DELIVERED',
  'RTO_DELIVERED',
  'IN_TRANSIT',
  'NEW',
  'RTO_IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'REACHED_BACK_AT_SELLER_CITY',
  'UNDELIVERED_1ST_ATTEMPT',
  'PICKUP_EXCEPTION',
  'UNDELIVERED_2ND_ATTEMPT',
  'UNDELIVERED_3RD_ATTEMPT',
  'UNDELIVERED',
  'UNDELIVERED_ATTEMPT_FAILURE',
  'RTO_INITIATED',
  'REACHED_AT_DESTINATION_HUB',
  'SHIPPED',
  'RTO_OFD',
  'PICKUP_SCHEDULED',
  'MISROUTED',
  'RTO_UNDELIVERED',
  'OUT_FOR_PICKUP',
  'PICKUP_DONE',
  'PICKUP_FAILED',
  'PICKUP_CANCELLED',
  'DELIVERY_EXCEPTION',
  'REVERSE_PICKUP_SCHEDULED',
  'REVERSE_PICKUP_FAILED',
  'REVERSE_PICKED_UP',
  'REVERSE_PICKUP_CANCELLED',
  'DISPOSED_OFF',
  'DAMAGED',
  'LOST',
  'CANCELLED'
];

const DATE_FILTERS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 Days' },
  { id: 'month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'all', label: 'All Time' },
  { id: 'custom', label: 'Custom' },
];

const STATUS_STYLES = {
  DELIVERED: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/60 text-emerald-800 shadow-[0_4px_12px_-2px_rgba(16,185,129,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(16,185,129,0.3)] hover:-translate-y-1 hover:border-emerald-300',
  RTO_DELIVERED: 'border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/60 text-blue-800 shadow-[0_4px_12px_-2px_rgba(59,130,246,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(59,130,246,0.3)] hover:-translate-y-1 hover:border-blue-300',
  IN_TRANSIT: 'border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/60 text-amber-800 shadow-[0_4px_12px_-2px_rgba(245,158,11,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(245,158,11,0.3)] hover:-translate-y-1 hover:border-amber-300',
  SHIPMENT_CANCELLED: 'border-red-200 bg-gradient-to-br from-red-50 to-red-100/60 text-red-800 shadow-[0_4px_12px_-2px_rgba(239,68,68,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(239,68,68,0.3)] hover:-translate-y-1 hover:border-red-300',
  SHIPMENT_BOOKED: 'border-sky-200 bg-gradient-to-br from-sky-50 to-sky-100/60 text-sky-800 shadow-[0_4px_12px_-2px_rgba(14,165,233,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(14,165,233,0.3)] hover:-translate-y-1 hover:border-sky-300',
  RTO_INTRANSIT: 'border-violet-200 bg-gradient-to-br from-violet-50 to-violet-100/60 text-violet-800 shadow-[0_4px_12px_-2px_rgba(139,92,246,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(139,92,246,0.3)] hover:-translate-y-1 hover:border-violet-300',
  OUT_FOR_DELIVERY: 'border-cyan-200 bg-gradient-to-br from-cyan-50 to-cyan-100/60 text-cyan-800 shadow-[0_4px_12px_-2px_rgba(6,182,212,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(6,182,212,0.3)] hover:-translate-y-1 hover:border-cyan-300',
  REACHED_BACK_AT_SELLER_CITY: 'border-lime-200 bg-gradient-to-br from-lime-50 to-lime-100/60 text-lime-800 shadow-[0_4px_12px_-2px_rgba(132,204,22,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(132,204,22,0.3)] hover:-translate-y-1 hover:border-lime-300',
  'UNDELIVERED_1ST_ATTEMPT': 'border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100/60 text-rose-800 shadow-[0_4px_12px_-2px_rgba(244,63,94,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(244,63,94,0.3)] hover:-translate-y-1 hover:border-rose-300',
  PICKUP_EXCEPTION: 'border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-fuchsia-100/60 text-fuchsia-800 shadow-[0_4px_12px_-2px_rgba(217,70,239,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(217,70,239,0.3)] hover:-translate-y-1 hover:border-fuchsia-300',
  'UNDELIVERED_2ND_ATTEMPT': 'border-pink-200 bg-gradient-to-br from-pink-50 to-pink-100/60 text-pink-800 shadow-[0_4px_12px_-2px_rgba(236,72,153,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(236,72,153,0.3)] hover:-translate-y-1 hover:border-pink-300',
  'UNDELIVERED_3RD_ATTEMPT': 'border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100/60 text-purple-800 shadow-[0_4px_12px_-2px_rgba(168,85,247,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(168,85,247,0.3)] hover:-translate-y-1 hover:border-purple-300',
  RTO_INITIATED: 'border-yellow-200 bg-gradient-to-br from-yellow-50 to-yellow-100/60 text-yellow-800 shadow-[0_4px_12px_-2px_rgba(234,179,8,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(234,179,8,0.3)] hover:-translate-y-1 hover:border-yellow-300',
  REACHED_AT_DESTINATION_HUB: 'border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100/60 text-indigo-800 shadow-[0_4px_12px_-2px_rgba(99,102,241,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(99,102,241,0.3)] hover:-translate-y-1 hover:border-indigo-300',
  SHIPPED: 'border-green-200 bg-gradient-to-br from-green-50 to-green-100/60 text-green-800 shadow-[0_4px_12px_-2px_rgba(34,197,94,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(34,197,94,0.3)] hover:-translate-y-1 hover:border-green-300',
  RTO_OFD: 'border-teal-200 bg-gradient-to-br from-teal-50 to-teal-100/60 text-teal-800 shadow-[0_4px_12px_-2px_rgba(20,184,166,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(20,184,166,0.3)] hover:-translate-y-1 hover:border-teal-300',
  PICKUP_SCHEDULED: 'border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/60 text-slate-800 shadow-[0_4px_12px_-2px_rgba(100,116,139,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(100,116,139,0.3)] hover:-translate-y-1 hover:border-slate-300',
  UNDELIVERED: 'border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100/60 text-rose-800 shadow-[0_4px_12px_-2px_rgba(244,63,94,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(244,63,94,0.3)] hover:-translate-y-1 hover:border-rose-300',
  UNDELIVERED_ATTEMPT_FAILURE: 'border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100/60 text-rose-800 shadow-[0_4px_12px_-2px_rgba(244,63,94,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(244,63,94,0.3)] hover:-translate-y-1 hover:border-rose-300',
  MISROUTED: 'border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/60 text-orange-800 shadow-[0_4px_12px_-2px_rgba(249,115,22,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(249,115,22,0.3)] hover:-translate-y-1 hover:border-orange-300',
  INVOICED: 'border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/60 text-blue-800 shadow-[0_4px_12px_-2px_rgba(59,130,246,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(59,130,246,0.3)] hover:-translate-y-1 hover:border-blue-300',
  RTO_UNDELIVERED: 'border-orange-300 bg-gradient-to-br from-orange-100 to-orange-200/60 text-orange-900 shadow-[0_4px_12px_-2px_rgba(249,115,22,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(249,115,22,0.3)] hover:-translate-y-1 hover:border-orange-400',
  OUT_FOR_PICKUP: 'border-teal-200 bg-gradient-to-br from-teal-50 to-teal-100/60 text-teal-800 shadow-[0_4px_12px_-2px_rgba(20,184,166,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(20,184,166,0.3)] hover:-translate-y-1 hover:border-teal-300',
  PICKUP_DONE: 'border-purple-300 bg-gradient-to-br from-purple-100 to-purple-200/60 text-purple-900 shadow-[0_4px_12px_-2px_rgba(168,85,247,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(168,85,247,0.3)] hover:-translate-y-1 hover:border-purple-400',
  PICKUP_FAILED: 'border-red-200 bg-gradient-to-br from-red-50 to-red-100/60 text-red-800 shadow-[0_4px_12px_-2px_rgba(239,68,68,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(239,68,68,0.3)] hover:-translate-y-1 hover:border-red-300',
  PICKUP_CANCELLED: 'border-red-200 bg-gradient-to-br from-red-50 to-red-100/60 text-red-800 shadow-[0_4px_12px_-2px_rgba(239,68,68,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(239,68,68,0.3)] hover:-translate-y-1 hover:border-red-300',
  DELIVERY_EXCEPTION: 'border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100/60 text-rose-800 shadow-[0_4px_12px_-2px_rgba(244,63,94,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(244,63,94,0.3)] hover:-translate-y-1 hover:border-rose-300',
  REVERSE_PICKUP_SCHEDULED: 'border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-fuchsia-100/60 text-fuchsia-800 shadow-[0_4px_12px_-2px_rgba(217,70,239,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(217,70,239,0.3)] hover:-translate-y-1 hover:border-fuchsia-300',
  REVERSE_PICKUP_FAILED: 'border-red-200 bg-gradient-to-br from-red-50 to-red-100/60 text-red-800 shadow-[0_4px_12px_-2px_rgba(239,68,68,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(239,68,68,0.3)] hover:-translate-y-1 hover:border-red-300',
  REVERSE_PICKED_UP: 'border-fuchsia-300 bg-gradient-to-br from-fuchsia-100 to-fuchsia-200/60 text-fuchsia-900 shadow-[0_4px_12px_-2px_rgba(217,70,239,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(217,70,239,0.3)] hover:-translate-y-1 hover:border-fuchsia-400',
  REVERSE_PICKUP_CANCELLED: 'border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100/60 text-gray-800 shadow-[0_4px_12px_-2px_rgba(107,114,128,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(107,114,128,0.3)] hover:-translate-y-1 hover:border-gray-300',
  DISPOSED_OFF: 'border-gray-300 bg-gradient-to-br from-gray-100 to-gray-200/60 text-gray-800 shadow-[0_4px_12px_-2px_rgba(107,114,128,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(107,114,128,0.3)] hover:-translate-y-1 hover:border-gray-400',
  DAMAGED: 'border-red-300 bg-gradient-to-br from-red-100 to-red-200/60 text-red-900 shadow-[0_4px_12px_-2px_rgba(239,68,68,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(239,68,68,0.3)] hover:-translate-y-1 hover:border-red-400',
  LOST: 'border-red-400 bg-gradient-to-br from-red-200 to-red-300/60 text-red-950 shadow-[0_4px_12px_-2px_rgba(239,68,68,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(239,68,68,0.3)] hover:-translate-y-1 hover:border-red-500',
  NEW: 'border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/60 text-blue-800 shadow-[0_4px_12px_-2px_rgba(59,130,246,0.15)] hover:shadow-[0_8px_24px_-4px_rgba(59,130,246,0.3)] hover:-translate-y-1 hover:border-blue-300',
};

const formatDateInput = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const SMX_MAP = {
  ADI: 'REVERSE_PICKUP_FAILED',
  CTR: 'REVERSE_PICKUP_SCHEDULED',
  CUN: 'DISPOSED_OFF',
  DAC: 'REVERSE_PICKED_UP',
  DEL: 'DELIVERED',
  DEX: 'DELIVERY_EXCEPTION',
  DMG: 'DAMAGED',
  INT: 'IN_TRANSIT',
  LOS: 'LOST',
  OFD: 'OUT_FOR_DELIVERY',
  OFP: 'OUT_FOR_PICKUP',
  ONH: 'REVERSE_PICKUP_CANCELLED',
  PCN: 'PICKUP_CANCELLED',
  PKD: 'PICKUP_DONE',
  PKF: 'PICKUP_FAILED',
  RRA: 'RTO_INTRANSIT',
  RTD: 'RTO_DELIVERED',
  RTO: 'RTO_INITIATED',
  RUN: 'RTO_UNDELIVERED',
  SC:  'SHIPMENT_CANCELLED',
  SPB: 'SHIPMENT_BOOKED',
  SPD: 'PICKUP_SCHEDULED',
  UND: 'UNDELIVERED',
};

const normalizeStatus = (status) => {
  let s = String(status || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return SMX_MAP[s] || s;
};
const formatStatusLabel = (status) => String(status || '').replace(/[-_]+/g, ' ');
const formatMoney = (value) => `Rs ${Number(value || 0).toLocaleString()}`;

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getDateParams = (preset, customFrom, customTo) => {
  if (preset === 'all') return {};
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
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { filterType: 'range', from: formatDateInput(d), to: formatDateInput(end) };
  }
  if (preset === 'last_month') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { filterType: 'range', from: formatDateInput(start), to: formatDateInput(end) };
  }
  if (preset === 'custom' && customFrom && customTo) {
    return { filterType: 'range', from: customFrom, to: customTo };
  }
  return {};
};

export default function OrderStatusBoard({
  title = 'Order Status',
  subtitle,
  defaultPreset = 'today',
  defaultStatus = 'DELIVERED',
  onStatsChange,
  filterParams,
  platform = 'shiprocket',
  allowedStatuses,
}) {
  const { t } = useLanguage();
  const svc = platform === 'shipmaxx' ? smxSvc : srSvc;
  const [deliveredStats, setDeliveredStats] = useState({ count: 0, revenue: 0, statusBreakdown: [] });
  const [datePreset, setDatePreset] = useState(defaultPreset);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(defaultStatus);
  const [statusOrders, setStatusOrders] = useState([]);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [noteInput, setNoteInput] = useState({});   // { [_id]: string }
  const [comments, setComments] = useState({});      // { [_id]: [{text, createdAt}] }
  const [savingNote, setSavingNote] = useState(null);
  const [noteError, setNoteError] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.order-status-interactive')) {
        setSelectedStatus('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadDelivered = useCallback((params = {}) => {
    svc.getDeliveredStats(params).then(res => {
      const { count, revenue, statusBreakdown } = res.data?.data || {};
      const stats = { count: count || 0, revenue: revenue || 0, statusBreakdown: statusBreakdown || [] };
      setDeliveredStats(stats);
      onStatsChange?.(stats);
    }).catch((err) => {
      console.error('[OrderStatusBoard] Error loading delivered stats:', err.response?.data?.message || err.message);
    });
  }, [onStatsChange, svc]);

  const loadStatusOrders = useCallback((status, params = {}, silent = false) => {
    if (!silent) {
      setStatusLoading(true);
      setStatusError('');
      setStatusOrders([]);
    }
    svc.getStatusOrders({ ...params, status, limit: 100 }).then(res => {
      const list = res.data?.data?.data || [];
      setStatusOrders(list);
      const c = {};
      list.forEach(o => { c[o._id] = o.comments || []; });
      setComments(prev => ({ ...prev, ...c }));
    }).catch(e => {
      setStatusOrders([]);
      setStatusError(e?.response?.data?.message || e.message || 'Unable to load orders');
    }).finally(() => { if (!silent) setStatusLoading(false); });
  }, [svc]);

  // Effective parameters: either passed from prop or generated from local state
  const getParams = useCallback(() => {
    return filterParams || getDateParams(datePreset, filterFrom, filterTo);
  }, [filterParams, datePreset, filterFrom, filterTo]);

  // Load delivered stats and status orders whenever params or selected status change
  useEffect(() => {
    const params = getParams();
    
    // For local custom filter, only auto-load if dates are provided
    if (!filterParams && datePreset === 'custom' && (!filterFrom || !filterTo)) return;

    loadDelivered(params);
    if (selectedStatus) {
      loadStatusOrders(selectedStatus, params);
    }
    
    // Auto-refresh stats and selected status orders every 15 seconds silently
    const interval = setInterval(() => {
      loadDelivered(params);
      if (selectedStatus) {
        loadStatusOrders(selectedStatus, params, true);
      }
    }, 15000);
    
    return () => clearInterval(interval);
  }, [getParams, selectedStatus, filterParams, datePreset, loadDelivered, loadStatusOrders]);

  const handleSaveNote = async (e, mongoId) => {
    e.stopPropagation();
    const text = (noteInput[mongoId] ?? '').trim();
    if (!text) return;
    setSavingNote(mongoId);
    setNoteError(prev => ({ ...prev, [mongoId]: '' }));
    try {
      const res = await svc.saveOrderNote(mongoId, text, 'general', selectedStatus);
      setComments(prev => ({ ...prev, [mongoId]: res.data?.data || [] }));
      setNoteInput(prev => ({ ...prev, [mongoId]: '' }));
    } catch (err) {
      setNoteError(prev => ({ ...prev, [mongoId]: err?.response?.data?.message || 'Save failed' }));
    } finally {
      setSavingNote(null);
    }
  };

  const applyDateFilter = useCallback((preset = datePreset, from = filterFrom, to = filterTo) => {
    if (preset === 'custom' && (!from || !to)) return;
    const params = getDateParams(preset, from, to);
    loadDelivered(params);
    if (selectedStatus) loadStatusOrders(selectedStatus, params);
  }, [datePreset, filterFrom, filterTo, loadDelivered, loadStatusOrders, selectedStatus]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      if (platform === 'shipmaxx') {
        const res = await smxSvc.syncShipmaxx();
        const d = res.data?.data || {};
        const timeMsg = d.elapsed ? ` (${d.elapsed}s)` : '';
        const warnMsg = d.timedOut ? ' ⚠ Partial sync' : '';
        setSyncMsg(`Sync complete! Updated ${d.updatedCount || 0} orders${timeMsg}${warnMsg}`);
      } else {
        await srSvc.syncShiprocket();
        const backfill = await srSvc.backfillDeliveredAt();
        const fixed = backfill.data?.data;
        setSyncMsg(`Sync complete! Fixed: ${fixed?.subTotalFixed || 0} amounts, ${fixed?.deliveredAtFixed || 0} dates`);
      }
      applyDateFilter();
    } catch (e) {
      setSyncMsg(e?.response?.data?.message || 'Sync failed');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(''), 6000);
    }
  };

  const selectDatePreset = (preset) => {
    setDatePreset(preset);
    if (preset === 'custom') {
      const today = new Date();
      const from = formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
      const to = formatDateInput(today);
      setFilterFrom(from);
      setFilterTo(to);
    } else {
      applyDateFilter(preset, filterFrom, filterTo);
    }
  };

  const openStatusDetails = (status) => {
    setSelectedStatus(status);
  };

  const statusCounts = deliveredStats.statusBreakdown.reduce((acc, item) => {
    const key = normalizeStatus(item._id);
    acc[key] = (acc[key] || 0) + item.count;
    return acc;
  }, {});


  const listedStatuses = new Set(STATUS_LIST.map(normalizeStatus));
  const statusCards = allowedStatuses
    ? allowedStatuses.map(status => ({ status: normalizeStatus(status), count: statusCounts[normalizeStatus(status)] || 0 }))
    : [
        ...STATUS_LIST.map(status => ({ status: normalizeStatus(status), count: statusCounts[normalizeStatus(status)] || 0 })),
        ...deliveredStats.statusBreakdown
          .filter(item => item._id && !listedStatuses.has(normalizeStatus(item._id)))
          .map(item => ({ status: normalizeStatus(item._id), count: item.count })),
      ];

  const orderTotal = deliveredStats.statusBreakdown.reduce((sum, item) => sum + item.count, 0);

  useEffect(() => {
    setDatePreset(defaultPreset);
  }, [defaultPreset]);

  return (
    <div className={cardCls} style={cardStyle}>
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-widest">{t(title)}</h3>
          <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 mt-1 uppercase">
            {subtitle || `${orderTotal} ${t('ORDERS TOTAL')}`}
          </p>
        </div>
        <div className="order-status-interactive w-full lg:w-auto flex flex-col gap-3">
          {!filterParams && (
            <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar shrink-0">
              <div className="inline-flex items-center gap-1 rounded-xl bg-gray-100 p-1">
                {DATE_FILTERS.map(filter => (
                  <button key={filter.id} onClick={() => selectDatePreset(filter.id)}
                    className={`h-8 px-3 rounded-lg text-[10px] sm:text-[11px] font-black transition-all whitespace-nowrap ${
                      datePreset === filter.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    {t(filter.label).toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            {!filterParams && datePreset === 'custom' && (
              <div className="flex-1 grid grid-cols-2 gap-2">
                <input type="date" className={`${inp} w-full py-2.5`} value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
                <input type="date" className={`${inp} w-full py-2.5`} value={filterTo} onChange={e => setFilterTo(e.target.value)} />
              </div>
            )}
            {!filterParams && (
              <button onClick={() => applyDateFilter()}
                className="h-10 text-[10px] sm:text-[11px] bg-green-600 text-white px-4 sm:px-5 rounded-xl hover:bg-green-700 font-bold shadow-md transition active:scale-95 inline-flex items-center justify-center gap-2 shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                  <path d="M3 4h18M6 12h12M10 20h4"/>
                </svg>
                <span className="hidden sm:inline">{t('APPLY')}</span>
                <span className="sm:hidden">GO</span>
              </button>
            )}
            <button onClick={handleSync} disabled={syncing}
              title="Sync from Shiprocket"
              className={`h-10 px-4 rounded-xl text-[10px] sm:text-[11px] font-bold inline-flex items-center gap-1.5 transition active:scale-95 disabled:opacity-60 shrink-0 ${
                syncing ? 'bg-blue-100 text-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
              }`}>
              <svg className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              {syncing ? '...' : t('SYNC')}
            </button>
          </div>
          {syncMsg && (
            <p className={`text-[11px] font-semibold text-right ${
              syncMsg.includes('complete') ? 'text-green-600' : 'text-red-500'
            }`}>{syncMsg}</p>
          )}
        </div>
      </div>

      {statusCards.length === 0 ? (
        <p className="text-sm text-gray-300">No order data yet</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {statusCards.map(({ status, count }) => {
            const selected = selectedStatus === status;
            return (
              <button key={status} onClick={() => openStatusDetails(status)}
                className={`group relative overflow-hidden order-status-interactive min-h-[90px] sm:min-h-[110px] text-left rounded-2xl border transition-all duration-300 ease-out active:scale-95 flex flex-col justify-between p-4 sm:p-5 ${
                  selected ? 'ring-2 ring-green-500 border-green-300 bg-green-50 shadow-lg scale-[1.02] z-10' : (STATUS_STYLES[normalizeStatus(status)] || 'border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100/60 text-gray-700 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-gray-300')
                }`}>
                {/* Ambient glow in corner */}
                <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-current opacity-[0.07] rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                {/* Glass reflection */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="relative z-10 flex items-start justify-between gap-3 w-full">
                  <span className="text-[10px] sm:text-[11px] font-extrabold uppercase leading-tight tracking-wider opacity-80 flex-1">{t(formatStatusLabel(status))}</span>
                  <div className={`w-6 h-6 shrink-0 rounded-full bg-white/50 backdrop-blur-md shadow-sm border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform ${selected ? 'text-green-600' : ''}`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor] opacity-80"></div>
                  </div>
                </div>
                
                <div className="relative z-10 mt-3 sm:mt-4 flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl font-black tracking-tighter drop-shadow-sm">{count}</span>
                  <span className="text-[10px] font-bold opacity-50 uppercase tracking-widest">Orders</span>
                </div>
                
                {/* Accent line at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-current opacity-10 group-hover:opacity-20 transition-opacity"></div>
              </button>
            );
          })}
        </div>
      )}

      {selectedStatus && (
        <div className="order-status-interactive mt-6 border-t border-gray-100 pt-5">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-700">{formatStatusLabel(selectedStatus)} Details</h4>
              <p className="text-xs text-gray-400 mt-1 flex items-center">
                <span>{statusOrders.length} orders loaded</span>
                {deliveredStats?.statusBreakdown?.find(b => normalizeStatus(b._id) === normalizeStatus(selectedStatus)) && (
                  <>
                    <span className="mx-2">•</span>
                    <span>Exact Total Amount: <span className="font-bold text-emerald-600">{formatMoney(deliveredStats.statusBreakdown.find(b => normalizeStatus(b._id) === normalizeStatus(selectedStatus)).revenue || 0)}</span></span>
                  </>
                )}
              </p>
            </div>
            <button onClick={() => { setSelectedStatus(''); setStatusOrders([]); }}
              className="h-8 text-xs bg-gray-100 text-gray-600 px-3 rounded-xl hover:bg-gray-200 font-semibold inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
              Close
            </button>
          </div>

          {statusLoading && (
            <div className="py-8 flex items-center justify-center gap-2 text-gray-400 text-sm">
              <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              Loading orders...
            </div>
          )}
          {!statusLoading && statusError && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">
              {statusError}
            </div>
          )}
          {!statusLoading && !statusError && statusOrders.length === 0 && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-6 text-center text-sm text-gray-400">
              No orders found for this status and date filter.
            </div>
          )}
          {!statusLoading && !statusError && statusOrders.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {statusOrders.map(order => (
                <div key={order._id}
                  className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 cursor-pointer group" onClick={() => navigate(`/orders/${order.order_id || order.shiprocket_order_id}`)}>
                      <p className="text-xs text-gray-400 font-semibold group-hover:text-green-600 transition-colors">Order</p>
                      <p className="text-sm font-bold text-gray-800 truncate group-hover:text-green-600 transition-colors underline decoration-dotted underline-offset-2">{order.order_id || order.shiprocket_order_id || '-'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${STATUS_STYLES[normalizeStatus(order.status)] || 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                        {formatStatusLabel(order.status || selectedStatus)}
                      </span>
                      <div className="flex flex-col items-end">
                        {order.status_updated_at && (
                          <span className="text-[10px] text-gray-500 font-bold bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 whitespace-nowrap">
                            {new Date(order.status_updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            {', '}
                            {new Date(order.status_updated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </span>
                        )}
                        {(normalizeStatus(order.status).includes('DELIVERY') || normalizeStatus(order.status).includes('UNDELIVERED')) && order.delivery_attempt && (
                          <span className="text-[9px] text-blue-600 font-extrabold mt-0.5 uppercase tracking-tighter bg-blue-50 px-1 rounded">
                            {order.delivery_attempt === 1 ? '1st' : order.delivery_attempt === 2 ? '2nd' : order.delivery_attempt === 3 ? '3rd' : `${order.delivery_attempt}th`} ATTEMPT
                            {new Date(order.status_updated_at).toDateString() === new Date().toDateString() ? ' - TODAY' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-gray-400 font-semibold">Customer</p>
                      <p className="font-semibold text-gray-700 truncate">{order.billing_customer_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-semibold">Staff</p>
                      <p className="font-semibold text-gray-700 truncate">{order.staff_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-semibold">Phone</p>
                      <p className="font-semibold text-gray-700 truncate">{order.billing_phone || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-semibold">Location</p>
                      <p className="font-semibold text-gray-700 truncate">
                        {[order.billing_city, order.billing_state, order.billing_pincode].filter(Boolean).join(', ') || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-semibold">Order Date</p>
                      <p className="font-semibold text-gray-700">{formatDateTime(order.createdAt)}</p>
                    </div>
                    <div onClick={e => e.stopPropagation()}>
                      <p className="text-gray-400 font-semibold">AWB</p>
                      {order.awb_code
                        ? (
                          <a 
                            href={(function() {
                              if (platform !== 'shipmaxx') return `https://shiprocket.co/tracking/${order.awb_code}`;
                              const c = (order.courier_name || '').toLowerCase();
                              if (c.includes('shadowfax')) return `https://tracker.shadowfax.in/track?awb=${order.awb_code}`;
                              if (c.includes('delhivery')) return `https://www.delhivery.com/tracking`;
                              if (c.includes('xpressbees')) return `https://www.xpressbees.com/track?awb=${order.awb_code}`;
                              if (c.includes('ecom')) return `https://ecomexpress.in/tracking/?awb=${order.awb_code}`;
                              if (c.includes('bluedart')) return `https://www.bluedart.com/tracking`;
                              if (c.includes('amazon') || c.includes('ats')) return `https://track.amazon.in/tracking/${order.awb_code}`;
                              return `https://shipmaxx.in/track/${order.awb_code}`;
                            })()} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="font-mono font-bold text-blue-600 truncate hover:underline"
                          >
                            {order.awb_code}
                          </a>
                        )
                        : <p className="font-mono font-semibold text-gray-400 truncate">-</p>
                      }
                    </div>
                    <div>
                      <p className="text-gray-400 font-semibold">Courier</p>
                      <p className="font-semibold text-gray-700 truncate">{order.courier_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-semibold">Payment</p>
                      <p className="font-semibold text-gray-700 truncate">{order.payment_method || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-semibold">Amount</p>
                      <p className="font-bold text-gray-800">{formatMoney(order.sub_total)}</p>
                    </div>
                  </div>
                  {order.order_items?.length > 0 && (
                    <div className="mt-4 rounded-lg bg-gray-50 px-3 py-2">
                      <p className="text-[11px] text-gray-400 font-semibold mb-1">Items</p>
                      <p className="text-xs text-gray-700 truncate">
                        {order.order_items.map(item => `${item.name || 'Item'} x${item.units || 1}`).join(', ')}
                      </p>
                    </div>
                  )}
                  {/* Comments */}
                  <div className="mt-3" onClick={e => e.stopPropagation()}>
                    <p className="text-[11px] text-gray-400 font-semibold mb-2">Comments</p>
                    {/* Existing comments list */}
                    {(comments[order._id] || []).filter(c => c.type !== 'followup').length > 0 && (
                      <div className="mb-2 space-y-1.5 max-h-40 overflow-y-auto">
                        {(comments[order._id] || []).filter(c => c.type !== 'followup').map((c, i) => (
                          <div key={i} className="bg-gray-50 rounded-lg px-3 py-2">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <span className="text-[10px] font-bold text-green-700">
                                {c.createdBy?.name || 'Unknown'}
                                <span className="text-gray-400 font-normal ml-1 capitalize">({c.createdBy?.role || 'user'})</span>
                              </span>
                              <span className="text-[10px] font-semibold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 whitespace-nowrap">
                                🕐 {new Date(c.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                              </span>
                            </div>
                            {c.section ? (
                              <span className="inline-block text-[9px] font-bold uppercase tracking-wide text-purple-600 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded mb-1">
                                📌 {formatStatusLabel(c.section)}
                              </span>
                            ) : null}
                            <p className="text-xs text-gray-700">{c.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Add new comment */}
                    <div className="flex gap-2">
                      <textarea
                        rows={2}
                        placeholder="Add a comment..."
                        value={noteInput[order._id] || ''}
                        onChange={e => setNoteInput(prev => ({ ...prev, [order._id]: e.target.value }))}
                        className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-green-500 bg-gray-50"
                      />
                      <button
                        onClick={e => handleSaveNote(e, order._id)}
                        disabled={savingNote === order._id || !(noteInput[order._id] || '').trim()}
                        className="self-end px-3 py-2 rounded-xl bg-green-600 text-white text-[11px] font-bold hover:bg-green-700 disabled:opacity-50 transition shrink-0">
                        {savingNote === order._id ? '...' : 'Add'}
                      </button>
                    </div>
                    {noteError[order._id] && (
                      <p className="text-[10px] mt-1 font-semibold text-red-500">{noteError[order._id]}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
