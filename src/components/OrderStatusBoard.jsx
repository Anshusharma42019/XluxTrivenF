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
  DELIVERED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  RTO_DELIVERED: 'border-blue-200 bg-blue-50 text-blue-700',
  IN_TRANSIT: 'border-amber-200 bg-amber-50 text-amber-700',
  SHIPMENT_CANCELLED: 'border-red-200 bg-red-50 text-red-700',
  SHIPMENT_BOOKED: 'border-sky-200 bg-sky-50 text-sky-700',
  RTO_INTRANSIT: 'border-violet-200 bg-violet-50 text-violet-700',
  OUT_FOR_DELIVERY: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  REACHED_BACK_AT_SELLER_CITY: 'border-lime-200 bg-lime-50 text-lime-700',
  'UNDELIVERED_1ST_ATTEMPT': 'border-rose-200 bg-rose-50 text-rose-700',
  PICKUP_EXCEPTION: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
  'UNDELIVERED_2ND_ATTEMPT': 'border-pink-200 bg-pink-50 text-pink-700',
  'UNDELIVERED_3RD_ATTEMPT': 'border-purple-200 bg-purple-50 text-purple-700',
  RTO_INITIATED: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  REACHED_AT_DESTINATION_HUB: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  SHIPPED: 'border-green-200 bg-green-50 text-green-700',
  RTO_OFD: 'border-teal-200 bg-teal-50 text-teal-700',
  PICKUP_SCHEDULED: 'border-slate-200 bg-slate-50 text-slate-700',
  UNDELIVERED: 'border-rose-200 bg-rose-50 text-rose-700',
  UNDELIVERED_ATTEMPT_FAILURE: 'border-rose-200 bg-rose-50 text-rose-700',
  MISROUTED: 'border-orange-200 bg-orange-50 text-orange-700',
  INVOICED: 'border-blue-200 bg-blue-50 text-blue-700',
  RTO_UNDELIVERED: 'border-orange-300 bg-orange-100 text-orange-800',
  OUT_FOR_PICKUP: 'border-teal-200 bg-teal-50 text-teal-700',
  PICKUP_DONE: 'border-purple-300 bg-purple-100 text-purple-800',
  PICKUP_FAILED: 'border-red-200 bg-red-50 text-red-700',
  PICKUP_CANCELLED: 'border-red-200 bg-red-50 text-red-700',
  DELIVERY_EXCEPTION: 'border-rose-200 bg-rose-50 text-rose-700',
  REVERSE_PICKUP_SCHEDULED: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
  REVERSE_PICKUP_FAILED: 'border-red-200 bg-red-50 text-red-700',
  REVERSE_PICKED_UP: 'border-fuchsia-300 bg-fuchsia-100 text-fuchsia-800',
  REVERSE_PICKUP_CANCELLED: 'border-gray-200 bg-gray-100 text-gray-700',
  DISPOSED_OFF: 'border-gray-300 bg-gray-200 text-gray-800',
  DAMAGED: 'border-red-300 bg-red-100 text-red-800',
  LOST: 'border-red-400 bg-red-200 text-red-900',
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
        setSyncMsg(`Sync complete! Updated ${res.data?.data?.updatedCount || 0} orders.`);
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
  const statusCards = [
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
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {statusCards.map(({ status, count }) => {
            const selected = selectedStatus === status;
            return (
              <button key={status} onClick={() => openStatusDetails(status)}
                className={`order-status-interactive min-h-[70px] sm:min-h-[86px] text-left rounded-2xl border p-3.5 sm:p-4 transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${
                  selected ? 'ring-2 ring-green-500 border-green-300 bg-green-50' : STATUS_STYLES[normalizeStatus(status)] || 'border-gray-200 bg-gray-50 text-gray-700'
                }`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[10px] sm:text-[11px] font-black uppercase leading-4 break-words tracking-tight">{t(formatStatusLabel(status))}</span>
                  <svg className="w-3.5 h-3.5 shrink-0 opacity-60" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </div>
                <div className="mt-2 sm:mt-3 text-xl sm:text-2xl font-black tracking-tight">{count}</div>
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
