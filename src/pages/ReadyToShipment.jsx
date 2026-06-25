import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api';
import Modal from '../components/ui/Modal';

const DEPARTMENTS = ['migraine', 'piles'];

const TruckIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <rect x="1" y="3" width="15" height="13" rx="1" />
    <path d="M16 8h4l3 5v3h-7V8z" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const PIN_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-rose-500', 'bg-amber-500', 'bg-cyan-500', 'bg-pink-500',
];

const initials = (name = '') =>
  name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const DetailRow = ({ label, value }) =>
  value ? (
    <div className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-28 shrink-0 mt-0.5">{label}</span>
      <span className="text-sm text-gray-800 font-medium capitalize flex-1">{value}</span>
    </div>
  ) : null;

const SectionHead = ({ label }) => (
  <div className="flex items-center gap-2 mt-4 mb-1">
    <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-500">{label}</span>
    <div className="flex-1 h-px bg-amber-100" />
  </div>
);

export default function ReadyToShipment() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'manager';
  const [searchParams] = useSearchParams();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [department, setDepartment] = useState('');
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('phone') || '');
  const [dayFilter, setDayFilter] = useState(() => new URLSearchParams(window.location.search).get('phone') ? 'all' : 'today');
  const [typeFilter, setTypeFilter] = useState('all');
  const [customDate, setCustomDate] = useState('');
  const [repairing, setRepairing] = useState(false);
  const [shipProvider, setShipProvider] = useState(() => localStorage.getItem('shipProvider') || 'shiprocket');
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsTab, setStatsTab] = useState('state');
  const [drillState, setDrillState] = useState(null);
  const [drillPincode, setDrillPincode] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const params = department ? { department } : {};
      const res = await API.get('/ready-to-shipment', { params });
      const data = res.data.data;
      setRecords(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [department]);

  const loadStats = useCallback(async (filterState = null, filterPincode = null) => {
    setStatsLoading(true);
    try {
      const params = {};
      if (department) params.department = department;
      if (filterState) params.filterState = filterState;
      if (filterPincode) params.filterPincode = filterPincode;
      const res = await API.get('/ready-to-shipment/stats', { params });
      setStats(res.data.data);
    } catch { /* ignore */ }
    finally { setStatsLoading(false); }
  }, [department]);

  const handleDrillState = (stateName) => {
    setDrillState(stateName);
    setDrillPincode(null);
    setStatsTab('monthly');
    loadStats(stateName, null);
  };

  const handleDrillPincode = (pincode) => {
    setDrillPincode(pincode);
    setDrillState(null);
    setStatsTab('monthly');
    loadStats(null, pincode);
  };

  const handleDrillBack = () => {
    setDrillState(null);
    setDrillPincode(null);
    setStatsTab('state');
    loadStats(null, null);
  };

  const handleRepair = async () => {
    setRepairing(true);
    try {
      const params = department ? { department } : {};
      const res = await API.post('/ready-to-shipment/sync', null, { params });
      const data = res.data.data;
      setRecords(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    finally { setRepairing(false); }
  };

  useEffect(() => {
    API.get('/integrations/shipping-provider').then(r => {
      const p = r.data?.data?.provider;
      if (p) { setShipProvider(p); localStorage.setItem('shipProvider', p); }
    }).catch(() => {});
  }, []);

  const toggleProvider = async () => {
    const next = shipProvider === 'shiprocket' ? 'shipmaxx' : 'shiprocket';
    setShipProvider(next);
    localStorage.setItem('shipProvider', next);
    try { await API.post('/integrations/shipping-provider', { provider: next }); } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, [load, department]);
  useEffect(() => { if (showStats) loadStats(drillState, drillPincode); }, [showStats, loadStats]); // eslint-disable-line

  const handleDelete = async (record) => {
    if (!window.confirm('Delete this record? The task will be marked as cancelled.')) return;
    try {
      await API.delete(`/ready-to-shipment/${record._id}`);
      setSelected(null);
      load();
    } catch (e) {
      alert(e?.response?.data?.message || 'Delete failed');
    }
  };

  const filtered = records.filter(r => {
    const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = startOf(new Date());
    if (dayFilter === 'today' && new Date(r.createdAt) < today) return false;
    if (dayFilter === 'yesterday') {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      const d = new Date(r.createdAt);
      if (d < y || d >= today) return false;
    }
    if (dayFilter === 'custom' && customDate) {
      const from = new Date(customDate);
      const to = new Date(from); to.setDate(to.getDate() + 1);
      const d = new Date(r.createdAt);
      if (d < from || d >= to) return false;
    }
    
    const isOld = r.lead?.status === 'old' || !!r.lead?.pending_reorder_source;
    if (typeFilter === 'new' && isOld) return false;
    if (typeFilter === 'old' && !isOld) return false;
    
    const q = search.toLowerCase();
    return !q ||
      r.title?.toLowerCase().includes(q) ||
      r.lead?.name?.toLowerCase().includes(q) ||
      r.lead?.phone?.includes(q) ||
      r.assignedTo?.name?.toLowerCase().includes(q) ||
      r.state?.toLowerCase().includes(q) ||
      r.district?.toLowerCase().includes(q);
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex gap-4 scroll-container-h overflow-hidden animate-slide-up mobile-p-safe">
      {/* ── LEFT PANEL ── */}
      <div className={`flex flex-col gap-4 transition-all duration-300 ${selected ? 'w-full lg:w-[55%]' : 'w-full'} h-full overflow-hidden`}>
        
        {/* Header & Filters (Fixed) */}
        <div className="flex items-center gap-3 shrink-0 glass px-4 py-3 rounded-2xl border border-white/50 shadow-sm">
          {[['all', 'All'], ['today', 'Today'], ['yesterday', 'Yesterday']].map(([val, label]) => (
            <button key={val} onClick={() => { setDayFilter(val); setCustomDate(''); }}
              className={`px-3 py-2 rounded-xl text-xs font-bold border whitespace-nowrap transition-all shrink-0 ${
                dayFilter === val ? 'bg-amber-500 text-white border-amber-500 shadow-md' : 'bg-white text-gray-400 border-gray-100 hover:bg-gray-50'
              }`}>{label}</button>
          ))}
          <input type="date" value={customDate} max={new Date().toISOString().slice(0, 10)}
            onChange={e => { setCustomDate(e.target.value); setDayFilter(e.target.value ? 'custom' : 'all'); }}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer outline-none shrink-0 ${
              dayFilter === 'custom' ? 'bg-amber-500 text-white border-amber-500 shadow-md' : 'bg-white text-gray-400 border-gray-100'
            }`} />
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, location..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-100 bg-white text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-300/50 focus:border-amber-400 transition shadow-sm" />
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="w-auto border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition shrink-0"
          >
            <option value="all">All Types</option>
            <option value="new">New Orders</option>
            <option value="old">Old Orders</option>
          </select>
          {canManage && (
            <select
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className="w-auto border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition shrink-0"
            >
              <option value="">All Depts</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
            </select>
          )}
          {/* Shipping Provider Toggle */}
          <button onClick={toggleProvider}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all shrink-0 ${
              shipProvider === 'shipmaxx'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                : 'bg-orange-500 text-white border-orange-500 shadow-md'
            }`}>
            🚚 {shipProvider === 'shipmaxx' ? 'ShipMaxx' : 'Shiprocket'}
          </button>
          <button onClick={handleRepair} disabled={repairing}
            className="px-3 py-2 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition disabled:opacity-50 whitespace-nowrap shrink-0">
            {repairing ? 'Syncing...' : '🔄 Sync Verified'}
          </button>
          <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-bold shadow-sm shrink-0"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
            <TruckIcon />
            {records.length} pending
          </div>
        </div>

        {/* List (Scrollable) */}
        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-3 text-amber-300">
                <TruckIcon className="w-6 h-6" />
              </div>
              <p className="text-gray-500 text-sm font-medium">No orders found</p>
              <p className="text-gray-400 text-xs mt-1">{search ? 'Try a different search' : 'Nothing here yet'}</p>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {filtered.map((r, i) => {
                const color = PIN_COLORS[i % PIN_COLORS.length];
                const isActive = selected?._id === r._id;
                const dept = r.department || r.lead?.department || r.task?.department;
                return (
                  <div
                    key={r._id}
                    onClick={() => setSelected(isActive ? null : r)}
                    className={`relative flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-4 sm:py-3.5 rounded-2xl cursor-pointer transition-all duration-200 border
                      ${isActive
                        ? 'bg-amber-50 border-amber-200 shadow-sm'
                        : 'bg-white border-gray-100 hover:border-amber-200 hover:bg-amber-50/30 hover:shadow-sm'}`}>

                    {/* Left color strip */}
                    <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${color}`} />

                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Avatar */}
                      <div className={`w-10 h-10 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-white text-sm sm:text-xs font-bold shrink-0 ${color}`}>
                        {initials(r.lead?.name || r.title)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between sm:justify-start gap-2">
                          <p className="text-sm font-bold text-gray-800 truncate">{r.title}</p>
                          <span className="sm:hidden text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                            {i + 1}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {r.lead?.name && <span className="text-xs text-gray-500 font-medium">{r.lead.name}</span>}
                          {r.lead?.phone && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.18 6.18l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                              {r.lead.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Desktop Status/Price */}
                    <div className="flex items-center justify-between sm:flex-col sm:items-end gap-1 shrink-0 mt-1 sm:mt-0 pt-2 sm:pt-0 border-t border-gray-50 sm:border-0">
                      <div className="flex items-center gap-2">
                        {dept && (
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 uppercase tracking-wide">
                            {dept}
                          </span>
                        )}
                        {r.price && (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg">
                            ₹{r.price}
                          </span>
                        )}
                        {(r.lead?.status === 'old' || !!r.lead?.pending_reorder_source) ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg uppercase">
                            Old
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg uppercase">
                            New
                          </span>
                        )}
                        <span className="sm:hidden text-[10px] font-bold text-gray-400">Order #{i + 1}</span>
                      </div>
                      
                      {(r.district || r.state) && (
                        <span className="text-[11px] text-gray-400 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.5" /></svg>
                          <span className="truncate max-w-[120px]">{[r.district, r.state].filter(Boolean).join(', ')}</span>
                        </span>
                      )}
                    </div>

                    {/* Chevron (Desktop only) */}
                    <svg className={`hidden sm:block w-4 h-4 text-gray-300 shrink-0 transition-transform duration-200 ${isActive ? 'rotate-90 text-amber-400' : ''}`}
                      fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT DETAIL PANEL ── */}
      {selected && (
        <div className="hidden lg:flex flex-col w-[45%] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-full">
          {/* Panel header */}
          <div className="h-1.5 shrink-0" style={{ background: 'linear-gradient(90deg,#f59e0b,#d97706,#f59e0b)' }} />
          <div className="px-5 py-4 flex items-center justify-between border-b border-gray-50 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold ${PIN_COLORS[filtered.findIndex(r => r._id === selected._id) % PIN_COLORS.length]}`}>
                {initials(selected.lead?.name || selected.title)}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800 leading-tight">{selected.lead?.name || 'Order Detail'}</p>
                {selected.lead?.phone && <p className="text-xs text-gray-400">{selected.lead.phone}</p>}
              </div>
            </div>
            <button onClick={() => setSelected(null)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition text-lg">
              ×
            </button>
          </div>

          {/* Panel body */}
          <div className="px-5 py-3 overflow-y-auto flex-1 custom-scrollbar">
            <SectionHead label="Customer" />
            <DetailRow label="Task" value={selected.title} />
            <DetailRow label="Assigned To" value={selected.assignedTo?.name} />
            <DetailRow label="Department" value={selected.department || selected.lead?.department || selected.task?.department} />
            <DetailRow label="Description" value={selected.description} />

            <SectionHead label="Health Info" />
            <DetailRow label="Problem" value={selected.problem} />
            <DetailRow label="Duration" value={selected.problemDuration} />
            <DetailRow label="Age" value={selected.age ? `${selected.age} yrs` : null} />
            <DetailRow label="Weight" value={selected.weight ? `${selected.weight} kg` : null} />
            <DetailRow label="Height" value={selected.height ? `${selected.height} cm` : null} />
            <DetailRow label="Other Problems" value={selected.otherProblems} />

            <SectionHead label="Address" />
            <DetailRow label={selected.cityVillageType === 'village' ? 'Village' : 'City'} value={selected.cityVillage} />
            <DetailRow label="House No" value={selected.houseNo} />
            <DetailRow label="Post Office" value={selected.postOffice} />
            <DetailRow label="District" value={selected.district} />
            <DetailRow label="State" value={selected.state} />
            <DetailRow label="Pincode" value={selected.pincode} />
            <DetailRow label="Landmark" value={selected.landmark} />

            <SectionHead label="Order" />
            <DetailRow label="Price" value={selected.price ? `₹${selected.price}` : null} />
            <DetailRow label="Confirm Date" value={selected.reminderAt ? new Date(selected.reminderAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null} />
          </div>

          {/* Panel footer */}
          <div className="px-5 py-4 border-t border-gray-50 shrink-0 flex gap-2">
            <button
              onClick={() => handleDelete(selected)}
              className="px-4 py-3 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition shrink-0">
              Delete
            </button>
            <button
              onClick={() => {
                setSelected(null);
                if (shipProvider === 'shipmaxx') {
                  navigate('/shipmaxx', { state: { rts: selected } });
                } else {
                  navigate('/shiprocket', { state: { delivery_postcode: selected.pincode || '', rts: selected } });
                }
              }}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md"
              style={{ background: shipProvider === 'shipmaxx' ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : 'linear-gradient(135deg,#16a34a,#15803d)' }}>
              <TruckIcon />
              {shipProvider === 'shipmaxx' ? 'Ship via ShipMaxx' : 'Check Serviceability & Ship'}
            </button>
          </div>
        </div>
      )}

      {/* Mobile Detail Modal */}
      {selected && (
        <div className="lg:hidden">
          <Modal hideHeader={true} onClose={() => setSelected(null)}>
            {/* Premium Header */}
            <div className="-mx-4 -mt-4 mb-5 px-6 py-6 rounded-b-3xl relative"
              style={{ background: 'linear-gradient(135deg, #0d1f0d, #1a3a1a)' }}>
              <button onClick={() => setSelected(null)}
                className="absolute right-4 top-4 w-7 h-7 flex items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-all text-xl">
                ×
              </button>
              <div className="flex items-center gap-4 pr-8">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-xl ${PIN_COLORS[filtered.findIndex(r => r._id === selected._id) % PIN_COLORS.length]}`}>
                  {initials(selected.lead?.name || selected.title)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold text-lg tracking-tight truncate">{selected.lead?.name || selected.title}</h3>
                  <p className="text-amber-300/70 text-sm font-medium">{selected.lead?.phone}</p>
                </div>
              </div>
            </div>

            <div className="space-y-0 px-2 pb-2">
              <SectionHead label="Customer Info" />
              <DetailRow label="Task" value={selected.title} />
              <DetailRow label="Assigned To" value={selected.assignedTo?.name} />
              <DetailRow label="Department" value={selected.department || selected.lead?.department || selected.task?.department} />
              <DetailRow label="Description" value={selected.description} />
              
              <SectionHead label="Health Info" />
              <DetailRow label="Problem" value={selected.problem} />
              <DetailRow label="Duration" value={selected.problemDuration} />
              <DetailRow label="Age" value={selected.age ? `${selected.age} yrs` : null} />
              <DetailRow label="Weight" value={selected.weight ? `${selected.weight} kg` : null} />
              <DetailRow label="Height" value={selected.height ? `${selected.height} cm` : null} />
              
              <SectionHead label="Shipping Address" />
              <DetailRow label={selected.cityVillageType === 'village' ? 'Village' : 'City'} value={selected.cityVillage} />
              <DetailRow label="House No" value={selected.houseNo} />
              <DetailRow label="Post Office" value={selected.postOffice} />
              <DetailRow label="District" value={selected.district} />
              <DetailRow label="State" value={selected.state} />
              <DetailRow label="Pincode" value={selected.pincode} />
              <DetailRow label="Landmark" value={selected.landmark} />
              
              <SectionHead label="Order Details" />
              <DetailRow label="Price" value={selected.price ? `₹${selected.price}` : null} />
              <DetailRow label="Confirm Date" value={selected.reminderAt ? new Date(selected.reminderAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null} />
              
              <div className="pt-6 flex gap-2">
                <button
                  onClick={() => handleDelete(selected)}
                  className="px-5 py-4 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition shrink-0">
                  Delete
                </button>
                <button
                  onClick={() => {
                    setSelected(null);
                    if (shipProvider === 'shipmaxx') {
                      navigate('/shipmaxx', { state: { rts: selected } });
                    } else {
                      navigate('/shiprocket', { state: { delivery_postcode: selected.pincode || '', rts: selected } });
                    }
                  }}
                  className="flex-1 py-4 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
                  style={{ background: shipProvider === 'shipmaxx' ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : 'linear-gradient(135deg, #16a34a, #15803d)' }}>
                  <TruckIcon className="w-5 h-5" />
                  {shipProvider === 'shipmaxx' ? 'SHIP VIA SHIPMAXX' : 'CHECK SERVICEABILITY'}
                </button>
              </div>
            </div>
          </Modal>
        </div>
      )}

      {/* ── ANALYTICS PANEL ── */}
      {showStats && (
        <div className="hidden lg:flex flex-col w-[360px] shrink-0 bg-white rounded-2xl border border-violet-100 shadow-sm overflow-hidden h-full">
          <div className="h-1.5 shrink-0" style={{ background: 'linear-gradient(90deg,#7c3aed,#6d28d9,#7c3aed)' }} />

          {/* Header */}
          <div className="px-5 pt-4 pb-3 border-b border-gray-50 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                {(drillState || drillPincode) && (
                  <button
                    onClick={handleDrillBack}
                    className="w-6 h-6 flex items-center justify-center rounded-lg bg-violet-100 text-violet-600 hover:bg-violet-200 transition shrink-0 text-sm"
                  >←</button>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">
                    {drillState ? `📍 ${drillState}` : drillPincode ? `📮 ${drillPincode}` : '📊 Shipment Analytics'}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                    {drillState
                      ? `${stats?.drillTotal ?? '—'} pending · Click pincode for more detail`
                      : drillPincode
                        ? `${stats?.drillTotal ?? '—'} pending · Pincode drill-down`
                        : 'Click any state or pincode to drill in'}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowStats(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition text-lg shrink-0">×</button>
            </div>

            {/* Tabs — context-aware */}
            <div className="flex gap-1">
              {(drillState || drillPincode
                ? [['monthly', '📅 Monthly'], ['weekly', '📆 Weekly'], ...(drillState ? [['pincode', '📍 Pincodes']] : [])]
                : [['state', '🗺️ States'], ['pincode', '📍 Pincodes'], ['monthly', '📅 Monthly'], ['weekly', '📆 Weekly']]
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setStatsTab(tab)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                    statsTab === tab
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-violet-600 hover:bg-violet-50'
                  }`}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3">
            {statsLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-gray-400">Loading analytics…</p>
              </div>
            ) : stats ? (
              <div className="space-y-5">

                {/* ── STATES LIST (clickable) ── */}
                {statsTab === 'state' && (
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-500 mb-2">🗺️ State-wise Orders — Click to drill in</p>
                    {stats.byState.length === 0 ? (
                      <p className="text-xs text-gray-400">No state data found</p>
                    ) : (
                      <div className="space-y-1">
                        {stats.byState.map((item, idx) => {
                          const max = stats.byState[0]?.count || 1;
                          const pct = Math.round((item.count / max) * 100);
                          const isTop = idx === 0;
                          const stateColors = ['from-amber-500 to-orange-400','from-emerald-500 to-teal-400','from-blue-500 to-cyan-400','from-rose-500 to-pink-400','from-purple-500 to-violet-400'];
                          const gradient = stateColors[idx % stateColors.length];
                          const isActive = drillState === item.state;
                          return (
                            <button
                              key={item.state}
                              onClick={() => handleDrillState(item.state)}
                              className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all group ${
                                isActive
                                  ? 'bg-violet-50 border-violet-300 shadow-sm'
                                  : 'bg-gray-50 border-transparent hover:bg-amber-50 hover:border-amber-200'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  {isTop && <span className="text-[10px]">🥇</span>}
                                  <span className={`text-xs font-bold capitalize ${isActive ? 'text-violet-700' : isTop ? 'text-amber-700' : 'text-gray-700'}`}>
                                    {item.state}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-gray-400">{item.pincodes?.filter(Boolean).length || 0} pincodes</span>
                                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${isActive ? 'bg-violet-100 text-violet-700' : isTop ? 'bg-amber-100 text-amber-700' : 'bg-white text-gray-600 border border-gray-200'}`}>
                                    {item.count}
                                  </span>
                                  <span className="text-[9px] text-gray-300 group-hover:text-violet-400 transition">›</span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%` }}>
                                  <div className={`h-full w-full bg-gradient-to-r ${gradient}`} />
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── PINCODES LIST (clickable) ── */}
                {statsTab === 'pincode' && (
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-500 mb-2">
                      📍 {drillState ? `Pincodes in ${drillState}` : 'Top Pincodes'} — Click to drill in
                    </p>
                    {stats.byPincode.length === 0 ? (
                      <p className="text-xs text-gray-400">No pincode data found</p>
                    ) : (
                      <div className="space-y-1">
                        {stats.byPincode.map((item, idx) => {
                          const max = stats.byPincode[0]?.count || 1;
                          const pct = Math.round((item.count / max) * 100);
                          const isTop = idx === 0;
                          const isActive = drillPincode === item.pincode;
                          return (
                            <button
                              key={item.pincode}
                              onClick={() => handleDrillPincode(item.pincode)}
                              className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all group ${
                                isActive
                                  ? 'bg-violet-50 border-violet-300 shadow-sm'
                                  : 'bg-gray-50 border-transparent hover:bg-violet-50 hover:border-violet-200'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  {isTop && <span className="text-[10px]">🏆</span>}
                                  <span className={`text-xs font-bold font-mono ${isActive ? 'text-violet-700' : isTop ? 'text-violet-600' : 'text-gray-700'}`}>
                                    {item.pincode}
                                  </span>
                                  {item.states?.filter(Boolean).length > 0 && (
                                    <span className="text-[9px] text-gray-400 truncate max-w-[80px]">
                                      {item.states.filter(Boolean).join(', ')}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${isActive ? 'bg-violet-100 text-violet-700' : isTop ? 'bg-violet-100 text-violet-700' : 'bg-white text-gray-600 border border-gray-200'}`}>
                                    {item.count}
                                  </span>
                                  <span className="text-[9px] text-gray-300 group-hover:text-violet-400 transition">›</span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${pct}%`, background: isTop ? 'linear-gradient(90deg,#7c3aed,#6d28d9)' : 'linear-gradient(90deg,#a78bfa,#c4b5fd)' }}
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── MONTHLY CHART ── */}
                {statsTab === 'monthly' && (() => {
                  const maxM = Math.max(...(stats.byMonth || []).map(m => m.count), 1);
                  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                  return (
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-blue-500 mb-3">
                        📅 Monthly Orders (12 Months){drillState ? ` — ${drillState}` : drillPincode ? ` — ${drillPincode}` : ''}
                      </p>
                      {(!stats.byMonth || stats.byMonth.length === 0) ? (
                        <p className="text-xs text-gray-400">No monthly data found</p>
                      ) : (
                        <div className="space-y-2">
                          {stats.byMonth.map(item => {
                            const [yr, mo] = item.month.split('-');
                            const label = `${monthNames[parseInt(mo, 10) - 1]} '${yr.slice(2)}`;
                            const pct = Math.round((item.count / maxM) * 100);
                            const isMax = item.count === maxM;
                            return (
                              <div key={item.month}>
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className={`text-xs font-bold ${isMax ? 'text-blue-700' : 'text-gray-600'}`}>{label}</span>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${isMax ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {item.count}{isMax ? ' 🔥' : ''}
                                  </span>
                                </div>
                                <div className="h-5 bg-gray-100 rounded-lg overflow-hidden">
                                  <div
                                    className="h-full rounded-lg transition-all duration-700 flex items-center justify-end pr-2"
                                    style={{
                                      width: `${pct}%`,
                                      minWidth: item.count > 0 ? '20px' : '0',
                                      background: isMax ? 'linear-gradient(90deg,#3b82f6,#1d4ed8)' : 'linear-gradient(90deg,#93c5fd,#bfdbfe)',
                                    }}
                                  >
                                    {pct > 25 && <span className="text-[9px] font-bold text-white">{item.count}</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          <div className="mt-1 p-2.5 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wide">Total (12 months)</span>
                            <span className="text-sm font-extrabold text-blue-700">{stats.byMonth.reduce((s, m) => s + m.count, 0)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── WEEKLY CHART ── */}
                {statsTab === 'weekly' && (() => {
                  const maxW = Math.max(...(stats.byWeek || []).map(w => w.count), 1);
                  return (
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-500 mb-3">
                        📆 Weekly Orders (8 Weeks){drillState ? ` — ${drillState}` : drillPincode ? ` — ${drillPincode}` : ''}
                      </p>
                      {(!stats.byWeek || stats.byWeek.length === 0) ? (
                        <p className="text-xs text-gray-400">No weekly data found</p>
                      ) : (
                        <div className="space-y-2">
                          {stats.byWeek.map((item, idx) => {
                            const pct = Math.round((item.count / maxW) * 100);
                            const isMax = item.count === maxW;
                            const weekStart = item.weekStart ? new Date(item.weekStart) : null;
                            const weekLabel = weekStart
                              ? weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                              : item.week;
                            const isThisWeek = idx === stats.byWeek.length - 1;
                            return (
                              <div key={item.week}>
                                <div className="flex items-center justify-between mb-0.5">
                                  <div className="flex items-center gap-1">
                                    <span className={`text-xs font-bold ${isMax ? 'text-emerald-700' : 'text-gray-600'}`}>
                                      {weekLabel}
                                    </span>
                                    {isThisWeek && <span className="text-[9px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-bold">Now</span>}
                                  </div>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${isMax ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {item.count}{isMax ? ' 🔥' : ''}
                                  </span>
                                </div>
                                <div className="h-5 bg-gray-100 rounded-lg overflow-hidden">
                                  <div
                                    className="h-full rounded-lg transition-all duration-700 flex items-center justify-end pr-2"
                                    style={{
                                      width: `${pct}%`,
                                      minWidth: item.count > 0 ? '20px' : '0',
                                      background: isMax ? 'linear-gradient(90deg,#10b981,#059669)' : 'linear-gradient(90deg,#6ee7b7,#a7f3d0)',
                                    }}
                                  >
                                    {pct > 25 && <span className="text-[9px] font-bold text-white">{item.count}</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          <div className="mt-1 p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide">Total (8 weeks)</span>
                            <span className="text-sm font-extrabold text-emerald-700">{stats.byWeek.reduce((s, w) => s + w.count, 0)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Summary Footer */}
                <div className="p-3 rounded-xl border" style={{ background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', borderColor: '#ddd6fe' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400">
                        {drillState ? drillState : drillPincode ? drillPincode : 'All India'}
                      </p>
                      <p className="text-sm font-bold text-violet-800 mt-0.5">
                        {(drillState || drillPincode) ? stats.drillTotal : stats.total} pending
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-violet-500">{stats.byMonth?.reduce((s,m)=>s+m.count,0)||0} added (12mo)</p>
                      <p className="text-[10px] text-violet-400 mt-0.5">{stats.byWeek?.reduce((s,w)=>s+w.count,0)||0} added (8wk)</p>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-3xl mb-2">📊</p>
                <p className="text-xs text-gray-400 font-medium">Analytics loading…</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
