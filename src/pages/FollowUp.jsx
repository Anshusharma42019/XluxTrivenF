import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const PER_PAGE = 20;
const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition";
const ordinal = n => {
  const value = Number(n) + 1;
  const suffix = value % 10 === 1 && value % 100 !== 11 ? 'st' : value % 10 === 2 && value % 100 !== 12 ? 'nd' : value % 10 === 3 && value % 100 !== 13 ? 'rd' : 'th';
  return `${value}${suffix}`;
};

const PIN_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-rose-500', 'bg-amber-500', 'bg-cyan-500', 'bg-pink-500',
];

const DEPARTMENTS = ['migraine', 'piles'];

const ROLE_GRADIENT = [
  'from-purple-500 to-violet-600',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-orange-500 to-amber-500',
  'from-rose-500 to-red-500'
];

const initials = (name) =>
  (name || '').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const formatDate = (value, options) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', options);
};

const toDateInputValue = (value = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
};

const isOldPatient = (order) =>
  (order.kit_number || 1) > 1 || !!(order.source_order_id || order.lead_id?.status === 'old');

const getKitText = (num) => {
  if (!num || num === 1) return '1st Kit';
  if (num === 2) return '2nd Kit';
  if (num === 3) return '3rd Kit';
  return `${num}th Kit`;
};

const getFollowup = (order, followupNumber) =>
  (order.followups || []).find(f => f.followup_number === Number(followupNumber));

const previousFollowupsDone = (order, followupNumber) =>
  (order.followups || [])
    .filter(f => f.followup_number < Number(followupNumber))
    .every(f => f.completed);

const isDue = (value, inputDate) => {
  if (!value) return false;
  const date = new Date(value);
  if (!inputDate) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return date <= today;
  }
  return toDateInputValue(value) <= inputDate;
};

const DetailRow = ({ label, value }) =>
  value ? (
    <div className="flex items-start gap-2 sm:gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-gray-400 w-20 sm:w-28 shrink-0 mt-0.5">{label}</span>
      <span className="text-xs sm:text-sm text-gray-800 font-medium flex-1">{value}</span>
    </div>
  ) : null;

const SectionHead = ({ label }) => (
  <div className="flex items-center gap-2 mt-5 mb-2">
    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">{label}</span>
    <div className="flex-1 h-px bg-emerald-100" />
  </div>
);

export default function FollowUp() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'support';
  const [searchParams, setSearchParams] = useSearchParams();
  const [department, setDepartment] = useState('');
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [filterDelivered, setFilterDelivered] = useState(() => toDateInputValue(new Date()));
  const [filterFollowupNum, setFilterFollowupNum] = useState(() =>
    new URLSearchParams(window.location.search).get('phone') ? '' : '1'
  );
  const [selected, setSelected] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [completedMap, setCompletedMap] = useState({});
  const [doneLoading, setDoneLoading] = useState(null);
  const [search, setSearch] = useState(() =>
    new URLSearchParams(window.location.search).get('phone') || ''
  );
  const [completedList, setCompletedList] = useState([]);
  const [completedTotal, setCompletedTotal] = useState(0);
  const [completedPage, setCompletedPage] = useState(1);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [settings, setSettings] = useState({ total_followups: 5, followup_gap_days: 6 });
  const [filterPatientType, setFilterPatientType] = useState('all'); // 'all' | 'old' | 'new'
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const followupNumbers = Array.from({ length: Number(settings.total_followups) || 5 }, (_, i) => i + 1);

  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ 
    name: '', phone: '', city: '', state: '', medicine: '', problem: '',
    delivered_date: '', amount: '', order_id: '', courier_name: '', 
    payment_method: '', pincode: '', address: '' 
  });
  const [manualSaving, setManualSaving] = useState(false);
  const [autofilling, setAutofilling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/shiprocket/orders/with-followups', { params: department ? { department } : {} });
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setAll(data);
      return data.length;
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
      return 0;
    } finally { setLoading(false); }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const res = await api.get('/shiprocket/settings/followups-commission');
      if (res.data?.data) setSettings(res.data.data);
    } catch { /* keep defaults */ }
  }, []);

  const loadCompleted = useCallback(async (pg = 1, q = '') => {
    setCompletedLoading(true);
    try {
      const res = await api.get('/shiprocket/orders/completed-followups', { params: { page: pg, per_page: PER_PAGE, search: q || undefined, ...(department && { department }) } });
      setCompletedList(Array.isArray(res.data?.data?.data) ? res.data.data.data : []);
      setCompletedTotal(res.data?.data?.total || 0);
    } catch (e) { setError(e?.response?.data?.message || e.message); }
    finally { setCompletedLoading(false); }
  }, []);

  const syncAndLoad = async () => {
    setSyncing(true); setError('');
    try { await api.post('/shiprocket/orders/sync'); } catch { }
    finally { setSyncing(false); }
    await load();
  };

  useEffect(() => {
    loadSettings();
    load().then(count => {
      if (count === 0 && !department) syncAndLoad();
      loadCompleted(1);
    });
  }, [load, loadCompleted, loadSettings, department]);

  const handleFollowUpDone = async (orderId) => {
    const oid = String(orderId);
    setDoneLoading(oid);
    try {
      const res = await api.post(`/shiprocket/orders/${oid}/complete-followup`);
      const { completedCount, next_follow_up } = res.data.data;
      setCompletedMap(prev => ({ ...prev, [oid]: completedCount }));
      const totalFollowups = Number(settings.total_followups) || 5;
      // Auto-switch to next call tab
      if (filterFollowupNum && completedCount < totalFollowups) {
        setFilterFollowupNum(String(completedCount + 1));
        setPage(1);
      }
      if (completedCount >= totalFollowups) {
         // Use selected (most up-to-date) or fall back to all
         const doneOrder = selected && String(selected._id) === oid ? selected : all.find(o => String(o._id) === oid);
         setAll(prev => prev.filter(o => String(o._id) !== oid));
         const finalOrder = doneOrder ? { ...doneOrder, all_followups_done: true } : null;
         if (finalOrder) {
           setCompletedList(prev => [finalOrder, ...prev]);
           setCompletedTotal(prev => prev + 1);
         }
         setSelected(null);
         return;
      }
      setAll(prev => prev.map(o => {
        if (String(o._id) !== oid) return o;
        
        let baseDate = new Date();
        const updatedFUs = (o.followups || []).map(f => {
          if (f.followup_number === completedCount) {
             return { ...f, completed: true, completed_at: new Date().toISOString() };
          }
          if (f.followup_number > completedCount) {
             baseDate.setDate(baseDate.getDate() + (Number(settings.followup_gap_days) || 6));
             return { ...f, scheduled_date: new Date(baseDate).toISOString() };
          }
          return f;
        });

        return { ...o, next_follow_up, followups: updatedFUs };
      }));
      if (selected?._id === orderId) {
          const updatedSelected = { ...selected, next_follow_up };
          let baseSel = new Date();
          updatedSelected.followups = (selected.followups || []).map(f => {
              if (f.followup_number === completedCount) return { ...f, completed: true, completed_at: new Date().toISOString() };
              if (f.followup_number > completedCount) {
                  baseSel.setDate(baseSel.getDate() + (Number(settings.followup_gap_days) || 6));
                  return { ...f, scheduled_date: new Date(baseSel).toISOString() };
              }
              return f;
          });
          setSelected(updatedSelected);
          api.get(`/shiprocket/orders/${oid}/activity`)
            .then(r => setActivity(Array.isArray(r.data?.data) ? r.data.data : []))
            .catch(() => {});
      }
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally { setDoneLoading(null); }
  };

  const handleSendToVerification = async (oid) => {
    if (!window.confirm('Are you sure you want to send this customer back to Verification for a new cycle?')) return;
    setDoneLoading(String(oid));
    try {
      await api.post(`/shiprocket/orders/${oid}/send-to-verification`);
      const verificationActivity = {
        _id: Date.now().toString(),
        title: 'Sent to Verification',
        description: 'Order sent back to Verification for a new cycle.',
        actor: { name: 'Staff' },
        occurred_at: new Date().toISOString(),
      };
      // Use selected (most up-to-date) or fall back to all list
      const orderData = (selected && String(selected._id) === String(oid))
        ? selected
        : all.find(o => String(o._id) === String(oid)) || completedList.find(o => String(o._id) === String(oid));
      // Remove from active list
      setAll(prev => prev.filter(o => String(o._id) !== String(oid)));
      // Always add/update in completed list
      if (orderData) {
        const sentOrder = { ...orderData, sent_to_verification: true };
        setCompletedList(prev => {
          const exists = prev.some(o => String(o._id) === String(oid));
          if (exists) return prev.map(o => String(o._id) === String(oid) ? sentOrder : o);
          setCompletedTotal(t => t + 1);
          return [sentOrder, ...prev];
        });
      }
      // Update activity and keep modal open
      if (selected && String(selected._id) === String(oid)) {
        setActivity(prev => [verificationActivity, ...prev]);
        setSelected(prev => prev ? { ...prev, sent_to_verification: true } : prev);
      }
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    } finally {
      setDoneLoading(null);
    }
  };

  const saveNote = async () => {
    if (!selected || !noteText.trim()) return;
    setNoteSaving(true);
    try {
      const res = await api.patch(`/shiprocket/orders/${selected._id}/notes`, { text: noteText, type: 'followup' });
      const newComments = res.data.data;
      setAll(prev => prev.map(o => String(o._id) === String(selected._id) ? { ...o, comments: newComments } : o));
      setSelected(prev => ({ ...prev, comments: newComments }));
      setNoteText('');
    } catch (e) {
      alert('Failed to save note: ' + (e?.response?.data?.message || e.message));
    } finally { setNoteSaving(false); }
  };

  const saveContact = async () => {
    if (!selected) return;
    setEditSaving(true);
    try {
      const res = await api.patch(`/shiprocket/orders/${selected._id}/contact`, editFields);
      const updated = { ...selected, ...res.data.data };
      setSelected(updated);
      setAll(prev => prev.map(o => String(o._id) === String(selected._id) ? { ...o, ...res.data.data } : o));
      setEditMode(false);
    } catch (e) {
      alert('Failed to save: ' + (e?.response?.data?.message || e.message));
    } finally { setEditSaving(false); }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setManualSaving(true);
    try {
      await api.post('/shiprocket/orders/manual-followup', manualForm);
      setManualModalOpen(false);
      setManualForm({ 
        name: '', phone: '', city: '', state: '', medicine: '', problem: '',
        delivered_date: '', amount: '', order_id: '', courier_name: '', 
        payment_method: '', pincode: '', address: '' 
      });
      await syncAndLoad();
    } catch (err) {
      alert(err?.response?.data?.message || err.message);
    } finally {
      setManualSaving(false);
    }
  };

  useEffect(() => {
    let phoneDigits = manualForm.phone.replace(/\D/g, '');
    if (phoneDigits.length >= 10 && manualModalOpen) {
      const last10 = phoneDigits.slice(-10);
      const autofill = async () => {
        setAutofilling(true);
        try {
          const res = await api.get(`/shiprocket/orders/search-by-phone?phone=${last10}`);
          if (res.data?.data) {
            const data = res.data.data;
            setManualForm(prev => ({
              ...prev,
              name: data.billing_customer_name || data.name || prev.name || '',
              city: data.billing_city || data.city || prev.city || '',
              state: data.billing_state || data.state || prev.state || '',
              medicine: data.order_items?.[0]?.name || data.products?.map(p=>p.name).join(', ') || prev.medicine || '',
              problem: data.problem || data.notes || prev.problem || '',
              amount: data.sub_total || data.total_amount || prev.amount || '',
              delivered_date: data.delivered_at ? toDateInputValue(data.delivered_at) : (data.createdAt ? toDateInputValue(data.createdAt) : prev.delivered_date || ''),
              order_id: data.order_id || data.shiprocket_order_id || prev.order_id || '',
              courier_name: data.courier_name || prev.courier_name || '',
              payment_method: data.payment_method || prev.payment_method || '',
              pincode: data.billing_pincode || prev.pincode || '',
              address: data.billing_address || prev.address || '',
            }));
          }
        } catch (e) {
          // silent error on autofill
        } finally {
          setAutofilling(false);
        }
      };
      autofill();
    }
  }, [manualForm.phone, manualModalOpen]);

  const dueCounts = followupNumbers.reduce((acc, n) => {
    acc[n] = all.filter(o => {
      const fu = getFollowup(o, n);
      return fu && !fu.completed && previousFollowupsDone(o, n) && isDue(fu.scheduled_date, filterDelivered);
    }).length;
    return acc;
  }, {});

  // Patient type counts (for all active orders)
  const patientTypeCounts = {
    old: all.filter(o => isOldPatient(o)).length,
    new: all.filter(o => !isOldPatient(o)).length,
  };

  const filtered = all.filter(o => {
    // Exclude orders that are fully done or sent to verification
    const allFUs = (o.followups || []).sort((a, b) => a.followup_number - b.followup_number);
    const completedCount = completedMap[o._id] ?? allFUs.filter(f => f.completed).length;
    const totalFU = Number(settings.total_followups) || 5;
    if (completedCount >= totalFU || o.sent_to_verification || o.followup_done) return false;
    if (filterFollowupNum) {
      const fu = getFollowup(o, filterFollowupNum);
      if (!fu || fu.completed || !previousFollowupsDone(o, filterFollowupNum) || !isDue(fu.scheduled_date, filterDelivered)) return false;
    }
    // Patient type filter
    if (filterPatientType === 'old' && !isOldPatient(o)) return false;
    if (filterPatientType === 'new' && isOldPatient(o)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        o.billing_customer_name?.toLowerCase().includes(q) ||
        o.billing_phone?.includes(q) ||
        o.billing_city?.toLowerCase().includes(q) ||
        o.order_id?.toString().includes(q) ||
        o.awb_code?.toLowerCase().includes(q) ||
        (o.order_items || []).some(item => item.name?.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleSelect = (order) => {
    setSelected(order);
    setNoteText('');
    setActivity([]);
    setEditMode(false);
    setEditFields({});
    setActivityLoading(true);
    api.get(`/shiprocket/orders/${order._id}/activity`)
      .then(res => setActivity(Array.isArray(res.data?.data) ? res.data.data : []))
      .catch(() => setActivity([]))
      .finally(() => setActivityLoading(false));
  };

  return (
    <div className="min-h-full bg-glow pb-10 px-3 sm:px-6 lg:px-8 space-y-8 pt-4">
      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 overflow-x-auto pb-2 no-scrollbar lg:overflow-visible">
        {followupNumbers.map((n, i) => {
          const colors = ['from-emerald-400 to-teal-500', 'from-blue-400 to-indigo-500', 'from-amber-400 to-orange-500', 'from-rose-400 to-red-500', 'from-purple-400 to-violet-500'];
          const icons = ['M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', 'M16 3h5m0 0v5m0-5l-6 6M5 3l6 6m-6-6v5m0-5h5', 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129', 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', 'M5 13l4 4L19 7'];
          const count = dueCounts[n] || 0;
          const label = `${ordinal(n - 1)} Call`;
          const color = colors[i % colors.length];
          const icon = icons[i % icons.length];
          
          return (
            <div key={n} className="bg-white rounded-2xl p-3 sm:p-5 shadow-sm border border-gray-100/50 hover:shadow-lg transition-all min-w-[140px] sm:min-w-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={`w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white shrink-0 shadow-lg`}>
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={icon}/></svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[8px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest truncate">{label}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg sm:text-2xl font-black text-gray-900">{count}</span>
                    <span className="text-[8px] sm:text-[9px] font-bold text-gray-300">DUE</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full">
          {/* Tabs Container */}
          <div className="flex items-center bg-white rounded-2xl border border-gray-100 p-1 shadow-sm overflow-x-auto no-scrollbar max-w-full">
            <button
              type="button"
              onClick={() => { setShowCompleted(false); setFilterFollowupNum(''); setPage(1); }}
              className={`px-4 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition whitespace-nowrap ${
                !showCompleted && !filterFollowupNum ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              All ({all.length})
            </button>
            {followupNumbers.map(n => {
              const active = !showCompleted && filterFollowupNum === String(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => { setShowCompleted(false); setFilterFollowupNum(String(n)); setPage(1); }}
                  className={`px-4 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition whitespace-nowrap ${
                    active ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {ordinal(n - 1)} ({dueCounts[n] || 0})
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => { setShowCompleted(true); setCompletedPage(1); loadCompleted(1, search); }}
              className={`px-4 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition whitespace-nowrap ${
                showCompleted ? 'bg-gray-800 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              ✅ Done ({completedTotal})
            </button>
            {canManage && (
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-gray-100 bg-white text-[11px] font-black uppercase tracking-widest text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition shadow-sm ml-2"
              >
                <option value="">ALL DEPTS</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
          </div>

          {/* Patient Type Filter (Old / New) */}
          <div className="flex items-center bg-white rounded-2xl border border-gray-100 p-1 shadow-sm">
            <button
              type="button"
              onClick={() => { setFilterPatientType('all'); setPage(1); }}
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition whitespace-nowrap ${
                filterPatientType === 'all' ? 'bg-gray-800 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              All Patients
            </button>
            <button
              type="button"
              onClick={() => { setFilterPatientType('new'); setPage(1); }}
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition whitespace-nowrap flex items-center gap-1.5 ${
                filterPatientType === 'new' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" style={filterPatientType !== 'new' ? {background:'#93c5fd'} : {}} />
              New ({patientTypeCounts.new})
            </button>
            <button
              type="button"
              onClick={() => { setFilterPatientType('old'); setPage(1); }}
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition whitespace-nowrap flex items-center gap-1.5 ${
                filterPatientType === 'old' ? 'bg-amber-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" style={filterPatientType !== 'old' ? {background:'#fcd34d'} : {}} />
              Old ({patientTypeCounts.old})
            </button>
          </div>

          <div className="flex flex-col sm:flex-row flex-1 items-center gap-3 w-full">
            <div className="relative group w-full sm:w-auto sm:min-w-[160px]">
              <input 
                type="date" 
                value={filterDelivered} 
                onChange={(e) => { setFilterDelivered(e.target.value); setPage(1); }}
                className="w-full bg-white border border-gray-100 rounded-2xl px-4 py-3 text-xs font-black text-gray-700 focus:ring-4 focus:ring-emerald-500/10 transition-all cursor-pointer shadow-sm hover:shadow-md"
              />
            </div>

            <div className="relative w-full sm:flex-1 sm:max-w-[300px]">
               <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                 <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
               </svg>
               <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                 placeholder="Search name, phone, awb..."
                 className="w-full pl-11 pr-5 py-3 rounded-2xl border border-gray-100 bg-white text-xs font-bold text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-emerald-400/20 transition shadow-sm" />
            </div>

            <button onClick={() => setManualModalOpen(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black text-white shadow-xl hover:-translate-y-1 transition-all uppercase tracking-widest active:scale-95"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              <span>Manual Add</span>
            </button>

            <button onClick={syncAndLoad} disabled={syncing || loading}
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black text-white shadow-xl hover:-translate-y-1 transition-all uppercase tracking-widest active:scale-95 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <svg className={`w-4 h-4 ${syncing || loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
              <span>{syncing ? 'Syncing...' : 'Sync Data'}</span>
            </button>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-100 rounded-2xl px-6 py-4 text-red-600 text-sm font-bold shadow-sm">{error}</div>}

      {/* Completed Follow-ups Table */}
      {showCompleted ? (
      <div className="premium-card overflow-hidden">
        {completedLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center gap-3 text-gray-400">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              Loading completed follow ups...
            </div>
          </div>
        ) : completedList.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-20 h-20 rounded-[2.5rem] bg-gray-100 flex items-center justify-center mx-auto mb-6 text-gray-300">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            </div>
            <p className="text-xl font-bold text-gray-400">No completed follow-ups yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar -mx-2 sm:-mx-4 lg:-mx-6 px-2 sm:px-4 lg:px-6">
            {/* Desktop Table */}
            <table className="hidden xl:table w-full text-xs min-w-[850px]">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100 text-left bg-white">
                  <th className="py-5 px-6 font-black uppercase tracking-[0.15em] text-[10px]">Customer</th>
                  <th className="py-5 px-2 font-black uppercase tracking-[0.15em] text-[10px]">Contact</th>
                  <th className="py-5 px-2 font-black uppercase tracking-[0.15em] text-[10px]">Medicine</th>
                  <th className="py-5 px-2 font-black uppercase tracking-[0.15em] text-[10px] text-center">Delivered</th>
                  <th className="py-5 px-2 font-black uppercase tracking-[0.15em] text-[10px] text-center">Status</th>
                  <th className="py-5 px-2 font-black uppercase tracking-[0.15em] text-[10px] text-center">Amount</th>
                  <th className="py-5 px-2 font-black uppercase tracking-[0.15em] text-[10px] text-center">Mark Down</th>
                  <th className="py-5 px-6 font-black uppercase tracking-[0.15em] text-[10px] text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50/50">
                {completedList.map((o, i) => (
                  <tr key={o._id} className="transition-all duration-300 group hover:bg-gray-50/30 dark:hover:bg-white/5">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center text-white text-sm font-black shadow-lg shadow-black/5 shrink-0`}>{initials(o.billing_customer_name)}</div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-800 text-sm truncate">{o.billing_customer_name || '—'}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <a href={`https://shiprocket.co/tracking/${o.awb_code}`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black uppercase tracking-widest text-gray-400 py-0.5 px-1.5 bg-gray-50 rounded-lg border border-gray-100 hover:text-blue-600 transition-colors">
                              {o.awb_code}
                            </a>
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">✓ All Done</span>
                            {isOldPatient(o) ? (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{getKitText(o.kit_number || 1)}
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />1st Kit (NEW)
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-1 flex flex-col gap-0.5">
                            <>
                              <span>Added: <strong className="text-gray-600">{o.lead_id?.createdBy?.name || o.lead_id?.assignedTo?.name || o.created_by?.name || '—'}</strong></span>
                              {isOldPatient(o) && (
                                <span>Verifier: <strong className="text-gray-600">{o.verified_by?.name || '—'}</strong></span>
                              )}
                            </>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-gray-700">{o.billing_phone}</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">{o.billing_city}{o.billing_state ? `, ${o.billing_state}` : ''}</span>
                      </div>
                    </td>
                    <td className="py-4 px-2">
                      <span className="text-xs font-bold text-gray-700 truncate max-w-[140px]" title={o.order_items?.[0]?.name}>{o.order_items?.[0]?.name || '—'}</span>
                    </td>
                    <td className="py-4 px-2 text-center">
                      <span className="text-sm font-bold text-gray-600 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">{formatDate(o.delivered_at || o.createdAt, { day: '2-digit', month: 'short' })}</span>
                    </td>
                    <td className="py-4 px-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {Array.from({ length: Number(settings.total_followups) || 5 }, (_, idx) => (
                          <div key={idx} className="text-[10px] font-black w-7 h-7 flex items-center justify-center rounded-lg border bg-emerald-100 text-emerald-600 border-emerald-200">{idx + 1}</div>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-2 text-center"><span className="text-sm font-black text-gray-700">₹{o.sub_total}</span></td>
                    <td className="py-4 px-2 text-center">
                      <button
                        onClick={() => !o.sent_to_verification && handleSendToVerification(o._id)}
                        disabled={doneLoading === String(o._id) || !!o.sent_to_verification}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${
                          o.sent_to_verification
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                            : 'bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white disabled:opacity-50'
                        }`}>
                        {o.sent_to_verification ? '✓ Sent' : doneLoading === String(o._id) ? '...' : 'Verification'}
                      </button>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button onClick={() => handleSelect(o)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 text-gray-700 hover:bg-emerald-600 hover:text-white transition-all shadow-sm hover:shadow-lg">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Cards */}
            <div className="xl:hidden divide-y divide-gray-100">
              {completedList.map((o) => {
                const completedCount = completedMap[o._id] ?? (o.followups || []).filter(f => f.completed).length;
                return (
                <div key={o._id} className="p-4 bg-white hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 font-black shrink-0 shadow-sm">{initials(o.billing_customer_name)}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 text-sm truncate">{o.billing_customer_name}</p>
                          {isOldPatient(o) ? (
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-200 uppercase shrink-0">{getKitText(o.kit_number || 1)}</span>
                          ) : (
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 border border-blue-200 uppercase shrink-0">1st Kit (NEW)</span>
                          )}
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{o.billing_phone} • {o.billing_city}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-gray-900 text-sm">₹{o.sub_total}</p>
                      <span className="inline-block text-[9px] font-bold text-emerald-600 uppercase bg-emerald-50 px-2 py-0.5 rounded-full mt-1 border border-emerald-100">✓ Done</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-gray-50 rounded-xl p-2.5 border border-gray-100 mb-3">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Number(settings.total_followups) || 5 }, (_, idx) => (
                        <div key={idx} className="w-6 h-6 rounded-lg text-[9px] font-black flex items-center justify-center bg-emerald-100 text-emerald-600 border border-emerald-200">
                          {idx + 1}
                        </div>
                      ))}
                    </div>
                    <div className="text-[10px] font-bold text-gray-400">
                      Delivered: <span className="text-gray-700">{formatDate(o.delivered_at || o.createdAt, { day: '2-digit', month: 'short' })}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                     <button onClick={() => !o.sent_to_verification && handleSendToVerification(o._id)} disabled={doneLoading === String(o._id) || !!o.sent_to_verification}
                       className={`flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                         o.sent_to_verification ? 'bg-gray-100 text-gray-400' : 'bg-orange-50 text-orange-600 border border-orange-100 shadow-sm'
                       }`}>
                       {o.sent_to_verification ? 'Sent' : 'Verification'}
                     </button>
                     <button onClick={() => handleSelect(o)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-900 text-white shadow-lg shrink-0">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                     </button>
                  </div>
                </div>
              )})}
            </div>
          </div>
        )}
        {(() => { const tp = Math.ceil(completedTotal / PER_PAGE); return tp > 1 ? (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Page {completedPage} of {tp}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => { const p = Math.max(1, completedPage - 1); setCompletedPage(p); loadCompleted(p, search); }} disabled={completedPage === 1} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6"/></svg>
              </button>
              <button onClick={() => { const p = Math.min(tp, completedPage + 1); setCompletedPage(p); loadCompleted(p, search); }} disabled={completedPage === tp} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        ) : null; })()}
      </div>
      ) : (
      /* Main Table Container */
      <div className="premium-card overflow-hidden">
        {loading && all.length === 0 ? (
           <div className="flex items-center justify-center h-64">
             <div className="flex items-center gap-3 text-gray-400">
               <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
               Loading follow ups...
             </div>
           </div>
        ) : filtered.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-20 h-20 rounded-[2.5rem] bg-emerald-50 flex items-center justify-center mx-auto mb-6 text-emerald-300 animate-float">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <p className="text-xl font-bold text-gray-400">No {ordinal(Number(filterFollowupNum) - 1)} follow-ups found</p>
            <p className="text-sm text-gray-300 mt-2">{search ? 'Try a different search' : `Nothing due on ${formatDate(filterDelivered)}`}</p>
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar -mx-2 sm:-mx-4 lg:-mx-6 px-2 sm:px-4 lg:px-6">
            {/* Desktop Table */}
            <table className="hidden xl:table w-full text-xs min-w-[850px]">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100 text-left bg-white">
                  <th className="py-4 px-6 font-black uppercase tracking-wider text-[10px]">Customer Order</th>
                  <th className="py-4 px-2 font-black uppercase tracking-wider text-[10px]">Location & Contact</th>
                  <th className="py-4 px-2 font-black uppercase tracking-wider text-[10px]">Medicine</th>
                  <th className="py-4 px-2 font-black uppercase tracking-wider text-[10px] text-center">Delivered</th>
                  <th className="py-4 px-2 font-black uppercase tracking-wider text-[10px] text-center">Progress</th>
                  <th className="py-4 px-2 font-black uppercase tracking-wider text-[10px] text-center">Next Call</th>
                  <th className="py-4 px-2 font-black uppercase tracking-wider text-[10px] text-center">Amount</th>
                  <th className="py-4 px-6 font-black uppercase tracking-wider text-[10px] text-right">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50/50">
                {paged.map((o, i) => {
                  const gradient = ROLE_GRADIENT[i % ROLE_GRADIENT.length];
                  const allFUs = (o.followups || []).sort((a, b) => a.followup_number - b.followup_number);
                  const completedCount = completedMap[o._id] ?? allFUs.filter(f => f.completed).length;
                  const allDone = completedCount >= (Number(settings.total_followups) || 5);
                  const activeFU = getFollowup(o, filterFollowupNum) || allFUs[completedCount];
                  
                  return (
                    <tr key={o._id} className="transition-all duration-300 group hover:bg-emerald-50/20 dark:hover:bg-white/5">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-base font-black shadow-lg shadow-black/5 group-hover:scale-110 transition-transform duration-300 shrink-0`}>
                            {initials(o.billing_customer_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-800 text-sm truncate">{o.billing_customer_name || '—'}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <a href={`https://shiprocket.co/tracking/${o.awb_code}`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black uppercase tracking-widest text-gray-400 py-0.5 px-1.5 bg-gray-50 rounded-lg border border-gray-100 hover:text-blue-600 transition-colors">
                                {o.awb_code}
                              </a>
                              {o.lead_id?.department && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 uppercase">{o.lead_id.department}</span>
                              )}
                              {isOldPatient(o) ? (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />{getKitText(o.kit_number || 1)}
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />1st Kit (NEW)
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-1 flex flex-col gap-0.5">
                              <>
                                <span>Added: <strong className="text-gray-600">{o.lead_id?.createdBy?.name || o.lead_id?.assignedTo?.name || o.created_by?.name || '—'}</strong></span>
                                {isOldPatient(o) && (
                                  <span>Verifier: <strong className="text-gray-600">{o.verified_by?.name || '—'}</strong></span>
                                )}
                              </>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-2">
                         <div className="flex flex-col gap-1">
                           <span className="text-sm font-bold text-gray-700">{o.billing_phone}</span>
                           <span className="text-[10px] font-bold text-gray-400 uppercase">{o.billing_city} {o.billing_state ? `, ${o.billing_state}` : ''}</span>
                         </div>
                      </td>
                      <td className="py-4 px-2">
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-gray-700 truncate max-w-[140px]" title={o.order_items?.[0]?.name}>
                            {o.order_items?.[0]?.name || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-2 text-center">
                         <span className="text-sm font-bold text-gray-600 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                           {formatDate(o.delivered_at || o.shiprocket_delivered_date || o.createdAt, { day: '2-digit', month: 'short' })}
                         </span>
                      </td>
                      <td className="py-4 px-2">
                        <div className="flex items-center justify-center gap-1">
                          {Array.from({ length: Number(settings.total_followups) || 5 }, (_, idx) => {
                            const isDone = idx < completedCount;
                            const isCurrent = idx === completedCount && !allDone;
                            return (
                              <div key={idx} 
                                className={`text-[9px] font-black w-6 h-6 flex items-center justify-center rounded-lg border transition-all ${
                                  isDone ? 'bg-gray-100 text-gray-400 border-gray-200' :
                                  isCurrent ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' :
                                  'bg-gray-50 text-gray-300 border-gray-100'
                                }`}>
                                {idx + 1}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-4 px-2 text-center">
                         <div className="flex flex-col items-center gap-1">
                            <span className={`text-[11px] font-black uppercase tracking-widest ${allDone ? 'text-gray-400' : 'text-orange-500'}`}>
                              {allDone ? 'DONE' : formatDate(activeFU?.scheduled_date, { day: '2-digit', month: 'short' })}
                            </span>
                         </div>
                      </td>
                      <td className="py-4 px-2 text-center">
                        <span className="text-sm font-black text-gray-700">₹{o.sub_total}</span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!activeFU?.completed && !allDone && (
                            <button onClick={() => handleFollowUpDone(o._id)} disabled={doneLoading === String(o._id)}
                              className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-50">
                              {doneLoading === String(o._id) ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                              )}
                            </button>
                          )}
                          <button onClick={() => handleSelect(o)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 text-gray-800 hover:bg-gray-900 hover:text-white transition-all shadow-sm active:scale-95">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile Cards */}
            <div className="xl:hidden divide-y divide-gray-100">
              {paged.map((o, i) => {
                const allFUs = (o.followups || []).sort((a, b) => a.followup_number - b.followup_number);
                const completedCount = completedMap[o._id] ?? allFUs.filter(f => f.completed).length;
                const allDone = completedCount >= (Number(settings.total_followups) || 5);
                const activeFU = getFollowup(o, filterFollowupNum) || allFUs[completedCount];
                const gradient = ROLE_GRADIENT[i % ROLE_GRADIENT.length];

                return (
                  <div key={o._id} className="p-4 bg-white hover:bg-gray-50/30 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-base font-black shrink-0 shadow-lg shadow-black/5`}>{initials(o.billing_customer_name)}</div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-gray-900 text-sm truncate">{o.billing_customer_name}</p>
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-200 uppercase shrink-0">{getKitText(o.kit_number || 1)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                             <span className="text-[10px] font-bold text-gray-400 uppercase">{o.billing_phone}</span>
                             <span className="w-1 h-1 rounded-full bg-gray-200" />
                             <span className="text-[10px] font-bold text-gray-400 uppercase truncate">{o.billing_city}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black text-gray-900 text-sm">₹{o.sub_total}</p>
                        <p className="text-[9px] font-bold text-orange-500 uppercase mt-1">
                          {allDone ? 'COMPLETED' : `Next: ${formatDate(activeFU?.scheduled_date, { day: '2-digit', month: 'short' })}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-gray-50 rounded-[1.25rem] p-3 border border-gray-100 mb-4">
                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: Number(settings.total_followups) || 5 }, (_, idx) => {
                          const isDone = idx < completedCount;
                          const isCurrent = idx === completedCount && !allDone;
                          return (
                            <div key={idx} className={`w-6 h-6 rounded-lg text-[9px] font-black flex items-center justify-center border transition-all ${
                              isDone ? 'bg-gray-200 text-gray-400 border-gray-200' :
                              isCurrent ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' :
                              'bg-white text-gray-300 border-gray-200'
                            }`}>{idx + 1}</div>
                          );
                        })}
                      </div>
                      <div className="text-[10px] font-bold text-gray-400">
                        Delivered: <span className="text-gray-700">{formatDate(o.delivered_at || o.createdAt, { day: '2-digit', month: 'short' })}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                       {!activeFU?.completed && !allDone && (
                         <button onClick={() => handleFollowUpDone(o._id)} disabled={doneLoading === String(o._id)}
                           className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50">
                           {doneLoading === String(o._id) ? 'Processing...' : 'Mark Done'}
                         </button>
                       )}
                       <button onClick={() => handleSelect(o)} className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest shadow-lg active:scale-95">
                         View Details
                       </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-3xl">
            <span className="text-[10px] sm:text-[11px] font-black text-gray-400 uppercase tracking-widest">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2 sm:gap-3">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-white hover:shadow-md disabled:opacity-30 transition-all active:scale-95">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6"/></svg>
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-white hover:shadow-md disabled:opacity-30 transition-all active:scale-95">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* View Modal */}
      {selected && (() => {
        const allFUs = (selected.followups || []).sort((a, b) => a.followup_number - b.followup_number);
        const completedCount = completedMap[selected._id] ?? allFUs.filter(f => f.completed).length;
        const allDone = completedCount >= (Number(settings.total_followups) || 5);

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
          <div className="bg-white rounded-[1.5rem] sm:rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
            
            <div className="px-3 sm:px-6 py-3 sm:py-5 shrink-0" style={{ background: 'linear-gradient(135deg, #064e3b, #065f46)' }}>
              <div className="flex items-center gap-3 sm:gap-4">
                <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-base sm:text-xl font-black shadow-lg`}>
                  {initials(selected.billing_customer_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-black text-base sm:text-xl tracking-tight truncate">{selected.billing_customer_name || 'Order Detail'}</h3>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-0.5 sm:mt-1">
                    <p className="text-emerald-300 font-bold text-xs sm:text-sm">{selected.billing_phone}</p>
                    <span className="hidden sm:inline w-1 h-1 rounded-full bg-emerald-400/50" />
                    <p className="text-emerald-300 font-bold text-xs sm:text-sm truncate">
                      <a href={`https://shiprocket.co/tracking/${selected.awb_code}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {selected.awb_code}
                      </a>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={() => {
                      if (editMode) { setEditMode(false); setEditFields({}); }
                      else { setEditMode(true); setEditFields({ billing_phone: selected.billing_phone, billing_city: selected.billing_city, billing_state: selected.billing_state, billing_pincode: selected.billing_pincode, billing_address: selected.billing_address }); }
                    }}
                    className="px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl bg-white/10 text-emerald-100 hover:bg-white/20 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all">
                    {editMode ? 'EXIT' : 'EDIT'}
                  </button>
                  <button onClick={() => setSelected(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg sm:rounded-xl bg-white/10 text-emerald-100 hover:bg-white/20 hover:text-white transition-all text-xl sm:text-2xl leading-none shadow-sm">
                    ×
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 custom-scrollbar bg-gray-50/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <SectionHead label="Order Details" />
                  <DetailRow label="Staff / Agent" value={selected.lead_id?.assignedTo?.name ? `👤 ${selected.lead_id.assignedTo.name}` : (selected.lead_id?.createdBy?.name ? `👤 ${selected.lead_id.createdBy.name}` : 'Unknown / System')} />
                  <DetailRow label="Patient Type" value={
                    isOldPatient(selected)
                      ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-black uppercase"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />{getKitText(selected.kit_number || 1)} (Returning)</span>
                      : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-black uppercase"><span className="w-2 h-2 rounded-full bg-blue-500" />1st Kit (New Patient)</span>
                  } />
                  {isOldPatient(selected) && (
                    <DetailRow label="Verifier" value={selected.verified_by?.name ? `👤 ${selected.verified_by.name}` : '—'} />
                  )}
                  <DetailRow label="Order ID" value={selected.order_id || selected.shiprocket_order_id} />
                  <DetailRow label="Courier" value={selected.courier_name} />
                  <DetailRow label="Payment" value={selected.payment_method} />
                  <DetailRow label="Amount" value={`₹${selected.sub_total}`} />
                  <DetailRow label="Delivered" value={formatDate(selected.delivered_at || selected.shiprocket_delivered_date || selected.createdAt, { day: '2-digit', month: 'short', year: 'numeric' })} />
                  {editMode ? (
                    <div className="flex items-start gap-3 py-2 border-b border-gray-50">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-28 shrink-0 mt-2">Phone</span>
                      <input className={inputCls} value={editFields.billing_phone || ''} onChange={e => setEditFields(p => ({ ...p, billing_phone: e.target.value }))} placeholder="Phone" />
                    </div>
                  ) : (
                    <DetailRow label="Phone" value={selected.billing_phone} />
                  )}
                  
                  <SectionHead label="Address" />
                  {editMode ? (
                    <div className="space-y-2">
                      {[['City', 'billing_city'], ['State', 'billing_state'], ['Pincode', 'billing_pincode']].map(([label, key]) => (
                        <div key={key} className="flex items-center gap-3 py-1">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-28 shrink-0">{label}</span>
                          <input className={inputCls} value={editFields[key] || ''} onChange={e => setEditFields(p => ({ ...p, [key]: e.target.value }))} placeholder={label} />
                        </div>
                      ))}
                      <div className="flex items-start gap-3 py-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-28 shrink-0 mt-2">Address</span>
                        <textarea className={inputCls + ' resize-none'} rows={3} value={editFields.billing_address || ''} onChange={e => setEditFields(p => ({ ...p, billing_address: e.target.value }))} placeholder="Address" />
                      </div>
                      <button onClick={saveContact} disabled={editSaving}
                        className="w-full py-2 rounded-xl text-[11px] font-black text-white tracking-widest disabled:opacity-50 transition-all active:scale-95"
                        style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                        {editSaving ? 'SAVING...' : 'SAVE CHANGES'}
                      </button>
                    </div>
                  ) : (
                    <>
                      <DetailRow label="City" value={selected.billing_city} />
                      <DetailRow label="State" value={selected.billing_state} />
                      <DetailRow label="Pincode" value={selected.billing_pincode} />
                      <DetailRow label="Address" value={selected.billing_address} />

                    </>
                  )}
                </div>
                
                <div>
                  <SectionHead label="Medicines" />
                  <div className="space-y-2 mt-2">
                    {(selected.order_items || []).map((p, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                        <span className="text-sm text-gray-700 font-bold truncate pr-2">{p.name}</span>
                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 shrink-0">×{p.units || 1}</span>
                      </div>
                    ))}
                  </div>

                  <SectionHead label="Feedback Notes" />
                  
                  {/* Comments List */}
                  <div className="mt-2 space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                    {(selected.comments || []).filter(c => c.type === 'followup').map((c, i) => (
                      <div key={i} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm relative group/comment">
                        <p className="text-xs text-gray-700 font-medium whitespace-pre-wrap">{c.text}</p>
                        <p className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-wider">{formatDate(c.createdAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    ))}
                    {!(selected.comments?.length > 0) && (
                      <p className="text-xs text-gray-400 italic py-2 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">No notes yet</p>
                    )}
                  </div>

                  <div className="mt-3 relative">
                    <textarea
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Type a new note..."
                      rows={2}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none transition shadow-sm"
                    />
                    <button onClick={saveNote} disabled={noteSaving || !noteText.trim()}
                      className="absolute bottom-3 right-3 px-4 py-1.5 rounded-lg text-[10px] font-black text-white shadow-md transition-all active:scale-95 disabled:opacity-50 tracking-widest"
                      style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                      {noteSaving ? 'SAVING...' : 'ADD NOTE'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <SectionHead label="Follow-up Timeline" />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-3">
                  {allFUs.map((fu, i) => {
                    const isCurrent = !fu.completed && (i === 0 || allFUs[i-1]?.completed);
                    const staffName = fu.staff?.name || (fu.status === 'missed' ? 'System' : '');
                    return (
                      <div key={i} className={`flex flex-col p-4 rounded-2xl border transition-all ${
                        fu.completed ? 'bg-gray-50 border-gray-100 opacity-70' : 
                        isCurrent ? 'bg-emerald-50 border-emerald-200 shadow-sm ring-2 ring-emerald-500/10' : 
                        'bg-white border-gray-100'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${
                            fu.completed ? 'bg-gray-200 text-gray-500' : 
                            isCurrent ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/20' : 
                            'bg-gray-100 text-gray-400'
                          }`}>
                            {fu.followup_number}
                          </div>
                          {fu.completed && (
                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold">✓</span>
                          )}
                        </div>
                        <p className={`text-[11px] font-black uppercase tracking-widest ${fu.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                          {ordinal(i)} Call
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 mt-0.5">{formatDate(fu.scheduled_date, { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        <p className="text-[10px] font-bold text-gray-500 mt-2 capitalize">{fu.status || (fu.completed ? 'completed' : 'scheduled')}</p>
                        {staffName && <p className="text-[10px] font-bold text-emerald-600 mt-1 truncate">By {staffName}</p>}
                        {(fu.notes || fu.note) && <p className="text-[10px] text-gray-500 mt-2 line-clamp-2">{fu.notes || fu.note}</p>}
                        
                        {/* Relief % per followup */}
                        <div className="mt-2">
                          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Relief % <span className="text-red-400">*</span></p>
                          {fu.completed && fu.relief_percentage != null && fu.relief_percentage !== '' ? (
                            <span className="text-xs font-black text-emerald-600">{fu.relief_percentage}%</span>
                          ) : (
                            <input
                              type="number" min="0" max="100"
                              placeholder="e.g. 70"
                              value={fu.relief_percentage !== null && fu.relief_percentage !== undefined && fu.relief_percentage !== '' ? fu.relief_percentage : ''}
                              onChange={e => {
                                const val = e.target.value;
                                setSelected(prev => ({
                                  ...prev,
                                  followups: prev.followups.map(f =>
                                    f.followup_number === fu.followup_number ? { ...f, relief_percentage: val === '' ? '' : val } : f
                                  )
                                }));
                              }}
                              onBlur={async e => {
                                const val = String(e.target.value).trim();
                                if (!val) return;
                                try {
                                  await api.patch(`/shiprocket/orders/${selected._id}/followup-relief`, {
                                    followup_number: fu.followup_number,
                                    relief_percentage: Number(val)
                                  });
                                  const numVal = Number(val);
                                  setSelected(prev => ({
                                    ...prev,
                                    followups: prev.followups.map(f =>
                                      f.followup_number === fu.followup_number ? { ...f, relief_percentage: numVal } : f
                                    )
                                  }));
                                  setAll(prev => prev.map(o => String(o._id) === String(selected._id) ? {
                                    ...o,
                                    followups: (o.followups || []).map(f =>
                                      f.followup_number === fu.followup_number ? { ...f, relief_percentage: numVal } : f
                                    )
                                  } : o));
                                } catch { /* silent */ }
                              }}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
                            />
                          )}
                        </div>

                        {isCurrent && (
                          <div className="flex flex-col gap-1.5 mt-3">
                            <button
                              onClick={() => handleFollowUpDone(selected._id)}
                              disabled={doneLoading === String(selected._id) || !fu.relief_percentage}
                              title={!fu.relief_percentage ? 'Enter relief % first' : ''}
                              className="w-full py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[10px] font-black rounded-xl shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-50 tracking-widest">
                              {doneLoading === String(selected._id) ? 'WAIT...' : 'MARK DONE'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-8">
                <SectionHead label="Order Activity" />
                <div className="mt-3 space-y-2">
                  {activityLoading ? (
                    <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 text-xs font-bold text-gray-400">Loading activity...</div>
                  ) : activity.length === 0 ? (
                    <div className="bg-white rounded-xl border border-dashed border-gray-200 px-4 py-3 text-xs font-bold text-gray-400">No activity recorded yet</div>
                  ) : activity.map((item) => (
                    <div key={item._id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <p className="text-xs font-black text-gray-800 uppercase tracking-wider">{item.title}</p>
                        <span className="text-[10px] font-bold text-gray-400">{formatDate(item.occurred_at, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-[11px] font-bold text-emerald-600 mt-1">{item.actor?.name ? `By ${item.actor.name}` : 'System'}</p>
                      {item.description && <p className="text-xs text-gray-500 mt-1">{item.description}</p>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                {(() => {
                  const lastRelief = [...allFUs].reverse().find(f => f.relief_percentage != null && f.relief_percentage !== '')?.relief_percentage;
                  return lastRelief != null ? (
                    <div className="mb-3 flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Last Relief %</span>
                      <span className="text-sm font-black text-emerald-700">{lastRelief}%</span>
                    </div>
                  ) : null;
                })()}
                <button
                  onClick={() => !selected.sent_to_verification && handleSendToVerification(selected._id)}
                  disabled={doneLoading === String(selected._id) || !!selected.sent_to_verification}
                  className={`w-full py-3 text-xs font-black rounded-xl shadow-lg hover:shadow-xl active:scale-[0.98] transition-all uppercase tracking-widest flex items-center justify-center gap-2 ${
                    selected.sent_to_verification
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white disabled:opacity-50'
                  }`}>
                  {doneLoading === String(selected._id) ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> SENDING...</>
                  ) : selected.sent_to_verification ? (
                    <><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> SENT TO VERIFICATION</>
                  ) : (
                    <><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> SEND TO VERIFICATION</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )})()}
      {/* Manual Add Followup Modal */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-blue-50">
              <h3 className="text-lg font-black text-blue-900 tracking-tight flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                Manually Add Followup
              </h3>
              <button onClick={() => setManualModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100/50 text-blue-600 hover:bg-blue-200 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <form id="manual-form" onSubmit={handleManualSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Customer Name</label>
                    <input required className={inputCls} value={manualForm.name} onChange={e => setManualForm({...manualForm, name: e.target.value})} placeholder="e.g. John Doe" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 flex items-center gap-2">
                      Phone
                      {autofilling && <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />}
                    </label>
                    <input required className={inputCls} value={manualForm.phone} onChange={e => setManualForm({...manualForm, phone: e.target.value})} placeholder="e.g. 9876543210" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">City</label>
                    <input className={inputCls} value={manualForm.city} onChange={e => setManualForm({...manualForm, city: e.target.value})} placeholder="e.g. Mumbai" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">State</label>
                    <input className={inputCls} value={manualForm.state} onChange={e => setManualForm({...manualForm, state: e.target.value})} placeholder="e.g. Maharashtra" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Medicine / Product</label>
                    <input required className={inputCls} value={manualForm.medicine} onChange={e => setManualForm({...manualForm, medicine: e.target.value})} placeholder="e.g. Migraine Kit" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Problem</label>
                    <input className={inputCls} value={manualForm.problem} onChange={e => setManualForm({...manualForm, problem: e.target.value})} placeholder="e.g. Headache" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Order ID</label>
                    <input className={inputCls} value={manualForm.order_id} onChange={e => setManualForm({...manualForm, order_id: e.target.value})} placeholder="e.g. ORD-123" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Courier</label>
                    <input className={inputCls} value={manualForm.courier_name} onChange={e => setManualForm({...manualForm, courier_name: e.target.value})} placeholder="e.g. Blue Dart" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Payment Method</label>
                    <input className={inputCls} value={manualForm.payment_method} onChange={e => setManualForm({...manualForm, payment_method: e.target.value})} placeholder="e.g. cod" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Pincode</label>
                    <input className={inputCls} value={manualForm.pincode} onChange={e => setManualForm({...manualForm, pincode: e.target.value})} placeholder="e.g. 400001" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Address</label>
                  <textarea className={inputCls} value={manualForm.address} onChange={e => setManualForm({...manualForm, address: e.target.value})} placeholder="e.g. Flat 101, Building 2" rows="2" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Delivered Date</label>
                    <input required type="date" className={inputCls} value={manualForm.delivered_date} onChange={e => setManualForm({...manualForm, delivered_date: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Amount (₹)</label>
                    <input type="number" className={inputCls} value={manualForm.amount} onChange={e => setManualForm({...manualForm, amount: e.target.value})} placeholder="e.g. 2000" />
                  </div>
                </div>
              </form>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3">
              <button type="button" onClick={() => setManualModalOpen(false)} className="flex-1 py-3.5 rounded-xl text-sm font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="submit" form="manual-form" disabled={manualSaving} className="flex-1 py-3.5 rounded-xl text-sm font-bold text-white shadow-md transition-all active:scale-95 disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
                {manualSaving ? 'Saving...' : 'Add Followup'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
