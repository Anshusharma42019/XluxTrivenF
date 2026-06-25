
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getVerificationRecords, syncVerificationRecords, updateVerificationStatus, updateVerificationRecord, updateTask, deleteVerificationRecord, getOnHoldVerificationRecords } from '../services/task.service';
import { updateLead, markCNP, createCallAgain } from '../services/lead.service';
import { getUsers } from '../services/user.service';
import API from '../api';
import Modal from '../components/ui/Modal';

const VerifyIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
  </svg>
);

const PIN_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-rose-500', 'bg-amber-500', 'bg-cyan-500', 'bg-pink-500',
];

const DEPARTMENTS = ['migraine', 'piles'];

const initials = (name = '') =>
  name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const isOldPatientVerification = (record) =>
  !!(record.lead?.status === 'old' || record.lead?.pending_reorder_source);

const getKitText = (num) => {
  if (!num) return '';
  if (num === 1) return '1st Kit';
  if (num === 2) return '2nd Kit';
  if (num === 3) return '3rd Kit';
  return `${num}th Kit`;
};

// Old-patient verification starts at the second kit, even if the backend sequence is 1.
const getDisplayKit = (record) => {
  const kit = record.kit_number;
  if (!kit) return null;
  if (isOldPatientVerification(record) && kit === 1) {
    return 2;
  }
  return kit;
};

const DetailRow = ({ label, value }) =>
  value ? (
    <div className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-28 shrink-0 mt-0.5">{label}</span>
      <span className="text-sm text-gray-800 font-medium capitalize flex-1">{value}</span>
    </div>
  ) : null;

const SectionHead = ({ label }) => (
  <div className="flex items-center gap-2 mt-4 mb-1">
    <span className="text-[10px] font-extrabold uppercase tracking-widest text-green-500">{label}</span>
    <div className="flex-1 h-px bg-green-100" />
  </div>
);

const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition";

export default function Verification() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'manager';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [department, setDepartment] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(null);
  const [selected, setSelected] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [onHoldDate, setOnHoldDate] = useState('');
  const [onHoldReason, setOnHoldReason] = useState('');
  const [showOnHoldPicker, setShowOnHoldPicker] = useState(false);
  const [dayFilter, setDayFilter] = useState('all');
  const [customDate, setCustomDate] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [onHoldRecords, setOnHoldRecords] = useState([]);
  const [ohDayFilter, setOhDayFilter] = useState('all');
  const [ohCustomDate, setOhCustomDate] = useState('');
  const [ohSearch, setOhSearch] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTo, setAssignTo] = useState('');
  const [showPatientTypeModal, setShowPatientTypeModal] = useState(false);
  const [selectedPatientType, setSelectedPatientType] = useState('new');

  const load = useCallback(async () => {
    try {
      const data = await getVerificationRecords(department ? { department } : {});
      setRecords(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load');
    } finally { setLoading(false); }
  }, [department]);

  const loadOnHold = useCallback(async () => {
    try {
      const data = await getOnHoldVerificationRecords(department ? { department } : {});
      setOnHoldRecords(Array.isArray(data) ? data : []);
    } catch { }
  }, [department]);

  useEffect(() => {
    load();
    loadOnHold();
    const filter = department ? { department } : {};
    syncVerificationRecords()
      .then(() => Promise.all([getVerificationRecords(filter), getOnHoldVerificationRecords(filter)]))
      .then(([pending, onHold]) => {
        setRecords(Array.isArray(pending) ? pending : []);
        setOnHoldRecords(Array.isArray(onHold) ? onHold : []);
      })
      .catch(() => { });
  }, [load, loadOnHold, department]);

  useEffect(() => {
    if (canManage) {
      Promise.all([
        getUsers({ role: 'sales' }),
        getUsers({ role: 'support' }),
        getUsers({ role: 'manager' }),
        getUsers({ role: 'admin' })
      ]).then(results => {
        const combined = results.flatMap(r => r.results || []);
        const unique = Array.from(new Map(combined.map(u => [u._id, u])).values());
        setAllUsers(unique);
      }).catch(() => {});
    }
  }, [canManage]);

  // Handle openId from search navigation — runs after records are populated
  useEffect(() => {
    const openId = searchParams.get('openId');
    if (!openId) return;
    const allRecs = [...records, ...onHoldRecords];
    if (allRecs.length === 0) return;
    const match = allRecs.find(r =>
      r._id === openId ||
      r.lead?._id === openId ||
      r.lead === openId ||
      r.task?._id === openId ||
      r.task === openId
    );
    if (match) {
      const flattened = flattenRecord(match);
      setSelected(flattened);
      if (match.status === 'on_hold') {
        setActiveTab('on_hold');
        setOhDayFilter('all');
      } else {
        setDayFilter('all');
      }
    }
    setSearchParams({}, { replace: true });
  }, [records, onHoldRecords, searchParams]);

  const flattenRecord = (r) => {
    const taskData = r.task && typeof r.task === 'object' ? r.task : {};
    const filteredTaskData = Object.fromEntries(
      Object.entries(taskData).filter(([_, v]) => v !== null && v !== undefined && v !== '')
    );
    return {
      ...r,
      ...filteredTaskData,
      _id: r._id,
      status: r.status,
      lead: r.lead,
      assignedTo: r.assignedTo || r.task?.assignedTo,
      title: r.title || r.task?.title,
      department: r.department || r.task?.department || r.lead?.department,
      task: r.task,
      _isPipelineOnly: r._isPipelineOnly,
    };
  };

  const filterRecords = (recs) => {
    // Use IST midnight (UTC+5:30) for correct day boundaries
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(Date.now() + IST_OFFSET);
    const todayIST = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()) - IST_OFFSET);
    const yesterdayIST = new Date(todayIST.getTime() - 24 * 60 * 60 * 1000);
    let filtered = recs.filter(r => r.status !== 'on_hold');

    if (dayFilter === 'today') filtered = filtered.filter(r => new Date(r.createdAt) >= todayIST);
    else if (dayFilter === 'yesterday') {
      filtered = filtered.filter(r => { const d = new Date(r.createdAt); return d >= yesterdayIST && d < todayIST; });
    } else if (dayFilter === 'custom' && customDate) {
      const from = new Date(`${customDate}T00:00:00.000+05:30`);
      const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
      filtered = filtered.filter(r => { const d = new Date(r.createdAt); return d >= from && d < to; });
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(r =>
        r.title?.toLowerCase().includes(q) ||
        r.lead?.name?.toLowerCase().includes(q) ||
        r.lead?.phone?.includes(q) ||
        r.assignedTo?.name?.toLowerCase().includes(q) ||
        r.district?.toLowerCase().includes(q)
      );
    }
    return filtered;
  };

  const filteredRecords = filterRecords(records);

  const filteredOnHold = (() => {
    const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = startOf(new Date());
    let filtered = [...onHoldRecords];
    if (ohDayFilter === 'today') filtered = filtered.filter(r => new Date(r.onHoldAt || r.updatedAt || r.createdAt) >= today);
    else if (ohDayFilter === 'yesterday') {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      filtered = filtered.filter(r => { const d = new Date(r.onHoldAt || r.updatedAt || r.createdAt); return d >= y && d < today; });
    } else if (ohDayFilter === 'custom' && ohCustomDate) {
      const from = new Date(ohCustomDate);
      const to = new Date(from); to.setDate(from.getDate() + 1);
      filtered = filtered.filter(r => { const d = new Date(r.onHoldAt || r.updatedAt || r.createdAt); return d >= from && d < to; });
    }
    if (ohSearch) {
      const q = ohSearch.toLowerCase();
      filtered = filtered.filter(r =>
        r.title?.toLowerCase().includes(q) ||
        r.lead?.name?.toLowerCase().includes(q) ||
        r.lead?.phone?.includes(q) ||
        r.assignedTo?.name?.toLowerCase().includes(q)
      );
    }
    return filtered;
  })();

  const startEdit = () => {
    setEditForm({
      name: selected.lead?.name || '',
      phone: selected.lead?.phone || '',
      description: selected.description || '',
      problem: selected.problem || '',
      age: selected.age || '',
      weight: selected.weight || '',
      height: selected.height || '',
      otherProblems: selected.otherProblems || '',
      problemDuration: selected.problemDuration || '',
      cityVillageType: selected.cityVillageType || 'city',
      cityVillage: selected.cityVillage || '',
      houseNo: selected.houseNo || '',
      postOffice: selected.postOffice || '',
      district: selected.district || '',
      landmark: selected.landmark || '',
      pincode: selected.pincode || '',
      state: selected.state || '',
      reminderAt: selected.reminderAt ? selected.reminderAt.slice(0, 10) : '',
      price: selected.price || '',
    });
    setEditMode(true);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const { name, phone, ...verificationFields } = editForm;
      await updateVerificationRecord(selected._id, verificationFields);
      if (selected.lead?._id) await updateLead(selected.lead._id, { name, phone });

      // Reload both pending and on-hold lists so neither tab goes stale
      const [freshData, freshOnHold] = await Promise.all([
        getVerificationRecords(),
        getOnHoldVerificationRecords(department ? { department } : {}),
      ]);
      const freshRecords = Array.isArray(freshData) ? freshData : [];
      setRecords(freshRecords);
      setOnHoldRecords(Array.isArray(freshOnHold) ? freshOnHold : []);

      const freshSelected = freshRecords.find(r => r._id === selected._id)
        || (Array.isArray(freshOnHold) ? freshOnHold : []).find(r => r._id === selected._id);
      const flattened = freshSelected ? flattenRecord(freshSelected) : { ...selected, ...verificationFields };
      setSelected({ ...flattened, lead: { ...(flattened.lead || selected.lead || {}), name, phone } });
      setEditMode(false);
    } catch { }
    finally { setSaving(false); }
  };

  const handleStatusUpdate = async (status, holdDate = null, holdReason = null) => {
    setUpdating(selected._id);
    try {
      if (status === 'pending' && !selected.task) {
        const leadId = selected.lead?._id || selected.lead;
        if (leadId) await updateLead(leadId, { status: 'new' });
        setOnHoldRecords(prev => prev.filter(r => r._id !== selected._id));
        setSelected(null);
        return;
      }
      await updateVerificationStatus(selected._id, status, holdDate, holdReason);
      if (status === 'verified' || status === 'on_hold') {
        setRecords(prev => prev.filter(r => r._id !== selected._id));
        setSelected(null);
        if (status === 'on_hold') {
          await API.post('/verification/repair').catch(() => { });
          await loadOnHold();
        }
      } else if (status === 'pending') {
        setOnHoldRecords(prev => prev.filter(r => r._id !== selected._id));
        setSelected(null);
        await load();
      } else {
        setRecords(prev => prev.map(r => r._id === selected._id ? { ...r, status } : r));
        setSelected(prev => prev ? { ...prev, status } : null);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setRecords(prev => prev.filter(r => r._id !== selected._id));
        setOnHoldRecords(prev => prev.filter(r => r._id !== selected._id));
        setSelected(null);
        await load();
      } else {
        alert(err.response?.data?.message || err.message || 'Update failed');
      }
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    if (!confirm('Delete this verification record?')) return;
    try {
      await deleteVerificationRecord(id);
      setRecords(prev => prev.filter(r => r._id !== id));
      setOnHoldRecords(prev => prev.filter(r => r._id !== id));
      if (selected?._id === id) setSelected(null);
    } catch (err) {
      if (err.response?.status === 404) {
        setRecords(prev => prev.filter(r => r._id !== id));
        setOnHoldRecords(prev => prev.filter(r => r._id !== id));
        if (selected?._id === id) setSelected(null);
      } else {
        alert(err.response?.data?.message || err.message || 'Delete failed');
      }
    }
  };

  const handleReadyToShipment = async () => {
    try {
      await updateVerificationStatus(selected._id, 'verified');
      setRecords(prev => prev.filter(r => r._id !== selected._id));
      setSelected(null);
      navigate('/ready-to-shipment');
    } catch { }
  };

  const handleSelect = async (r) => {
    const isActive = selected?._id === r._id;
    if (isActive) { setSelected(null); return; }
    setSelected(flattenRecord(r));
  };

  const sf = (k, v) => setEditForm(f => ({ ...f, [k]: v }));

  const handlePincodeChange = async (val) => {
    sf('pincode', val);
    if (val.length !== 6) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/pincode/${val}`);
      const data = await res.json();
      const result = Array.isArray(data) ? data[0] : data;
      if (result?.Status === 'Success') {
        const office = result.PostOffice?.[0];
        if (office) setEditForm(f => ({ ...f, district: office.District, state: office.State }));
      }
    } catch { }
  };

  // Avatar color helper — works for both pending and on-hold records
  const getAvatarColor = (id) => {
    const idx = [...filteredRecords, ...filteredOnHold].findIndex(r => r._id === id);
    return PIN_COLORS[Math.max(0, idx) % PIN_COLORS.length];
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex gap-4 scroll-container-h overflow-hidden animate-slide-up mobile-p-safe">
      {/* ── LEFT PANEL ── */}
      <div className={`flex flex-col gap-4 transition-all duration-300 ${selected ? 'w-full lg:w-[55%]' : 'w-full'} h-full overflow-hidden`}>

        {/* Tabs */}
        <div className="flex gap-2 shrink-0">
          {[['pending', 'Pending'], ['on_hold', 'On Hold']].map(([val, label]) => (
            <button key={val} onClick={() => { setActiveTab(val); setSelected(null); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${activeTab === val ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-white text-gray-400 border-gray-100 hover:bg-gray-50'}`}>
              {label}
              {val === 'on_hold' && onHoldRecords.length > 0 && (
                <span className="ml-1.5 bg-gray-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{onHoldRecords.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* On Hold Filters */}
        {activeTab === 'on_hold' && (
          <div className="flex items-center gap-3 shrink-0 glass px-4 py-3 rounded-2xl border border-white/50 shadow-sm">
            {[['all', 'All'], ['today', 'Today'], ['yesterday', 'Yesterday']].map(([val, label]) => (
              <button key={val} onClick={() => { setOhDayFilter(val); setOhCustomDate(''); }}
                className={`px-3 py-2 rounded-xl text-xs font-bold border whitespace-nowrap transition-all shrink-0 ${ohDayFilter === val ? 'bg-gray-700 text-white border-gray-700 shadow-md' : 'bg-white text-gray-400 border-gray-100 hover:bg-gray-50'}`}>{label}</button>
            ))}
            <input type="date" value={ohCustomDate} max={new Date().toISOString().slice(0, 10)}
              onChange={e => { setOhCustomDate(e.target.value); setOhDayFilter(e.target.value ? 'custom' : 'all'); }}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer outline-none shrink-0 ${ohDayFilter === 'custom' ? 'bg-gray-700 text-white border-gray-700 shadow-md' : 'bg-white text-gray-400 border-gray-100'}`} />
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input value={ohSearch} onChange={e => setOhSearch(e.target.value)} placeholder="Search name, phone, task..."
                className="w-full pl-9 pr-16 py-2.5 rounded-xl border border-gray-100 bg-white text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400/20 focus:border-gray-400 transition shadow-sm" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-300">{filteredOnHold.length}</span>
            </div>
            <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-xs font-bold shadow-md shrink-0 bg-gray-600">
              {filteredOnHold.length} On Hold
            </div>
            {canManage && (
              <select value={department} onChange={e => setDepartment(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-gray-100 bg-white text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400/20 transition shadow-sm shrink-0">
                <option value="">All Depts</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
              </select>
            )}
          </div>
        )}

        {/* Pending Filters */}
        <div className={`flex items-center gap-3 shrink-0 glass px-4 py-3 rounded-2xl border border-white/50 shadow-sm ${activeTab === 'on_hold' ? 'hidden' : ''}`}>
          {[['all', 'All'], ['today', 'Today'], ['yesterday', 'Yesterday']].map(([val, label]) => (
            <button key={val} onClick={() => { setDayFilter(val); setCustomDate(''); }}
              className={`px-3 py-2 rounded-xl text-xs font-bold border whitespace-nowrap transition-all shrink-0 ${dayFilter === val ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-white text-gray-400 border-gray-100 hover:bg-gray-50'}`}>{label}</button>
          ))}
          <input type="date" value={customDate} max={new Date().toISOString().slice(0, 10)}
            onChange={e => { setCustomDate(e.target.value); setDayFilter(e.target.value ? 'custom' : 'all'); }}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer outline-none shrink-0 ${dayFilter === 'custom' ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-white text-gray-400 border-gray-100'}`} />
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, task..."
              className="w-full pl-9 pr-16 py-2.5 rounded-xl border border-gray-100 bg-white text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-green-400/20 focus:border-green-400 transition shadow-sm" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-300">{filteredRecords.length}</span>
          </div>
          <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-xs font-bold shadow-md shrink-0"
            style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
            <VerifyIcon className="w-3.5 h-3.5" />
            {filteredRecords.length} Pending ✓
          </div>
          {canManage && (
            <select value={department} onChange={e => setDepartment(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-100 bg-white text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400/20 transition shadow-sm shrink-0">
              <option value="">All Depts</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
            </select>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {activeTab === 'on_hold' ? (
            filteredOnHold.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                <p className="text-gray-500 text-sm font-medium">No on hold records</p>
              </div>
            ) : (
              <div className="space-y-2 pb-4">
                {filteredOnHold.map((r, i) => {
                  const color = PIN_COLORS[i % PIN_COLORS.length];
                  const isActive = selected?._id === r._id;
                  const flattened = flattenRecord(r);
                  return (
                    <div key={r._id} onClick={() => handleSelect(r)} className={`relative flex items-center gap-4 px-4 py-3.5 rounded-2xl cursor-pointer transition-all duration-200 border ${isActive ? 'bg-gray-50 border-gray-300 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-300 hover:bg-gray-50/50 hover:shadow-sm'}`}>
                      <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${color}`} />
                      <span className="text-[11px] font-bold text-gray-300 w-5 text-center shrink-0 ml-2">{i + 1}</span>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 ${color}`}>
                        {initials(flattened.lead?.name || flattened.title)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-800 truncate">{flattened.title}</p>
                          {getDisplayKit(flattened) ? (
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-200 uppercase shrink-0 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />{getKitText(getDisplayKit(flattened))}
                            </span>
                          ) : (
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 border border-blue-200 uppercase shrink-0 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />NEW
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {flattened.lead?.name && <span className="text-xs text-gray-500">{flattened.lead.name}</span>}
                          {flattened.lead?.phone && <span className="text-xs text-gray-400">{flattened.lead.phone}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-gray-50 text-gray-600 border-gray-100">ON HOLD</span>
                        {r.onHoldUntil && (
                          <span className="text-[10px] text-gray-400">
                            Until {new Date(r.onHoldUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                        {flattened.assignedTo?.name && <span className="text-[10px] text-gray-400 hidden sm:block">Assigned: {flattened.assignedTo.name}</span>}
                        {flattened.department && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 uppercase">{flattened.department}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
              <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mb-3 text-green-300">
                <VerifyIcon className="w-6 h-6" />
              </div>
              <p className="text-gray-500 text-sm font-medium">No tasks found</p>
              <p className="text-gray-400 text-xs mt-1">{search ? 'Try a different search' : 'Nothing here yet'}</p>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {filteredRecords.map((r, i) => {
                const color = PIN_COLORS[i % PIN_COLORS.length];
                const isActive = selected?._id === r._id;
                const flattened = flattenRecord(r);
                return (
                  <div key={r._id} onClick={() => handleSelect(r)}
                    className={`relative flex items-center gap-4 px-4 py-3.5 rounded-2xl cursor-pointer transition-all duration-200 border ${isActive ? 'bg-green-50 border-green-200 shadow-sm' : 'bg-white border-gray-100 hover:border-green-200 hover:bg-green-50/30 hover:shadow-sm'}`}>
                    <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${color}`} />
                    <span className="text-[11px] font-bold text-gray-300 w-5 text-center shrink-0 ml-2">{i + 1}</span>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 ${color}`}>
                      {initials(flattened.lead?.name || flattened.title)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-800 truncate">{flattened.title}</p>
                        {isOldPatientVerification(flattened) ? (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-200 uppercase shrink-0 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />{getKitText(getDisplayKit(flattened))}
                          </span>
                        ) : (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 border border-blue-200 uppercase shrink-0 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />NEW
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {flattened.lead?.name && <span className="text-xs text-gray-500">{flattened.lead.name}</span>}
                        {flattened.lead?.phone && (
                          <span className="text-xs text-gray-400 flex items-center gap-0.5">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.18 6.18l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                            {flattened.lead.phone}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${flattened.status === 'on_hold' ? 'bg-gray-50 text-gray-600 border-gray-100' : flattened.status === 'verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : flattened.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                        {flattened.status?.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      {flattened.assignedTo?.name && <span className="text-[10px] text-gray-400 hidden sm:block">Assigned: {flattened.assignedTo.name}</span>}
                      {(flattened.department || flattened.lead?.department || flattened.task?.department) && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 uppercase">{flattened.department || flattened.lead?.department || flattened.task?.department}</span>
                      )}
                    </div>
                    <button onClick={(e) => handleDelete(r._id, e)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100 border border-red-100 transition shrink-0 font-bold text-base">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT DETAIL PANEL (Desktop) ── */}
      {selected && (
        <div className="hidden lg:flex flex-col w-[45%] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-full">
          <div className="h-1.5 shrink-0" style={{ background: 'linear-gradient(90deg,#16a34a,#15803d,#16a34a)' }} />

          <div className="px-5 py-4 flex items-center justify-between border-b border-gray-50 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold ${getAvatarColor(selected._id)}`}>
                {initials(selected.lead?.name || selected.title)}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800 leading-tight">{selected.lead?.name || 'Task Detail'}</p>
                {selected.lead?.phone && <p className="text-xs text-gray-400">{selected.lead.phone}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!editMode && (
                <button onClick={startEdit} className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg transition">Edit</button>
              )}
              <button onClick={() => { setSelected(null); setEditMode(false); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition text-lg">×</button>
            </div>
          </div>

          <div className="px-5 py-3 overflow-y-auto flex-1 custom-scrollbar">
            {editMode ? (
              <form onSubmit={handleSave} className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Name</label>
                    <input className={`${inputCls} mt-1`} value={editForm.name} onChange={e => sf('name', e.target.value)} /></div>
                  <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone</label>
                    <input className={`${inputCls} mt-1`} value={editForm.phone} onChange={e => sf('phone', e.target.value)} /></div>
                </div>
                <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Problem</label>
                  <textarea rows={2} className={`${inputCls} mt-1`} value={editForm.problem} onChange={e => sf('problem', e.target.value)} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Age</label>
                    <input type="number" className={`${inputCls} mt-1`} value={editForm.age} onChange={e => sf('age', e.target.value)} /></div>
                  <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Weight</label>
                    <input type="number" className={`${inputCls} mt-1`} value={editForm.weight} onChange={e => sf('weight', e.target.value)} /></div>
                  <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Height</label>
                    <input type="number" step="0.1" className={`${inputCls} mt-1`} value={editForm.height} onChange={e => sf('height', e.target.value)} /></div>
                </div>
                <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Other Problems</label>
                  <textarea rows={2} className={`${inputCls} mt-1`} value={editForm.otherProblems} onChange={e => sf('otherProblems', e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Price</label>
                    <input type="number" className={`${inputCls} mt-1`} value={editForm.price} onChange={e => sf('price', e.target.value)} /></div>
                  <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Call Date</label>
                    <input type="date" className={`${inputCls} mt-1`} value={editForm.reminderAt} onChange={e => sf('reminderAt', e.target.value)} /></div>
                </div>
                <SectionHead label="Address" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">City / Village Type</label>
                    <select className={`${inputCls} mt-1`} value={editForm.cityVillageType} onChange={e => sf('cityVillageType', e.target.value)}>
                      <option value="city">City</option>
                      <option value="village">Village</option>
                    </select>
                  </div>
                  <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">City Name</label>
                    <input className={`${inputCls} mt-1`} value={editForm.cityVillage} onChange={e => sf('cityVillage', e.target.value)} /></div>
                  <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pincode</label>
                    <input className={`${inputCls} mt-1`} value={editForm.pincode} onChange={e => handlePincodeChange(e.target.value)} /></div>
                  <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">House No</label>
                    <input className={`${inputCls} mt-1`} value={editForm.houseNo} onChange={e => sf('houseNo', e.target.value)} /></div>
                  <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Post Office</label>
                    <input className={`${inputCls} mt-1`} value={editForm.postOffice} onChange={e => sf('postOffice', e.target.value)} /></div>
                  <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Landmark</label>
                    <input className={`${inputCls} mt-1`} value={editForm.landmark} onChange={e => sf('landmark', e.target.value)} /></div>
                  <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">District</label>
                    <input className={`${inputCls} mt-1`} value={editForm.district} onChange={e => sf('district', e.target.value)} /></div>
                  <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">State</label>
                    <input className={`${inputCls} mt-1`} value={editForm.state} onChange={e => sf('state', e.target.value)} /></div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-green-600 hover:bg-green-700 transition disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button type="button" onClick={() => setEditMode(false)} className="flex-1 py-2 rounded-xl text-xs font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <SectionHead label="Customer" />
                <DetailRow label="Task" value={selected.title} />
                <div className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-28 shrink-0 mt-0.5">Patient Type</span>
                  <span className="text-sm text-gray-800 font-medium capitalize flex-1">
                    {isOldPatientVerification(selected)
                      ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-black uppercase"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />{getKitText(getDisplayKit(selected))} (Returning)</span>
                      : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-black uppercase"><span className="w-2 h-2 rounded-full bg-blue-500" />New Patient</span>
                    }
                  </span>
                  <button type="button" onClick={() => { setSelectedPatientType(isOldPatientVerification(selected) ? String(getDisplayKit(selected) || 2) : 'new'); setShowPatientTypeModal(true); }}
                    className="text-[10px] font-bold text-green-600 hover:bg-green-50 px-2 py-0.5 rounded border border-green-200 transition">
                    Change
                  </button>
                </div>
                <div className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-28 shrink-0 mt-0.5">Assigned To</span>
                  <span className="text-sm text-gray-800 font-medium capitalize flex-1">{selected.assignedTo?.name || '—'}</span>
                  {user?.role === 'admin' && (
                    <button type="button" onClick={() => { setAssignTo(selected.assignedTo?._id || selected.assignedTo || ''); setShowAssignModal(true); }}
                      className="text-[10px] font-bold text-green-600 hover:bg-green-50 px-2 py-0.5 rounded border border-green-200 transition">
                      Change
                    </button>
                  )}
                </div>
                <DetailRow label="Added By" value={selected.lead?.createdBy?.name || '—'} />
                <DetailRow label="Description" value={selected.description} />

                <SectionHead label="Health Info" />
                <DetailRow label="Problem" value={selected.problem || selected.lead?.problem} />
                <DetailRow label="Duration" value={selected.problemDuration} />
                <DetailRow label="Age" value={selected.age ? `${selected.age} yrs` : null} />
                <DetailRow label="Weight" value={selected.weight ? `${selected.weight} kg` : null} />
                <DetailRow label="Height" value={selected.height ? `${selected.height} ft` : null} />
                <DetailRow label="Other Problems" value={selected.otherProblems} />

                <SectionHead label="Address" />
                <DetailRow label="Full Address" value={selected.address || selected.lead?.address} />
                <DetailRow label={(selected.cityVillageType || selected.lead?.cityVillageType) === 'village' ? 'Village' : 'City'} value={selected.cityVillage || selected.lead?.cityVillage} />
                <DetailRow label="House No" value={selected.houseNo || selected.lead?.houseNo} />
                <DetailRow label="Post Office" value={selected.postOffice || selected.lead?.postOffice} />
                <DetailRow label="District" value={selected.district || selected.lead?.district} />
                <DetailRow label="State" value={selected.state || selected.lead?.state} />
                <DetailRow label="Pincode" value={selected.pincode || selected.lead?.pincode} />
                <DetailRow label="Landmark" value={selected.landmark || selected.lead?.landmark} />

                {selected.status === 'on_hold' && (
                  <>
                    <SectionHead label="Hold Info" />
                    <DetailRow label="Hold Reason" value={selected.onHoldReason} />
                    <DetailRow label="Hold Until" value={selected.onHoldUntil ? new Date(selected.onHoldUntil).toLocaleDateString() : null} />
                  </>
                )}

                <SectionHead label="Order" />
                <DetailRow label="Price" value={selected.price ? `₹${selected.price}` : null} />
                {selected.relief_percentage != null && (
                  <div className="flex items-start gap-3 py-2 border-b border-gray-50">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-28 shrink-0 mt-0.5">Relief %</span>
                    <span className="text-sm font-black text-emerald-600">{selected.relief_percentage}%</span>
                  </div>
                )}
                <DetailRow label="Call Date" value={selected.reminderAt ? new Date(selected.reminderAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null} />
              </>
            )}
          </div>

          {!editMode && (
            <div className="px-5 py-4 border-t border-gray-50 flex flex-col gap-2 shrink-0 bg-white">
              {selected?.status === 'on_hold' ? (
                <div className="space-y-2">
                  <button onClick={() => handleStatusUpdate('pending')} disabled={updating}
                    className="w-full py-3 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md bg-gradient-to-r from-blue-500 to-blue-600 disabled:opacity-50">
                    Move to Pending
                  </button>
                  <button onClick={(e) => handleDelete(selected._id, e)}
                    className="w-full py-3 rounded-xl text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 transition-all hover:bg-rose-100 active:scale-[0.98] flex items-center justify-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    DELETE RECORD
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <button onClick={() => handleStatusUpdate('verified')} disabled={updating}
                      className="flex-1 py-3 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-emerald-900/10 bg-gradient-to-r from-emerald-500 to-emerald-600 disabled:opacity-50">
                      <VerifyIcon /> Verified
                    </button>
                    {showOnHoldPicker ? (
                      <div className="flex-[1.5] flex flex-col gap-1.5 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                        <input placeholder="Reason (e.g. call back later)" value={onHoldReason} onChange={e => setOnHoldReason(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-gray-400" />
                        <input type="date" value={onHoldDate} onChange={e => setOnHoldDate(e.target.value)}
                          min={new Date().toISOString().slice(0, 10)}
                          className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none" />
                        <div className="flex gap-1.5">
                          <button onClick={() => { handleStatusUpdate('on_hold', onHoldDate, onHoldReason); setShowOnHoldPicker(false); setOnHoldReason(''); setOnHoldDate(''); }}
                            disabled={!onHoldDate || !onHoldReason}
                            className="flex-1 py-1.5 bg-gray-800 text-white text-[10px] font-bold rounded-lg disabled:opacity-40 transition">
                            Confirm
                          </button>
                          <button onClick={() => { setShowOnHoldPicker(false); setOnHoldReason(''); setOnHoldDate(''); }} className="px-2 text-gray-400 hover:text-gray-600 text-sm">×</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowOnHoldPicker(true)}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 bg-gradient-to-r from-gray-500 to-gray-600">
                        On Hold
                      </button>
                    )}
                  </div>
                  <button onClick={handleReadyToShipment}
                    className="w-full py-3 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-amber-900/10 bg-gradient-to-r from-amber-500 to-amber-600">
                    Ready to Shipment
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Detail Modal (Mobile) */}
      {selected && (
        <div className="lg:hidden">
          <Modal hideHeader={true} onClose={() => { setSelected(null); setEditMode(false); }}>
            <div className="-mx-4 -mt-4 mb-5 px-6 py-6 rounded-b-3xl relative" style={{ background: 'linear-gradient(135deg, #064e3b, #065f46)' }}>
              <button onClick={() => { setSelected(null); setEditMode(false); }}
                className="absolute right-4 top-4 w-7 h-7 flex items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-all text-xl">
                ×
              </button>
              <div className="flex items-center gap-4 pr-8">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-xl ${getAvatarColor(selected._id)}`}>
                  {initials(selected.lead?.name || selected.title)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold text-lg tracking-tight truncate">{selected.lead?.name || selected.title}</h3>
                  <p className="text-emerald-300/70 text-sm font-medium">{selected.lead?.phone}</p>
                </div>
              </div>
            </div>

            <div className="space-y-0 px-2">
              {editMode ? (
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Name</label>
                      <input className={`${inputCls} mt-1`} value={editForm.name} onChange={e => sf('name', e.target.value)} /></div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone</label>
                      <input className={`${inputCls} mt-1`} value={editForm.phone} onChange={e => sf('phone', e.target.value)} /></div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Problem</label>
                      <textarea rows={1} className={`${inputCls} mt-1`} value={editForm.problem} onChange={e => sf('problem', e.target.value)} /></div>
                    <div className="grid grid-cols-3 gap-2">
                      <input type="number" placeholder="Age" className={inputCls} value={editForm.age} onChange={e => sf('age', e.target.value)} />
                      <input type="number" placeholder="Wt" className={inputCls} value={editForm.weight} onChange={e => sf('weight', e.target.value)} />
                      <input type="number" step="0.1" placeholder="Ht" className={inputCls} value={editForm.height} onChange={e => sf('height', e.target.value)} />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 pb-2">
                    <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-green-600 shadow-md">Save</button>
                    <button type="button" onClick={() => setEditMode(false)} className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-500 bg-gray-100">Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <SectionHead label="Customer Info" />
                  <DetailRow label="Task" value={selected.title} />
                  <div className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-28 shrink-0 mt-0.5">Patient Type</span>
                    <span className="text-sm text-gray-800 font-medium capitalize flex-1">
                      {isOldPatientVerification(selected)
                        ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-black uppercase"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />{getKitText(getDisplayKit(selected))} (Returning)</span>
                        : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-black uppercase"><span className="w-2 h-2 rounded-full bg-blue-500" />New Patient</span>
                      }
                    </span>
                    <button type="button" onClick={() => { setSelectedPatientType(isOldPatientVerification(selected) ? String(getDisplayKit(selected) || 2) : 'new'); setShowPatientTypeModal(true); }}
                      className="text-[10px] font-bold text-green-600 hover:bg-green-50 px-2 py-0.5 rounded border border-green-200 transition">
                      Change
                    </button>
                  </div>
                  <DetailRow label="Assigned" value={selected.assignedTo?.name} />
                  <DetailRow label="Problem" value={selected.problem} />
                  <DetailRow label="Duration" value={selected.problemDuration} />

                  <SectionHead label="Address Details" />
                  <DetailRow label="City/Village" value={selected.cityVillage} />
                  <DetailRow label="Pincode" value={selected.pincode} />
                  <DetailRow label="Landmark" value={selected.landmark} />

                  <SectionHead label="Order Details" />
                  <DetailRow label="Price" value={selected.price ? `₹${selected.price}` : null} />
                  {selected.relief_percentage != null && (
                    <div className="flex items-start gap-3 py-2 border-b border-gray-50">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-28 shrink-0 mt-0.5">Relief %</span>
                      <span className="text-sm font-black text-emerald-600">{selected.relief_percentage}%</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 pt-6 pb-4">
                    <div className="flex gap-2.5">
                      <button onClick={() => handleStatusUpdate('verified')}
                        className="flex-1 py-4 rounded-xl text-[11px] font-bold text-white shadow-lg shadow-emerald-900/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                        <VerifyIcon className="w-4 h-4" /> VERIFY RECORD
                      </button>
                      <button onClick={() => setEditMode(true)}
                        className="px-6 py-4 rounded-xl text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-100 transition-all active:scale-[0.98]">
                        EDIT
                      </button>
                    </div>
                    <button onClick={handleReadyToShipment}
                      className="w-full py-4 rounded-xl text-[11px] font-bold text-white shadow-lg shadow-amber-900/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M5 8h14M5 8a2 2 0 1 0 0-4h14a2 2 0 1 0 0 4M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
                      </svg>
                      READY TO SHIPMENT
                    </button>
                    <button onClick={(e) => handleDelete(selected._id, e)}
                      className="w-full py-3 mt-2 rounded-xl text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 transition-all hover:bg-rose-100 active:scale-[0.98] flex items-center justify-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                      DELETE RECORD
                    </button>
                  </div>
                </>
              )}
            </div>
          </Modal>
        </div>
      )}

      {showAssignModal && (
        <Modal title="Assign Verification Task" onClose={() => setShowAssignModal(false)}>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              await updateVerificationRecord(selected._id, { assignedTo: assignTo });
              await load();
              await loadOnHold();
              setSelected(prev => ({ ...prev, assignedTo: allUsers.find(u => u._id === assignTo) || prev.assignedTo }));
              setShowAssignModal(false);
            } catch (err) {
              alert('Assignment failed: ' + (err.response?.data?.message || err.message));
            } finally {
              setSaving(false);
            }
          }} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Select Verifier</label>
              <select required className={inputCls} value={assignTo} onChange={e => setAssignTo(e.target.value)}>
                <option value="">Select staff</option>
                {allUsers.map(u => <option key={u._id} value={u._id}>{u.name} ({u.role?.toUpperCase()})</option>)}
              </select>
            </div>
            <button type="submit" disabled={saving} className="w-full py-3 bg-green-600 text-white text-xs font-bold rounded-xl shadow-md transition-all">Assign Now</button>
          </form>
        </Modal>
      )}

      {showPatientTypeModal && (
        <Modal title="Change Patient Type" onClose={() => setShowPatientTypeModal(false)}>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              const leadId = selected.lead?._id || selected.lead;
              if (selectedPatientType === 'new') {
                if (leadId) await updateLead(leadId, { status: 'new', pending_reorder_source: null });
              } else {
                if (leadId) await updateLead(leadId, { status: 'old' });
              }
              await load();
              await loadOnHold();
              const freshData = await getVerificationRecords();
              const freshRecords = Array.isArray(freshData) ? freshData : [];
              setRecords(freshRecords);
              const freshSelected = freshRecords.find(r => r._id === selected._id);
              if (freshSelected) setSelected(flattenRecord(freshSelected));
              setShowPatientTypeModal(false);
            } catch (err) {
              alert('Update failed: ' + (err.response?.data?.message || err.message));
            } finally {
              setSaving(false);
            }
          }} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Select Patient Type</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'new', label: 'New Patient', color: 'blue' },
                  { value: '2', label: '2nd Kit', color: 'amber' },
                  { value: '3', label: '3rd Kit', color: 'amber' },
                  { value: '4', label: '4th Kit', color: 'amber' },
                  { value: '5', label: '5th Kit', color: 'amber' },
                  { value: '6', label: '6th Kit', color: 'amber' },
                ].map(opt => (
                  <button key={opt.value} type="button" onClick={() => setSelectedPatientType(opt.value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                      selectedPatientType === opt.value
                        ? opt.color === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-400 shadow-md' : 'bg-amber-50 text-amber-700 border-amber-400 shadow-md'
                        : 'bg-white text-gray-500 border-gray-100 hover:border-gray-300'
                    }`}>
                    <span className={`w-2 h-2 rounded-full ${selectedPatientType === opt.value ? (opt.color === 'blue' ? 'bg-blue-500' : 'bg-amber-500') : 'bg-gray-300'}`} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" disabled={saving}
              className="w-full py-3 bg-green-600 text-white text-xs font-bold rounded-xl shadow-md transition-all hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Updating...' : 'Update Patient Type'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
