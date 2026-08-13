import { Search, Briefcase, Inbox, Phone, ClipboardList, BellOff, Clock, Star, MessageSquare, Circle, Flame, Zap, CheckCircle2, DollarSign, Headphones, Truck, Stethoscope, Users, User, Package, RefreshCcw, AlertTriangle, ChevronRight, Activity, Calendar } from 'lucide-react';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import API from '../api';

/* ─── Helpers & Formatting ─────────────────────────────────────────────── */
const fmtNum = (n) => {
  if (n === null || n === undefined) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
};
const fmtPct = (n) => (n === null || n === undefined ? '—' : `${n}%`);
const fmtCurr = (n) => (n === null || n === undefined ? '—' : `₹${fmtNum(n)}`);

/* ─── Sparkline (mini SVG line) ──────────────────────────────────────────── */
function Sparkline({ data = [], color = '#16a34a', height = 28 }) {
  if (data.length <= 1) return null;
  const safeData = data.map(v => (typeof v === 'number' && !isNaN(v)) ? v : 0);
  const max = Math.max(...safeData, 1);
  const w = 80; const h = height;
  const pts = safeData.map((v, i) => `${(i / (safeData.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── KPI Card Component ─────────────────────────────────────────────────── */
function KpiCard({ label, value, color, formatter = fmtNum, sparkData = [], subtext, unit, onClick, footerNode }) {
  const unitLabel = unit !== undefined ? unit
    : formatter === fmtPct ? 'Rate'
    : formatter === fmtCurr ? 'Revenue'
    : 'Orders';

  return (
    <div
      onClick={onClick}
      className="group relative overflow-hidden transition-all duration-300 ease-out active:scale-95 flex flex-col justify-between"
      style={{
        background: `linear-gradient(135deg, ${color}0A, ${color}14)`,
        border: `1px solid ${color}25`,
        borderRadius: 16, padding: '20px', cursor: onClick ? 'pointer' : 'default',
        boxShadow: `0 4px 12px -2px ${color}15`,
        minHeight: 120,
        height: '100%',
      }}
      onMouseEnter={e => { 
        e.currentTarget.style.boxShadow = `0 8px 24px -4px ${color}40`; 
        e.currentTarget.style.transform = 'translateY(-4px)'; 
        e.currentTarget.style.borderColor = `${color}40`;
      }}
      onMouseLeave={e => { 
        e.currentTarget.style.boxShadow = `0 4px 12px -2px ${color}15`; 
        e.currentTarget.style.transform = 'none'; 
        e.currentTarget.style.borderColor = `${color}25`;
      }}
    >
      <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700 pointer-events-none" style={{ background: color, opacity: 0.1 }}></div>
      <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', zIndex: 10, width: '100%', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}>{label}</div>
            {subtext && <div title={subtext} style={{ fontSize: 10, background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(4px)', color: '#64748b', padding: '2px 6px', borderRadius: 4, cursor: 'help' }}>ℹ</div>}
          </div>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }} className="group-hover:scale-110 transition-transform">
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }}></div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', position: 'relative', zIndex: 10, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: color, lineHeight: 1, letterSpacing: '-0.02em', textShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              {value !== undefined ? formatter(value) : <span style={{ opacity: .4, fontSize: 20 }}>—</span>}
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1, color }}>{unitLabel}</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            {sparkData && sparkData.length > 0 && <div style={{ width: 60 }}><Sparkline data={sparkData} color={color} /></div>}
          </div>
        </div>
      </div>
      
      {footerNode && (
        <div style={{ position: 'relative', zIndex: 10, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${color}20` }}>
          {footerNode}
        </div>
      )}
      
      <div className="absolute bottom-0 left-0 right-0 h-1 transition-opacity pointer-events-none group-hover:opacity-30" style={{ background: color, opacity: 0.15 }}></div>
    </div>
  );
}

/* ─── Section Card Component ─────────────────────────────────────────────── */
function SectionCard({ title, subtitle, children, action }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '22px 24px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ─── Global Filter Bar (OpsDashboard Style) ─────────────────────────────── */
const PRESETS = [
  { label: <><Star size={14} className="inline-block ml-1" />{" All Time"}</>, value: 'all' },
  { label: '📅 This Month', value: 'month' },
  { label: '⏰ Today', value: 'today' },
  { label: '📆 Yesterday', value: 'yesterday' },
  { label: '🔍 Custom', value: 'custom' },
];

const ROLES = [
  { label: <><Users size={14} className="inline-block mr-1" />{" All Teams"}</>, value: 'all' },
  { label: '💼 Sales Team', value: 'sales' },
  { label: <><Headphones size={14} className="inline-block mr-1" />{" Support Team"}</>, value: 'support' },
  { label: <><Truck size={14} className="inline-block mr-1" />{" Logistics Team"}</>, value: 'logistics' },
];

export default function StaffActivity() {
  // Filters
  const [period, setPeriod] = useState('today');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table', 'grid'
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Data states
  const [stats, setStats] = useState([]);
  const [deliveryMeta, setDeliveryMeta] = useState({ total: 0, attributed: 0, unattributed: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [staffOrdersData, setStaffOrdersData] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'new', 'old', 'rto'
  const autoRefreshTimer = useRef(null);

  const fetchStaffStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        preset: period,
        from: period === 'custom' ? fromDate : undefined,
        to: period === 'custom' ? toDate : undefined,
        _t: Date.now()
      };

      const res = await API.get('/dashboard/all-staff-stats', { params });
      const data = res.data?.data || {};
      const staffList = data.staffStats || (Array.isArray(data) ? data : []);

      const raw = staffList.filter(item => 
        item.user && ['sales', 'support', 'logistics'].includes(item.user.role)
      );
      setStats(raw);
      setDeliveryMeta({
        total: data._totalUniqueDelivered || 0,       // All delivered (matches ShipMaxx/Shiprocket)
        attributed: data._totalAttributed || 0,       // Orders linked to a staff member
        unattributed: data._totalUnattributed || 0,   // Orders with no staff link
        trueNew: data._totalTrueNew || 0,             // Actual 1st kit physical orders
        trueRepeat: data._totalTrueRepeat || 0,       // Actual 2nd+ kit physical orders
      });
      setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Error fetching staff activity:', err);
    } finally {
      setLoading(false);
    }
  }, [period, fromDate, toDate]);

  useEffect(() => {
    fetchStaffStats();
  }, [fetchStaffStats]);

  // Auto-refresh logic
  useEffect(() => {
    if (autoRefresh) {
      autoRefreshTimer.current = setInterval(() => fetchStaffStats(), 30000);
    } else {
      clearInterval(autoRefreshTimer.current);
    }
    return () => clearInterval(autoRefreshTimer.current);
  }, [autoRefresh, fetchStaffStats]);

  // Fetch specific user order details when drawer opens
  const openStaffDrawer = async (staffItem) => {
    setSelectedStaff(staffItem);
    setOrdersLoading(true);
    setActiveTab('all');
    try {
      const now = new Date();
      const res = await API.get('/dashboard/staff-delivery-stats', {
        params: {
          month: now.getMonth(),
          year: now.getFullYear(),
          userId: staffItem.user._id,
          preset: period,
          from: period === 'custom' ? fromDate : undefined,
          to: period === 'custom' ? toDate : undefined,
          _t: Date.now()
        }
      });
      setStaffOrdersData(res.data?.data || null);
    } catch (err) {
      console.error('Error fetching staff order breakdown:', err);
      setStaffOrdersData(null);
    } finally {
      setOrdersLoading(false);
    }
  };

  const closeDrawer = () => {
    setSelectedStaff(null);
    setStaffOrdersData(null);
  };

  // Filtered and searched staff list
  const filteredStaff = useMemo(() => {
    return stats.filter(s => {
      const u = s.user || {};
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (u.name || '').toLowerCase().includes(q);
        const phoneMatch = (u.phone || '').toLowerCase().includes(q);
        return nameMatch || phoneMatch;
      }
      return true;
    }).sort((a, b) => {
      // Sort by uniqueDeliveredCount (true individual delivery count, no double-counting)
      return (b.uniqueDeliveredCount || 0) - (a.uniqueDeliveredCount || 0);
    });
  }, [stats, roleFilter, searchQuery]);

  // Aggregate KPI summary
  const summary = useMemo(() => {
    let totalVerifications = 0;
    let totalNewDel = 0;
    let totalSalesOldDel = 0;
    let totalSupportReVer = 0;
    let totalRTO = 0;
    let totalWorkingHours = 0;

    filteredStaff.forEach(s => {
      totalVerifications += (s.verifiedCount || 0);
      totalNewDel += (s.newDeliveredCount || 0);
      if (s.user?.role === 'sales') {
        totalSalesOldDel += (s.salesOldDeliveredCount || 0);
      } else if (s.user?.role === 'support') {
        totalSupportReVer += (s.supportOldDeliveredCount || s.oldDeliveredCount || 0);
      }
      totalRTO += (s.rtoCount || 0);
      totalWorkingHours += (s.workingHours || 0);
    });

    // True total = ALL delivered orders from shipping platforms (deliveryMeta.total)
    // This matches what you see in ShipMaxx/Shiprocket exactly
    const totalDeliveries = deliveryMeta.total;
    const rtoRate = totalDeliveries + totalRTO > 0 
      ? Math.round((totalRTO / (totalDeliveries + totalRTO)) * 100) 
      : 0;
    const delRate = totalDeliveries + totalRTO > 0
      ? 100 - rtoRate
      : 100;

    return {
      totalStaff: filteredStaff.length,
      totalVerifications,
      totalNewDel,
      totalRepeatDel: totalSalesOldDel + totalSupportReVer,
      totalSalesOldDel,
      totalSupportReVer,
      totalUniqueDelivered: deliveryMeta.total,     // Real total matching shipping platform
      totalAttributed: deliveryMeta.attributed,     // Orders linked to a staff
      totalUnattributed: deliveryMeta.unattributed, // Orders with no staff link
      totalCommission: filteredStaff.reduce((sum, s) => sum + (s.commission || 0), 0),
      totalRTO,
      rtoRate,
      delRate,
      totalWorkingHours: Math.round(totalWorkingHours)
    };
  }, [filteredStaff, deliveryMeta]);

  const badge = (delCount, verifCount) => {
    if (delCount >= 10 || verifCount >= 30) return { bg: '#dcfce7', color: '#16a34a', label: '⭐ Excellent' };
    if (delCount >= 3 || verifCount >= 10) return { bg: '#fef9c3', color: '#ca8a04', label: '⚠ Average' };
    return { bg: '#f1f5f9', color: '#64748b', label: <><Clock size={14} className="inline-block ml-1" />{" Developing"}</> };
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f0', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @media print { .no-print { display: none !important; } body { background: white !important; } }
      `}</style>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px' }}>
        
        {/* Title & Quick Rate Highlights Header */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif", letterSpacing: -0.5 }}>
                <Zap size={12} className="inline-block mr-1" /> Staff Activity & Delivery Hub
              </h1>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
              Company-wide operational efficiency, verification throughput, and dual-attribution tracking for Sales & Support team members.
            </p>
          </div>
          
          {!loading && (
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1px solid #86efac', padding: '10px 18px', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', boxShadow: '0 2px 6px rgba(22,163,74,0.08)' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: 0.5 }}>New (1st Kit) Share</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#15803d', lineHeight: 1.1 }}>
                  {summary.totalNewDel} <span style={{ fontSize: 12, fontWeight: 700 }}>Orders <Star size={12} className="inline-block ml-1" /></span>
                </span>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: '1px solid #93c5fd', padding: '10px 18px', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', boxShadow: '0 2px 6px rgba(37,99,235,0.08)' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Delivered 📦</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#1d4ed8', lineHeight: 1.1 }}>
                  {summary.totalUniqueDelivered} <span style={{ fontSize: 12, fontWeight: 700 }}>Orders</span>
                </span>
                {summary.totalUnattributed > 0 && (
                  <span title={`${summary.totalUnattributed} order(s) not linked to any Sales/Support staff (lead assigned to manager/admin or no phone record)`}
                    style={{ fontSize: 10, color: '#64748b', fontWeight: 600, marginTop: 2 }}>
                    ⚠ {summary.totalUnattributed} unlinked
                  </span>
                )}
              </div>
              <div style={{ background: 'linear-gradient(135deg, #fef2f2, #fee2e2)', border: '1px solid #fca5a5', padding: '10px 18px', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', boxShadow: '0 2px 6px rgba(220,38,38,0.08)' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: 0.5 }}>RTO Impact Rate</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#b91c1c', lineHeight: 1.1 }}>
                  {summary.rtoRate}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Global Filter Bar (OpsDashboard Style) */}
        <div className="no-print" style={{
          background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 16,
          padding: '12px 16px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: 24,
        }}>
          {/* Period Presets */}
          <div style={{ display: 'flex', gap: 4, background: '#f8fafc', borderRadius: 10, padding: 3, border: '1px solid #e2e8f0' }}>
            {PRESETS.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)}
                style={{
                  padding: '6px 12px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  background: period === p.value ? '#16a34a' : 'transparent',
                  color: period === p.value ? '#fff' : '#64748b',
                  transition: 'all .15s',
                }}>{p.label}</button>
            ))}
          </div>

          {/* Role Filter Presets */}
          <div style={{ display: 'flex', gap: 4, background: '#f8fafc', borderRadius: 10, padding: 3, border: '1px solid #e2e8f0' }}>
            {ROLES.map(r => (
              <button key={r.value} onClick={() => setRoleFilter(r.value)}
                style={{
                  padding: '6px 12px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  background: roleFilter === r.value ? '#0f172a' : 'transparent',
                  color: roleFilter === r.value ? '#fff' : '#64748b',
                  transition: 'all .15s',
                }}>{r.label}</button>
            ))}
          </div>

          {/* Custom date range */}
          {period === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', padding: '2px 8px', borderRadius: 8, border: '1px solid #cbd5e1' }}>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, outline: 'none', background: 'transparent' }} />
              <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>to</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, outline: 'none', background: 'transparent' }} />
            </div>
          )}

          {/* Search Bar */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search staff name or phone..."
              style={{ padding: '6px 14px 6px 34px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 12, width: 220, fontWeight: 500, outline: 'none', background: '#f8fafc' }}
            />
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, opacity: 0.5 }}>🔍</span>
          </div>

          {/* Right Controls */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            {lastUpdated && <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Updated {lastUpdated}</span>}
            <button onClick={fetchStaffStats} title="Refresh Live Data" style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700 }}>
              <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              <span>Sync</span>
            </button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>
              <div onClick={() => setAutoRefresh(v => !v)} style={{
                width: 32, height: 18, borderRadius: 9, background: autoRefresh ? '#16a34a' : '#cbd5e1',
                position: 'relative', transition: 'background .2s', cursor: 'pointer', flexShrink: 0,
              }}>
                <div style={{ position: 'absolute', top: 2, left: autoRefresh ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
              </div>
              Auto-refresh
            </label>
            <button onClick={() => window.print()} title="Print Report" style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}>
              <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            </button>
          </div>
        </div>

        {/* KPI Cards Grid (OpsDashboard Style) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 24 }}>
          <KpiCard
            label="Active Staff"
            value={summary.totalStaff}
            color="#0f172a"
            unit="MEMBERS"
            subtext="Total sales and support team members active during this selected period"
            sparkData={[2, 4, summary.totalStaff]}
          />
          <KpiCard
            label="Verifications Done"
            value={summary.totalVerifications}
            color="#0891b2"
            unit="CONFIRMED"
            subtext="Total order verifications completed by team members"
            sparkData={[5, 10, summary.totalVerifications]}
          />
          <KpiCard
            label={<>New Deliveries <Star size={12} className="inline-block ml-1" /></>}
            value={summary.totalNewDel}
            color="#16a34a"
            unit="1ST KIT"
            subtext="First-time customers whose initial order was successfully delivered"
            sparkData={[3, 8, summary.totalNewDel]}
          />
          <KpiCard
            label={<>Repeat Deliveries <RefreshCcw size={12} className="inline-block ml-1" /></>}
            value={deliveryMeta.trueRepeat}
            color="#7c3aed"
            unit="PHYSICAL ORDERS"
            subtext="Actual number of physical repeat orders delivered"
            sparkData={[1, 5, deliveryMeta.trueRepeat]}
            footerNode={
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600 }}>
                <span style={{ color: '#6b7280' }}>Credits given:</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color: '#7c3aed' }} title="Attributed to original Sales Lead owner">Sales: {summary.totalSalesOldDel}</span>
                  <span style={{ color: '#059669' }} title="Re-verified and delivered by Support">Support: {summary.totalSupportReVer}</span>
                </div>
              </div>
            }
          />
          <KpiCard
            label="RTO Returns Impact"
            value={summary.totalRTO}
            color="#dc2626"
            unit="RETURNED"
            subtext="Unsuccessful shipments that resulted in Return to Origin (RTO)"
            sparkData={[0, 2, summary.totalRTO]}
          />
        </div>

        {/* Main Section Card & Leaderboard Table */}
        <SectionCard
          title="Staff Performance Leaderboard & Attribution Analysis"
          subtitle={`Ranked by total combined deliveries (New + Repeat). Showing data for ${filteredStaff.length} team members.`}
          action={
            <div style={{ display: 'flex', gap: 6, background: '#f8fafc', padding: '4px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <button
                onClick={() => setViewMode('table')}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  background: viewMode === 'table' ? '#0f172a' : 'transparent',
                  color: viewMode === 'table' ? '#fff' : '#64748b',
                  display: 'flex', alignItems: 'center', gap: 4, transition: 'all .15s'
                }}
              >
                <span>📑</span> Table View
              </button>
              <button
                onClick={() => setViewMode('grid')}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  background: viewMode === 'grid' ? '#0f172a' : 'transparent',
                  color: viewMode === 'grid' ? '#fff' : '#64748b',
                  display: 'flex', alignItems: 'center', gap: 4, transition: 'all .15s'
                }}
              >
                <span>📱</span> Cards View
              </button>
            </div>
          }
        >
          {loading ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p style={{ color: '#64748b', fontSize: 14, fontWeight: 700 }}>Syncing staff operational throughput...</p>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div style={{ padding: '50px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}><Inbox size={36} className="mx-auto text-slate-400 mb-2" /></div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#475569' }}>No matching team members found</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Try altering your period preset or role filters above.</div>
            </div>
          ) : viewMode === 'table' ? (
            /* LEADERBOARD TABLE VIEW (OpsDashboard Style) */
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9', background: '#f8fafc' }}>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>Rank</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>Staff Member</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>Role</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#64748b', fontSize: 11, textTransform: 'uppercase', textAlign: 'center' }}>Work Hrs</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#64748b', fontSize: 11, textTransform: 'uppercase', textAlign: 'center' }}>Verifications</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#16a34a', fontSize: 11, textTransform: 'uppercase', textAlign: 'center', background: '#f0fdf4' }}>New Del <Star size={12} className="inline-block ml-1" /> (1st)</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#7c3aed', fontSize: 11, textTransform: 'uppercase', textAlign: 'center', background: '#f5f3ff' }}>Repeat / Re-Ver <RefreshCcw size={12} className="inline-block ml-1" /> (2nd+)</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#64748b', fontSize: 11, textTransform: 'uppercase', textAlign: 'center' }}>Delivery Share %</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#dc2626', fontSize: 11, textTransform: 'uppercase', textAlign: 'center' }}>RTO <AlertTriangle size={14} className="inline-block ml-1 text-red-600" /></th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#64748b', fontSize: 11, textTransform: 'uppercase', textAlign: 'center' }}>Grade</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#64748b', fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const rolesOrder = ['sales', 'support', 'logistics', 'doctor', 'manager'];
                    const groups = {};
                    filteredStaff.forEach(row => {
                      const r = row.user?.role || 'other';
                      if (!groups[r]) groups[r] = [];
                      groups[r].push(row);
                    });

                    const elements = [];
                    [...rolesOrder, 'other'].forEach(role => {
                      if (!groups[role] || groups[role].length === 0) return;
                      
                      const roleDisplay = role === 'other' ? 'Other Staff' : `${role} Team`;
                      const roleIcon = role === 'sales' ? <DollarSign size={14} className="inline-block mr-1" /> : role === 'support' ? <Headphones size={14} className="inline-block mr-1" /> : role === 'logistics' ? <Truck size={14} className="inline-block mr-1" /> : role === 'doctor' ? <Stethoscope size={14} className="inline-block mr-1" /> : role === 'manager' ? <User size={14} className="inline-block mr-1" /> : <Users size={14} className="inline-block mr-1" />;
                      
                      elements.push(
                        <tr key={`header-perf-${role}`} style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                          <td colSpan="11" style={{ padding: '10px 14px', fontWeight: 900, color: '#0f172a', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>
                            {roleIcon} {roleDisplay}
                          </td>
                        </tr>
                      );

                      groups[role].forEach((row) => {
                        const u = row.user || {};
                        const isSupport = u.role === 'support' || u.role === 'logistics';
                        const newDel = row.newDeliveredCount || 0;
                        const oldDel = isSupport 
                          ? (row.supportOldDeliveredCount || row.oldDeliveredCount || 0) 
                          : (row.salesOldDeliveredCount || 0);
                        const verif = row.verifiedCount || 0;
                        const rto = row.rtoCount || 0;
                        const totalDel = newDel + oldDel;
                        
                        // Progress percentage relative to maximum deliveries on leaderboard
                        const maxDel = Math.max(...filteredStaff.map(s => (s.newDeliveredCount || 0) + (s.user?.role === 'support' ? (s.supportOldDeliveredCount || 0) : (s.salesOldDeliveredCount || 0))), 1);
                        const progRate = Math.round((totalDel / maxDel) * 100);
                        const b = badge(totalDel, verif);

                        elements.push(
                          <tr key={u._id} style={{ borderBottom: '1px solid #f8fafc', transition: 'background .15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <td style={{ padding: '14px 14px', fontWeight: 800, color: '#94a3b8', fontSize: 14 }}>
                              #{filteredStaff.findIndex(s => s.user?._id === u._id) + 1}
                            </td>
                            <td style={{ padding: '14px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                  width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontWeight: 800, color: '#fff', fontSize: 14,
                                  background: isSupport ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                  boxShadow: isSupport ? '0 2px 6px rgba(139,92,246,0.3)' : '0 2px 6px rgba(59,130,246,0.3)'
                                }}>
                                  {(u.name?.[0] || '?').toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 14 }}>{u.name}</div>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>{u.phone || 'No phone recorded'}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '14px 14px' }}>
                              <span style={{
                                background: isSupport ? '#f3e8ff' : '#eff6ff', color: isSupport ? '#7e22ce' : '#1d4ed8',
                                padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800, textTransform: 'uppercase'
                              }}>
                                {u.role}
                              </span>
                            </td>
                            <td style={{ padding: '14px 14px', textAlign: 'center', fontWeight: 700, color: '#374151' }}>
                              {(row.workingHours || 0).toFixed(1)} hrs
                            </td>
                            <td style={{ padding: '14px 14px', textAlign: 'center', fontWeight: 800, color: verif > 0 ? '#0891b2' : '#94a3b8', fontSize: 15 }}>
                              {verif}
                            </td>
                            <td style={{ padding: '14px 14px', textAlign: 'center', background: '#f0fdf4' }}>
                              <div style={{ fontWeight: 900, color: newDel > 0 ? '#16a34a' : '#94a3b8', fontSize: 16 }}>{newDel}</div>
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>{isSupport ? <>New Assisted</> : <>{"First Kit "}<Star size={12} className="inline-block ml-1" /></>}</span>
                            </td>
                            <td style={{ padding: '14px 14px', textAlign: 'center', background: '#f5f3ff' }}>
                              <div style={{ fontWeight: 900, color: oldDel > 0 ? '#7c3aed' : '#94a3b8', fontSize: 16 }}>{oldDel}</div>
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' }}>{isSupport ? <>{"Re-Verification "}<RefreshCcw size={12} className="inline-block ml-1" /></> : <>{"Old Reorder "}<RefreshCcw size={12} className="inline-block ml-1" /></>}</span>
                            </td>
                            <td style={{ padding: '14px 14px', textAlign: 'center', minWidth: 120 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                                <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 4, height: 8, width: 60, overflow: 'hidden' }}>
                                  <div style={{ width: `${progRate}%`, height: '100%', background: isSupport ? '#8b5cf6' : '#16a34a', borderRadius: 4 }} />
                                </div>
                                <span style={{ fontWeight: 800, color: '#0f172a', fontSize: 12 }}>{totalDel}</span>
                              </div>
                            </td>
                            <td style={{ padding: '14px 14px', textAlign: 'center', fontWeight: 800, color: rto > 0 ? '#dc2626' : '#94a3b8', fontSize: 14 }}>
                              {rto}
                            </td>
                            <td style={{ padding: '14px 14px', textAlign: 'center' }}>
                              <span style={{ background: b.bg, color: b.color, padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', display: 'inline-block' }}>
                                {b.label}
                              </span>
                            </td>
                            <td style={{ padding: '14px 14px', textAlign: 'right' }}>
                              <button
                                onClick={() => openStaffDrawer(row)}
                                style={{
                                  padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff',
                                  color: '#2563eb', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                              >
                                Inspect Orders <ChevronRight size={14} className="inline-block ml-1" />
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    });

                    return elements;
                  })()}
                </tbody>
              </table>
            </div>
          ) : (
            /* GRID CARDS VIEW (OpsDashboard Style) */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 20 }}>
              {filteredStaff.map((row, idx) => {
                const u = row.user || {};
                const isSupport = u.role === 'support' || u.role === 'logistics';
                const newDel = row.newDeliveredCount || 0;
                const oldDel = isSupport 
                  ? (row.supportOldDeliveredCount || row.oldDeliveredCount || 0) 
                  : (row.salesOldDeliveredCount || 0);
                const verif = row.verifiedCount || 0;
                const rto = row.rtoCount || 0;
                const b = badge(newDel + oldDel, verif);

                return (
                  <div key={u._id} style={{
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '20px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', justifyBetween: 'space-between',
                    transition: 'all .2s'
                  }} className="hover:shadow-md hover:border-slate-300">
                    <div>
                      {/* Top profile Header */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyBetween: 'space-between', gap: 12, marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                          <div style={{
                            width: 46, height: 46, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, color: '#fff', fontSize: 18,
                            background: isSupport ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                            boxShadow: isSupport ? '0 4px 12px rgba(139,92,246,0.25)' : '0 4px 12px rgba(59,130,246,0.25)'
                          }}>
                            {(u.name?.[0] || '?').toUpperCase()}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8' }}>#{idx + 1}</span>
                              <span style={{ fontWeight: 800, color: '#0f172a', fontSize: 16 }}>{u.name}</span>
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{u.phone || 'No phone'}</div>
                          </div>
                        </div>
                        <span style={{ background: b.bg, color: b.color, padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>
                          {b.label}
                        </span>
                      </div>

                      {/* Stats Pills Box */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: '#f8fafc', padding: '12px', borderRadius: 12, border: '1px solid #f1f5f9', marginBottom: 16 }}>
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Verifications</span>
                          <span style={{ fontSize: 18, fontWeight: 900, color: '#0891b2' }}>{verif} <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>DONE</span></span>
                        </div>
                        <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: 10 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Working Time</span>
                          <span style={{ fontSize: 18, fontWeight: 900, color: '#3b82f6' }}>{(row.workingHours || 0).toFixed(1)} <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>HRS</span></span>
                        </div>
                      </div>

                      {/* Delivery Attribution Highlights Box */}
                      <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e1b4b)', color: '#fff', borderRadius: 14, padding: '16px', marginBottom: 16, boxShadow: '0 4px 12px rgba(15,23,42,0.15)' }}>
                        <div style={{ display: 'flex', justifyBetween: 'space-between', alignItems: 'center', fontSize: 11, fontWeight: 800, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                          <span>Attribution Scorecard</span>
                          <span style={{ color: '#4ade80' }}>Live Ratio</span>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, textAlign: 'center' }}>
                          <div style={{ background: 'rgba(255,255,255,0.08)', padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)' }}>
                            <span style={{ fontSize: 24, fontWeight: 900, color: '#4ade80', display: 'block' }}>{newDel}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase' }}>{isSupport ? <>New Assisted</> : <>{"1st Kit (New) "}<Star size={12} className="inline-block ml-1" /></>}</span>
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.08)', padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)' }}>
                            <span style={{ fontSize: 24, fontWeight: 900, color: '#c084fc', display: 'block' }}>{oldDel}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase' }}>{isSupport ? <>{"Re-Verifications "}<RefreshCcw size={12} className="inline-block ml-1" /></> : <>{"2nd+ Kit (Old) "}<RefreshCcw size={12} className="inline-block ml-1" /></>}</span>
                          </div>
                        </div>

                        {rto > 0 && (
                          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyBetween: 'space-between', alignItems: 'center', fontSize: 12, color: '#fca5a5', fontWeight: 700 }}>
                            <span>RTO Returns Impact:</span>
                            <span style={{ background: 'rgba(220,38,38,0.25)', padding: '2px 8px', borderRadius: 6, color: '#f87171' }}>{rto} Returned</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => openStaffDrawer(row)}
                      style={{
                        width: '100%', padding: '12px', background: '#1e293b', color: '#fff', border: 'none',
                        borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
                        boxShadow: '0 2px 8px rgba(15,23,42,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#0f172a'}
                      onMouseLeave={e => e.currentTarget.style.background = '#1e293b'}
                    >
                      <span>Inspect Complete Shipment Records</span>
                      <span><ChevronRight size={14} className="inline-block ml-1" /></span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Lead Calling & Conversion Monitor Section */}
        <SectionCard
          title={<><Phone size={20} className="inline-block mr-2" /> Lead Calling & Conversion Monitor (Sales & Follow-Up Tracking)</>}
          subtitle="Comprehensive monitoring of assigned leads, CNP (Could Not Pick) moves, Call Again schedules, Interested markers, and comments added per staff member."
        >
          {loading ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p style={{ color: '#64748b', fontSize: 14, fontWeight: 700 }}>Loading calling activities and lead conversion metrics...</p>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div style={{ padding: '50px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}><Inbox size={36} className="mx-auto text-slate-400 mb-2" /></div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#475569' }}>No calling activity found for this filter</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9', background: '#f8fafc' }}>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>Rank</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>Staff Member</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>Role</th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#2563eb', fontSize: 11, textTransform: 'uppercase', textAlign: 'center', background: '#eff6ff' }}>Tasks / Verifications <ClipboardList size={14} className="inline-block ml-1" /></th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#ea580c', fontSize: 11, textTransform: 'uppercase', textAlign: 'center', background: '#fff7ed' }}>CNP (Could Not Pick) <BellOff size={14} className="inline-block ml-1" /></th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#d97706', fontSize: 11, textTransform: 'uppercase', textAlign: 'center', background: '#fef3c7' }}>Call Again (Follow-Up) <Clock size={14} className="inline-block ml-1" /></th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#16a34a', fontSize: 11, textTransform: 'uppercase', textAlign: 'center', background: '#f0fdf4' }}>Interested Marked <Star size={14} className="inline-block ml-1" /></th>
                    <th style={{ padding: '12px 14px', fontWeight: 800, color: '#64748b', fontSize: 11, textTransform: 'uppercase', textAlign: 'center' }}>Calling Efficiency</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const sortedStaff = [...filteredStaff].sort((a, b) => ((b.tasksAssigned || 0) + (b.commentsCount || 0)) - ((a.tasksAssigned || 0) + (a.commentsCount || 0)));
                    const rolesOrder = ['sales', 'support', 'logistics', 'doctor', 'manager'];
                    const groups = {};
                    sortedStaff.forEach(row => {
                      const r = row.user?.role || 'other';
                      if (!groups[r]) groups[r] = [];
                      groups[r].push(row);
                    });

                    const elements = [];
                    [...rolesOrder, 'other'].forEach(role => {
                      if (!groups[role] || groups[role].length === 0) return;
                      
                      const roleDisplay = role === 'other' ? 'Other Staff' : `${role} Team`;
                      const roleIcon = role === 'sales' ? <DollarSign size={14} className="inline-block mr-1" /> : role === 'support' ? <Headphones size={14} className="inline-block mr-1" /> : role === 'logistics' ? <Truck size={14} className="inline-block mr-1" /> : role === 'doctor' ? <Stethoscope size={14} className="inline-block mr-1" /> : role === 'manager' ? <User size={14} className="inline-block mr-1" /> : <Users size={14} className="inline-block mr-1" />;
                      
                      elements.push(
                        <tr key={`header-${role}`} style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                          <td colSpan="8" style={{ padding: '10px 14px', fontWeight: 900, color: '#0f172a', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>
                            {roleIcon} {roleDisplay}
                          </td>
                        </tr>
                      );

                      groups[role].forEach((row, idx) => {
                        const u = row.user || {};
                        const isSupport = u.role === 'support';
                        const tasksAssigned = row.tasksAssigned || 0;
                        const cnp = row.todayCnp || 0;
                        const cnpNotes = row.cnpComments || 0;
                        const callAgain = row.todayCallAgain || 0;
                        const callAgainNotes = row.callAgainComments || 0;
                        const interested = row.todayInterested || 0;
                        const interestedNotes = row.interestedComments || 0;
                        const comments = row.commentsCount || 0;

                        let effBadge = { label: <><Circle size={12} className="inline-block mr-1" />{" Idle"}</>, bg: '#f1f5f9', color: '#64748b' };
                        if (comments > 500 || interested >= 20) effBadge = { label: <><Flame size={12} className="inline-block mr-1" />{" High Performance"}</>, bg: '#fef2f2', color: '#dc2626' };
                        else if (comments > 100 || interested >= 10 || tasksAssigned >= 50) effBadge = { label: <><Zap size={12} className="inline-block mr-1" />{" Active Caller"}</>, bg: '#f0fdf4', color: '#16a34a' };
                        else if (comments > 20 || tasksAssigned > 0) effBadge = { label: <><CheckCircle2 size={12} className="inline-block mr-1" />{" Active Standard"}</>, bg: '#fef3c7', color: '#d97706' };

                        elements.push(
                          <tr key={u._id} style={{ borderBottom: '1px solid #f8fafc', transition: 'background .15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <td style={{ padding: '14px 14px', fontWeight: 800, color: '#94a3b8', fontSize: 14 }}>
                              #{idx + 1}
                            </td>
                            <td style={{ padding: '14px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                  width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontWeight: 800, color: '#fff', fontSize: 14,
                                  background: isSupport ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                  boxShadow: isSupport ? '0 2px 6px rgba(139,92,246,0.3)' : '0 2px 6px rgba(59,130,246,0.3)'
                                }}>
                                  {(u.name?.[0] || '?').toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 14 }}>{u.name}</div>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>{u.phone || 'No phone recorded'}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '14px 14px' }}>
                              <span style={{
                                background: isSupport ? '#f3e8ff' : '#eff6ff', color: isSupport ? '#7e22ce' : '#1d4ed8',
                                padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800, textTransform: 'uppercase'
                              }}>
                                {u.role}
                              </span>
                            </td>
                            <td style={{ padding: '14px 14px', textAlign: 'center', background: '#eff6ff' }}>
                              <div style={{ fontWeight: 900, color: tasksAssigned > 0 ? '#2563eb' : '#94a3b8', fontSize: 18 }}>{tasksAssigned}</div>
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase' }}>{isSupport ? 'RE-VERIFICATIONS' : 'TASKS ASSIGNED'}</span>
                            </td>
                            <td style={{ padding: '14px 14px', textAlign: 'center', background: '#fff7ed' }}>
                              <div style={{ fontWeight: 900, color: cnp > 0 ? '#ea580c' : '#94a3b8', fontSize: 16 }}>{cnp} <span style={{ fontSize: 11, fontWeight: 700, color: '#9a3412' }}>Leads</span></div>
                              <div style={{ fontSize: 11, fontWeight: 800, color: '#c2410c', marginTop: 2, background: 'rgba(234,88,12,0.1)', padding: '2px 6px', borderRadius: 6, display: 'inline-block' }}>
                                <MessageSquare size={12} className="inline-block mr-1" /> {cnpNotes} CNP Notes
                              </div>
                            </td>
                            <td style={{ padding: '14px 14px', textAlign: 'center', background: '#fef3c7' }}>
                              <div style={{ fontWeight: 900, color: callAgain > 0 ? '#d97706' : '#94a3b8', fontSize: 16 }}>{callAgain} <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309' }}>Leads</span></div>
                              <div style={{ fontSize: 11, fontWeight: 800, color: '#b45309', marginTop: 2, background: 'rgba(217,119,6,0.1)', padding: '2px 6px', borderRadius: 6, display: 'inline-block' }}>
                                <MessageSquare size={12} className="inline-block mr-1" /> {callAgainNotes} Call Again Notes
                              </div>
                            </td>
                            <td style={{ padding: '14px 14px', textAlign: 'center', background: '#f0fdf4' }}>
                              <div style={{ fontWeight: 900, color: interested > 0 ? '#16a34a' : '#94a3b8', fontSize: 16 }}>{interested} <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d' }}>Leads</span></div>
                              <div style={{ fontSize: 11, fontWeight: 800, color: '#15803d', marginTop: 2, background: 'rgba(22,163,74,0.1)', padding: '2px 6px', borderRadius: 6, display: 'inline-block' }}>
                                <MessageSquare size={12} className="inline-block mr-1" /> {interestedNotes} Interested Notes
                              </div>
                            </td>
                            <td style={{ padding: '14px 14px', textAlign: 'center' }}>
                              <span style={{ background: effBadge.bg, color: effBadge.color, padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', display: 'inline-block' }}>
                                {effBadge.label}
                              </span>
                            </td>
                          </tr>
                        );
                      });
                    });

                    return elements;
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* Slide-Over Drawer for Staff Order Breakdown */}
        {selectedStaff && (
          <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm flex justify-end transition-opacity duration-300">
            <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col justify-between animate-slideLeft">
              
              {/* Drawer Header (OpsDashboard Executive Theme) */}
              <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #0f172a, #1e1b4b)', color: '#fff', display: 'flex', alignItems: 'center', justifyBetween: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                    {(selectedStaff.user?.name?.[0] || '?').toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{selectedStaff.user?.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#c4b5fd', marginTop: 2, fontWeight: 600 }}>
                      <span style={{ textTransform: 'uppercase', color: '#4ade80' }}>{selectedStaff.user?.role}</span>
                      <span>•</span>
                      <span>{selectedStaff.user?.phone || 'No Phone'}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={closeDrawer}
                  style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* Drawer Body - Tabs & Orders */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                {ordersLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 260, color: '#64748b' }}>
                    <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
                    <p style={{ fontWeight: 700, fontSize: 14 }}>Fetching real-time shipment records...</p>
                  </div>
                ) : !staffOrdersData ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 260, color: '#94a3b8' }}>
                    <div style={{ fontSize: 44, marginBottom: 8 }}>📦</div>
                    <p style={{ fontWeight: 700, fontSize: 15 }}>No delivery data found for this period.</p>
                  </div>
                ) : (
                  <div>
                    {/* Category Tabs */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px', background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                      {[
                        { id: 'all', label: 'All Delivered', count: staffOrdersData.deliveredOrders?.length || 0, commission: staffOrdersData.totalCommission || 0, color: '#2563eb', bg: '#eff6ff' },
                        { id: 'new', label: <>{"New (1st Kit) "}<Star size={12} className="inline-block ml-1" /></>, count: staffOrdersData.newDeliveredOrders?.length || 0, commission: staffOrdersData.newCommissionTotal || 0, color: '#16a34a', bg: '#f0fdf4' },
                        { id: 'old', label: <>{"Repeat / Re-Ver "}<RefreshCcw size={12} className="inline-block ml-1" /></>, count: staffOrdersData.oldDeliveredOrders?.length || 0, commission: staffOrdersData.oldCommissionTotal || 0, color: '#7c3aed', bg: '#f5f3ff' },
                        { id: 'rto', label: <>{"RTO Returns "}<AlertTriangle size={14} className="inline-block ml-1 text-red-600" /></>, count: staffOrdersData.rtoOrders?.length || 0, color: '#dc2626', bg: '#fef2f2' }
                      ].map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                              flex: 1, padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', transition: 'all .15s',
                              background: isActive ? '#0f172a' : 'transparent', color: isActive ? '#fff' : '#475569',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: 12
                            }}
                          >
                            <span>{tab.label}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{
                                fontSize: 13, fontWeight: 900, padding: '2px 8px', borderRadius: 20,
                                background: isActive ? 'rgba(255,255,255,0.2)' : tab.bg,
                                color: isActive ? '#fff' : tab.color
                              }}>
                                {tab.count}
                              </span>
                              {(tab.commission !== undefined) && (
                                <span style={{ fontSize: 11, fontWeight: 800, color: isActive ? '#4ade80' : '#059669', background: isActive ? 'rgba(74,222,128,0.2)' : '#d1fae5', padding: '2px 6px', borderRadius: 6 }}>
                                  ₹{tab.commission || 0}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Order List */}
                    {(() => {
                      let list = [];
                      if (activeTab === 'all') list = staffOrdersData.deliveredOrders || [];
                      else if (activeTab === 'new') list = staffOrdersData.newDeliveredOrders || [];
                      else if (activeTab === 'old') list = staffOrdersData.oldDeliveredOrders || [];
                      else if (activeTab === 'rto') list = staffOrdersData.rtoOrders || [];

                      if (list.length === 0) {
                        return (
                          <div style={{ background: '#fff', padding: '40px 20px', borderRadius: 16, border: '1px solid #e2e8f0', textAlign: 'center', color: '#94a3b8', margin: '24px 0' }}>
                            <div style={{ fontSize: 36, marginBottom: 8 }}><Inbox size={36} className="mx-auto text-slate-400 mb-2" /></div>
                            <p style={{ fontWeight: 800, fontSize: 15, color: '#475569', margin: 0 }}>No shipments in this category</p>
                            <p style={{ fontSize: 13, marginTop: 4 }}>This team member hasn't recorded deliveries under this filter yet.</p>
                          </div>
                        );
                      }

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {list.map((order) => (
                            <div key={order._id} style={{
                              background: '#fff', padding: '16px 18px', borderRadius: 14, border: '1px solid #e2e8f0',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', justifyBetween: 'space-between',
                              transition: 'all .15s'
                            }} className="hover:border-slate-300">
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span style={{ fontWeight: 800, color: '#0f172a', fontSize: 15 }}>{order.name}</span>
                                  <span style={{
                                    padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
                                    background: activeTab === 'rto' ? '#fee2e2' : '#dcfce7',
                                    color: activeTab === 'rto' ? '#dc2626' : '#16a34a'
                                  }}>
                                    {order.status || 'Delivered'}
                                  </span>
                                </div>
                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 10, fontWeight: 500 }}>
                                  <span>📱 {order.phone}</span>
                                  <span>•</span>
                                  <span>🏷️ AWB: <strong style={{ color: '#2563eb', fontFamily: 'monospace', fontSize: 13 }}>{order.awb || 'N/A'}</strong></span>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>₹{(Number(order.amount) || 0).toLocaleString('en-IN')}</div>
                                {(order.commission > 0) && (
                                  <div style={{ fontSize: 12, fontWeight: 800, color: '#059669', marginTop: 2 }}>
                                    + ₹{order.commission} Comm.
                                  </div>
                                )}
                                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginTop: 2 }}>
                                  {order.date ? new Date(order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date N/A'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              <div style={{ padding: '16px 24px', background: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyBetween: 'flex-end', justifyContent: 'flex-end' }}>
                <button
                  onClick={closeDrawer}
                  style={{ padding: '8px 20px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Close Panel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
