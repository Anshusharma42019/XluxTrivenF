import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const PER_PAGE = 20;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

function KpiCard({ label, value, colorHex, unit }) {
  return (
    <div
      className="group relative overflow-hidden transition-all duration-300 ease-out flex flex-col justify-between"
      style={{
        background: `linear-gradient(135deg, ${colorHex}0A, ${colorHex}14)`,
        border: `1px solid ${colorHex}25`,
        borderRadius: 16, padding: '20px',
        boxShadow: `0 4px 12px -2px ${colorHex}15`,
        minHeight: 120,
        height: '100%',
      }}
      onMouseEnter={e => { 
        e.currentTarget.style.boxShadow = `0 8px 24px -4px ${colorHex}40`; 
        e.currentTarget.style.transform = 'translateY(-4px)'; 
        e.currentTarget.style.borderColor = `${colorHex}40`;
      }}
      onMouseLeave={e => { 
        e.currentTarget.style.boxShadow = `0 4px 12px -2px ${colorHex}15`; 
        e.currentTarget.style.transform = 'none'; 
        e.currentTarget.style.borderColor = `${colorHex}25`;
      }}
    >
      <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700 pointer-events-none" style={{ background: colorHex, opacity: 0.1 }}></div>
      <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', zIndex: 10, width: '100%', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}>{label}</div>
          </div>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }} className="group-hover:scale-110 transition-transform">
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: colorHex, boxShadow: `0 0 8px ${colorHex}` }}></div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', position: 'relative', zIndex: 10, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: colorHex, lineHeight: 1, letterSpacing: '-0.02em', textShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              ₹{(value || 0).toLocaleString()}
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1, color: colorHex }}>{unit}</span>
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-1 transition-opacity pointer-events-none group-hover:opacity-30" style={{ background: colorHex, opacity: 0.15 }}></div>
    </div>
  );
}

export default function ReorderCommission() {
  const { user } = useAuth();
  const isAdmin = ['admin', 'superadmin'].includes(user?.role);

  // Settings
  const [settings, setSettings] = useState({
    commission_type: 'percent',
    reorder_commission_percent: 0,       // Staff B % of medicine price
    original_staff_commission_percent: 0, // Staff A % of medicine price
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Staff summary
  const [staffList, setStaffList] = useState([]);
  const [staffPayingId, setStaffPayingId] = useState(null);

  // Commission table
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ net_amount: 0, pending: 0, paid: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterStatus, setFilterStatus] = useState('');
  const [payingId, setPayingId] = useState(null);

  const loadSettings = useCallback(async () => {
    try {
      const res = await api.get('/commission/settings');
      if (res.data?.data) setSettings(s => ({ ...s, ...res.data.data }));
    } catch { /* keep defaults */ }
  }, []);

  const loadStaff = useCallback(async () => {
    try {
      const params = {};
      if (filterMonth !== '') params.month = filterMonth;
      if (filterYear !== '') params.year = filterYear;
      const res = await api.get('/commission/records/staff-summary', { params });
      setStaffList(res.data?.data || []);
    } catch { /* ignore */ }
  }, [filterMonth, filterYear]);

  const loadCommissions = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const params = { page: pg, per_page: PER_PAGE };
      if (filterMonth !== '') params.month = filterMonth;
      if (filterYear !== '') params.year = filterYear;
      if (filterStatus) params.status = filterStatus;
      const res = await api.get('/commission/records', { params });
      setData(res.data?.data?.data || []);
      setTotal(res.data?.data?.total || 0);
      setSummary(res.data?.data?.summary || { net_amount: 0, pending: 0, paid: 0 });
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [filterMonth, filterYear, filterStatus]);

  useEffect(() => { loadSettings(); }, [loadSettings]);
  useEffect(() => { 
    setPage(1);
    loadStaff(); 
    loadCommissions(1); 
  }, [loadStaff, loadCommissions, filterMonth, filterYear, filterStatus]);

  const saveSettings = async () => {
    setSaving(true); setSaveMsg('');
    try {
      await api.put('/commission/settings', settings);
      setSaveMsg(
        <div className="flex items-center justify-center gap-2">
          <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
          <span>Saved Successfully!</span>
        </div>
      );
      loadStaff();
      loadCommissions(page);
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e) {
      setSaveMsg(e?.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const addSlab = () => {
    const newSlab = { min_price: 0, max_price: null, reorder_commission_percent: 0, original_staff_commission_percent: 0 };
    setSettings(s => ({ ...s, price_slabs: [...(s.price_slabs || []), newSlab] }));
  };

  const removeSlab = (idx) => {
    setSettings(s => ({ ...s, price_slabs: s.price_slabs.filter((_, i) => i !== idx) }));
  };

  const updateSlab = (idx, field, val) => {
    const slabs = [...(settings.price_slabs || [])];
    slabs[idx] = { ...slabs[idx], [field]: val };
    setSettings(s => ({ ...s, price_slabs: slabs }));
  };

  const markStaffPaid = async (staffId) => {
    setStaffPayingId(staffId);
    try {
      const body = {};
      if (filterMonth !== '') body.month = Number(filterMonth);
      if (filterYear !== '') body.year = Number(filterYear);
      await api.post(`/commission/records/staff/${staffId}/pay-all`, body);
      loadStaff(); loadCommissions(page);
    } catch { /* ignore */ }
    finally { setStaffPayingId(null); }
  };

  const markPaid = async (id) => {
    setPayingId(id);
    try {
      await api.patch(`/commission/records/${id}/pay`);
      loadStaff(); loadCommissions(page);
    } catch { /* ignore */ }
    finally { setPayingId(null); }
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-10">

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 px-2">
        <div>
          <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-emerald-100">Performance Incentives</span>
          <h2 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tighter uppercase mt-2">Re-Order Commission</h2>
          <p className="text-sm font-bold text-gray-400 mt-1 uppercase tracking-widest">Incentives for Staff A & Staff B on follow-up re-orders</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-gray-100 shadow-sm">
             <span className={`w-2 h-2 rounded-full ${settings.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
             <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
               Status: {settings.is_active ? 'Active' : 'Disabled'}
             </span>
          </div>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2.5 rounded-2xl bg-gray-900 text-white shadow-xl hover:-translate-y-0.5 transition-all active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <KpiCard label="Total Revenue Generated" value={summary.net_amount || summary.total_amount} colorHex="#10b981" unit="REVENUE" />
        <KpiCard label="Pending Payout" value={summary.pending} colorHex="#f97316" unit="PENDING" />
        <KpiCard label="Paid Commission" value={summary.paid} colorHex="#3b82f6" unit="PAID" />
      </div>

      {/* ── Commission Settings (Expandable) ── */}
      {showSettings && (
        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-gray-900 px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">Commission Parameters</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">Configure global rates and calculation method</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Type Toggle */}
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                <button 
                  onClick={() => setSettings(s => ({ ...s, commission_type: 'percent' }))}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${settings.commission_type === 'percent' ? 'bg-white text-gray-900 shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >Percentage (%)</button>
                <button 
                  onClick={() => setSettings(s => ({ ...s, commission_type: 'flat' }))}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${settings.commission_type === 'flat' ? 'bg-white text-gray-900 shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >Flat Amount (₹)</button>
              </div>

              <button onClick={() => setShowSettings(false)} className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
          
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start mb-8">
              {/* Staff B */}
              <div className="relative group bg-purple-50/50 rounded-[2rem] p-6 border border-purple-100 transition-all hover:shadow-lg">
                <div className="absolute -top-3 left-6 px-3 py-1 bg-purple-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg">Global Staff B</div>
                <p className="text-xs font-bold text-gray-500 mb-4 mt-2">Default fallback {settings.commission_type === 'percent' ? 'percentage' : 'amount'}</p>
                <div className="flex items-center gap-4">
                  <span className="text-3xl font-black text-purple-300">{settings.commission_type === 'percent' ? '' : '₹'}</span>
                  <input
                    type="number" min="0"
                    value={settings.commission_type === 'percent' ? settings.reorder_commission_percent : settings.reorder_commission_amount}
                    onChange={e => setSettings(s => ({ 
                      ...s, 
                      [settings.commission_type === 'percent' ? 'reorder_commission_percent' : 'reorder_commission_amount']: e.target.value 
                    }))}
                    className="w-full border-2 border-purple-100 rounded-[1.5rem] px-6 py-4 text-3xl font-black text-purple-700 bg-white focus:outline-none focus:ring-4 focus:ring-purple-200 transition-all text-center"
                  />
                  <span className="text-3xl font-black text-purple-300">{settings.commission_type === 'percent' ? '%' : ''}</span>
                </div>
              </div>

              {/* Staff A */}
              <div className="relative group bg-blue-50/50 rounded-[2rem] p-6 border border-blue-100 transition-all hover:shadow-lg">
                <div className="absolute -top-3 left-6 px-3 py-1 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg">Global Staff A</div>
                <p className="text-xs font-bold text-gray-500 mb-4 mt-2">Default fallback {settings.commission_type === 'percent' ? 'percentage' : 'amount'}</p>
                <div className="flex items-center gap-4">
                  <span className="text-3xl font-black text-blue-300">{settings.commission_type === 'percent' ? '' : '₹'}</span>
                  <input
                    type="number" min="0"
                    value={settings.commission_type === 'percent' ? settings.original_staff_commission_percent : settings.original_staff_commission_amount}
                    onChange={e => setSettings(s => ({ 
                      ...s, 
                      [settings.commission_type === 'percent' ? 'original_staff_commission_percent' : 'original_staff_commission_amount']: e.target.value 
                    }))}
                    className="w-full border-2 border-blue-100 rounded-[1.5rem] px-6 py-4 text-3xl font-black text-blue-700 bg-white focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all text-center"
                  />
                  <span className="text-3xl font-black text-blue-300">{settings.commission_type === 'percent' ? '%' : ''}</span>
                </div>
              </div>

              {/* Action Column */}
              <div className="space-y-6 pt-6">
                <div className="flex items-center justify-between px-4 py-6 bg-gray-50 rounded-[2rem] border border-gray-100">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input type="checkbox" checked={settings.is_active}
                        onChange={e => setSettings(s => ({ ...s, is_active: e.target.checked }))}
                        className="sr-only" />
                      <div className={`w-12 h-7 rounded-full transition-colors ${settings.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${settings.is_active ? 'translate-x-5' : ''}`} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-900 uppercase tracking-widest">System Active</p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Enable/Disable incentives</p>
                    </div>
                  </label>
                  
                  <button onClick={saveSettings} disabled={saving}
                    className="ml-6 px-10 py-4 rounded-[1.25rem] text-[10px] font-black text-white uppercase tracking-widest disabled:opacity-50 transition-all hover:shadow-xl active:scale-95 shadow-lg shadow-emerald-500/20"
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                    {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
                {saveMsg && <div className="px-4">{saveMsg}</div>}
              </div>
            </div>

            {/* Price Slabs Management */}
            <div className="border-t border-gray-100 pt-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h4 className="text-lg font-black text-gray-900 tracking-tight">Price-Based Slabs (Auto-Lookup)</h4>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Define custom rates for specific price ranges</p>
                </div>
                <button onClick={addSlab} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
                  Add Slab
                </button>
              </div>

              <div className="space-y-3">
                {(settings.price_slabs || []).map((slab, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row md:items-center gap-4 bg-gray-50/50 p-4 rounded-3xl border border-gray-100 group transition-all hover:bg-white hover:shadow-lg">
                    <div className="flex items-center gap-2 min-w-[300px]">
                      <div className="flex-1">
                        <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Min Price</p>
                        <input type="number" value={slab.min_price} onChange={e => updateSlab(idx, 'min_price', e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs font-black text-gray-900" />
                      </div>
                      <div className="pt-4 text-gray-300">to</div>
                      <div className="flex-1">
                        <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Max Price</p>
                        <input type="number" value={slab.max_price === null ? '' : slab.max_price} 
                          placeholder="Infinity"
                          onChange={e => updateSlab(idx, 'max_price', e.target.value === '' ? null : e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs font-black text-gray-900" />
                      </div>
                    </div>

                    <div className="flex-1 flex items-center gap-4">
                      <div className="flex-1">
                        <p className="text-[8px] font-black text-purple-400 uppercase mb-1">Staff B %</p>
                        <input type="number" value={slab.reorder_commission_percent} onChange={e => updateSlab(idx, 'reorder_commission_percent', e.target.value)}
                          className="w-full bg-white border border-purple-100 rounded-xl px-4 py-2 text-xs font-black text-purple-700" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[8px] font-black text-blue-400 uppercase mb-1">Staff A %</p>
                        <input type="number" value={slab.original_staff_commission_percent} onChange={e => updateSlab(idx, 'original_staff_commission_percent', e.target.value)}
                          className="w-full bg-white border border-blue-100 rounded-xl px-4 py-2 text-xs font-black text-blue-700" />
                      </div>
                    </div>

                    <button onClick={() => removeSlab(idx)} className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                ))}
                {(!settings.price_slabs || settings.price_slabs.length === 0) && (
                  <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-3xl">
                    <p className="text-xs font-black text-gray-300 uppercase tracking-widest">No custom price slabs defined</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Staff Performance List ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xl font-black text-gray-900 tracking-tight">Staff Performance</h3>
          <span className="px-3 py-1 bg-gray-100 text-gray-500 text-[9px] font-bold uppercase tracking-widest rounded-full">{staffList.length} Active Staff</span>
        </div>

        {staffList.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] p-12 text-center border border-gray-100 shadow-sm">
             <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
               <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
             </div>
             <p className="text-sm font-black text-gray-400 uppercase tracking-widest">No staff performance data found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {staffList.map((s, i) => (
              <div key={String(s.staff_id)} className="group bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden flex flex-col">
                {/* Background Accent */}
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />

                <div className="relative z-10 flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-[1.25rem] bg-gray-900 flex items-center justify-center text-white text-lg font-black shadow-lg">
                      {(s.name || '?').split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()}
                    </div>
                    <div>
                      <p className="text-lg font-black text-gray-900 tracking-tight leading-none mb-1.5">{s.name || 'Unknown'}</p>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-gray-50 border border-gray-100 rounded-md text-[8px] font-black text-gray-500 uppercase tracking-widest">{s.role}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span className="text-[10px] font-bold text-gray-500">{s.original_count + s.reorder_count} Deliveries</span>
                      </div>
                    </div>
                  </div>

                  <div className={`flex items-center justify-center w-8 h-8 rounded-xl text-[10px] font-black shrink-0 ${
                    i === 0 ? 'bg-amber-100 text-amber-600' : 
                    i === 1 ? 'bg-gray-100 text-gray-500' : 
                    i === 2 ? 'bg-orange-100 text-orange-600' : 
                    'bg-gray-50 text-gray-400'
                  }`}>
                    #{i + 1}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px', background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                  {/* EARNED (Active style) */}
                  <div style={{ flex: 1, padding: '10px 4px', borderRadius: 10, background: '#0f172a', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: 11 }}>
                    <span>EARNED</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 900, padding: '2px 6px', borderRadius: 20, background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                        {s.original_count + s.reorder_count}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#4ade80', background: 'rgba(74,222,128,0.2)', padding: '2px 6px', borderRadius: 6 }}>
                        ₹{(s.total_amount || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  
                  {/* PAID */}
                  <div style={{ flex: 1, padding: '10px 4px', borderRadius: 10, background: 'transparent', color: '#475569', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: 11 }}>
                    <span>PAID</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#059669', background: '#d1fae5', padding: '2px 6px', borderRadius: 6 }}>
                        ₹{(s.paid_amount || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  
                  {/* PENDING */}
                  <div style={{ flex: 1, padding: '10px 4px', borderRadius: 10, background: 'transparent', color: '#475569', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: 11 }}>
                    <span>PENDING</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#ea580c', background: '#ffedd5', padding: '2px 6px', borderRadius: 6 }}>
                        ₹{(s.pending_amount || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 mt-auto">
                  {s.pending_amount > 0 ? (
                    <button onClick={() => markStaffPaid(String(s.staff_id))} disabled={staffPayingId === String(s.staff_id)}
                      className="w-full py-3.5 rounded-xl text-[10px] font-black text-white uppercase tracking-widest transition-all hover:shadow-lg hover:shadow-emerald-500/30 active:scale-95 flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                      {staffPayingId === String(s.staff_id) ? (
                        <>
                          <svg className="w-4 h-4 animate-spin text-white/70" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <span>Pay ₹{(s.pending_amount).toLocaleString()}</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="w-full py-3.5 rounded-xl text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 flex items-center justify-center gap-2 tracking-widest uppercase">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                      All Paid Up
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Unique Commission Ledger ── */}
      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden mb-12">
        <div className="bg-[#0f172a] px-10 py-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/30">
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
              </div>
              <div>
                <h3 className="text-2xl font-black text-white tracking-tight leading-none">Commission Ledger</h3>
                <p className="text-[10px] font-black text-emerald-500/60 uppercase tracking-[0.3em] mt-1.5">Verified Payout History & Audit Trail</p>
              </div>
            </div>
          </div>
          
          <div className="relative z-10 flex flex-wrap items-center gap-3">
            <button 
              onClick={async () => {
                setLoading(true);
                try {
                  await api.post('/shipmaxx/orders/sync');
                  await api.post('/shiprocket/orders/sync');
                  loadCommissions(1);
                  loadStaff();
                } catch (e) { alert(e?.response?.data?.message || 'Sync failed'); }
                finally { setLoading(false); }
              }}
              className="flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 transition-all active:scale-95 shadow-xl backdrop-blur-md"
            >
              <svg className={`w-3.5 h-3.5 text-emerald-400 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
              <span>Sync Now</span>
            </button>
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 backdrop-blur-md">
              <select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setPage(1); }}
                className="bg-transparent border-none rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-300 focus:outline-none focus:ring-0 cursor-pointer hover:text-white transition-colors">
                <option value="" className="bg-slate-900">Month</option>
                {MONTHS.map((m, i) => <option key={i} value={i} className="bg-slate-900">{m}</option>)}
              </select>
              <div className="w-px h-4 bg-white/10 my-auto" />
              <div className="flex items-center px-4 gap-2">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Year</span>
                <input type="number" placeholder="2026" value={filterYear} onChange={e => { setFilterYear(e.target.value); setPage(1); }}
                  className="w-16 bg-transparent border-none p-0 text-[10px] font-black uppercase tracking-widest text-gray-300 focus:outline-none focus:ring-0 placeholder:text-gray-600" />
              </div>
              <div className="w-px h-4 bg-white/10 my-auto" />
              <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                className="bg-transparent border-none rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-300 focus:outline-none focus:ring-0 cursor-pointer hover:text-white transition-colors">
                <option value="" className="bg-slate-900">Status</option>
                <option value="pending" className="bg-slate-900">Pending</option>
                <option value="paid" className="bg-slate-900">Paid</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-6">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-emerald-500/10 rounded-full animate-pulse" />
              </div>
            </div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] animate-pulse">Analyzing Financial Records...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="py-24 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            </div>
            <p className="text-base font-black text-gray-400 uppercase tracking-widest">No commissions found</p>
            <p className="text-xs text-gray-300 mt-2">Try adjusting your filters or wait for synced deliveries.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead>
                <tr className="bg-gray-50/50 text-gray-400 text-left">
                  <th className="py-5 px-8 font-black uppercase tracking-widest text-[10px]">Staff Member</th>
                  <th className="py-5 px-4 font-black uppercase tracking-widest text-[10px]">Context</th>
                  <th className="py-5 px-4 font-black uppercase tracking-widest text-[10px]">Customer</th>
                  <th className="py-5 px-4 font-black uppercase tracking-widest text-[10px] text-right">Order Sub-Total</th>
                  <th className="py-5 px-4 font-black uppercase tracking-widest text-[10px] text-right">Incentive</th>
                  <th className="py-5 px-4 font-black uppercase tracking-widest text-[10px] text-center">Status</th>
                  <th className="py-5 px-8 font-black uppercase tracking-widest text-[10px] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map(row => (
                  <tr key={row._id} className="hover:bg-emerald-50/30 transition-colors group">
                    <td className="py-6 px-8">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-xs font-black text-slate-500 border border-white shadow-sm group-hover:scale-110 transition-transform">
                          {(row.staff_id?.name || '?')[0]}
                        </div>
                        <div>
                          <p className="font-black text-gray-900 text-sm tracking-tight">{row.staff_id?.name || '—'}</p>
                          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest leading-none mt-0.5">{row.staff_id?.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-6 px-4">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${
                        row.entry_type === 'reversal' ? 'bg-red-50 text-red-600 border-red-100' :
                        row.commission_role === 'original' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-purple-50 text-purple-600 border-purple-100'
                      }`}>
                        {row.entry_type === 'reversal' ? 'Reversal / Correction' :
                         row.commission_role === 'original' ? '1st Delivery' : 'Re-Order'}
                      </span>
                    </td>
                    <td className="py-6 px-4">
                      <p className="font-black text-gray-700 text-sm tracking-tight leading-none">{row.lead_id?.name || row.order_id?.billing_customer_name || '—'}</p>
                      <p className="text-[10px] text-gray-400 font-medium mt-1 leading-none">{row.lead_id?.phone || ''}</p>
                    </td>
                    <td className="py-6 px-4 text-right">
                      <span className="font-black text-gray-900 font-mono">₹{row.order_sub_total?.toLocaleString()}</span>
                    </td>
                    <td className="py-6 px-4 text-right">
                      <span className={`font-black text-lg tracking-tighter ${row.commission_amount < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {row.commission_amount < 0 ? '-' : ''}₹{Math.abs(row.commission_amount || 0).toLocaleString()}
                      </span>
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter mt-0.5">{row.commission_type}</p>
                    </td>
                    <td className="py-6 px-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                          row.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-orange-50 text-orange-600 border border-orange-100'
                        }`}>{row.status}</span>
                        <span className="text-[7px] font-black text-gray-400 uppercase mt-1 tracking-tighter">
                          Order: {row.order_id?.status || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="py-6 px-8 text-right">
                      {row.entry_type === 'reversal' ? (
                        <span className="text-[10px] font-black uppercase tracking-widest text-red-500 bg-red-50 px-2.5 py-1 rounded-md border border-red-100">Adjusted</span>
                      ) : row.status === 'pending' ? (
                        <button onClick={() => markPaid(row._id)} disabled={payingId === row._id}
                          className="px-6 py-2.5 rounded-xl text-[10px] font-black text-white uppercase tracking-widest disabled:opacity-50 transition-all hover:shadow-xl active:scale-95 hover:scale-105"
                          style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                          {payingId === row._id ? '...' : 'Payout'}
                        </button>
                      ) : (
                         <div className="flex items-center justify-end gap-3">
                           <div className="flex items-center gap-1.5 text-emerald-500">
                             <span className="text-[10px] font-black uppercase tracking-widest">Settled</span>
                             <div className="w-5 h-5 bg-emerald-50 rounded-full flex items-center justify-center">
                               <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={4} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
                             </div>
                           </div>
                           {isAdmin && (
                             <button
                               onClick={async () => {
                                 const note = window.prompt("Reason for this reversal (correction):");
                                 if (note === null) return; // cancelled
                                 if (!note.trim()) {
                                   alert("Please provide a reason for the reversal.");
                                   return;
                                 }
                                 try {
                                   await api.post(`/commission/records/${row._id}/reverse`, { note: note.trim() });
                                   loadStaff();
                                   loadCommissions(page);
                                 } catch (e) {
                                   alert(e?.response?.data?.message || "Reversal failed");
                                 }
                               }}
                               className="px-3 py-1.5 rounded-lg text-[9px] font-black text-red-600 bg-red-50 border border-red-100 hover:bg-red-500 hover:text-white transition-all active:scale-95 uppercase tracking-widest"
                             >
                               Reverse
                             </button>
                           )}
                         </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-8 py-6 bg-gray-50/50 border-t border-gray-100">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Record {((page-1)*PER_PAGE)+1} - {Math.min(page*PER_PAGE, total)} of {total}</span>
            <div className="flex gap-3">
              <button onClick={() => { const p = Math.max(1,page-1); setPage(p); loadCommissions(p); }} disabled={page===1}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 disabled:opacity-30 shadow-sm transition-all hover:bg-gray-50 active:scale-90">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button onClick={() => { const p = Math.min(totalPages,page+1); setPage(p); loadCommissions(p); }} disabled={page===totalPages}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 disabled:opacity-30 shadow-sm transition-all hover:bg-gray-50 active:scale-90">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
