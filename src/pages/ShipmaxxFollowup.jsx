import React, { useState, useEffect, useCallback } from 'react';
import * as smxSvc from '../services/shipmaxx.service';

const PER_PAGE = 20;
const TOTAL_FU = 5;
const GAP_DAYS = 6;

const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition";

const ordinal = n => {
  const v = Number(n) + 1;
  const s = v % 10 === 1 && v % 100 !== 11 ? 'st' : v % 10 === 2 && v % 100 !== 12 ? 'nd' : v % 10 === 3 && v % 100 !== 13 ? 'rd' : 'th';
  return `${v}${s}`;
};

const ROLE_GRADIENT = [
  'from-purple-500 to-violet-600',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-orange-500 to-amber-500',
  'from-rose-500 to-red-500',
];

const initials = name => (name || '').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const formatDate = (value, options) => {
  if (!value) return '-';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', options);
};

const toDateInputValue = (value = new Date()) => {
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const getFollowup = (order, n) => (order.followups || []).find(f => f.followup_number === Number(n));

const previousFollowupsDone = (order, n) =>
  (order.followups || []).filter(f => f.followup_number < Number(n)).every(f => f.completed);

const isDue = (value, inputDate) => {
  if (!value) return false;
  const date = new Date(value);
  if (!inputDate) { const t = new Date(); t.setHours(23, 59, 59, 999); return date <= t; }
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

export default function ShipmaxxFollowup() {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [filterDelivered, setFilterDelivered] = useState(() => toDateInputValue(new Date()));
  const [filterFollowupNum, setFilterFollowupNum] = useState('1');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [completedMap, setCompletedMap] = useState({});
  const [doneLoading, setDoneLoading] = useState(null);
  const [completedList, setCompletedList] = useState([]);
  const [completedTotal, setCompletedTotal] = useState(0);
  const [completedPage, setCompletedPage] = useState(1);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    name: '', phone: '', city: '', state: '', medicine: '',
    delivered_date: '', amount: '', order_id: '', courier_name: '',
    payment_method: '', pincode: '', address: ''
  });
  const [manualSaving, setManualSaving] = useState(false);
  const [autofilling, setAutofilling] = useState(false);

  const followupNumbers = Array.from({ length: TOTAL_FU }, (_, i) => i + 1);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await smxSvc.getOrdersWithFollowUps();
      setAll(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (e) { setError(e?.response?.data?.message || e.message); }
    finally { setLoading(false); }
  }, []);

  const loadCompleted = useCallback(async (pg = 1, q = '') => {
    setCompletedLoading(true);
    try {
      const res = await smxSvc.getCompletedFollowUps({ page: pg, per_page: PER_PAGE, search: q || undefined });
      setCompletedList(Array.isArray(res.data?.data?.data) ? res.data.data.data : []);
      setCompletedTotal(res.data?.data?.total || 0);
    } catch { }
    finally { setCompletedLoading(false); }
  }, []);

  const syncAndLoad = async () => {
    setSyncing(true);
    try { await smxSvc.syncShipmaxx(); } catch { }
    finally { setSyncing(false); }
    await load();
  };

  useEffect(() => {
    load().then(()=> loadCompleted(1));
  }, [load, loadCompleted]);

  // Phone autofill for manual form
  useEffect(() => {
    const digits = manualForm.phone.replace(/\D/g, '');
    if (digits.length >= 10 && manualModalOpen) {
      const last10 = digits.slice(-10);
      setAutofilling(true);
      smxSvc.searchOrderByPhone(last10).then(res => {
        const d = res.data?.data;
        if (d) setManualForm(p => ({
          ...p,
          name: d.billing_customer_name || p.name,
          city: d.billing_city || p.city,
          state: d.billing_state || p.state,
          medicine: d.order_items?.[0]?.name || p.medicine,
          amount: d.sub_total || p.amount,
          delivered_date: d.delivered_at ? toDateInputValue(d.delivered_at) : (d.createdAt ? toDateInputValue(d.createdAt) : p.delivered_date),
          order_id: d.order_id || p.order_id,
          courier_name: d.courier_name || p.courier_name,
          payment_method: d.payment_method || p.payment_method,
          pincode: d.billing_pincode || p.pincode,
          address: d.billing_address || p.address,
        }));
      }).catch(() => {}).finally(() => setAutofilling(false));
    }
  }, [manualForm.phone, manualModalOpen]);

  const handleFollowUpDone = async (orderId) => {
    const oid = String(orderId);
    setDoneLoading(oid);
    try {
      const res = await smxSvc.completeFollowUp(oid, noteText ? { note: noteText } : {});
      const { completedCount, next_follow_up } = res.data.data;
      setCompletedMap(prev => ({ ...prev, [oid]: completedCount }));
      if (completedCount >= TOTAL_FU) {
        const doneOrder = selected && String(selected._id) === oid ? selected : all.find(o => String(o._id) === oid);
        setAll(prev => prev.filter(o => String(o._id) !== oid));
        if (doneOrder) { setCompletedList(prev => [{ ...doneOrder, all_followups_done: true }, ...prev]); setCompletedTotal(prev => prev + 1); }
        setSelected(null);
        return;
      }
      setAll(prev => prev.map(o => {
        if (String(o._id) !== oid) return o;
        let base = new Date();
        const updatedFUs = (o.followups || []).map(f => {
          if (f.followup_number === completedCount) return { ...f, completed: true, completed_at: new Date().toISOString() };
          if (f.followup_number > completedCount) { base = new Date(base.getTime() + GAP_DAYS * 86400000); return { ...f, scheduled_date: new Date(base).toISOString() }; }
          return f;
        });
        return { ...o, next_follow_up, followups: updatedFUs };
      }));
      if (selected?._id === orderId) {
        setSelected(prev => ({ ...prev, next_follow_up }));
        smxSvc.getOrderActivity(oid).then(r => setActivity(Array.isArray(r.data?.data) ? r.data.data : [])).catch(() => {});
      }
    } catch (e) { setError(e?.response?.data?.message || e.message); }
    finally { setDoneLoading(null); }
  };

  const handleSendToVerification = async (oid) => {
    if (!window.confirm('Send this customer back to Verification for a new cycle?')) return;
    setDoneLoading(String(oid));
    try {
      await smxSvc.sendToVerification(oid);
      const orderData = (selected && String(selected._id) === String(oid)) ? selected : all.find(o => String(o._id) === String(oid));
      setAll(prev => prev.filter(o => String(o._id) !== String(oid)));
      if (orderData) {
        const sentOrder = { ...orderData, sent_to_verification: true };
        setCompletedList(prev => {
          const exists = prev.some(o => String(o._id) === String(oid));
          if (exists) return prev.map(o => String(o._id) === String(oid) ? sentOrder : o);
          setCompletedTotal(t => t + 1);
          return [sentOrder, ...prev];
        });
      }
      if (selected && String(selected._id) === String(oid)) setSelected(prev => prev ? { ...prev, sent_to_verification: true } : prev);
    } catch (e) { alert(e?.response?.data?.message || e.message); }
    finally { setDoneLoading(null); }
  };

  const saveNote = async () => {
    if (!selected || !noteText.trim()) return;
    setNoteSaving(true);
    try {
      const res = await smxSvc.saveOrderNote(selected._id, noteText, 'followup');
      const newComments = res.data.data;
      setAll(prev => prev.map(o => String(o._id) === String(selected._id) ? { ...o, comments: newComments } : o));
      setSelected(prev => ({ ...prev, comments: newComments }));
      setNoteText('');
    } catch (e) { alert('Failed: ' + (e?.response?.data?.message || e.message)); }
    finally { setNoteSaving(false); }
  };

  const saveContact = async () => {
    if (!selected) return;
    setEditSaving(true);
    try {
      const res = await smxSvc.updateOrderContact(selected._id, editFields);
      const updated = { ...selected, ...res.data.data };
      setSelected(updated);
      setAll(prev => prev.map(o => String(o._id) === String(selected._id) ? { ...o, ...res.data.data } : o));
      setEditMode(false);
    } catch (e) { alert('Failed: ' + (e?.response?.data?.message || e.message)); }
    finally { setEditSaving(false); }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setManualSaving(true);
    try {
      await smxSvc.createManualFollowup(manualForm);
      setManualModalOpen(false);
      setManualForm({ name: '', phone: '', city: '', state: '', medicine: '', delivered_date: '', amount: '', order_id: '', courier_name: '', payment_method: '', pincode: '', address: '' });
      await syncAndLoad();
    } catch (err) { alert(err?.response?.data?.message || err.message); }
    finally { setManualSaving(false); }
  };

  const handleSelect = (order) => {
    setSelected(order); setNoteText(''); setActivity([]); setEditMode(false); setEditFields({});
    setActivityLoading(true);
    smxSvc.getOrderActivity(order._id)
      .then(res => setActivity(Array.isArray(res.data?.data) ? res.data.data : []))
      .catch(() => setActivity([]))
      .finally(() => setActivityLoading(false));
  };

  const dueCounts = followupNumbers.reduce((acc, n) => {
    acc[n] = all.filter(o => {
      const fu = getFollowup(o, n);
      return fu && !fu.completed && previousFollowupsDone(o, n) && isDue(fu.scheduled_date, filterDelivered);
    }).length;
    return acc;
  }, {});

  const filtered = all.filter(o => {
    const allFUs = (o.followups || []);
    const completedCount = completedMap[o._id] ?? allFUs.filter(f => f.completed).length;
    if (completedCount >= TOTAL_FU || o.sent_to_verification || o.followup_done) return false;
    if (filterFollowupNum) {
      const fu = getFollowup(o, filterFollowupNum);
      if (!fu || fu.completed || !previousFollowupsDone(o, filterFollowupNum) || !isDue(fu.scheduled_date, filterDelivered)) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return (
        o.billing_customer_name?.toLowerCase().includes(q) ||
        o.billing_phone?.includes(q) ||
        o.order_id?.toString().includes(q) ||
        o.awb_code?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="min-h-full bg-glow pb-10 px-3 sm:px-6 lg:px-8 space-y-8 pt-4">

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {followupNumbers.map((n, i) => {
          const colors = ['from-emerald-400 to-teal-500','from-blue-400 to-indigo-500','from-amber-400 to-orange-500','from-rose-400 to-red-500','from-purple-400 to-violet-500'];
          const count = dueCounts[n] || 0;
          return (
            <div key={n} className="bg-white rounded-2xl p-3 sm:p-5 shadow-sm border border-gray-100/50 hover:shadow-lg transition-all">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={`w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-gradient-to-br ${colors[i]} flex items-center justify-center text-white font-black text-sm sm:text-base shrink-0 shadow-lg`}>{n}</div>
                <div>
                  <p className="text-[8px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest">{ordinal(n - 1)} Call</p>
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

      {/* ── Header / Controls ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full">
          {/* Tab bar */}
          <div className="flex items-center bg-white rounded-2xl border border-gray-100 p-1 shadow-sm overflow-x-auto no-scrollbar max-w-full">
            <button onClick={() => { setShowCompleted(false); setFilterFollowupNum(''); setPage(1); }}
              className={`px-4 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition whitespace-nowrap ${!showCompleted && !filterFollowupNum ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
              All ({all.length})
            </button>
            {followupNumbers.map(n => (
              <button key={n} onClick={() => { setShowCompleted(false); setFilterFollowupNum(String(n)); setPage(1); }}
                className={`px-4 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition whitespace-nowrap ${!showCompleted && filterFollowupNum === String(n) ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
                {ordinal(n - 1)} ({dueCounts[n] || 0})
              </button>
            ))}
            <button onClick={() => { setShowCompleted(true); setCompletedPage(1); loadCompleted(1, search); }}
              className={`px-4 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition whitespace-nowrap ${showCompleted ? 'bg-gray-800 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
              ✅ Done ({completedTotal})
            </button>
          </div>

          <div className="flex flex-col sm:flex-row flex-1 items-center gap-3 w-full">
            <input type="date" value={filterDelivered} onChange={e => { setFilterDelivered(e.target.value); setPage(1); }}
              className="bg-white border border-gray-100 rounded-2xl px-4 py-3 text-xs font-black text-gray-700 focus:ring-4 focus:ring-emerald-500/10 transition shadow-sm hover:shadow-md w-full sm:w-auto" />

            <div className="relative w-full sm:flex-1 sm:max-w-[300px]">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
              </svg>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, phone, awb..."
                className="w-full pl-11 pr-5 py-3 rounded-2xl border border-gray-100 bg-white text-xs font-bold text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-emerald-400/20 transition shadow-sm" />
            </div>

            <button onClick={() => setManualModalOpen(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black text-white shadow-xl hover:-translate-y-1 transition-all uppercase tracking-widest active:scale-95"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Manual Add
            </button>

            <button onClick={syncAndLoad} disabled={syncing || loading}
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black text-white shadow-xl hover:-translate-y-1 transition-all uppercase tracking-widest active:scale-95 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <svg className={`w-4 h-4 ${syncing || loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
              {syncing ? 'Syncing...' : 'Sync Data'}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-100 rounded-2xl px-6 py-4 text-red-600 text-sm font-bold shadow-sm">{error}</div>}

      {/* ── Completed Table ── */}
      {showCompleted ? (
        <div className="premium-card overflow-hidden">
          {completedLoading ? (
            <div className="flex items-center justify-center h-64 gap-3 text-gray-400">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />Loading completed follow ups...
            </div>
          ) : completedList.length === 0 ? (
            <div className="p-20 text-center">
              <div className="w-20 h-20 rounded-[2.5rem] bg-gray-100 flex items-center justify-center mx-auto mb-6 text-gray-300">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="text-xl font-bold text-gray-400">No completed follow-ups yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50/50">
              {completedList.map((o, i) => (
                <div key={o._id} className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-gray-50/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${ROLE_GRADIENT[i % 5]} flex items-center justify-center text-white font-black shrink-0 shadow`}>{initials(o.billing_customer_name)}</div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-800 text-sm truncate">{o.billing_customer_name}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">{o.billing_phone} · {o.awb_code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: TOTAL_FU }, (_, idx) => (
                        <div key={idx} className="w-6 h-6 rounded-lg text-[9px] font-black flex items-center justify-center bg-emerald-100 text-emerald-600 border border-emerald-200">{idx + 1}</div>
                      ))}
                    </div>
                    <span className="text-sm font-black text-gray-700">₹{o.sub_total}</span>
                    <button onClick={() => !o.sent_to_verification && handleSendToVerification(o._id)}
                      disabled={doneLoading === String(o._id) || !!o.sent_to_verification}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition ${o.sent_to_verification ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white disabled:opacity-50'}`}>
                      {o.sent_to_verification ? '✓ Sent' : doneLoading === String(o._id) ? '...' : 'Verification'}
                    </button>
                    <button onClick={() => handleSelect(o)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 text-gray-700 hover:bg-emerald-600 hover:text-white transition-all shadow-sm">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {(() => { const tp = Math.ceil(completedTotal / PER_PAGE); return tp > 1 ? (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Page {completedPage} of {tp}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => { const p = Math.max(1, completedPage - 1); setCompletedPage(p); loadCompleted(p, search); }} disabled={completedPage === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-30 transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" /></svg>
                </button>
                <button onClick={() => { const p = Math.min(tp, completedPage + 1); setCompletedPage(p); loadCompleted(p, search); }} disabled={completedPage === tp}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-30 transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" /></svg>
                </button>
              </div>
            </div>
          ) : null; })()}
        </div>
      ) : (
        /* ── Active Follow-ups Table ── */
        <div className="premium-card overflow-hidden">
          {loading && all.length === 0 ? (
            <div className="flex items-center justify-center h-64 gap-3 text-gray-400">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />Loading follow ups...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-20 text-center">
              <div className="w-20 h-20 rounded-[2.5rem] bg-emerald-50 flex items-center justify-center mx-auto mb-6 text-emerald-300">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="text-xl font-bold text-gray-400">No {filterFollowupNum ? `${ordinal(Number(filterFollowupNum) - 1)} ` : ''}follow-ups found</p>
              <p className="text-sm text-gray-300 mt-2">{search ? 'Try a different search' : 'Nothing due on selected date'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto no-scrollbar">
              {/* Desktop Table */}
              <table className="hidden xl:table w-full text-xs min-w-[850px]">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100 text-left bg-white">
                    {['Customer Order', 'Location & Contact', 'Medicine', 'Delivered', 'Progress', 'Next Call', 'Amount', 'Controls'].map(h => (
                      <th key={h} className="py-4 px-4 font-black uppercase tracking-wider text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50/50">
                  {paged.map((o, i) => {
                    const gradient = ROLE_GRADIENT[i % ROLE_GRADIENT.length];
                    const allFUs = (o.followups || []).sort((a, b) => a.followup_number - b.followup_number);
                    const completedCount = completedMap[o._id] ?? allFUs.filter(f => f.completed).length;
                    const allDone = completedCount >= TOTAL_FU;
                    const activeFU = getFollowup(o, filterFollowupNum) || allFUs[completedCount];
                    return (
                      <tr key={o._id} className="transition-all duration-300 group hover:bg-emerald-50/20">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-base font-black shadow-lg group-hover:scale-110 transition-transform duration-300 shrink-0`}>
                              {initials(o.billing_customer_name)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-gray-800 text-sm truncate">{o.billing_customer_name || '—'}</p>
                              <p className="text-[10px] text-gray-400 font-mono mt-0.5">{o.awb_code}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-sm font-bold text-gray-700">{o.billing_phone}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">{o.billing_city}{o.billing_state ? `, ${o.billing_state}` : ''}</p>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-xs font-bold text-gray-700 truncate max-w-[140px] block" title={o.order_items?.[0]?.name}>{o.order_items?.[0]?.name || '—'}</span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="text-sm font-bold text-gray-600 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                            {formatDate(o.delivered_at || o.createdAt, { day: '2-digit', month: 'short' })}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center gap-1">
                            {Array.from({ length: TOTAL_FU }, (_, idx) => {
                              const isDone = idx < completedCount;
                              const isCurrent = idx === completedCount && !allDone;
                              return (
                                <div key={idx} className={`text-[9px] font-black w-6 h-6 flex items-center justify-center rounded-lg border transition-all ${isDone ? 'bg-gray-100 text-gray-400 border-gray-200' : isCurrent ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-gray-50 text-gray-300 border-gray-100'}`}>
                                  {idx + 1}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={`text-[11px] font-black uppercase tracking-widest ${allDone ? 'text-gray-400' : 'text-orange-500'}`}>
                            {allDone ? 'DONE' : formatDate(activeFU?.scheduled_date, { day: '2-digit', month: 'short' })}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="text-sm font-black text-gray-700">₹{o.sub_total}</span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!allFUs[completedCount]?.completed && !allDone && (
                              <button onClick={() => handleFollowUpDone(o._id)} disabled={doneLoading === String(o._id)}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-50">
                                {doneLoading === String(o._id) ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                              </button>
                            )}
                            <button onClick={() => handleSelect(o)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 text-gray-800 hover:bg-gray-900 hover:text-white transition-all shadow-sm active:scale-95">
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
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
                  const allDone = completedCount >= TOTAL_FU;
                  const activeFU = getFollowup(o, filterFollowupNum) || allFUs[completedCount];
                  const gradient = ROLE_GRADIENT[i % ROLE_GRADIENT.length];
                  return (
                    <div key={o._id} className="p-4 bg-white hover:bg-gray-50/30 transition-colors">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black shrink-0 shadow-lg`}>{initials(o.billing_customer_name)}</div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 text-sm truncate">{o.billing_customer_name}</p>
                            <p className="text-[10px] font-bold text-gray-400">{o.billing_phone} · {o.billing_city}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-gray-900 text-sm">₹{o.sub_total}</p>
                          <p className="text-[9px] font-bold text-orange-500 uppercase mt-1">{allDone ? 'DONE' : `Next: ${formatDate(activeFU?.scheduled_date, { day: '2-digit', month: 'short' })}`}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between bg-gray-50 rounded-[1.25rem] p-3 border border-gray-100 mb-4">
                        <div className="flex items-center gap-1.5">
                          {Array.from({ length: TOTAL_FU }, (_, idx) => {
                            const isDone = idx < completedCount;
                            const isCurrent = idx === completedCount && !allDone;
                            return <div key={idx} className={`w-6 h-6 rounded-lg text-[9px] font-black flex items-center justify-center border transition-all ${isDone ? 'bg-gray-200 text-gray-400 border-gray-200' : isCurrent ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white text-gray-300 border-gray-200'}`}>{idx + 1}</div>;
                          })}
                        </div>
                        <div className="text-[10px] font-bold text-gray-400">Delivered: <span className="text-gray-700">{formatDate(o.delivered_at || o.createdAt, { day: '2-digit', month: 'short' })}</span></div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!allFUs[completedCount]?.completed && !allDone && (
                          <button onClick={() => handleFollowUpDone(o._id)} disabled={doneLoading === String(o._id)}
                            className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-50">
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
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-3xl">
              <span className="text-[10px] sm:text-[11px] font-black text-gray-400 uppercase tracking-widest">Page {page} of {totalPages}</span>
              <div className="flex items-center gap-2 sm:gap-3">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-white hover:shadow-md disabled:opacity-30 transition-all active:scale-95">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" /></svg>
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-white hover:shadow-md disabled:opacity-30 transition-all active:scale-95">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" /></svg>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Detail Modal ── */}
      {selected && (() => {
        const allFUs = (selected.followups || []).sort((a, b) => a.followup_number - b.followup_number);
        const completedCount = completedMap[selected._id] ?? allFUs.filter(f => f.completed).length;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
            <div className="bg-white rounded-[1.5rem] sm:rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>

              {/* Modal Header */}
              <div className="px-3 sm:px-6 py-3 sm:py-5 shrink-0" style={{ background: 'linear-gradient(135deg, #064e3b, #065f46)' }}>
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-base sm:text-xl font-black shadow-lg shrink-0">
                    {initials(selected.billing_customer_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-black text-base sm:text-xl tracking-tight truncate">{selected.billing_customer_name || 'Order Detail'}</h3>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-0.5 sm:mt-1">
                      <p className="text-emerald-300 font-bold text-xs sm:text-sm">{selected.billing_phone}</p>
                      <span className="hidden sm:inline w-1 h-1 rounded-full bg-emerald-400/50" />
                      <p className="text-emerald-300 font-bold text-xs sm:text-sm font-mono">{selected.awb_code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <button onClick={() => { if (editMode) { setEditMode(false); setEditFields({}); } else { setEditMode(true); setEditFields({ billing_phone: selected.billing_phone, billing_city: selected.billing_city, billing_state: selected.billing_state, billing_pincode: selected.billing_pincode, billing_address: selected.billing_address }); } }}
                      className="px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl bg-white/10 text-emerald-100 hover:bg-white/20 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all">
                      {editMode ? 'EXIT' : 'EDIT'}
                    </button>
                    <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center rounded-lg sm:rounded-xl bg-white/10 text-emerald-100 hover:bg-white/20 hover:text-white transition-all text-xl leading-none">×</button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 custom-scrollbar bg-gray-50/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  {/* Left Column */}
                  <div>
                    <SectionHead label="Order Details" />
                    <DetailRow label="Order ID" value={selected.order_id} />
                    <DetailRow label="Courier" value={selected.courier_name} />
                    <DetailRow label="Payment" value={selected.payment_method} />
                    <DetailRow label="Amount" value={`₹${selected.sub_total}`} />
                    <DetailRow label="Delivered" value={formatDate(selected.delivered_at || selected.createdAt, { day: '2-digit', month: 'short', year: 'numeric' })} />
                    {editMode ? (
                      <div className="flex items-start gap-3 py-2 border-b border-gray-50">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-28 shrink-0 mt-2">Phone</span>
                        <input className={inputCls} value={editFields.billing_phone || ''} onChange={e => setEditFields(p => ({ ...p, billing_phone: e.target.value }))} placeholder="Phone" />
                      </div>
                    ) : <DetailRow label="Phone" value={selected.billing_phone} />}

                    <SectionHead label="Address" />
                    {editMode ? (
                      <div className="space-y-2">
                        {[['City', 'billing_city'], ['State', 'billing_state'], ['Pincode', 'billing_pincode']].map(([lbl, key]) => (
                          <div key={key} className="flex items-center gap-3 py-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-28 shrink-0">{lbl}</span>
                            <input className={inputCls} value={editFields[key] || ''} onChange={e => setEditFields(p => ({ ...p, [key]: e.target.value }))} />
                          </div>
                        ))}
                        <div className="flex items-start gap-3 py-1">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-28 shrink-0 mt-2">Address</span>
                          <textarea className={inputCls + ' resize-none'} rows={3} value={editFields.billing_address || ''} onChange={e => setEditFields(p => ({ ...p, billing_address: e.target.value }))} />
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

                  {/* Right Column */}
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
                    <div className="mt-2 space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                      {(selected.comments || []).filter(c => c.type === 'followup').map((c, i) => (
                        <div key={i} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                          <p className="text-xs text-gray-700 font-medium">{c.text}</p>
                          <p className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-wider">{formatDate(c.createdAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      ))}
                      {!(selected.comments?.some(c => c.type === 'followup')) && (
                        <p className="text-xs text-gray-400 italic py-2 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">No notes yet</p>
                      )}
                    </div>
                    <div className="mt-3 relative">
                      <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Type a new note..." rows={2}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none transition shadow-sm" />
                      <button onClick={saveNote} disabled={noteSaving || !noteText.trim()}
                        className="absolute bottom-3 right-3 px-4 py-1.5 rounded-lg text-[10px] font-black text-white shadow-md transition-all active:scale-95 disabled:opacity-50 tracking-widest"
                        style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                        {noteSaving ? 'SAVING...' : 'ADD NOTE'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Follow-up Timeline */}
                <div className="mt-8">
                  <SectionHead label="Follow-up Timeline" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-3">
                    {allFUs.map((fu, i) => {
                      const isCurrent = !fu.completed && (i === 0 || allFUs[i - 1]?.completed);
                      return (
                        <div key={i} className={`flex flex-col p-4 rounded-2xl border transition-all ${fu.completed ? 'bg-gray-50 border-gray-100 opacity-70' : isCurrent ? 'bg-emerald-50 border-emerald-200 shadow-sm ring-2 ring-emerald-500/10' : 'bg-white border-gray-100'}`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${fu.completed ? 'bg-gray-200 text-gray-500' : isCurrent ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg' : 'bg-gray-100 text-gray-400'}`}>
                              {fu.followup_number}
                            </div>
                            {fu.completed && <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold">✓</span>}
                          </div>
                          <p className={`text-[11px] font-black uppercase tracking-widest ${fu.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{ordinal(i)} Call</p>
                          <p className="text-[10px] font-bold text-gray-400 mt-0.5">{formatDate(fu.scheduled_date, { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                          <p className="text-[10px] font-bold text-gray-500 mt-2 capitalize">{fu.status || (fu.completed ? 'completed' : 'scheduled')}</p>
                          {(fu.notes || fu.note) && <p className="text-[10px] text-gray-500 mt-2 line-clamp-2">{fu.notes || fu.note}</p>}
                          {isCurrent && (
                            <button onClick={() => handleFollowUpDone(selected._id)} disabled={doneLoading === String(selected._id)}
                              className="mt-3 w-full py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[10px] font-black rounded-xl shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-50 tracking-widest">
                              {doneLoading === String(selected._id) ? 'WAIT...' : 'MARK DONE'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Activity */}
                <div className="mt-8">
                  <SectionHead label="Order Activity" />
                  <div className="mt-3 space-y-2">
                    {activityLoading ? (
                      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 text-xs font-bold text-gray-400">Loading activity...</div>
                    ) : activity.length === 0 ? (
                      <div className="bg-white rounded-xl border border-dashed border-gray-200 px-4 py-3 text-xs font-bold text-gray-400">No activity recorded yet</div>
                    ) : activity.map(item => (
                      <div key={item._id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <p className="text-xs font-black text-gray-800 uppercase tracking-wider">{item.title}</p>
                          <span className="text-[10px] font-bold text-gray-400">{formatDate(item.createdAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {item.description && <p className="text-xs text-gray-500 mt-1">{item.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Send to Verification */}
                <div className="mt-6">
                  <button onClick={() => !selected.sent_to_verification && handleSendToVerification(selected._id)}
                    disabled={doneLoading === String(selected._id) || !!selected.sent_to_verification}
                    className={`w-full py-3 text-xs font-black rounded-xl shadow-lg hover:shadow-xl active:scale-[0.98] transition-all uppercase tracking-widest flex items-center justify-center gap-2 ${selected.sent_to_verification ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white disabled:opacity-50'}`}>
                    {doneLoading === String(selected._id) ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> SENDING...</>
                    ) : selected.sent_to_verification ? (
                      <><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> SENT TO VERIFICATION</>
                    ) : (
                      <><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> SEND TO VERIFICATION</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Manual Add Modal ── */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-blue-50">
              <h3 className="text-lg font-black text-blue-900 tracking-tight flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Manually Add Followup
              </h3>
              <button onClick={() => setManualModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100/50 text-blue-600 hover:bg-blue-200 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <form id="smx-manual-form" onSubmit={handleManualSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Customer Name *</label>
                    <input required className={inputCls} value={manualForm.name} onChange={e => setManualForm(p => ({ ...p, name: e.target.value }))} placeholder="Full name" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 flex items-center gap-2">
                      Phone * {autofilling && <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />}
                    </label>
                    <input required className={inputCls} value={manualForm.phone} onChange={e => setManualForm(p => ({ ...p, phone: e.target.value }))} placeholder="10-digit phone" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">City</label>
                    <input className={inputCls} value={manualForm.city} onChange={e => setManualForm(p => ({ ...p, city: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">State</label>
                    <input className={inputCls} value={manualForm.state} onChange={e => setManualForm(p => ({ ...p, state: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Medicine / Product *</label>
                    <input required className={inputCls} value={manualForm.medicine} onChange={e => setManualForm(p => ({ ...p, medicine: e.target.value }))} placeholder="e.g. Migraine Kit" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Delivered Date *</label>
                    <input required type="date" className={inputCls} value={manualForm.delivered_date} onChange={e => setManualForm(p => ({ ...p, delivered_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Amount (₹)</label>
                    <input type="number" className={inputCls} value={manualForm.amount} onChange={e => setManualForm(p => ({ ...p, amount: e.target.value }))} placeholder="e.g. 2000" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Order ID</label>
                    <input className={inputCls} value={manualForm.order_id} onChange={e => setManualForm(p => ({ ...p, order_id: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Courier</label>
                    <input className={inputCls} value={manualForm.courier_name} onChange={e => setManualForm(p => ({ ...p, courier_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Payment Method</label>
                    <input className={inputCls} value={manualForm.payment_method} onChange={e => setManualForm(p => ({ ...p, payment_method: e.target.value }))} placeholder="cod / prepaid" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Pincode</label>
                    <input className={inputCls} value={manualForm.pincode} onChange={e => setManualForm(p => ({ ...p, pincode: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Address</label>
                  <textarea className={inputCls} rows={2} value={manualForm.address} onChange={e => setManualForm(p => ({ ...p, address: e.target.value }))} />
                </div>
              </form>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3">
              <button type="button" onClick={() => setManualModalOpen(false)} className="flex-1 py-3.5 rounded-xl text-sm font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors">Cancel</button>
              <button type="submit" form="smx-manual-form" disabled={manualSaving} className="flex-1 py-3.5 rounded-xl text-sm font-bold text-white shadow-md transition-all active:scale-95 disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
                {manualSaving ? 'Saving...' : 'Add Followup'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
