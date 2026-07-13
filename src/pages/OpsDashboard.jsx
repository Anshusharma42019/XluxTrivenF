import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchKPIs, fetchTrend, fetchFunnel, fetchRtoReasons,
  fetchAging, fetchLeaderboard, fetchShipments, fetchAlerts
} from '../services/opsDashboard.service';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const fmtNum = (n) => {
  if (n === null || n === undefined) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
};
const fmtPct = (n) => (n === null || n === undefined ? '—' : `${n}%`);
const fmtDays = (n) => (n === null || n === undefined ? '—' : `${n}d`);

function ChangeChip({ value }) {
  if (value === undefined || value === null) return null;
  const up = value >= 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 700,
      color: up ? '#16a34a' : '#dc2626',
      background: up ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
      padding: '2px 6px', borderRadius: 8,
    }}>
      {up ? '↑' : '↓'} {Math.abs(value)}%
    </span>
  );
}

const STATUS_COLORS = {
  totalShipments: '#0f172a',
  inTransit: '#8b5cf6',
  delivered: '#16a34a', oldDelivered: '#059669', ofd: '#2563eb', undelivered: '#d97706',
  rto: '#dc2626', rtoIntersite: '#7c3aed', verified: '#0891b2',
};

/* ─── Sparkline (mini SVG line) ──────────────────────────────────────────── */
function Sparkline({ data = [], color = '#16a34a', height = 28 }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const w = 80; const h = height;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── KPI Card ────────────────────────────────────────────────────────────── */
function KpiCard({ label, value, change, color, formatter = fmtNum, sparkData = [], onClick, icon, subtext }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff', borderRadius: 16, padding: '20px 22px', cursor: onClick ? 'pointer' : 'default',
        border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        transition: 'all .2s', display: 'flex', flexDirection: 'column', gap: 10,
        position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* color bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '16px 16px 0 0' }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
            {subtext && <div title={subtext} style={{ fontSize: 10, background: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: 4, cursor: 'help' }}>ℹ</div>}
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', lineHeight: 1, fontFamily: "'Outfit', sans-serif" }}>
            {value !== undefined ? formatter(value) : <span style={{ opacity: .4, fontSize: 20 }}>—</span>}
          </div>
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
          {icon}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <ChangeChip value={change} />
        <Sparkline data={sparkData} color={color} />
      </div>
    </div>
  );
}

/* ─── Trend Chart (SVG area) ─────────────────────────────────────────────── */
function TrendChart({ data = [] }) {
  if (!data.length) return <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>No trend data</div>;

  const keys = ['delivered', 'ofd', 'undelivered', 'rto', 'rtoIntersite'];
  const colors = [STATUS_COLORS.delivered, STATUS_COLORS.ofd, STATUS_COLORS.undelivered, STATUS_COLORS.rto, STATUS_COLORS.rtoIntersite];
  const labels = ['Delivered', 'OFD', 'Undelivered', 'RTO', 'RTO Intersite'];

  const maxVal = Math.max(...data.map(d => keys.reduce((s, k) => s + (d[k] || 0), 0)), 1);
  const W = 100, H = 100;
  const [hovered, setHovered] = useState(null);

  const getY = (val) => H - (val / maxVal) * H;
  const getX = (i) => (i / (data.length - 1)) * W;

  const buildPath = (key) => {
    const pts = data.map((d, i) => `${getX(i).toFixed(1)},${getY(d[key] || 0).toFixed(1)}`).join(' L ');
    return `M ${pts}`;
  };

  return (
    <div>
      <svg viewBox={`0 0 100 100`} style={{ width: '100%', height: 200, overflow: 'visible' }} preserveAspectRatio="none">
        {keys.map((key, ki) => (
          <path key={key} d={buildPath(key)} fill="none" stroke={colors[ki]} strokeWidth={0.8} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
        ))}
        {/* X-axis labels */}
        {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0).map((d, i, arr) => {
          const origIdx = data.indexOf(d);
          return (
            <text key={i} x={getX(origIdx)} y={H + 5} fontSize={3} fill="#94a3b8" textAnchor="middle">
              {d.date?.slice(5)}
            </text>
          );
        })}
      </svg>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
        {keys.map((key, ki) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#64748b' }}>
            <span style={{ width: 12, height: 3, borderRadius: 2, background: colors[ki], display: 'inline-block' }} />
            {labels[ki]}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Funnel ─────────────────────────────────────────────────────────────── */
function FunnelChart({ data }) {
  if (!data) return null;
  const steps = [
    { label: 'Verified', value: data.verified, color: STATUS_COLORS.verified },
    { label: 'OFD', value: data.ofd, color: STATUS_COLORS.ofd },
    { label: 'Delivered', value: data.delivered, color: STATUS_COLORS.delivered },
    { label: 'Undelivered', value: data.undelivered, color: STATUS_COLORS.undelivered },
    { label: 'RTO', value: data.rto, color: STATUS_COLORS.rto },
  ];
  const max = Math.max(...steps.map(s => s.value || 0), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {steps.map((s, i) => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 100, fontSize: 12, color: '#64748b', fontWeight: 600, textAlign: 'right', flexShrink: 0 }}>{s.label}</div>
          <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 8, overflow: 'hidden', height: 24 }}>
            <div style={{ width: `${((s.value || 0) / max) * 100}%`, height: '100%', background: s.color, borderRadius: 8, transition: 'width .6s', minWidth: s.value > 0 ? 4 : 0 }} />
          </div>
          <div style={{ width: 60, fontSize: 13, fontWeight: 700, color: '#0f172a', textAlign: 'right', flexShrink: 0 }}>{fmtNum(s.value || 0)}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Donut for RTO Reasons ──────────────────────────────────────────────── */
const RTO_REASON_COLORS = ['#dc2626', '#d97706', '#7c3aed', '#2563eb', '#94a3b8'];

function DonutChart({ reasons = [] }) {
  const total = reasons.reduce((s, r) => s + r.count, 0) || 1;
  let cumulative = 0;
  const R = 40, CX = 50, CY = 50;

  const segments = reasons.slice(0, 5).map((r, i) => {
    const pct = r.count / total;
    const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
    cumulative += pct;
    const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;
    const x1 = CX + R * Math.cos(startAngle);
    const y1 = CY + R * Math.sin(startAngle);
    const x2 = CX + R * Math.cos(endAngle);
    const y2 = CY + R * Math.sin(endAngle);
    const largeArc = pct > 0.5 ? 1 : 0;
    return { d: `M ${CX} ${CY} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`, color: RTO_REASON_COLORS[i], pct, reason: r.reason, count: r.count };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      <svg viewBox="0 0 100 100" width={140} height={140}>
        {segments.map((s, i) => <path key={i} d={s.d} fill={s.color} opacity={0.9} />)}
        <circle cx={CX} cy={CY} r={22} fill="white" />
        <text x={CX} y={CY + 1} textAnchor="middle" dominantBaseline="middle" fontSize={8} fontWeight="bold" fill="#0f172a">{total}</text>
        <text x={CX} y={CY + 9} textAnchor="middle" fontSize={4} fill="#94a3b8">total</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ color: '#374151', fontWeight: 600 }}>{s.reason}</span>
            <span style={{ color: '#9ca3af', marginLeft: 'auto', paddingLeft: 8 }}>{s.count} ({(s.pct * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Aging Row ──────────────────────────────────────────────────────────── */
function AgingTable({ rows = [], title, color, emptyMsg }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, 5);
  if (!rows.length) return (
    <div style={{ padding: '16px 0', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>{emptyMsg}</div>
  );
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
              {['AWB', 'Customer', 'City/State', 'Courier', 'Status', 'Updated', 'Attempts', 'Amount'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f8fafc', transition: 'background .15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '10px 10px', fontFamily: 'monospace', fontSize: 12, color: '#0f172a', fontWeight: 600 }}>{r.awb_code || '—'}</td>
                <td style={{ padding: '10px 10px', color: '#374151', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.billing_customer_name || '—'}</td>
                <td style={{ padding: '10px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>{[r.billing_city, r.billing_state].filter(Boolean).join(', ') || '—'}</td>
                <td style={{ padding: '10px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>{r.courier_name || '—'}</td>
                <td style={{ padding: '10px 10px' }}>
                  <span style={{ background: color + '18', color, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{r.status}</span>
                </td>
                <td style={{ padding: '10px 10px', color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {r.status_updated_at ? new Date(r.status_updated_at).toLocaleDateString('en-IN') : '—'}
                </td>
                <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 700, color: r.delivery_attempt >= 3 ? '#dc2626' : '#374151' }}>{r.delivery_attempt || 1}</td>
                <td style={{ padding: '10px 10px', color: '#374151', fontWeight: 600 }}>₹{(r.sub_total || 0).toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 5 && (
        <button onClick={() => setExpanded(!expanded)} style={{
          marginTop: 8, background: 'none', border: 'none', color: '#2563eb', fontSize: 12, fontWeight: 600,
          cursor: 'pointer', padding: '4px 0',
        }}>{expanded ? 'Show less ↑' : `Show all ${rows.length} ↓`}</button>
      )}
    </div>
  );
}

/* ─── Leaderboard ────────────────────────────────────────────────────────── */
function LeaderboardTable({ rows = [], sortKey, sortDir, onSort }) {
  const cols = [
    { key: 'courier', label: 'Courier / Partner' },
    { key: 'total', label: 'Total' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'deliveryRate', label: 'Delivery %' },
    { key: 'rto', label: 'RTO' },
    { key: 'rtoRate', label: 'RTO %' },
    { key: 'undelivered', label: 'NDR' },
    { key: 'avgTat', label: 'Avg TAT (d)' },
  ];

  const badge = (rate) => {
    if (rate >= 80) return { bg: '#dcfce7', color: '#16a34a', label: '⭐ Excellent' };
    if (rate >= 60) return { bg: '#fef9c3', color: '#ca8a04', label: '⚠ Average' };
    return { bg: '#fee2e2', color: '#dc2626', label: '✗ Poor' };
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: 11 }}>#</th>
            {cols.map(c => (
              <th key={c.key} onClick={() => onSort(c.key)}
                style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: 11, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                {c.label} {sortKey === c.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
            ))}
            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: 11 }}>Grade</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const b = badge(r.deliveryRate);
            return (
              <tr key={i} style={{ borderBottom: '1px solid #f8fafc', transition: 'background .15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '12px 12px', color: '#94a3b8', fontWeight: 700 }}>{i + 1}</td>
                <td style={{ padding: '12px 12px', fontWeight: 700, color: '#0f172a', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.courier}</td>
                <td style={{ padding: '12px 12px', color: '#374151' }}>{r.total}</td>
                <td style={{ padding: '12px 12px', color: STATUS_COLORS.delivered, fontWeight: 700 }}>{r.delivered}</td>
                <td style={{ padding: '12px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 6, maxWidth: 60, overflow: 'hidden' }}>
                      <div style={{ width: `${r.deliveryRate}%`, height: '100%', background: STATUS_COLORS.delivered, borderRadius: 4 }} />
                    </div>
                    <span style={{ fontWeight: 700, color: r.deliveryRate >= 70 ? STATUS_COLORS.delivered : '#dc2626', fontSize: 12 }}>{r.deliveryRate}%</span>
                  </div>
                </td>
                <td style={{ padding: '12px 12px', color: STATUS_COLORS.rto, fontWeight: 600 }}>{r.rto}</td>
                <td style={{ padding: '12px 12px', color: '#dc2626', fontWeight: 600, fontSize: 12 }}>{r.rtoRate}%</td>
                <td style={{ padding: '12px 12px', color: STATUS_COLORS.undelivered }}>{r.undelivered}</td>
                <td style={{ padding: '12px 12px', color: '#374151' }}>{r.avgTat}d</td>
                <td style={{ padding: '12px 12px' }}>
                  <span style={{ background: b.bg, color: b.color, padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{b.label}</span>
                </td>
              </tr>
            );
          })}
          {!rows.length && <tr><td colSpan={10} style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No leaderboard data</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Shipments Table ────────────────────────────────────────────────────── */
function ShipmentsTable({ data, filters, onFilterChange, onExportCsv }) {
  const { shipments = [], total = 0, pages = 1, page = 1 } = data || {};
  const statusChip = (status) => {
    const cat = (() => {
      const s = (status || '').toLowerCase();
      if (/^delivered/.test(s)) return 'delivered';
      if (/out.?for.?delivery|^ofd/.test(s)) return 'ofd';
      if (/^undelivered|^ndr/.test(s)) return 'undelivered';
      if (/rto.?in.?transit/.test(s)) return 'rtoIntersite';
      if (/^rto/.test(s)) return 'rto';
      return 'other';
    })();
    const col = STATUS_COLORS[cat] || '#64748b';
    return <span style={{ background: col + '18', color: col, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{status || '—'}</span>;
  };

  return (
    <div>
      {/* Filters row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <select value={filters.status || ''} onChange={e => onFilterChange('status', e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#374151', background: '#fff' }}>
          <option value="">All Statuses</option>
          <option value="verified">Verified</option>
          <option value="delivered">Delivered</option>
          <option value="blDelivered">Old Delivered</option>
          <option value="ofd">OFD</option>
          <option value="undelivered">Undelivered</option>
          <option value="blUndelivered">Old Undelivered</option>
          <option value="rto">RTO</option>
          <option value="blRto">Old RTO</option>
          <option value="rtoIntersite">RTO Intersite</option>
          <option value="blRtoIntersite">Old RTO Intersite</option>
        </select>
        <select value={filters.platform || ''} onChange={e => onFilterChange('platform', e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#374151', background: '#fff' }}>
          <option value="">Both Platforms</option>
          <option value="shiprocket">Shiprocket</option>
          <option value="shipmaxx">ShipMaxx</option>
        </select>
        <input value={filters.awb || ''} onChange={e => onFilterChange('awb', e.target.value)}
          placeholder="Search AWB..." style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, minWidth: 180 }} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={onExportCsv} style={{
            padding: '7px 16px', borderRadius: 8, border: '1px solid #16a34a', background: '#fff',
            color: '#16a34a', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1={12} y1={15} x2={12} y2={3} /></svg>
            Export CSV
          </button>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>{total.toLocaleString()} shipments found</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
              {[(filters.status === 'verified' ? 'Phone' : 'AWB'), 'Customer', 'City/State', 'Courier', 'Status', 'Platform', 'Order Date', 'Status Date', 'Attempts', '₹ Amount'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shipments.map((s, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f8fafc', transition: 'background .15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '10px 10px', fontFamily: 'monospace', fontSize: 11, color: '#0f172a', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {s.platform === 'verification' ? (s.billing_phone || '—') : (s.awb_code || '—')}
                </td>
                <td style={{ padding: '10px 10px', color: '#374151', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.billing_customer_name || '—'}
                </td>
                <td style={{ padding: '10px 10px', color: '#64748b', whiteSpace: 'nowrap', fontSize: 12 }}>{[s.billing_city, s.billing_state].filter(Boolean).join(', ') || '—'}</td>
                <td style={{ padding: '10px 10px', color: '#64748b', whiteSpace: 'nowrap', fontSize: 12 }}>{s.courier_name || '—'}</td>
                <td style={{ padding: '10px 10px' }}>{statusChip(s.status)}</td>
                <td style={{ padding: '10px 10px' }}>
                  <span style={{ background: s.platform === 'shiprocket' ? '#eff6ff' : '#f0fdf4', color: s.platform === 'shiprocket' ? '#2563eb' : '#16a34a', padding: '2px 7px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                    {s.platform === 'shiprocket' ? 'SR' : 'SM'}
                  </span>
                </td>
                <td style={{ padding: '10px 10px', color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN') : '—'}
                </td>
                <td style={{ padding: '10px 10px', color: '#0f172a', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600 }}>
                  {(s.delivered_at || s.status_updated_at) ? new Date(s.delivered_at || s.status_updated_at).toLocaleDateString('en-IN') : '—'}
                </td>
                <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 700, color: s.delivery_attempt >= 3 ? '#dc2626' : '#374151' }}>{s.delivery_attempt || 1}</td>
                <td style={{ padding: '10px 10px', color: '#374151', fontWeight: 600, whiteSpace: 'nowrap' }}>₹{(s.sub_total || 0).toLocaleString('en-IN')}</td>
              </tr>
            ))}
            {!shipments.length && <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No shipments found</td></tr>}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center', alignItems: 'center' }}>
          <button onClick={() => onFilterChange('page', Math.max(1, page - 1))} disabled={page <= 1}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: page > 1 ? 'pointer' : 'not-allowed', opacity: page <= 1 ? 0.4 : 1 }}>‹</button>
          <span style={{ fontSize: 13, color: '#64748b' }}>Page {page} of {pages}</span>
          <button onClick={() => onFilterChange('page', Math.min(pages, page + 1))} disabled={page >= pages}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: page < pages ? 'pointer' : 'not-allowed', opacity: page >= pages ? 0.4 : 1 }}>›</button>
        </div>
      )}
    </div>
  );
}

/* ─── Alert Banner ───────────────────────────────────────────────────────── */
function AlertBanner({ alerts = [] }) {
  const [dismissed, setDismissed] = useState([]);
  const visible = alerts.filter((_, i) => !dismissed.includes(i));
  if (!visible.length) return null;
  const sevColors = { critical: { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b', icon: '🔴' }, high: { bg: '#fef3c7', border: '#fcd34d', text: '#92400e', icon: '🟡' }, medium: { bg: '#dbeafe', border: '#93c5fd', text: '#1e3a8a', icon: '🔵' } };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
      {visible.map((a, i) => {
        const sev = sevColors[a.severity] || sevColors.medium;
        return (
          <div key={i} style={{ background: sev.bg, border: `1px solid ${sev.border}`, borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>{sev.icon}</span>
            <span style={{ flex: 1, fontSize: 13, color: sev.text, fontWeight: 500 }}>{a.message}</span>
            <button onClick={() => setDismissed(d => [...d, alerts.indexOf(a)])} style={{ background: 'none', border: 'none', color: sev.text, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0, opacity: 0.6 }}>×</button>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Global Filters Bar ─────────────────────────────────────────────────── */
const PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'weekly' },
  { label: 'MTD', value: 'mtd' },
  { label: 'QTD', value: 'qtd' },
  { label: 'Custom', value: 'custom' },
];

function FilterBar({ filters, onChange, lastUpdated, onRefresh, autoRefresh, onToggleAutoRefresh }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14,
      padding: '12px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: 20,
    }}>
      {/* Preset buttons */}
      <div style={{ display: 'flex', gap: 4, background: '#f8fafc', borderRadius: 10, padding: 3 }}>
        {PRESETS.map(p => (
          <button key={p.value} onClick={() => onChange('preset', p.value)}
            style={{
              padding: '5px 12px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: filters.preset === p.value ? '#16a34a' : 'transparent',
              color: filters.preset === p.value ? '#fff' : '#64748b',
              transition: 'all .15s',
            }}>{p.label}</button>
        ))}
      </div>
      {/* Custom date range */}
      {filters.preset === 'custom' && (
        <>
          <input type="date" value={filters.from || ''} onChange={e => onChange('from', e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
          <span style={{ color: '#94a3b8', fontSize: 12 }}>to</span>
          <input type="date" value={filters.to || ''} onChange={e => onChange('to', e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
        </>
      )}
      {/* Hub/State */}
      <input value={filters.state || ''} onChange={e => onChange('state', e.target.value)}
        placeholder="State..." style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, width: 100 }} />
      {/* Courier */}
      <input value={filters.courier || ''} onChange={e => onChange('courier', e.target.value)}
        placeholder="Courier..." style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, width: 110 }} />
      {/* AWB */}
      <input value={filters.awb || ''} onChange={e => onChange('awb', e.target.value)}
        placeholder="AWB / Track #" style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, width: 130 }} />

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        {lastUpdated && <span style={{ fontSize: 11, color: '#94a3b8' }}>Updated {lastUpdated}</span>}
        <button onClick={onRefresh} title="Refresh" style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}>
          <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748b', cursor: 'pointer', userSelect: 'none' }}>
          <div onClick={onToggleAutoRefresh} style={{
            width: 32, height: 18, borderRadius: 9, background: autoRefresh ? '#16a34a' : '#cbd5e1',
            position: 'relative', transition: 'background .2s', cursor: 'pointer', flexShrink: 0,
          }}>
            <div style={{ position: 'absolute', top: 2, left: autoRefresh ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
          </div>
          Auto-refresh
        </label>
        <button onClick={() => window.print()} title="Print" style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}>
          <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        </button>
      </div>
    </div>
  );
}

/* ─── Section Card ───────────────────────────────────────────────────────── */
function SectionCard({ title, subtitle, children, action }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '22px 24px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ─── Loading skeleton ───────────────────────────────────────────────────── */
function Skeleton({ h = 80, w = '100%' }) {
  return <div style={{ height: h, width: w, borderRadius: 12, background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />;
}

/* ─── KPI Icons ──────────────────────────────────────────────────────────── */
const kpiIcons = {
  totalShipments: <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16v-2"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  verified: <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  ofd: <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  delivered: <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>,
  undelivered: <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  rto: <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  rtoIntersite: <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  ndrRate: <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>,
  fadr: <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  avgTat: <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  inTransit: <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  oldDelivered: <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/><circle cx="18" cy="18" r="4"/><polyline points="18 16 18 18 19 19"/></svg>,
  blDelivered: <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/><circle cx="18" cy="18" r="4"/><polyline points="18 16 18 18 19 19"/></svg>,
  blUndelivered: <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/><circle cx="18" cy="18" r="4"/><polyline points="18 16 18 18 19 19"/></svg>,
  blRto: <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/><circle cx="18" cy="18" r="4"/><polyline points="18 16 18 18 19 19"/></svg>,
};


/* ─── TABS ────────────────────────────────────────────────────────────────── */
const TABS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'rto', label: 'RTO Reasons', icon: '↩' },
  { id: 'aging', label: 'Aging', icon: '⏱' },
  { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
  { id: 'shipments', label: 'Shipments', icon: '📦' },
];

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function OpsDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState({ preset: 'mtd' });
  const [shipmentFilters, setShipmentFilters] = useState({ preset: 'mtd', page: 1, limit: 50 });
  const [kpis, setKpis] = useState(null);
  const [trend, setTrend] = useState([]);
  const [funnel, setFunnel] = useState(null);
  const [rtoReasons, setRtoReasons] = useState([]);
  const [aging, setAging] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [shipments, setShipments] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lbSort, setLbSort] = useState({ key: 'deliveryRate', dir: 'desc' });
  const autoRefreshTimer = useRef(null);

  const setLoad = (key, val) => setLoading(l => ({ ...l, [key]: val }));

  const loadOverview = useCallback(async (f) => {
    setLoad('kpis', true); setLoad('trend', true); setLoad('funnel', true); setLoad('alerts', true);
    try {
      const [k, t, fn, al] = await Promise.all([
        fetchKPIs(f).catch(() => null),
        fetchTrend(f).catch(() => []),
        fetchFunnel(f).catch(() => null),
        fetchAlerts(f).catch(() => ({ alerts: [] })),
      ]);
      setKpis(k); setTrend(t || []); setFunnel(fn); setAlerts(al?.alerts || []);
      setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    } finally {
      setLoad('kpis', false); setLoad('trend', false); setLoad('funnel', false); setLoad('alerts', false);
    }
  }, []);

  const loadRto = useCallback(async (f) => {
    setLoad('rto', true);
    try { const d = await fetchRtoReasons(f).catch(() => []); setRtoReasons(d || []); }
    finally { setLoad('rto', false); }
  }, []);

  const loadAging = useCallback(async (f) => {
    setLoad('aging', true);
    try { const d = await fetchAging(f).catch(() => null); setAging(d); }
    finally { setLoad('aging', false); }
  }, []);

  const loadLeaderboard = useCallback(async (f) => {
    setLoad('lb', true);
    try { const d = await fetchLeaderboard(f).catch(() => []); setLeaderboard(d || []); }
    finally { setLoad('lb', false); }
  }, []);

  const loadShipments = useCallback(async (f) => {
    setLoad('ships', true);
    try { const d = await fetchShipments(f).catch(() => null); setShipments(d); }
    finally { setLoad('ships', false); }
  }, []);

  // Load on tab/filter change
  useEffect(() => {
    if (activeTab === 'overview') loadOverview(filters);
    else if (activeTab === 'rto') loadRto(filters);
    else if (activeTab === 'aging') loadAging(filters);
    else if (activeTab === 'leaderboard') loadLeaderboard(filters);
    else if (activeTab === 'shipments') loadShipments({ ...filters, ...shipmentFilters });
  }, [activeTab, filters]);

  useEffect(() => {
    if (activeTab === 'shipments') loadShipments({ ...filters, ...shipmentFilters });
  }, [shipmentFilters]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      autoRefreshTimer.current = setInterval(() => {
        if (activeTab === 'overview') loadOverview(filters);
      }, 30000);
    }
    return () => clearInterval(autoRefreshTimer.current);
  }, [autoRefresh, activeTab, filters]);

  const handleFilterChange = useCallback((key, val) => {
    setFilters(f => ({ ...f, [key]: val }));
  }, []);

  const handleShipmentFilterChange = useCallback((key, val) => {
    setShipmentFilters(f => ({ ...f, [key]: val, ...(key !== 'page' ? { page: 1 } : {}) }));
  }, []);

  const handleRefresh = () => {
    if (activeTab === 'overview') loadOverview(filters);
    else if (activeTab === 'rto') loadRto(filters);
    else if (activeTab === 'aging') loadAging(filters);
    else if (activeTab === 'leaderboard') loadLeaderboard(filters);
    else if (activeTab === 'shipments') loadShipments({ ...filters, ...shipmentFilters });
  };

  // Leaderboard sort
  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    const va = a[lbSort.key]; const vb = b[lbSort.key];
    return lbSort.dir === 'asc' ? va - vb : vb - va;
  });
  const handleLbSort = (key) => setLbSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));

  // CSV Export
  const handleExportCsv = () => {
    const rows = shipments?.shipments || [];
    if (!rows.length) return;
    const headers = ['AWB', 'Customer', 'City', 'State', 'Courier', 'Status', 'Platform', 'Order Date', 'Attempts', 'Amount'];
    const csv = [
      headers.join(','),
      ...rows.map(r => [
        r.awb_code, r.billing_customer_name, r.billing_city, r.billing_state,
        r.courier_name, r.status, r.platform,
        r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '',
        r.delivery_attempt, r.sub_total,
      ].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `shipments_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // KPI cards config
  const kpiCards = kpis ? [
    { key: 'totalShipments', label: 'Total Shipments', color: STATUS_COLORS.totalShipments, formatter: fmtNum, subtext: 'Orders dispatched this month' },
    { key: 'verified', label: 'Verified', color: STATUS_COLORS.verified, formatter: fmtNum },
    { key: 'inTransit', label: 'In Transit', color: STATUS_COLORS.inTransit, formatter: fmtNum },
    { key: 'ofd', label: 'Out for Delivery', color: STATUS_COLORS.ofd, formatter: fmtNum },
    { key: 'delivered', label: 'Delivered', color: STATUS_COLORS.delivered, formatter: fmtNum },
    { key: 'undelivered', label: 'Undelivered', color: STATUS_COLORS.undelivered, formatter: fmtNum },
    { key: 'rto', label: 'RTO', color: STATUS_COLORS.rto, formatter: fmtNum },
    { key: 'rtoIntersite', label: 'RTO Intersite', color: STATUS_COLORS.rtoIntersite, formatter: fmtNum },
    ...( ['admin', 'manager', 'support', 'logistics'].includes(user?.role?.toLowerCase()) ? [
      { key: 'blDelivered', label: 'Old Delivered', color: STATUS_COLORS.oldDelivered, formatter: fmtNum, subtext: 'Previous month orders delivered this month' },
      { key: 'blUndelivered', label: 'Old Undelivered', color: STATUS_COLORS.undelivered, formatter: fmtNum },
      { key: 'blRto', label: 'Old RTO', color: STATUS_COLORS.rto, formatter: fmtNum },
      { key: 'blRtoIntersite', label: 'Old RTO Intersite', color: STATUS_COLORS.rtoIntersite, formatter: fmtNum }
    ] : [] ),
    { key: 'ndrRate', label: 'NDR Rate', color: '#f59e0b', formatter: fmtPct },
    { key: 'fadr', label: 'First Attempt Delivery', color: '#10b981', formatter: fmtPct },
    { key: 'avgTat', label: 'Avg TAT', color: '#6366f1', formatter: fmtDays },
  ] : [];

  // Spark data from trend
  const sparkFor = (key) => trend.slice(-14).map(d => d[key] || 0);

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f0', fontFamily: "'Inter', sans-serif" }}>
      {/* Print styles injected */}
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-break { page-break-after: always; }
        }
        @media (max-width: 768px) {
          .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .filter-bar { flex-direction: column !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px' }}>
        {/* Header */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif", letterSpacing: -0.5 }}>
                📦 {['admin', 'manager'].includes(user?.role) ? 'Ops Dashboard' : 'My Ops Dashboard'}
              </h1>
              {!['admin', 'manager'].includes(user?.role) && (
                <span style={{
                  background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d',
                  borderRadius: 8, fontSize: 11, fontWeight: 700, padding: '3px 10px',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  👤 My Data Only
                </span>
              )}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
              {['admin', 'manager'].includes(user?.role)
                ? 'All shipments — company-wide view'
                : `Showing only your verified shipments — ${user?.name || user?.role}`}
            </p>
          </div>
        </div>

        {/* Alert banners */}
        <AlertBanner alerts={alerts} />

        {/* Filter bar */}
        <div className="no-print">
          <FilterBar filters={filters} onChange={handleFilterChange} lastUpdated={lastUpdated}
            onRefresh={handleRefresh} autoRefresh={autoRefresh} onToggleAutoRefresh={() => setAutoRefresh(v => !v)} />
        </div>

        {/* Tabs */}
        <div className="no-print" style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#fff', borderRadius: 12, padding: 4, border: '1px solid rgba(0,0,0,0.06)', width: 'fit-content' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: '8px 18px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: activeTab === t.id ? '#16a34a' : 'transparent',
              color: activeTab === t.id ? '#fff' : '#64748b',
              transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* KPI Grid */}
            <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
              {loading.kpis
                ? Array.from({ length: ['admin', 'manager', 'support'].includes(user?.role?.toLowerCase()) ? 12 : 11 }).map((_, i) => <Skeleton key={i} h={130} />)
                : kpiCards.map(card => (
                  <KpiCard key={card.key} label={card.label} color={card.color} formatter={card.formatter}
                    value={kpis?.kpis?.[card.key]?.value}
                    change={kpis?.kpis?.[card.key]?.change}
                    sparkData={sparkFor(card.key)}
                    icon={kpiIcons[card.key]}
                    subtext={card.subtext}
                    onClick={['ndrRate', 'fadr', 'avgTat'].includes(card.key) ? undefined : () => {
                      setActiveTab('shipments'); 
                      handleShipmentFilterChange('status', card.key === 'totalShipments' ? '' : card.key); 
                    }}
                  />
                ))
              }
            </div>

            {/* Trend + Funnel row */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
              <SectionCard title="Shipment Trend" subtitle="Daily breakdown over the selected period">
                {loading.trend ? <Skeleton h={200} /> : <TrendChart data={trend} />}
              </SectionCard>
              <SectionCard title="Delivery Funnel" subtitle="Verified → OFD → Outcome">
                {loading.funnel ? <Skeleton h={200} /> : <FunnelChart data={funnel} />}
              </SectionCard>
            </div>
          </div>
        )}

        {/* ── RTO Reasons Tab ── */}
        {activeTab === 'rto' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <SectionCard title="RTO Reason Breakdown" subtitle="Why shipments are being returned">
              {loading.rto ? <Skeleton h={200} /> : <DonutChart reasons={rtoReasons} />}
            </SectionCard>
            <SectionCard title="Reason Details">
              {loading.rto ? <Skeleton h={200} /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {rtoReasons.length ? rtoReasons.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < rtoReasons.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: RTO_REASON_COLORS[i] || '#94a3b8', flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13, color: '#374151', fontWeight: 600 }}>{r.reason}</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{r.count}</span>
                    </div>
                  )) : <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 32 }}>No RTO reason data available</div>}
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {/* ── Aging Tab ── */}
        {activeTab === 'aging' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionCard title="🕐 OFD > 2 Days" subtitle="Shipments stuck out-for-delivery for over 48 hours">
              {loading.aging ? <Skeleton h={120} /> : <AgingTable rows={aging?.ofd_stuck || []} title="OFD Stuck" color={STATUS_COLORS.ofd} emptyMsg="No OFD-stuck shipments 🎉" />}
            </SectionCard>
            <SectionCard title="🔄 Undelivered — 3+ Attempts" subtitle="Shipments that have failed delivery 3 or more times">
              {loading.aging ? <Skeleton h={120} /> : <AgingTable rows={aging?.undelivered_3plus || []} title="3+ Attempts" color={STATUS_COLORS.undelivered} emptyMsg="No high-attempt shipments 🎉" />}
            </SectionCard>
            <SectionCard title="🚚 RTO Intersite > 5 Days" subtitle="Return-in-transit shipments stuck for over 5 days">
              {loading.aging ? <Skeleton h={120} /> : <AgingTable rows={aging?.rto_intersite_stuck || []} title="RTO Intersite Stuck" color={STATUS_COLORS.rtoIntersite} emptyMsg="No stuck RTO intersite shipments 🎉" />}
            </SectionCard>
          </div>
        )}

        {/* ── Leaderboard Tab ── */}
        {activeTab === 'leaderboard' && (
          <SectionCard title="🏆 Courier Leaderboard" subtitle="Ranked by delivery success rate — click column headers to sort">
            {loading.lb ? <Skeleton h={300} /> : <LeaderboardTable rows={sortedLeaderboard} sortKey={lbSort.key} sortDir={lbSort.dir} onSort={handleLbSort} />}
          </SectionCard>
        )}

        {/* ── Shipments Tab ── */}
        {activeTab === 'shipments' && (
          <SectionCard title="📋 Shipment Detail" subtitle="All shipments with full filtering and export">
            {loading.ships ? <Skeleton h={400} /> : (
              <ShipmentsTable data={shipments} filters={shipmentFilters} onFilterChange={handleShipmentFilterChange} onExportCsv={handleExportCsv} />
            )}
          </SectionCard>
        )}
      </div>
    </div>
  );
}
