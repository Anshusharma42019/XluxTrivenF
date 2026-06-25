import { useState, useCallback, useEffect } from 'react';
import API from '../api';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const STATE_COLORS = [
  { bg: '#f59e0b', light: '#fef3c7', text: '#92400e' },
  { bg: '#10b981', light: '#d1fae5', text: '#065f46' },
  { bg: '#3b82f6', light: '#dbeafe', text: '#1e3a8a' },
  { bg: '#f43f5e', light: '#ffe4e6', text: '#9f1239' },
  { bg: '#8b5cf6', light: '#ede9fe', text: '#4c1d95' },
  { bg: '#06b6d4', light: '#cffafe', text: '#164e63' },
  { bg: '#f97316', light: '#ffedd5', text: '#7c2d12' },
];

/* ─── Mini sparkline (SVG) ─────────────────────────────────────── */
function Sparkline({ data, color = '#7c3aed', height = 40 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  const w = 100, h = height;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (d.count / max) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const area = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sg-${color.replace('#','')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── KPI summary card ─────────────────────────────────────────── */
function KpiCard({ label, value, sub, icon, accent = '#7c3aed' }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 flex flex-col gap-1"
      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.55)' }}>{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-black text-white leading-none">{value}</p>
      {sub && <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{sub}</p>}
    </div>
  );
}

/* ─── Horizontal bar row ───────────────────────────────────────── */
function HBar({ label, count, max, rank, color, subLabel, onClick, clickable, rankLabel }) {
  const pct = Math.max(Math.round((count / (max || 1)) * 100), count > 0 ? 3 : 0);
  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-3 py-2.5 px-1 rounded-xl transition-all ${clickable ? 'cursor-pointer hover:bg-gray-50' : ''}`}
    >
      {/* Rank badge */}
      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0"
        style={{ background: rank === 1 ? color + '22' : '#f3f4f6', color: rank === 1 ? color : '#9ca3af' }}>
        {rankLabel ? (
          <span className="text-[9px] font-black">{rankLabel}</span>
        ) : rank <= 3 ? (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" style={{ color: rank === 1 ? color : rank === 2 ? '#9ca3af' : '#d97706' }}>
            {rank === 1 && <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" fill="currentColor" stroke="none" />}
            {rank === 2 && <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" fill="currentColor" stroke="none" opacity="0.5" />}
            {rank === 3 && <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" fill="currentColor" stroke="none" opacity="0.4" />}
          </svg>
        ) : rank}
      </div>

      {/* Label + bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-700 truncate capitalize">{label}</span>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {subLabel && <span className="text-[10px] text-gray-400">{subLabel}</span>}
            <span className="text-xs font-black" style={{ color }}>{count}</span>
            {clickable && (
              <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-violet-400 transition-all group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path d="m9 18 6-6-6-6" />
              </svg>
            )}
          </div>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}cc, ${color})` }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Chart section wrapper ────────────────────────────────────── */
function ChartCard({ title, children, accent = '#7c3aed', total, totalLabel }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden h-full" style={{ border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="px-5 pt-4 pb-3 flex items-center justify-between" style={{ borderBottom: '1px solid #f9fafb' }}>
        <div className="text-xs font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: accent }}>{title}</div>
        {total != null && (
          <div className="text-right">
            <p className="text-lg font-black text-gray-800 leading-none">{total}</p>
            <p className="text-[9px] text-gray-400 uppercase tracking-wide mt-0.5">{totalLabel}</p>
          </div>
        )}
      </div>
      <div className="px-5 py-4 overflow-y-auto custom-scrollbar" style={{ maxHeight: 340 }}>
        {children}
      </div>
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────── */
export default function ShipmentAnalyticsPanel({ department = '' }) {
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const [loaded, setLoaded]     = useState(false);
  const [drillState, setDrillState]     = useState(null);
  const [drillPincode, setDrillPincode] = useState(null);
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [globalMonth, setGlobalMonth] = useState(currentMonth);

  const fetchStats = useCallback(async (fState = null, fPincode = null, fMonth = null) => {
    setLoading(true);
    try {
      const params = {};
      if (department)  params.department    = department;
      if (fState)      params.filterState   = fState;
      if (fPincode)    params.filterPincode = fPincode;
      if (fMonth)      params.filterMonth   = fMonth;
      const res = await API.get('/ready-to-shipment/stats', { params });
      setStats(res.data.data);
      setLoaded(true);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [department]);

  const handleDrillState      = s => { setDrillState(s); setDrillPincode(null); fetchStats(s, null, globalMonth); };
  const handleDrillPincode    = p => { setDrillPincode(p); setDrillState(null); fetchStats(null, p, globalMonth); };
  const handleBack            = () => { setDrillState(null); setDrillPincode(null); fetchStats(null, null, globalMonth); };
  const handleGlobalMonthChange = m => { setGlobalMonth(m); fetchStats(drillState, drillPincode, m); };

  // Auto-load analytics on mount
  useEffect(() => {
    fetchStats(null, null, currentMonth);
  }, [fetchStats, currentMonth]);

  const isDrilled   = !!(drillState || drillPincode);
  const drillLabel  = drillState || drillPincode;

  const totalAdded12mo = stats?.byMonth?.reduce((s, m) => s + m.count, 0) || 0;
  const totalAdded8wk  = stats?.byWeek?.reduce((s, w) => s + w.count, 0) || 0;
  const pendingCount   = isDrilled ? (stats?.drillTotal ?? 0) : (stats?.total ?? 0);
  // For peak month: use all-time byMonth from a separate call isn't available, so show from current data
  const peakMonth      = stats?.byMonth?.length
    ? stats.byMonth.reduce((a, b) => b.count > a.count ? b : a, stats.byMonth[0])
    : null;
  const peakMonthLabel = peakMonth ? `${MONTH_NAMES[parseInt(peakMonth.month.split('-')[1], 10) - 1]} ${peakMonth.month.split('-')[0]}` : '—';

  // Build month options from a stored full list (pre-filter)
  const monthOptions = stats?.allMonths || stats?.byMonth || [];

  return (
    <div className="rounded-3xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(109,40,217,0.10), 0 1px 4px rgba(0,0,0,0.06)' }}>

      {/* ── DARK HEADER ── */}
      <div className="relative overflow-hidden px-6 pt-6 pb-5"
        style={{ background: 'linear-gradient(135deg, #071407 0%, #0d2410 40%, #14532d 100%)' }}>
        {/* decorative circles */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #4ade80, transparent)' }} />
        <div className="absolute -bottom-6 -left-4 w-32 h-32 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #22c55e, transparent)' }} />

          <div className="relative flex items-start justify-between gap-4 mb-4">
          <div>
            {isDrilled && (
              <button onClick={handleBack}
                className="inline-flex items-center gap-1.5 text-[10px] font-bold mb-2 px-2.5 py-1 rounded-lg transition"
                style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}>
                ← Back to Overview
              </button>
            )}
            <h2 className="text-white font-black text-lg leading-tight flex items-center gap-2">
              {isDrilled ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                  {drillLabel}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                  Shipment Analytics
                </>
              )}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.45)' }} className="text-xs mt-0.5 font-medium">
              {isDrilled
                ? `Drill-down view · ${drillState ? 'State' : 'Pincode'} breakdown`
                : 'Ready to Ship · State · Pincode · Monthly · Weekly'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 mt-1">
            {/* Global month filter */}
            {loaded && stats && monthOptions.length > 0 && (
              <select
                value={globalMonth || ''}
                onChange={e => handleGlobalMonthChange(e.target.value || null)}
                className="px-2 py-1.5 rounded-lg text-xs font-bold border-0 outline-none"
                style={{ background: 'rgba(255,255,255,0.15)', color: globalMonth ? '#fff' : 'rgba(255,255,255,0.6)' }}
              >
                <option value="" style={{ background: '#312e81', color: '#fff' }}>All months</option>
                {monthOptions.map(item => (
                  <option key={item.month} value={item.month} style={{ background: '#312e81', color: '#fff' }}>
                    {`${MONTH_NAMES[parseInt(item.month.split('-')[1], 10) - 1]} '${item.month.split('-')[0].slice(2)}`}
                  </option>
                ))}
              </select>
            )}
            {loaded && (
              <button onClick={() => fetchStats(drillState, drillPincode, globalMonth)} title="Refresh"
                className="w-8 h-8 flex items-center justify-center rounded-xl transition"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M2.5 2v6h6M21.5 22v-6h-6M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2" />
                </svg>
              </button>
            )}
            {!loaded && !loading && (
              <button onClick={() => fetchStats(null, null, currentMonth)}
                className="px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', color: 'white', boxShadow: '0 4px 12px rgba(22,163,74,0.4)' }}>
                Load Analytics
              </button>
            )}
          </div>
        </div>

        {/* KPI cards */}
        {loaded && stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              label="Pending Orders"
              value={pendingCount}
              sub={isDrilled ? `in ${drillLabel}` : 'ready to ship'}
              accent="#a78bfa"
              icon={<svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>}
            />
            <KpiCard
              label="Added (12 months)"
              value={totalAdded12mo}
              sub="all records incl. shipped"
              icon={<svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>}
            />
            <KpiCard
              label="Added (8 weeks)"
              value={totalAdded8wk}
              sub="recent activity"
              icon={<svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
            />
            <KpiCard
              label="Peak Month"
              value={peakMonthLabel}
              sub={peakMonth ? `${peakMonth.count} orders` : '—'}
              icon={<svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>}
            />
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8 gap-3">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin opacity-60" />
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Fetching analytics…</span>
          </div>
        )}

        {!loaded && !loading && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              </div>
            <p className="text-[11px] text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>Click "Load Analytics" to see full breakdown</p>
          </div>
        )}
      </div>

      {/* ── CHARTS GRID ── */}
      {loaded && stats && !loading && (
        <div className="bg-gray-50/80 p-5 grid grid-cols-1 lg:grid-cols-3 gap-4"
          style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>

          {/* Column 1: States */}
          <ChartCard
            title={isDrilled && drillState
              ? <span className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>Pincodes in {drillState}</span>
              : <span className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13V7m0 13l6-3M9 7l6-3m0 16l5.447-2.724A1 1 0 0 0 21 16.382V5.618a1 1 0 0 0-1.447-.894L15 7"/></svg>State-wise Orders</span>}
            accent="#16a34a"
            total={isDrilled && drillState ? stats.byPincode.length : stats.byState.length}
            totalLabel={isDrilled && drillState ? 'pincodes' : 'states'}
          >
            {(isDrilled && drillState ? stats.byPincode : stats.byState).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No data available</p>
            ) : (isDrilled && drillState ? stats.byPincode : stats.byState).map((item, idx) => {
              const col = STATE_COLORS[idx % STATE_COLORS.length];
              const isPin = isDrilled && drillState;
              const label = isPin ? item.pincode : item.state;
              const sub = isPin
                ? item.states?.filter(Boolean).join(', ')
                : `${item.pincodes?.filter(Boolean).length || 0} pins`;
              return (
                <HBar
                  key={label}
                  label={label}
                  count={item.count}
                  max={(isDrilled && drillState ? stats.byPincode : stats.byState)[0]?.count || 1}
                  rank={idx + 1}
                  color={col.bg}
                  subLabel={sub}
                  clickable
                  onClick={() => isPin ? handleDrillPincode(item.pincode) : handleDrillState(item.state)}
                />
              );
            })}
          </ChartCard>

          {/* Column 2: Monthly */}
          <ChartCard
            title={<span className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>Monthly Trend{drillLabel ? ` · ${drillLabel}` : ''}</span>}
            accent="#16a34a"
            total={totalAdded12mo}
            totalLabel={globalMonth ? 'filtered month' : 'last 12 months'}
          >
            {/* Sparkline */}
            {stats.byMonth?.length > 1 && (
              <div className="mb-4 -mx-1">
                <Sparkline data={stats.byMonth} color="#16a34a" height={44} />
              </div>
            )}
            {(!stats.byMonth || stats.byMonth.length === 0) ? (
              <p className="text-xs text-gray-400 text-center py-4">No monthly data</p>
            ) : (() => {
              const maxM = Math.max(...stats.byMonth.map(m => m.count), 1);
              return stats.byMonth.map((item, idx) => {
                const [yr, mo] = item.month.split('-');
                const label = `${MONTH_NAMES[parseInt(mo, 10) - 1]} '${yr.slice(2)}`;
                return (
                  <HBar key={item.month} label={label} count={item.count} max={maxM} rank={idx + 1} color="#16a34a" />
                );
              });
            })()}
          </ChartCard>
          <ChartCard
            title={<span className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01"/></svg>{globalMonth ? 'Daily Trend' : 'Weekly Trend'}{drillLabel ? ` · ${drillLabel}` : ''}</span>}
            accent="#16a34a"
            total={totalAdded8wk}
            totalLabel={globalMonth ? 'filtered month' : 'last 8 weeks'}
          >
            {/* Sparkline */}
            {stats.byWeek?.length > 1 && (
              <div className="mb-4 -mx-1">
                <Sparkline data={stats.byWeek} color="#22c55e" height={44} />
              </div>
            )}
            {(!stats.byWeek || stats.byWeek.length === 0) ? (
              <p className="text-xs text-gray-400 text-center py-4">No {globalMonth ? 'daily' : 'weekly'} data</p>
            ) : (() => {
              const maxW = Math.max(...stats.byWeek.map(w => w.count), 1);
              return stats.byWeek.map((item, idx) => {
                let weekLabel;
                let dayNum = null;
                if (globalMonth && item.week?.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  const d = new Date(item.week);
                  weekLabel = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                  dayNum = d.getDate();
                } else {
                  const weekStart = item.weekStart ? new Date(item.weekStart) : null;
                  weekLabel = weekStart
                    ? weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                    : item.week;
                }
                const isNow = !globalMonth && idx === stats.byWeek.length - 1;
                return (
                  <HBar key={item.week} label={weekLabel} count={item.count} max={maxW} rank={idx + 1} rankLabel={dayNum} color="#22c55e" subLabel={isNow ? 'Current week' : ''} />
                );
              });
            })()}
          </ChartCard>

        </div>
      )}

      {/* ── FOOTER ── */}
      {loaded && stats && !loading && (
        <div className="bg-white px-6 py-3 flex items-center justify-between flex-wrap gap-3"
          style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#16a34a' }} />
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
              {isDrilled ? drillLabel : 'All India'} · Ready to Ship
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-[10px] text-gray-400 font-medium">{stats.byState.length} States</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-[10px] text-gray-400 font-medium">{stats.byPincode.length} Pincodes tracked</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-gray-400 font-medium">{stats.byWeek?.length || 0} Active weeks</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
