import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as smxSvc from '../services/shipmaxx.service';
import OrderStatusBoard from '../components/OrderStatusBoard';

const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 bg-white';
const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const DEPARTMENTS = ['migraine', 'piles'];

const ATTEMPT_OPTIONS = [
  { value: 'all', label: 'All Attempts' },
  { value: '1',   label: '1st Attempt' },
  { value: '2',   label: '2nd Attempt' },
  { value: '3',   label: '3rd Attempt' },
  { value: '4+',  label: '4+ Attempts' },
];

const statusBadge = (s) => {
  const v = String(s || '').toUpperCase();
  if (v.includes('UNDELIVERED') || v.includes('NDR') || v.includes('EXCEPTION')) return 'bg-red-50 text-red-700 border-red-200';
  if (v.includes('DELIVERED'))                         return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (v.includes('TRANSIT') || v.includes('PICKUP'))   return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
};

const fmt = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

// ── NDR Detail Panel ──────────────────────────────────────────────────────────
function NdrDetailPanel({ ndr, onClose, onUseAwb }) {
  const [phone, setPhone] = useState(ndr?.customer_phone || '');

  useEffect(() => {
    if (!ndr) return;
    const masked = String(ndr.customer_phone || '');
    const isHidden = !masked || /^x+$/i.test(masked) || masked.replace(/\D/g, '').length < 10;
    if (!isHidden) { setPhone(masked); return; }
    setPhone('');
    
    // Look up local order lookup using order_id / channel_id
    const orderId = ndr.channel_order_id || ndr.order_id || '';
    if (orderId) {
      smxSvc.getOrder(orderId).then(r => {
        const p = r.data?.data?.billing_phone || '';
        if (p) setPhone(p);
      }).catch(() => {});
    }
  }, [ndr]);

  if (!ndr) return null;

  const FIELDS = [
    ['AWB Code',       ndr.awb_code],
    ['Channel Order',  ndr.channel_order_id],
    ['Shipment ID',    ndr.shipment_id],
    ['Customer',       ndr.customer_name],
    ['Phone',          phone || ndr.customer_phone],
    ['Email',          ndr.customer_email],
    ['Courier',             ndr.courier_name],
    ['Status',              ndr.status || ndr.current_status],
    ['Delivery Boy Reason', ndr.delivery_boy_reason || ndr.reason],
    ['Action By / Courier', ndr.action_by || ndr.courier_name],
    ['Staff Follow-up Note', ndr.staff_remark],
    ['Staff Note By',       ndr.staff_remark_by],
    ['Remarks',             ndr.remarks],
    ['Comment',             ndr.comment],
    ['Attempts',       ndr.attempts],
    ['NDR Raised',     ndr.ndr_raised_at],
    ['Payment',        ndr.payment_method],
    ['EDD',            ndr.edd],
    ['Address',        ndr.address],
    ['City',           ndr.city],
    ['State',          ndr.state],
    ['Pincode',        ndr.pincode],
  ].filter(([, v]) => v !== null && v !== undefined && v !== '');

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
      <div className="h-1 bg-blue-500" />
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <button onClick={onClose} className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
            Back to list
          </button>
          <h3 className="font-bold text-gray-800 text-base">{ndr.customer_name?.trim() || 'NDR Detail'}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{ndr.awb_code}</p>
        </div>
        <div className="flex gap-2">
          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${statusBadge(ndr.status || ndr.current_status)}`}>
            {fmt(ndr.status || ndr.current_status)}
          </span>
          <button onClick={() => onUseAwb(ndr.awb_code)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition">
            Use AWB in Action
          </button>
        </div>
      </div>
      <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {FIELDS.map(([label, value]) => (
          <div key={label} className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
            <p className="text-sm font-semibold text-gray-800 break-words">{fmt(value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── NDR List ──────────────────────────────────────────────────────────────────
const getMonthBounds = (m, y) => {
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  const fmt = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  return { from: fmt(start), to: fmt(end) };
};

const getPresetDates = (presetId, monthObj) => {
  const today = new Date();
  const fmt = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  if (presetId === 'today') {
    const s = fmt(today);
    return { from: s, to: s };
  }
  if (presetId === 'yesterday') {
    const y = new Date(today);
    y.setDate(today.getDate() - 1);
    const s = fmt(y);
    return { from: s, to: s };
  }
  if (presetId === 'last7') {
    const past = new Date(today);
    past.setDate(today.getDate() - 6);
    return { from: fmt(past), to: fmt(today) };
  }
  if (presetId === 'last_month') {
    const m = today.getMonth() - 1;
    const y = m < 0 ? today.getFullYear() - 1 : today.getFullYear();
    const actM = m < 0 ? 11 : m;
    return getMonthBounds(actM, y);
  }
  if (presetId === 'month') {
    return getMonthBounds(monthObj.month, monthObj.year);
  }
  return null;
};

function NdrList({ department: externalDept, setDepartment: externalSetDept, onSelectNdr, onUseAwb }) {
  const [ndrs, setNdrs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('ndr'); // 'ndr' | 'rto' | 'delivered' | 'all'
  const [preset, setPreset] = useState('month');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const n = new Date();
    return { month: n.getMonth(), year: n.getFullYear() };
  });

  const initialBounds = getMonthBounds(new Date().getMonth(), new Date().getFullYear());
  const [from, setFrom] = useState(initialBounds.from);
  const [to, setTo]     = useState(initialBounds.to);
  const [department, setDepartment] = useState(externalDept || 'all');

  const [summary, setSummary] = useState({
    totalInitiated: 0,
    delivered: 0,
    rto: 0,
    ndr: 0,
    inTransit: 0,
    deliveryRate: '0%',
    rtoRate: '0%',
    departments: { all: 0, migraine: 0, piles: 0 }
  });

  useEffect(() => {
    if (externalDept !== undefined) setDepartment(externalDept);
  }, [externalDept]);

  const [attempt, setAttempt] = useState('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);

  const fetchNDR = useCallback((f = from, t = to, v = view) => {
    setLoading(true);
    const params = {};
    if (f) params.from = f;
    if (t) params.to = t;
    if (v) params.view = v;

    smxSvc.getNdrList(params)
      .then(r => {
        let rawData = r.data?.data;
        if (rawData?.summary) {
          setSummary(rawData.summary);
        }
        while (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
          if (Array.isArray(rawData.data)) { rawData = rawData.data; break; }
          if (Array.isArray(rawData.items)) { rawData = rawData.items; break; }
          if (rawData.data !== undefined) { rawData = rawData.data; }
          else { break; }
        }
        setNdrs(Array.isArray(rawData) ? rawData : []);
      })
      .catch(() => setNdrs([]))
      .finally(() => setLoading(false));
  }, [from, to, view]);

  useEffect(() => { fetchNDR(); }, []);

  const handlePresetChange = (presetId) => {
    setPreset(presetId);
    if (presetId === 'custom') return;
    const b = getPresetDates(presetId, selectedMonth);
    if (b) {
      setFrom(b.from);
      setTo(b.to);
      fetchNDR(b.from, b.to, view);
    }
  };

  const handleMonthNav = (delta) => {
    setSelectedMonth(prev => {
      let m = prev.month + delta;
      let y = prev.year;
      if (m < 0) { m = 11; y -= 1; }
      else if (m > 11) { m = 0; y += 1; }
      const newMonth = { month: m, year: y };
      const b = getMonthBounds(m, y);
      setFrom(b.from);
      setTo(b.to);
      setPreset('month');
      fetchNDR(b.from, b.to, view);
      return newMonth;
    });
  };

  const handleViewChange = (newView) => {
    setView(newView);
    fetchNDR(from, to, newView);
  };

  const getTrackingUrl = (n) => {
    const c = (n.courier_name || '').toLowerCase();
    if (c.includes('shadowfax')) return `https://tracker.shadowfax.in/track?awb=${n.awb_code}`;
    if (c.includes('xpressbees')) return `https://www.xpressbees.com/track?awb=${n.awb_code}`;
    if (c.includes('delhivery')) return `https://www.delhivery.com/tracking`;
    if (c.includes('bluedart')) return `https://www.bluedart.com/tracking`;
    return `https://shipmaxx.in/track/${n.awb_code}`;
  };

  const getDept = (n) => {
    if (!n) return 'migraine';
    const dept = String(n.department || '').toLowerCase();
    if (dept === 'piles') return 'piles';
    if (dept === 'migraine') return 'migraine';
    const rawStr = (typeof n === 'string' ? n : JSON.stringify(n)).toLowerCase();
    const pilesKeywords = ['piles', 'gastro', 'bawasir', 'bavasir', 'hemorrhoid', 'fissure', 'fistula', 'bhagander'];
    if (pilesKeywords.some(kw => rawStr.includes(kw))) return 'piles';
    return 'migraine';
  };

  const safeNdrs = Array.isArray(ndrs) ? ndrs : [];
  const filtered = safeNdrs.filter(n => {
    if (department !== 'all') {
      const d = getDept(n);
      if (department !== d) return false;
    }
    if (attempt !== 'all') {
      const a = Number(n.attempts ?? 1);
      if (attempt === '4+' ? a < 4 : a !== Number(attempt)) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return (
        (n.awb_code || '').toLowerCase().includes(q) ||
        (n.customer_name || '').toLowerCase().includes(q) ||
        (n.customer_phone || '').includes(q) ||
        (n.channel_order_id || '').toLowerCase().includes(q) ||
        (n.reason || '').toLowerCase().includes(q) ||
        (n.delivery_boy_reason || '').toLowerCase().includes(q) ||
        (n.staff_remark || '').toLowerCase().includes(q) ||
        (n.courier_name || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const migraineCount = summary.departments?.migraine ?? safeNdrs.filter(n => getDept(n) === 'migraine').length;
  const pilesCount = summary.departments?.piles ?? safeNdrs.filter(n => getDept(n) === 'piles').length;
  const allDeptCount = summary.departments?.all ?? safeNdrs.length;

  if (detail) {
    return (
      <NdrDetailPanel
        ndr={detail}
        onClose={() => setDetail(null)}
        onUseAwb={(awb) => { onUseAwb(awb); setDetail(null); }}
      />
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
      <div className="h-1 bg-blue-600" />
      
      {/* ── Filters & Summary Header ──────────────────────────── */}
      <div className="px-5 py-4 border-b border-gray-100 space-y-4 bg-gray-50/30">
        
        {/* Top Header with Month Navigator */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-black text-gray-900 text-base flex items-center gap-2">
              <span>ShipMaxx Delivery & NDR Dashboard</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                Admin Analytics
              </span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Live ShipMaxx overview: Total Initiated, Delivered, RTO returns & active NDR actions
            </p>
          </div>

          {/* Month Navigator */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-gray-200 shadow-2xs">
            <button
              type="button"
              onClick={() => handleMonthNav(-1)}
              className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 transition cursor-pointer"
              title="Previous Month"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span className="text-xs font-black min-w-[95px] text-center text-gray-800 uppercase tracking-tight">
              {new Date(selectedMonth.year, selectedMonth.month).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
            </span>
            <button
              type="button"
              onClick={() => handleMonthNav(1)}
              className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 transition cursor-pointer"
              title="Next Month"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>

        {/* ── KPI Summary Cards (Initiated, Delivered, RTO, Active NDR) ──────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* TOTAL INITIATED */}
          <button
            type="button"
            onClick={() => handleViewChange('all')}
            className={`p-3.5 rounded-2xl border text-left transition-all hover:shadow-md cursor-pointer relative overflow-hidden ${
              view === 'all'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-blue-50/60 border-blue-200/70 hover:border-blue-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase tracking-wider ${view === 'all' ? 'text-blue-100' : 'text-blue-700'}`}>
                Initiated (Total)
              </span>
              <span className="text-sm">📦</span>
            </div>
            <p className={`text-2xl font-black mt-1 ${view === 'all' ? 'text-white' : 'text-blue-900'}`}>
              {summary.totalInitiated || safeNdrs.length}
            </p>
            <p className={`text-[10px] mt-1 font-medium ${view === 'all' ? 'text-blue-100' : 'text-blue-600'}`}>
              Shipments this period
            </p>
          </button>

          {/* DELIVERED */}
          <button
            type="button"
            onClick={() => handleViewChange('delivered')}
            className={`p-3.5 rounded-2xl border text-left transition-all hover:shadow-md cursor-pointer relative overflow-hidden ${
              view === 'delivered'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-emerald-50/60 border-emerald-200/70 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase tracking-wider ${view === 'delivered' ? 'text-emerald-100' : 'text-emerald-700'}`}>
                Delivered
              </span>
              <span className="text-sm">🚚</span>
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <p className={`text-2xl font-black ${view === 'delivered' ? 'text-white' : 'text-emerald-900'}`}>
                {summary.delivered || 0}
              </p>
              {summary.deliveryRate && (
                <span className={`text-[11px] font-bold ${view === 'delivered' ? 'text-emerald-100' : 'text-emerald-600'}`}>
                  ({summary.deliveryRate})
                </span>
              )}
            </div>
            <p className={`text-[10px] mt-1 font-medium ${view === 'delivered' ? 'text-emerald-100' : 'text-emerald-600'}`}>
              Successfully delivered
            </p>
          </button>

          {/* RTO */}
          <button
            type="button"
            onClick={() => handleViewChange('rto')}
            className={`p-3.5 rounded-2xl border text-left transition-all hover:shadow-md cursor-pointer relative overflow-hidden ${
              view === 'rto'
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                : 'bg-rose-50/60 border-rose-200/70 hover:border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase tracking-wider ${view === 'rto' ? 'text-rose-100' : 'text-rose-700'}`}>
                RTO (Returned)
              </span>
              <span className="text-sm">🔴</span>
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <p className={`text-2xl font-black ${view === 'rto' ? 'text-white' : 'text-rose-900'}`}>
                {summary.rto || 0}
              </p>
              {summary.rtoRate && (
                <span className={`text-[11px] font-bold ${view === 'rto' ? 'text-rose-100' : 'text-rose-600'}`}>
                  ({summary.rtoRate})
                </span>
              )}
            </div>
            <p className={`text-[10px] mt-1 font-medium ${view === 'rto' ? 'text-rose-100' : 'text-rose-600'}`}>
              Returned / In-Transit
            </p>
          </button>

          {/* ACTIVE NDR */}
          <button
            type="button"
            onClick={() => handleViewChange('ndr')}
            className={`p-3.5 rounded-2xl border text-left transition-all hover:shadow-md cursor-pointer relative overflow-hidden ${
              view === 'ndr'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-amber-50/60 border-amber-200/70 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase tracking-wider ${view === 'ndr' ? 'text-amber-100' : 'text-amber-700'}`}>
                Active NDR List
              </span>
              <span className="text-sm">⚠️</span>
            </div>
            <p className={`text-2xl font-black mt-1 ${view === 'ndr' ? 'text-white' : 'text-amber-900'}`}>
              {summary.ndr || (view === 'ndr' ? safeNdrs.length : 0)}
            </p>
            <p className={`text-[10px] mt-1 font-medium ${view === 'ndr' ? 'text-amber-100' : 'text-amber-600'}`}>
              Requires Re-Attempt
            </p>
          </button>
        </div>

        {/* ── Date Presets & Custom Pickers Bar ────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-gray-200/60">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider mr-1">Period:</span>
            {[
              { id: 'month', label: 'This Month' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'last7', label: 'Last 7 Days' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'custom', label: 'Custom' },
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePresetChange(p.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                  preset === p.id
                    ? 'bg-gray-900 text-white shadow-xs'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Custom Date Pickers */}
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2.5 py-1 shadow-2xs">
              <span className="text-[10px] font-black text-gray-400 uppercase">From:</span>
              <input
                type="date"
                value={from}
                onChange={e => { setFrom(e.target.value); setPreset('custom'); }}
                className="text-xs bg-transparent focus:outline-none font-semibold text-gray-700"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2.5 py-1 shadow-2xs">
              <span className="text-[10px] font-black text-gray-400 uppercase">To:</span>
              <input
                type="date"
                value={to}
                onChange={e => { setTo(e.target.value); setPreset('custom'); }}
                className="text-xs bg-transparent focus:outline-none font-semibold text-gray-700"
              />
            </div>

            <button
              type="button"
              onClick={() => fetchNDR(from, to, view)}
              disabled={loading}
              className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition disabled:opacity-50 shadow-xs flex items-center gap-1 cursor-pointer"
            >
              {loading ? '…' : '🔍 Apply'}
            </button>
            <button
              type="button"
              onClick={() => {
                const b = getMonthBounds(new Date().getMonth(), new Date().getFullYear());
                setPreset('month');
                setSelectedMonth({ month: new Date().getMonth(), year: new Date().getFullYear() });
                setFrom(b.from);
                setTo(b.to);
                setSearch('');
                setAttempt('all');
                setDepartment('all');
                setView('ndr');
                fetchNDR(b.from, b.to, 'ndr');
              }}
              className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200 transition cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>

        {/* ── Department Filter & Search Bar ──────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-gray-200/60">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black text-gray-500 uppercase tracking-wide mr-1">Department:</span>
            <button
              type="button"
              onClick={() => setDepartment('all')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                department === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <span>All</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${department === 'all' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {allDeptCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDepartment('migraine')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                department === 'migraine'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
              }`}
            >
              <span>Migraine</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${department === 'migraine' ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-800'}`}>
                {migraineCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDepartment('piles')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                department === 'piles'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <span>Piles</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${department === 'piles' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                {pilesCount}
              </span>
            </button>
          </div>

          {/* Active View Badge */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-500">
              Table View: <span className="font-extrabold text-blue-700 uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{view === 'ndr' ? 'Active NDR' : view === 'rto' ? 'RTO Returns' : view === 'delivered' ? 'Delivered Orders' : 'All Shipments'}</span>
            </span>
            <span className="text-[10px] font-black text-gray-500 bg-white px-2.5 py-1 rounded-xl border border-gray-200 shadow-2xs">
              {filtered.length} records shown
            </span>
          </div>
        </div>

        {/* ── Search & Attempts Bar ───────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          <input
            placeholder="Search AWB / patient name / phone / order…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          />
          <select
            value={attempt}
            onChange={e => setAttempt(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white font-semibold focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            {ATTEMPT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-5 py-10 text-center text-gray-400 text-sm">
          {loading ? 'Loading NDR records…' : 'No NDR records found.'}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="overflow-x-auto">
            <table className="hidden sm:table w-full text-sm">
              <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-[0.1em] sticky top-0">
                <tr>
                  {['AWB', 'Order ID', 'Customer', 'Department', 'Reason', 'Attempts', 'Raised', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((n, i) => (
                  <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <a href={getTrackingUrl(n)} target="_blank" rel="noreferrer"
                        className="font-mono text-[11px] text-blue-600 font-bold hover:underline">
                        {n.awb_code}
                      </a>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-gray-600">{n.channel_order_id}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800 text-[13px]">{n.customer_name?.trim() || '—'}</td>
                    <td className="px-4 py-3">
                      {getDept(n) === 'piles' ? (
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                          Piles
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 uppercase">
                          Migraine
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[280px]">
                      <div className="space-y-1">
                        {/* Delivery Boy Reason */}
                        <div className="flex items-start gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200/80 px-1.5 py-0.5 rounded shrink-0">
                            <span>🚚 Delivery Boy:</span>
                            {n.courier_name && <span className="opacity-75">({n.courier_name})</span>}
                          </span>
                          <span className="text-xs font-black text-gray-900 leading-snug break-words" title={n.reason}>
                            {n.reason || 'Delivery Attempt Failed'}
                          </span>
                        </div>

                        {/* Staff Caller Remark if present */}
                        {n.staff_remark && (
                          <div className="flex items-center gap-1.5 pl-0.5 text-[10px] text-gray-500 font-medium">
                            <span className="text-[9px] font-bold text-purple-700 uppercase bg-purple-50 px-1 py-0.2 rounded border border-purple-100 shrink-0">
                              Caller Note
                            </span>
                            <span className="truncate italic max-w-[190px]" title={n.staff_remark}>
                              "{n.staff_remark}"
                            </span>
                            {n.staff_remark_by && (
                              <span className="text-[9px] text-gray-400 font-semibold shrink-0">
                                - {n.staff_remark_by}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex w-6 h-6 items-center justify-center rounded-lg bg-red-50 text-red-700 font-bold text-[11px] border border-red-100">
                        {n.attempts ?? 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-400">{String(n.ndr_raised_at || '').split('T')[0].split(' ')[0]}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => setDetail(n)}
                          className="text-[10px] font-bold px-3 py-1.5 rounded-xl bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 transition">
                          VIEW
                        </button>
                        <button onClick={() => onUseAwb(n.awb_code, 'reattempt')}
                          className="text-[10px] font-bold px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-600 hover:text-white transition">
                          RE-TRY
                        </button>
                        <button onClick={() => onUseAwb(n.awb_code, 'rto')}
                          className="text-[10px] font-bold px-3 py-1.5 rounded-xl bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-600 hover:text-white transition">
                          RTO
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-50">
              {filtered.map((n, i) => (
                <div key={i} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">{n.customer_name?.trim() || 'Unknown'}</p>
                      <a href={getTrackingUrl(n)} target="_blank" rel="noreferrer"
                        className="text-[10px] font-mono text-blue-600 font-bold hover:underline">
                        {n.awb_code}
                      </a>
                    </div>
                    <span className="inline-flex w-7 h-7 items-center justify-center rounded-lg bg-red-50 text-red-700 font-bold text-xs border border-red-100 shrink-0">
                      {n.attempts ?? 1}
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="text-[9px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                        🚚 Delivery Boy Reason
                      </span>
                      {n.courier_name && (
                        <span className="text-[9px] font-bold text-gray-500 uppercase">{n.courier_name}</span>
                      )}
                    </div>
                    <p className="text-xs font-black text-gray-900 pl-0.5 leading-snug">{n.reason || 'Delivery Attempt Failed'}</p>
                    {n.staff_remark && (
                      <div className="pt-1.5 mt-1 border-t border-gray-200/60 text-[11px] text-gray-600 flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-purple-700 text-[9px] uppercase bg-purple-50 px-1 rounded border border-purple-100">Staff Note:</span>
                        <span className="italic">"{n.staff_remark}"</span>
                        {n.staff_remark_by && <span className="text-[9px] text-gray-400">({n.staff_remark_by})</span>}
                      </div>
                    )}
                    <p className="text-[10px] text-gray-400 font-bold mt-1">ORDER: {n.channel_order_id} · RAISED: {String(n.ndr_raised_at || '').split('T')[0]}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setDetail(n)} className="flex-1 text-[11px] font-bold py-2 rounded-xl bg-white text-gray-600 border border-gray-200">VIEW</button>
                    <button onClick={() => onUseAwb(n.awb_code, 'reattempt')} className="flex-1 text-[11px] font-bold py-2 rounded-xl bg-blue-600 text-white">RE-TRY</button>
                    <button onClick={() => onUseAwb(n.awb_code, 'rto')} className="flex-1 text-[11px] font-bold py-2 rounded-xl bg-orange-600 text-white">RTO</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── NDR Action Panel ──────────────────────────────────────────────────────────
function NdrActionPanel({ prefillAwb, prefillAction }) {
  const [form, setForm] = useState({ awb: prefillAwb || '', action: prefillAction || 'reattempt', comment: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (prefillAwb) setForm(p => ({ ...p, awb: prefillAwb, action: prefillAction || p.action }));
  }, [prefillAwb, prefillAction]);

  const submit = async () => {
    if (!form.awb) { setError('AWB is required'); return; }
    setLoading(true); setError(''); setResult('');
    try {
      await smxSvc.ndrAction(form.awb, { action: form.action, notes: form.comment });
      setResult('NDR action submitted successfully to ShipMaxx');
      setForm(p => ({ ...p, comment: '' }));
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
      <div className="h-1 bg-blue-600" />
      <div className="px-5 py-3 border-b border-gray-100">
        <span className="font-semibold text-gray-700 text-sm">ShipMaxx NDR Action</span>
        <p className="text-xs text-gray-400 mt-0.5">Submit an instruction directly to the ShipMaxx/Losung platform</p>
      </div>
      <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="AWB Code *">
          <input className={inp} placeholder="Enter AWB or Shipment ID" value={form.awb} onChange={e => setForm(p => ({ ...p, awb: e.target.value }))} />
        </Field>
        <Field label="Action *">
          <select className={inp} value={form.action} onChange={e => setForm(p => ({ ...p, action: e.target.value }))}>
            <option value="reattempt">Re-attempt Delivery</option>
            <option value="rto">Return to Origin (RTO)</option>
            <option value="escalate">Escalate</option>
            <option value="follow_up">Follow Up</option>
          </select>
        </Field>
        <Field label="Notes / Comment">
          <input className={inp} placeholder="Optional notes to attach" value={form.comment} onChange={e => setForm(p => ({ ...p, comment: e.target.value }))} />
        </Field>
      </div>
      <div className="px-5 pb-5 flex items-center gap-3 flex-wrap">
        <button onClick={submit} disabled={loading}
          className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition disabled:opacity-50">
          {loading ? 'Submitting…' : 'Submit NDR Action'}
        </button>
        {result && <span className="text-sm font-semibold text-green-600">{result}</span>}
        {error  && <span className="text-sm font-semibold text-red-500">{error}</span>}
      </div>
    </div>
  );
}

// ── NDR Notes Panel ───────────────────────────────────────────────────────────
function NdrNotesPanel() {
  const [notes, setNotes]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [search, setSearch]     = useState('');
  const [form, setForm]         = useState({ name: '', phone_number: '', reason: '', awb_number: '', date: new Date().toISOString().split('T')[0] });
  const [editId, setEditId]     = useState(null);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);

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
    if (!name || !phone_number || !reason || !awb_number) {
      setError('All fields are required'); return;
    }
    setSaving(true); setError('');
    try {
      if (editId) {
        await smxSvc.updateNdrNote(editId, { name, phone_number, reason, awb_number });
        setEditId(null);
      } else {
        await smxSvc.createNdrNote({ name, phone_number, reason, awb_number });
      }
      setForm({ name: '', phone_number: '', reason: '', awb_number: '', date: new Date().toISOString().split('T')[0] });
      fetchNotes();
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (id) => {
    if (!window.confirm('Delete this note?')) return;
    await smxSvc.deleteNdrNote(id).catch(() => {});
    setNotes(p => p.filter(n => n._id !== id));
  };

  const startEdit = (note) => {
    setEditId(note._id);
    setForm({ name: note.name, phone_number: note.phone_number, reason: note.reason, awb_number: note.awb_number, date: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-4">
      {/* Add / Edit form */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="h-1 bg-yellow-400" />
        <div className="px-5 py-3 border-b border-gray-100">
          <span className="font-semibold text-gray-700 text-sm">{editId ? 'Edit Note' : 'Add New Note'}</span>
        </div>
        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Customer Name *">
            <input className={inp} placeholder="Name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </Field>
          <Field label="Phone Number *">
            <input className={inp} placeholder="Phone" value={form.phone_number} onChange={e => setForm(p => ({ ...p, phone_number: e.target.value }))} />
          </Field>
          <Field label="AWB Number *">
            <input className={inp} placeholder="AWB" value={form.awb_number} onChange={e => setForm(p => ({ ...p, awb_number: e.target.value }))} />
          </Field>
          <Field label="Reason / Note *">
            <input className={inp} placeholder="Reason" value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} />
          </Field>
        </div>
        <div className="px-5 pb-4 flex items-center gap-3 flex-wrap">
          <button onClick={save} disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-yellow-500 text-white text-sm font-bold hover:bg-yellow-600 transition disabled:opacity-50">
            {saving ? 'Saving…' : editId ? 'Update Note' : '+ Add Note'}
          </button>
          {editId && (
            <button onClick={() => { setEditId(null); setForm({ name: '', phone_number: '', reason: '', awb_number: '', date: '' }); }}
              className="px-5 py-2.5 rounded-xl bg-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-300 transition">
              Cancel
            </button>
          )}
          {error && <span className="text-red-500 text-sm font-semibold">{error}</span>}
        </div>
      </div>

      {/* Notes list */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="h-1 bg-yellow-400" />
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <span className="font-semibold text-gray-700 text-sm flex-1">
            ShipMaxx Notes {notes.length > 0 && <span className="text-xs text-gray-400 font-normal ml-1">({notes.length})</span>}
          </span>
          <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchNotes(filterDate, search)}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-yellow-400 w-36" />
          <input type="date" value={filterDate} onChange={e => { setFilterDate(e.target.value); fetchNotes(e.target.value, search); }}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-yellow-400" />
          {filterDate && (
            <button onClick={() => { setFilterDate(''); fetchNotes('', search); }}
              className="text-xs text-gray-400 hover:text-gray-600 font-semibold">Clear</button>
          )}
          <button onClick={() => fetchNotes(filterDate, search)}
            className="px-4 py-1.5 rounded-xl bg-yellow-500 text-white text-xs font-bold hover:bg-yellow-600 transition">
            {loading ? '…' : 'Refresh'}
          </button>
        </div>

        {notes.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">
            {loading ? 'Loading…' : 'No notes found.'}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden sm:table w-full text-sm">
              <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-[0.1em] sticky top-0">
                <tr>{['Date', 'Name', 'Phone', 'AWB', 'Reason', 'By', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-bold">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {notes.map(n => (
                  <tr key={n._id} className="hover:bg-yellow-50/30 transition-colors">
                    <td className="px-4 py-3 text-[11px] text-gray-400 font-medium whitespace-nowrap">
                      {new Date(n.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800 text-[13px]">{n.name}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-gray-600">{n.phone_number}</td>
                    <td className="px-4 py-3">
                      <a href={`https://shipmaxx.in/track/${n.awb_number}`} target="_blank" rel="noreferrer"
                        className="font-mono text-[11px] text-blue-600 font-bold hover:underline">{n.awb_number}</a>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-gray-600 max-w-[220px] truncate" title={n.reason}>{n.reason}</td>
                    <td className="px-4 py-3 text-[11px] text-gray-500">{n.createdBy?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => startEdit(n)}
                          className="w-8 h-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-500 hover:text-white transition border border-blue-100">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button onClick={() => deleteNote(n._id)}
                          className="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition border border-red-100">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile */}
            <div className="sm:hidden divide-y divide-gray-50">
              {notes.map(n => (
                <div key={n._id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-sm">{n.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{n.phone_number}</p>
                    </div>
                    <p className="text-[10px] text-gray-400 shrink-0">{new Date(n.createdAt).toLocaleDateString('en-IN')}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1">
                    <p><span className="font-bold text-gray-400">AWB:</span> <a href={`https://shipmaxx.in/track/${n.awb_number}`} target="_blank" rel="noreferrer" className="text-blue-600 font-mono font-bold hover:underline">{n.awb_number}</a></p>
                    <p><span className="font-bold text-gray-400">Reason:</span> {n.reason}</p>
                    <p><span className="font-bold text-gray-400">By:</span> {n.createdBy?.name || '—'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(n)} className="flex-1 text-[11px] font-bold py-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">Edit</button>
                    <button onClick={() => deleteNote(n._id)} className="flex-1 text-[11px] font-bold py-2 rounded-xl bg-red-50 text-red-600 border border-red-100">Delete</button>
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

// ── Main NDR Page ─────────────────────────────────────────────────────────────
const TABS = [
  { id: 'board',  label: 'Status Board',   icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { id: 'list',   label: 'NDR List',       icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  { id: 'action', label: 'NDR Action',     icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { id: 'notes',  label: 'Notes',          icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> },
];

export default function ShipmaxxNdr() {
  const [tab, setTab] = useState('board');
  const [department, setDepartment] = useState('all');
  const [actionAwb, setActionAwb] = useState('');
  const [actionType, setActionType] = useState('reattempt');

  const handleUseAwb = (awb, type = 'reattempt') => {
    setActionAwb(awb);
    setActionType(type);
    setTab('action');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-4">
      {/* Tab bar with Department Filter */}
      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 pb-1 scrollbar-hide">
        <select
          value={department}
          onChange={e => setDepartment(e.target.value)}
          className="h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 shadow-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer uppercase tracking-wider transition hover:border-gray-300 shrink-0"
        >
          <option value="all">ALL DEPARTMENTS</option>
          <option value="migraine">MIGRAINE</option>
          <option value="piles">PILES</option>
        </select>

        <div className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm whitespace-nowrap">
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`h-9 rounded-lg px-3 text-xs font-semibold transition-all inline-flex items-center gap-2 ${
                  active ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }`}>
                <span className={`grid h-5 w-5 place-items-center rounded-md ${active ? 'bg-white/15' : 'bg-blue-50 text-blue-600'}`}>
                  {t.icon}
                </span>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'board'  && <OrderStatusBoard platform="shipmaxx" title="ShipMaxx Undelivered Orders" department={department} defaultStatus="UNDELIVERED_1ST_ATTEMPT" allowedStatuses={['NEW', 'PICKUP_SCHEDULED', 'SHIPMENT_BOOKED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'UNDELIVERED_1ST_ATTEMPT', 'UNDELIVERED_2ND_ATTEMPT', 'UNDELIVERED_3RD_ATTEMPT', 'UNDELIVERED']} />}
      {tab === 'list'   && <NdrList department={department} setDepartment={setDepartment} onSelectNdr={() => {}} onUseAwb={handleUseAwb} />}
      {tab === 'action' && <NdrActionPanel prefillAwb={actionAwb} prefillAction={actionType} />}
      {tab === 'notes'  && <NdrNotesPanel />}
    </div>
  );
}
