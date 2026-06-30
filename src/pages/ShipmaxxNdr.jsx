import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import * as smxSvc from '../services/shipmaxx.service';
import OrderStatusBoard from '../components/OrderStatusBoard';

/* ── tiny helpers ─────────────────────────────────────────────────────────── */
const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 bg-white';
const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const fmt = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const statusBadge = (s) => {
  const v = String(s || '').toUpperCase();
  if (v.includes('UNDELIVER') || v.includes('FAIL') || v.includes('NDR') || v.includes('EXCEPTION')) return 'bg-red-50 text-red-700 border-red-200';
  if (v.includes('DELIVER'))   return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (v.includes('TRANSIT') || v.includes('PICKUP') || v.includes('SHIPPED')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (v.includes('PENDING'))   return 'bg-yellow-50 text-yellow-700 border-yellow-200';
  if (v.includes('ACTION'))    return 'bg-orange-50 text-orange-700 border-orange-200';
  if (v.includes('CLOSED'))    return 'bg-slate-50 text-slate-500 border-slate-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
};

const NDR_ACTIONS = [
  { value: 'reattempt', label: '🔄 Re-attempt Delivery',   color: 'bg-blue-600 hover:bg-blue-700' },
  { value: 'rto',       label: '↩️ Return to Origin (RTO)', color: 'bg-orange-500 hover:bg-orange-600' },
  { value: 'escalate',  label: '🚨 Escalate',               color: 'bg-red-600 hover:bg-red-700' },
  { value: 'follow_up', label: '📞 Follow Up',              color: 'bg-purple-600 hover:bg-purple-700' },
];

const NDR_STATUS_OPTIONS = [
  { value: '',                 label: 'All Statuses' },
  { value: 'pending',          label: 'Pending' },
  { value: 'action_requested', label: 'Action Requested' },
  { value: 'closed',           label: 'Closed' },
];

const ATTEMPT_OPTIONS = [
  { value: 'all', label: 'All Attempts' },
  { value: '1',   label: '1st Attempt' },
  { value: '2',   label: '2nd Attempt' },
  { value: '3',   label: '3rd Attempt' },
  { value: '4+',  label: '4+ Attempts' },
];

/* ── Live Tracking Detail Panel ────────────────────────────────────────────── */
function NdrDetailPanel({ item, onClose, onUseNdr }) {
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // NDR list item uses: id, awb, customer_name, customer_phone, status, attempt_number, reason, ndr_date
  // CRM order item uses: awb_code, billing_customer_name, billing_phone, order_id, status
  const awb  = item?.awb || item?.awb_code || item?.awb_number;
  const name = item?.customer?.name || item?.customer_name || item?.billing_customer_name || item?.name;
  const phone = item?.customer?.phone || item?.customer_phone || item?.billing_phone || item?.phone_number;
  const ndrId = item?.id || item?.ndr_id;

  useEffect(() => {
    if (!awb) return;
    setLoading(true); setError(''); setTracking(null);
    smxSvc.trackShipment(awb)
      .then(res => setTracking(res.data?.data || res.data))
      .catch(e  => setError(e?.response?.data?.detail || e?.response?.data?.message || e.message || 'Failed to fetch live tracking'))
      .finally(() => setLoading(false));
  }, [awb]);

  if (!item) return null;

  const history = tracking?.history || tracking?.tracking_history || [];

  const fields = [
    ['Customer Name', name],
    ['Phone Number',  phone],
    ['AWB Number',    awb],
    ['NDR ID',        ndrId],
  ];

  if (item.order_id) {
    fields.push(['Order ID', item.order_id]);
    fields.push(['Payment Method', item.payment_method]);
    if (item.sub_total !== undefined) fields.push(['Order Amount', `Rs ${item.sub_total}`]);
    fields.push(['Courier', item.courier_name]);
  }
  if (item.attempt_number !== undefined) fields.push(['Attempt #', item.attempt_number]);
  if (item.reason)      fields.push(['NDR Reason', item.reason]);
  if (item.ndr_date)    fields.push(['NDR Date',   new Date(item.ndr_date).toLocaleString('en-IN')]);
  if (item.createdAt)   fields.push(['Created At', new Date(item.createdAt).toLocaleString('en-IN')]);

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden space-y-5" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
      <div className="h-1 bg-orange-500" />
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <button onClick={onClose} className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
            Back to List
          </button>
          <h3 className="font-bold text-gray-800 text-base">{name?.trim() || 'NDR Detail'}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{awb}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(item.status || tracking?.current_status) && (
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${statusBadge(item.status || tracking?.current_status)}`}>
              {item.status || tracking?.current_status}
            </span>
          )}
          {ndrId && onUseNdr && (
            <button onClick={() => onUseNdr(item)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition shadow-sm">
              Take Action on this NDR
            </button>
          )}
        </div>
      </div>

      <div className="px-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {fields.map(([label, value]) => (
          <div key={label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
            <p className="text-xs font-semibold text-gray-800 break-words">{fmt(value)}</p>
          </div>
        ))}
      </div>

      <div className="px-5 pb-5">
        <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/30 space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <svg className="w-4 h-4 text-orange-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Live Tracking Status</span>
          </div>
          {loading && (
            <div className="py-6 flex items-center justify-center gap-2 text-gray-400 text-xs font-semibold">
              <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              Fetching live tracking status from ShipMaxx...
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-red-600 text-xs font-semibold">
              <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>{error}</span>
            </div>
          )}
          {tracking && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ['Order ID',    tracking.order_id],
                  ['Courier',     tracking.courier || tracking.carrier],
                  ['EDD',         tracking.edd || tracking.expected_delivery],
                  ['Payment',     tracking.payment_method],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
                    <p className="text-xs font-bold text-gray-700 break-words">{fmt(value)}</p>
                  </div>
                ))}
              </div>
              {history.length > 0 ? (
                <div className="space-y-3 pt-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Tracking History</p>
                  <div className="space-y-2.5 relative pl-4 border-l border-gray-100 ml-1">
                    {history.map((h, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-orange-400 border border-white" />
                        <div className="bg-white border border-gray-50 rounded-xl px-3 py-2 shadow-sm">
                          <p className="text-xs font-bold text-gray-700">{h.status || h.activity || h.description || '—'}</p>
                          <div className="flex gap-3 mt-1 text-[10px] text-gray-400 font-semibold flex-wrap">
                            {(h.location || h.city) && <span>📍 {h.location || h.city}</span>}
                            {(h.date || h.timestamp || h.time) && <span>🕐 {h.date || h.timestamp || h.time}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <pre className="text-xs text-gray-600 bg-white border border-gray-100 rounded-xl p-3 overflow-auto max-h-48">
                  {JSON.stringify(tracking, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── NDR List (GET /ndr + CRM undelivered fallback) ─────────────────────────── */
function NdrList({ onActionItem }) {
  const [ndrs, setNdrs]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [statusFilter, setStatus] = useState('');
  const [search, setSearch]       = useState('');
  const [attempt, setAttempt]     = useState('all');
  const [detail, setDetail]       = useState(null);

  // Bulk selection
  const [selected, setSelected]   = useState(new Set());
  const [bulkAction, setBulkAction] = useState('reattempt');
  const [bulkNotes, setBulkNotes] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState('');
  const [bulkError, setBulkError] = useState('');

  const fetchNdrs = useCallback((status = statusFilter) => {
    setLoading(true); setError(''); setSelected(new Set());
    const params = { limit: 1000, per_page: 1000 };
    if (status) params.status = status;

    // ── Fetch from BOTH sources in parallel ─────────────────────────────────
    // Source 1: ShipMaxx live /ndr API  (formal NDR records)
    // Source 2: CRM undelivered orders  (guaranteed local data, always present)
    Promise.allSettled([
      smxSvc.getNdrList(params),
      (!status)
        ? smxSvc.getStatusOrders({ status: 'UNDELIVERED', limit: 200 })
        : Promise.resolve(null),
    ]).then(([ndrRes, crmRes]) => {
      // ── Parse ShipMaxx NDR records ──────────────────────────────────────
      let smxNdrs = [];
      if (ndrRes.status === 'fulfilled' && ndrRes.value) {
        const d1 = ndrRes.value.data;
        const d2 = d1?.data;

        // ShipMaxx API actually returns { status, shipments: [...] }
        let arr = [];
        if (d2?.data?.shipments && Array.isArray(d2.data.shipments)) arr = d2.data.shipments;
        else if (d2?.shipments && Array.isArray(d2.shipments)) arr = d2.shipments;
        else if (d2?.data && Array.isArray(d2.data)) arr = d2.data;
        else if (Array.isArray(d2)) arr = d2;
        else if (Array.isArray(d1)) arr = d1;

        smxNdrs = arr.map(n => ({ ...n, _source: 'shipmaxx_ndr' }));
      }

      // ── Parse CRM undelivered orders ────────────────────────────────────
      let crmNdrs = [];
      if (crmRes.status === 'fulfilled' && crmRes.value) {
        const d1 = crmRes.value.data;
        const d2 = d1?.data;
        const d3 = d2?.data;

        let rawCrm = [];
        if (Array.isArray(d3)) rawCrm = d3;
        else if (Array.isArray(d2)) rawCrm = d2;
        else if (Array.isArray(d1)) rawCrm = d1;

        const attemptLabel = (num) => {
          const n = Number(num || 1);
          return n === 1 ? '1st Attempt' : n === 2 ? '2nd Attempt' : n === 3 ? '3rd Attempt' : `${n}th Attempt`;
        };

        crmNdrs = rawCrm.map(o => ({
          _id:            o._id,
          id:             o._id,
          awb:            o.awb_code || '',
          awb_code:       o.awb_code || '',
          order_id:       o.order_id || '',
          customer_name:  o.billing_customer_name || '',
          customer_phone: o.billing_phone || '',
          status:         o.status || 'UNDELIVERED',
          attempt_number: o.delivery_attempt ?? 1,
          reason:         `Undelivered - ${attemptLabel(o.delivery_attempt ?? 1)}`,
          ndr_date:       o.status_updated_at || o.createdAt,
          courier_name:   o.courier_name || '',
          payment_method: o.payment_method || '',
          sub_total:      o.sub_total,
          billing_city:   o.billing_city || '',
          billing_state:  o.billing_state || '',
          _source:        'crm',
        }));
      }

      // Merge: ShipMaxx NDR records take priority; CRM fills the gaps
      const smxAwbs = new Set(smxNdrs.map(n => n.awb).filter(Boolean));
      const uniqueCrm = crmNdrs.filter(n => !n.awb || !smxAwbs.has(n.awb));
      const merged = [...smxNdrs, ...uniqueCrm];
      setNdrs(merged);

      if (merged.length === 0 && ndrRes.status === 'rejected') {
        setError(ndrRes.reason?.response?.data?.message || ndrRes.reason?.message || 'Failed to fetch NDR list');
      }
    }).finally(() => setLoading(false));
  }, [statusFilter]);

  // Fetch on mount and whenever status filter changes
  useEffect(() => { fetchNdrs(statusFilter); }, [statusFilter]);

  const filtered = ndrs.filter(n => {
    // Attempt number filter
    if (attempt !== 'all') {
      const a = Number(n.attempt_number ?? n.delivery_attempt ?? 1);
      if (attempt === '4+' ? a < 4 : a !== Number(attempt)) return false;
    }
    // NDR status filter — only applies to ShipMaxx NDR source records
    // For CRM records (pending = undelivered, closed = delivered/rto)
    if (statusFilter) {
      const s = (n.status || '').toLowerCase();
      const ndrStatus = (n.ndr_status || '').toLowerCase();
      if (statusFilter === 'pending') {
        // pending: undelivered records not yet actioned
        const isPending = ndrStatus === 'pending' || s.includes('undelivered') || s === 'pending';
        if (!isPending) return false;
      } else if (statusFilter === 'action_requested') {
        const isAction = ndrStatus === 'action_requested' || s === 'action_requested';
        if (!isAction) return false;
      } else if (statusFilter === 'closed') {
        const isClosed = ndrStatus === 'closed' || s === 'closed' || s.includes('delivered') || s.includes('rto');
        if (!isClosed) return false;
      }
    }
    // Search filter
    if (search) {
      const q = search.toLowerCase();
      return (
        (n.awb || n.awb_code || '').toLowerCase().includes(q) ||
        (n.customer?.name || n.customer_name || '').toLowerCase().includes(q) ||
        (n.order_id || '').toLowerCase().includes(q) ||
        (n.id || '').toLowerCase().includes(q) ||
        (n.reason || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const toggleSelect = (id) => {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(n => String(n.id || n._id))));
  };

  const runBulkAction = async () => {
    if (selected.size === 0) { setBulkError('Select at least one NDR record'); return; }
    if (selected.size > 10) { setBulkError('Maximum 10 NDRs can be selected at once'); return; }
    setBulkLoading(true); setBulkResult(''); setBulkError('');
    try {
      const body = { ndr_ids: [...selected], action: bulkAction };
      if (bulkNotes.trim()) body.notes = bulkNotes.trim();
      await smxSvc.ndrBulkAction(body);
      setBulkResult(`Bulk "${bulkAction}" action applied to ${selected.size} NDR(s) successfully`);
      setSelected(new Set());
      setBulkNotes('');
      fetchNdrs(statusFilter);
    } catch (e) {
      setBulkError(e?.response?.data?.message || e.message || 'Bulk action failed');
    } finally { setBulkLoading(false); }
  };

  if (detail) {
    return (
      <NdrDetailPanel
        item={detail}
        onClose={() => setDetail(null)}
        onUseNdr={(item) => { onActionItem(item); setDetail(null); }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Bulk action bar — shows when items selected */}
      {selected.size > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-4 flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold text-sm">{selected.size}</div>
            <span className="text-sm font-bold text-orange-800">NDRs selected</span>
          </div>
          <div className="flex flex-wrap gap-2 flex-1">
            <select value={bulkAction} onChange={e => setBulkAction(e.target.value)}
              className="border border-orange-300 rounded-xl px-3 py-2 text-xs bg-white font-semibold focus:outline-none focus:ring-1 focus:ring-orange-400">
              {NDR_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
            <input
              placeholder="Optional notes for bulk action…"
              value={bulkNotes}
              onChange={e => setBulkNotes(e.target.value)}
              className="flex-1 min-w-[180px] border border-orange-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
            />
            <button onClick={runBulkAction} disabled={bulkLoading}
              className="px-5 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition disabled:opacity-50 shadow-sm">
              {bulkLoading ? 'Applying…' : '⚡ Apply Bulk Action'}
            </button>
            <button onClick={() => { setSelected(new Set()); setBulkResult(''); setBulkError(''); }}
              className="px-4 py-2 rounded-xl bg-white border border-orange-200 text-orange-600 text-xs font-bold hover:bg-orange-50 transition">
              Clear
            </button>
          </div>
          {bulkResult && <p className="w-full text-xs font-bold text-green-700 bg-green-50 px-3 py-2 rounded-xl border border-green-200">✅ {bulkResult}</p>}
          {bulkError  && <p className="w-full text-xs font-bold text-red-600  bg-red-50  px-3 py-2 rounded-xl border border-red-200">❌ {bulkError}</p>}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="h-1 bg-orange-500" />

        {/* Filters */}
        <div className="px-5 py-3 border-b border-gray-100 space-y-3 bg-gray-50/30">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-700 text-sm">NDR Shipments</span>
              <span className="text-[10px] font-bold text-gray-400 bg-white px-2 py-0.5 rounded-full border">{filtered.length} records</span>
              {selected.size > 0 && (
                <span className="text-[10px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">{selected.size} selected</span>
              )}
            </div>
            <div className="text-[10px] font-semibold bg-blue-50 px-3 py-1 rounded-full border border-blue-100 text-blue-700">
              📡 ShipMaxx NDR API + CRM Undelivered
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <input placeholder="Search AWB / name / order / NDR ID…" value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 min-w-[180px] border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white" />
            <select value={statusFilter} onChange={e => setStatus(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white font-semibold focus:outline-none focus:ring-1 focus:ring-orange-400">
              {NDR_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={attempt} onChange={e => setAttempt(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white font-semibold focus:outline-none focus:ring-1 focus:ring-orange-400">
              {ATTEMPT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={() => fetchNdrs(statusFilter)} disabled={loading}
              className="px-5 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition disabled:opacity-50">
              {loading ? '…' : 'Refresh'}
            </button>
            <button onClick={() => { setStatus(''); setAttempt('all'); setSearch(''); }}
              className="px-4 py-2 rounded-xl bg-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-300 transition">
              Reset
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-5 my-3 flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-red-600 text-xs font-semibold">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                Loading NDR records from ShipMaxx &amp; CRM…
              </div>
            ) : 'No NDR records found.'}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="overflow-x-auto">
              <table className="hidden sm:table w-full text-sm">
                <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-[0.1em] sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                        onChange={toggleAll} className="rounded" />
                    </th>
                    {['NDR ID', 'AWB', 'Customer', 'Status', 'Attempt', 'Reason', 'Date', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((n, i) => {
                    const ndrId  = String(n.id || n.ndr_id || i);
                    const awb    = n.awb || n.awb_code;
                    const name   = n.customer?.name || n.customer_name || '—';
                    const status = n.status || '—';
                    const attempt = n.attempt_number ?? n.delivery_attempt ?? 1;
                    const reason = n.reason || n.ndr_reason || '—';
                    const date   = n.ndr_date || n.createdAt;
                    const isSelected = selected.has(ndrId);
                    return (
                      <tr key={ndrId} className={`transition-colors ${isSelected ? 'bg-orange-50/50' : 'hover:bg-orange-50/20'}`}>
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(ndrId)} className="rounded" />
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-blue-600 font-bold">
                          <button onClick={() => setDetail(n)} className="hover:underline">{ndrId}</button>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-gray-600">{awb || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800 text-[13px]">{name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusBadge(status)}`}>{status}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex w-6 h-6 items-center justify-center rounded-lg bg-orange-50 text-orange-700 font-bold text-[11px] border border-orange-100">
                            {attempt}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-gray-500 max-w-[160px] truncate" title={reason}>{reason}</td>
                        <td className="px-4 py-3 text-[11px] text-gray-400 whitespace-nowrap">
                          {date ? new Date(date).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <button onClick={() => setDetail(n)}
                              className="text-[10px] font-bold px-2.5 py-1.5 rounded-xl bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 transition">
                              VIEW
                            </button>
                            <button onClick={() => onActionItem(n)}
                              className="text-[10px] font-bold px-2.5 py-1.5 rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition">
                              ACTION
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-50">
              {filtered.map((n, i) => {
                const ndrId  = String(n.id || n.ndr_id || i);
                const awb    = n.awb || n.awb_code;
                const name   = n.customer?.name || n.customer_name || '—';
                const status = n.status || '—';
                const attempt = n.attempt_number ?? n.delivery_attempt ?? 1;
                const reason = n.reason || n.ndr_reason || '—';
                const isSelected = selected.has(ndrId);
                return (
                  <div key={ndrId} className={`p-4 space-y-3 ${isSelected ? 'bg-orange-50/40' : ''}`}>
                    <div className="flex items-start gap-2">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(ndrId)} className="mt-1 rounded" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-gray-900 text-sm truncate">{name}</p>
                          <span className="inline-flex w-7 h-7 items-center justify-center rounded-lg bg-orange-50 text-orange-700 font-bold text-xs border border-orange-100 shrink-0">{attempt}</span>
                        </div>
                        <p className="text-[10px] font-mono text-blue-600 font-bold mt-0.5">{awb || ndrId}</p>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge(status)}`}>{status}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{reason}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setDetail(n)} className="flex-1 text-[11px] font-bold py-2 rounded-xl bg-white text-gray-600 border border-gray-200">VIEW</button>
                      <button onClick={() => onActionItem(n)} className="flex-1 text-[11px] font-bold py-2 rounded-xl bg-orange-500 text-white">ACTION</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── NDR Action Panel (POST /ndr/{ndr_id}/action + POST /ndr/bulk-action) ──── */
function NdrActionPanel({ prefillItem }) {
  const [ndrId, setNdrId]     = useState('');
  const [awb, setAwb]         = useState('');
  const [action, setAction]   = useState('reattempt');
  const [notes, setNotes]     = useState('');
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [trackLoading, setTrackLoading] = useState(false);
  const [result, setResult]   = useState('');
  const [error, setError]     = useState('');

  // Bulk action state
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkIds, setBulkIds]   = useState('');
  const [bulkAction, setBulkAction] = useState('reattempt');
  const [bulkNotes, setBulkNotes]   = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult]   = useState('');
  const [bulkError, setBulkError]     = useState('');

  const prevPrefill = useRef(null);
  useEffect(() => {
    if (!prefillItem) return;
    const key = JSON.stringify(prefillItem);
    if (key === prevPrefill.current) return;
    prevPrefill.current = key;
    const id  = String(prefillItem.id || prefillItem.ndr_id || '');
    const awbCode = prefillItem.awb || prefillItem.awb_code || '';
    setNdrId(id);
    setAwb(awbCode);
    setResult(''); setError('');
    if (awbCode) trackAwbFn(awbCode);
  }, [prefillItem]);

  const trackAwbFn = async (awbCode = awb) => {
    const a = String(awbCode || '').trim();
    if (!a) return;
    setTrackLoading(true); setTracking(null);
    try {
      const res = await smxSvc.trackShipment(a);
      setTracking(res.data?.data || res.data);
    } catch { /* silent */ }
    finally { setTrackLoading(false); }
  };

  const submit = async () => {
    if (!ndrId.trim()) { setError('NDR ID is required'); return; }
    setLoading(true); setError(''); setResult('');
    try {
      const body = { action };
      if (notes.trim()) body.notes = notes.trim();
      await smxSvc.ndrAction(ndrId.trim(), body);
      const actionLabel = NDR_ACTIONS.find(a => a.value === action)?.label || action;
      setResult(`✅ "${actionLabel}" action applied to NDR #${ndrId} successfully`);
      setNotes('');
    } catch (e) {
      setError(e?.response?.data?.message || e?.response?.data?.detail || e.message || 'Action failed');
    } finally { setLoading(false); }
  };

  const submitBulk = async () => {
    const ids = bulkIds.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    if (ids.length === 0)  { setBulkError('Enter at least one NDR ID'); return; }
    if (ids.length > 10)   { setBulkError('Maximum 10 NDR IDs per bulk request'); return; }
    setBulkLoading(true); setBulkResult(''); setBulkError('');
    try {
      const body = { ndr_ids: ids, action: bulkAction };
      if (bulkNotes.trim()) body.notes = bulkNotes.trim();
      await smxSvc.ndrBulkAction(body);
      setBulkResult(`✅ Bulk "${bulkAction}" applied to ${ids.length} NDR(s) successfully`);
      setBulkIds(''); setBulkNotes('');
    } catch (e) {
      setBulkError(e?.response?.data?.message || e?.response?.data?.detail || e.message || 'Bulk action failed');
    } finally { setBulkLoading(false); }
  };

  const status = tracking?.current_status || tracking?.status || '';

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Mode toggle */}
      <div className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        <button onClick={() => setBulkMode(false)}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${!bulkMode ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
          Single NDR Action
        </button>
        <button onClick={() => setBulkMode(true)}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${bulkMode ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
          Bulk Action (up to 10)
        </button>
      </div>

      {!bulkMode ? (
        /* ── Single NDR Action (POST /ndr/{ndr_id}/action) ── */
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="h-1 bg-orange-500" />
          <div className="px-5 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-gray-700 text-sm">Single NDR Action</span>
                <p className="text-xs text-gray-400 mt-0.5">POST /ndr/{'{ndr_id}'}/action</p>
              </div>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-full border border-blue-100">
                📡 ShipMaxx API
              </span>
            </div>
          </div>
          <div className="px-5 py-4 space-y-4">
            {/* NDR ID + AWB row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="NDR ID *">
                <input className={inp} placeholder="Enter NDR record ID" value={ndrId}
                  onChange={e => setNdrId(e.target.value)} />
              </Field>
              <div>
                <Field label="AWB Number (optional, for live status)">
                  <div className="flex gap-2">
                    <input className={inp} placeholder="Enter AWB" value={awb}
                      onChange={e => setAwb(e.target.value)}
                      onBlur={() => trackAwbFn()} />
                    <button onClick={() => trackAwbFn()} disabled={trackLoading || !awb.trim()}
                      className="px-3 h-10 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200 transition disabled:opacity-50 whitespace-nowrap border border-gray-200 self-end">
                      {trackLoading ? '…' : 'Check'}
                    </button>
                  </div>
                </Field>
              </div>
            </div>

            {/* Live status card */}
            {tracking && (
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Live Tracking Info</span>
                  {status && (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${statusBadge(status)}`}>{status}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[['Customer', tracking.customer_name], ['Phone', tracking.customer_phone], ['Courier', tracking.courier || tracking.carrier]].filter(([,v]) => v).map(([l, v]) => (
                    <div key={l}>
                      <p className="text-gray-400 font-semibold">{l}</p>
                      <p className="font-bold text-gray-700 truncate">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action + Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Action *">
                <select className={inp} value={action} onChange={e => setAction(e.target.value)}>
                  {NDR_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </Field>
              <Field label="Notes (optional)">
                <input className={inp} placeholder="Add notes for this action" value={notes}
                  onChange={e => setNotes(e.target.value)} />
              </Field>
            </div>
          </div>
          <div className="px-5 pb-5 flex items-center gap-3 flex-wrap border-t border-gray-50 pt-4">
            <button onClick={submit} disabled={loading || !ndrId.trim()}
              className="px-6 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition disabled:opacity-50 shadow-sm">
              {loading ? 'Applying…' : `Apply ${NDR_ACTIONS.find(a => a.value === action)?.label || 'Action'}`}
            </button>
            {result && <span className="text-xs font-bold text-green-700 bg-green-50 px-3 py-2 rounded-xl border border-green-200">{result}</span>}
            {error  && <span className="text-xs font-bold text-red-600  bg-red-50  px-3 py-2 rounded-xl border border-red-200">❌ {error}</span>}
          </div>
        </div>
      ) : (
        /* ── Bulk NDR Action (POST /ndr/bulk-action) ── */
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="h-1 bg-purple-500" />
          <div className="px-5 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-gray-700 text-sm">Bulk NDR Action</span>
                <p className="text-xs text-gray-400 mt-0.5">POST /ndr/bulk-action · up to 10 NDR IDs</p>
              </div>
              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded-full border border-purple-100">
                ⚡ Batch API
              </span>
            </div>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 font-semibold">
              💡 Enter up to 10 NDR IDs separated by commas or newlines. Use the NDR List tab to find IDs.
            </div>
            <Field label="NDR IDs * (comma or newline separated, max 10)">
              <textarea
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 bg-white font-mono resize-none"
                rows={4}
                placeholder={'12\n13\n14\n\nor: 12, 13, 14'}
                value={bulkIds}
                onChange={e => setBulkIds(e.target.value)}
              />
              {(() => {
                const count = bulkIds.split(/[\n,]+/).map(s => s.trim()).filter(Boolean).length;
                return count > 0 ? (
                  <p className={`text-[10px] font-bold mt-1 ${count > 10 ? 'text-red-500' : 'text-gray-400'}`}>
                    {count} ID{count !== 1 ? 's' : ''} entered {count > 10 ? '(max 10 allowed)' : ''}
                  </p>
                ) : null;
              })()}
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Action *">
                <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 bg-white" value={bulkAction} onChange={e => setBulkAction(e.target.value)}>
                  {NDR_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </Field>
              <Field label="Notes (optional)">
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 bg-white"
                  placeholder="Notes attached to each action"
                  value={bulkNotes}
                  onChange={e => setBulkNotes(e.target.value)}
                />
              </Field>
            </div>
          </div>
          <div className="px-5 pb-5 flex items-center gap-3 flex-wrap border-t border-gray-50 pt-4">
            <button onClick={submitBulk} disabled={bulkLoading}
              className="px-6 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 transition disabled:opacity-50 shadow-sm">
              {bulkLoading ? 'Applying…' : `⚡ Apply Bulk ${NDR_ACTIONS.find(a => a.value === bulkAction)?.label || 'Action'}`}
            </button>
            {bulkResult && <span className="text-xs font-bold text-green-700 bg-green-50 px-3 py-2 rounded-xl border border-green-200">{bulkResult}</span>}
            {bulkError  && <span className="text-xs font-bold text-red-600  bg-red-50  px-3 py-2 rounded-xl border border-red-200">❌ {bulkError}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── NDR Notes Panel (internal CRM notes) ───────────────────────────────────── */
function NdrNotesPanel({ onUseAwb }) {
  const [notes, setNotes]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [search, setSearch]     = useState('');
  const [form, setForm]         = useState({ name: '', phone_number: '', reason: '', awb_number: '' });
  const [editId, setEditId]     = useState(null);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [detail, setDetail]     = useState(null);

  const fetchNotes = useCallback((date = filterDate, q = search) => {
    setLoading(true);
    const params = {};
    if (date) params.date = date;
    if (q)    params.search = q;
    smxSvc.getNdrNotes(params)
      .then(r => setNotes(r.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterDate, search]);

  useEffect(() => { fetchNotes(); }, []);

  const save = async () => {
    const { name, phone_number, reason, awb_number } = form;
    if (!name || !phone_number || !reason || !awb_number) { setError('All fields are required'); return; }
    setSaving(true); setError('');
    try {
      if (editId) {
        await smxSvc.updateNdrNote(editId, { name, phone_number, reason, awb_number });
        setEditId(null);
      } else {
        await smxSvc.createNdrNote({ name, phone_number, reason, awb_number });
      }
      setForm({ name: '', phone_number: '', reason: '', awb_number: '' });
      fetchNotes();
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this note?')) return;
    await smxSvc.deleteNdrNote(id).catch(() => {});
    setNotes(p => p.filter(n => n._id !== id));
  };

  const startEdit = (n) => {
    setEditId(n._id);
    setForm({ name: n.name, phone_number: n.phone_number, reason: n.reason, awb_number: n.awb_number });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (detail) {
    return <NdrDetailPanel item={detail} onClose={() => setDetail(null)} onUseNdr={null} />;
  }

  const inpY = inp.replace('focus:border-orange-400 focus:ring-orange-400', 'focus:border-yellow-400 focus:ring-yellow-400');

  return (
    <div className="space-y-4">
      {/* Add / Edit Form */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="h-1 bg-yellow-400" />
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <span className="font-semibold text-gray-700 text-sm">{editId ? 'Edit Note' : 'Add New Note'}</span>
            <p className="text-xs text-gray-400 mt-0.5">Internal CRM notes (not sent to carrier)</p>
          </div>
          {editId && (
            <button onClick={() => { setEditId(null); setForm({ name: '', phone_number: '', reason: '', awb_number: '' }); setError(''); }}
              className="text-xs font-bold text-gray-400 hover:text-gray-600">Cancel Edit</button>
          )}
        </div>
        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['name',         'Customer Name *',  'Name'],
            ['phone_number', 'Phone Number *',   'Phone'],
            ['awb_number',   'AWB Number *',     'AWB'],
            ['reason',       'Reason / Note *',  'Reason'],
          ].map(([key, label, ph]) => (
            <Field key={key} label={label}>
              <input className={inpY} placeholder={ph}
                value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
            </Field>
          ))}
        </div>
        <div className="px-5 pb-4 flex items-center gap-3 flex-wrap">
          <button onClick={save} disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-yellow-500 text-white text-xs font-bold hover:bg-yellow-600 transition disabled:opacity-50 shadow-sm">
            {saving ? 'Saving…' : editId ? 'Update Note' : '+ Add Note'}
          </button>
          {error && <span className="text-red-500 text-xs font-semibold">{error}</span>}
        </div>
      </div>

      {/* Notes List */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="h-1 bg-yellow-400" />
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3 bg-gray-50/30">
          <span className="font-semibold text-gray-700 text-sm flex-1">
            Notes {notes.length > 0 && <span className="text-xs text-gray-400 font-normal ml-1">({notes.length})</span>}
          </span>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <input placeholder="Search…" value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchNotes(filterDate, search)}
              className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-yellow-400 flex-1 sm:w-44" />
            <input type="date" value={filterDate}
              onChange={e => { setFilterDate(e.target.value); fetchNotes(e.target.value, search); }}
              className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-yellow-400" />
            {filterDate && (
              <button onClick={() => { setFilterDate(''); fetchNotes('', search); }}
                className="text-xs text-gray-400 hover:text-gray-600 font-semibold self-center">Clear</button>
            )}
            <button onClick={() => fetchNotes(filterDate, search)} disabled={loading}
              className="px-4 py-1.5 rounded-xl bg-yellow-500 text-white text-xs font-bold hover:bg-yellow-600 transition shadow-sm disabled:opacity-50">
              {loading ? '…' : 'Refresh'}
            </button>
          </div>
        </div>

        {notes.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">
            {loading ? 'Loading…' : 'No notes found.'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="hidden sm:table w-full text-sm">
                <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-[0.1em] sticky top-0">
                  <tr>{['Date', 'Name', 'Phone', 'AWB', 'Reason', 'By', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-bold">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {notes.map(n => (
                    <tr key={n._id} className="hover:bg-yellow-50/30 transition-colors">
                      <td className="px-4 py-3 text-[11px] text-gray-400 whitespace-nowrap">{new Date(n.createdAt).toLocaleDateString('en-IN')}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800 text-[13px]">{n.name}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-gray-600">{n.phone_number}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setDetail(n)} className="font-mono text-[11px] text-blue-600 font-bold hover:underline text-left">{n.awb_number}</button>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-gray-600 max-w-[220px] truncate" title={n.reason}>{n.reason}</td>
                      <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap">{n.createdBy?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 items-center">
                          <button onClick={() => setDetail(n)} className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 transition">VIEW</button>
                          <button onClick={() => startEdit(n)} title="Edit Note"
                            className="w-7 h-7 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-slate-100 transition border border-slate-200">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          </button>
                          <button onClick={() => del(n._id)} title="Delete Note"
                            className="w-7 h-7 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition border border-red-100">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="sm:hidden divide-y divide-gray-50">
              {notes.map(n => (
                <div key={n._id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{n.name}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{n.phone_number}</p>
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold bg-white px-2 py-0.5 rounded border">{new Date(n.createdAt).toLocaleDateString('en-IN')}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1.5 border border-gray-100">
                    <p><span className="font-bold text-gray-400 uppercase text-[9px] tracking-wide mr-1.5">AWB</span>
                      <button onClick={() => setDetail(n)} className="text-blue-600 font-mono font-bold hover:underline">{n.awb_number}</button>
                    </p>
                    <p><span className="font-bold text-gray-400 uppercase text-[9px] tracking-wide mr-1.5">Note</span> {n.reason}</p>
                    <p><span className="font-bold text-gray-400 uppercase text-[9px] tracking-wide mr-1.5">By</span> {n.createdBy?.name || '—'}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setDetail(n)} className="flex-1 text-[11px] font-bold py-2 rounded-xl bg-white text-gray-600 border border-gray-200 shadow-sm">VIEW</button>
                    <button onClick={() => startEdit(n)} className="text-[11px] font-bold p-2 rounded-xl bg-slate-50 text-slate-600 border border-slate-200">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button onClick={() => del(n._id)} className="text-[11px] font-bold p-2 rounded-xl bg-red-50 text-red-500 border border-red-100">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Main ShipMaxx NDR Page ──────────────────────────────────────────────────── */
const TABS = [
  { id: 'board',  label: 'Status Board',   icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { id: 'list',   label: 'NDR List',       icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  { id: 'action', label: 'NDR Action',     icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { id: 'notes',  label: 'Notes',          icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> },
];

export default function ShipmaxxNdr() {
  const [tab, setTab]             = useState('board');
  const [actionItem, setActionItem] = useState(null);
  const location = useLocation();
  // Track which tabs have been visited — lazy mount to avoid loading all tabs on page load
  const [visited, setVisited]     = useState(new Set(['board']));

  const switchTab = (id) => {
    setTab(id);
    setVisited(prev => new Set([...prev, id]));
  };

  useEffect(() => {
    if (location.state?.prefillAwb) {
      // Legacy: if prefilled with just AWB, create a minimal item
      setActionItem({ awb: location.state.prefillAwb, id: '', status: '' });
      setTab('action');
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const handleActionItem = (item) => {
    setActionItem(item);
    switchTab('action');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-gray-800 text-base">ShipMaxx NDR Management</h2>
          <p className="text-xs text-gray-400 mt-0.5 font-medium">
            Manage non-delivery reports · Single & bulk actions · GET /ndr · POST /ndr/&#123;id&#125;/action · POST /ndr/bulk-action
          </p>
        </div>
        {/* Tab bar */}
        <div className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm overflow-x-auto pb-1 scrollbar-hide whitespace-nowrap">
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => switchTab(t.id)}
                className={`h-9 rounded-lg px-3 text-xs font-semibold transition-all inline-flex items-center gap-2 ${
                  active ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }`}>
                <span className={`grid h-5 w-5 place-items-center rounded-md ${active ? 'bg-white/20 text-white' : 'bg-orange-50 text-orange-500'}`}>
                  {t.icon}
                </span>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lazy mount: only render when first visited, keep mounted after for instant switching */}
      <div style={{ display: tab === 'board' ? 'block' : 'none' }}>
        <OrderStatusBoard 
          title="ShipMaxx Overall Status" 
          subtitle="ALL SHIPMAXX ORDERS"
          defaultPreset="today"
          defaultStatus=""
          platform="shipmaxx"
        />
      </div>
      {visited.has('list') && (
        <div style={{ display: tab === 'list' ? 'block' : 'none' }}>
          <NdrList onActionItem={handleActionItem} />
        </div>
      )}
      {visited.has('action') && (
        <div style={{ display: tab === 'action' ? 'block' : 'none' }}>
          <NdrActionPanel prefillItem={actionItem} />
        </div>
      )}
      {visited.has('notes') && (
        <div style={{ display: tab === 'notes' ? 'block' : 'none' }}>
          <NdrNotesPanel onUseAwb={(awb) => { setActionItem({ awb, id: '' }); switchTab('action'); }} />
        </div>
      )}
    </div>
  );
}
