import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLeads, getLead, updateLead, getCallAgains, updateCallAgain, markCNP, createCallAgain, deleteLead } from '../services/lead.service';
import { createTask, getCnpRecords, deleteCnpRecord, getTaskByLead } from '../services/task.service';
import API from '../api';
import Modal from '../components/ui/Modal';

const PIN_COLORS = [
  'bg-blue-500', 'bg-amber-500', 'bg-purple-500',
  'bg-orange-500', 'bg-emerald-500', 'bg-rose-500', 'bg-gray-500',
];

const DEPARTMENTS = ['migraine', 'piles'];

const initials = (name = '') =>
  name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const DetailRow = ({ label, value, color = "gray" }) =>
  value ? (
    <div className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-28 shrink-0 mt-0.5">{label}</span>
      <span className={`text-sm font-medium capitalize flex-1 ${color === 'red' ? 'text-red-600' : 'text-gray-800'}`}>{value}</span>
    </div>
  ) : null;

const SectionHead = ({ label, color = "green" }) => (
  <div className="flex items-center gap-2 mt-4 mb-1">
    <span className={`text-[10px] font-extrabold uppercase tracking-widest ${color === 'green' ? 'text-green-500' : 'text-blue-500'}`}>{label}</span>
    <div className={`flex-1 h-px ${color === 'green' ? 'bg-green-100' : 'bg-blue-100'}`} />
  </div>
);

const todayISO = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.toISOString(); };
const TASK_EMPTY = { title: '', phone: '', problem: '', age: '', weight: '', height: '', otherProblems: '', problemDuration: '', price: '', reminderAt: '', dueDate: '', cityVillageType: 'city', cityVillage: '', houseNo: '', postOffice: '', district: '', landmark: '', pincode: '', state: '', type: 'task', priority: 'medium', lead: '', assignedTo: '' };
const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition";



const STAGES = [
  { key: 'interested',     label: 'Interested',     bar: 'bg-purple-500' },
  { key: 'closed_lost',    label: 'Not Interested', bar: 'bg-red-400' },
  { key: 'on_hold',        label: 'Pending (On Hold)', bar: 'bg-gray-400' },
];

export default function Pipeline() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [interestedLeads, setInterestedLeads] = useState([]);
  const [onHoldLeads, setOnHoldLeads] = useState([]);
  const [closedLostLeads, setClosedLostLeads] = useState([]);
  const [deliveredOrders, setDeliveredOrders] = useState([]);
  const [cnpLeads, setCnpLeads] = useState([]);
  const [callAgainLeads, setCallAgainLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('interested');
  const [selected, setSelected] = useState(null);
  const [leadTask, setLeadTask] = useState(null);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  
  const canManage = user?.role === 'admin' || user?.role === 'manager';
  // Follow-up state
  const [note, setNote] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      API.post('/verification/repair').catch(() => {});

      const query = { limit: 500 };
      if (department) query.department = department;

      const [interestedRes, onHoldRes, closedLostRes, ordersRes, cnpRes, callAgainRes] = await Promise.all([
        getLeads({ ...query, status: 'interested' }),
        getLeads({ ...query, status: 'on_hold' }),
        getLeads({ ...query, status: 'closed_lost' }),
        API.get('/shiprocket/orders/with-followups'),
        getCnpRecords(query),
        getCallAgains(query),
      ]);
      setInterestedLeads(Array.isArray(interestedRes?.leads) ? interestedRes.leads : []);
      setOnHoldLeads(Array.isArray(onHoldRes?.leads) ? onHoldRes.leads.filter(l => !l.cnp) : []);
      setClosedLostLeads(Array.isArray(closedLostRes?.leads) ? closedLostRes.leads : []);
      setDeliveredOrders(Array.isArray(ordersRes.data?.data) ? ordersRes.data.data : []);
      setCnpLeads(Array.isArray(cnpRes) ? cnpRes : []);
      setCallAgainLeads(Array.isArray(callAgainRes) ? callAgainRes : []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load');
    } finally { setLoading(false); }
  }, [department]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (location.state?.filter) {
      setFilter(location.state.filter);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const filteredItems = useMemo(() => {
    let items = [];
    if (filter === 'cnp') items = cnpLeads;
    else if (filter === 'call_again') items = callAgainLeads;
    else if (filter === 'closed_lost') items = closedLostLeads;
    else if (filter === 'on_hold') items = onHoldLeads;
    else items = interestedLeads;

    if (!search) return items;
    
    const q = search.toLowerCase();
    return items.filter(item => {
      const lead = item.lead || item;
      return (
        lead.name?.toLowerCase().includes(q) || 
        lead.phone?.includes(q) || 
        lead.problem?.toLowerCase().includes(q)
      );
    });
  }, [filter, interestedLeads, onHoldLeads, closedLostLeads, cnpLeads, callAgainLeads, search]);

  const handleMove = async (lead, newStage) => {
    setUpdating(lead._id);
    try {
      await updateLead(lead._id, { status: newStage === 'verification' ? 'new' : newStage, cnp: false, forceVerification: newStage === 'verification' });
      if (filter === 'cnp' && selected?._id) {
        try { await deleteCnpRecord(selected._id); } catch { }
      }
      if (filter === 'call_again' && selected?._id && selected._id !== lead._id) {
        try { await updateCallAgain(selected._id, { status: 'done' }); } catch { }
      }
      setSelected(null);
      await load();
    } catch (e) { 
      setError(e.response?.data?.message || e.message || 'Update failed');
    }
    finally { setUpdating(null); }
  };

  const handleStatusChange = async (leadId, status, taskId = null) => {
    setUpdating(leadId);
    try {
      await updateLead(leadId, { status });
      if (taskId) await deleteCnpRecord(taskId);
      load();
      setSelected(null);
    } catch { /* ignore */ } finally { setUpdating(null); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    setUpdating(id);
    try {
      await deleteLead(id);
      await load();
      setSelected(null);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Delete failed');
    } finally {
      setUpdating(null);
    }
  };

  const handleFollowUpNote = async () => {
    if (!note.trim() && !nextDate) return;
    setSavingNote(true);
    const leadId = (selected.lead?._id || selected._id);
    try {
      const res = await API.post(`/leads/${leadId}/follow-up`, { note, next_date: nextDate || undefined });
      const updated = res.data.data;
      // Update selected panel immediately so Activity History refreshes
      setSelected(prev => ({ ...prev, lead: prev.lead ? { ...prev.lead, ...updated } : { ...prev, ...updated } }));
      setNote('');
      setNextDate('');
      load(); // Refresh list to reflect new note
    } catch { }
    finally { setSavingNote(false); }
  };

  const [taskModal, setTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState(TASK_EMPTY);
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskError, setTaskError] = useState('');
  const [taskCnpId, setTaskCnpId] = useState(null);

  const openTaskModal = (lead) => {
    const t = leadTask;
    setTaskForm({ ...TASK_EMPTY, dueDate: todayISO(), lead: lead._id, assignedTo: lead.assignedTo?._id || user?._id || '', title: lead.name || '', phone: t?.phone || lead.phone || '', problem: t?.problem || lead.problem || '', age: t?.age || '', weight: t?.weight || '', height: t?.height || '', cityVillageType: t?.cityVillageType || 'city', cityVillage: t?.cityVillage || '', houseNo: t?.houseNo || '', postOffice: t?.postOffice || '', district: t?.district || '', landmark: t?.landmark || '', pincode: t?.pincode || '', state: t?.state || '', otherProblems: t?.otherProblems || '', problemDuration: t?.problemDuration || '', price: t?.price || '' });
    setTaskCnpId(filter === 'cnp' ? selected?._id : null);
    setTaskError('');
    setTaskModal(true);
  };

  const handleTaskSubmit = async (e) => {
    e.preventDefault(); setTaskLoading(true); setTaskError('');
    try {
      const payload = { ...taskForm };
      if (!payload.assignedTo) delete payload.assignedTo;
      if (!payload.dueDate) payload.dueDate = todayISO();
      await createTask(payload);
      if (taskCnpId) {
        await deleteCnpRecord(taskCnpId).catch(() => {});
        await updateLead(taskForm.lead, { cnp: false }).catch(() => {});
      }
      // Mark call-again as done if task created from Call Again list
      if (filter === 'call_again' && selected?._id && selected._id !== taskForm.lead) {
        await updateCallAgain(selected._id, { status: 'done' }).catch(() => {});
      }
      setTaskModal(false);
      setSelected(null);
      await load();
    } catch (err) { setTaskError(err.response?.data?.message || 'Failed to create task'); }
    finally { setTaskLoading(false); }
  };

  const [doneLoading, setDoneLoading] = useState(null);
  const handleFollowUpDone = async (orderId) => {
    const oid = String(orderId);
    setDoneLoading(oid);
    try {
      const res = await API.post(`/shiprocket/orders/${oid}/complete-followup`);
      const { next_follow_up, completedCount } = res.data.data;
      setDeliveredOrders(prev => prev.map(o => {
        if (String(o._id) !== oid) return o;
        if (completedCount >= 5 && !next_follow_up) return null;
        const updatedFUs = (o.followups || []).map(f =>
          f.followup_number === completedCount ? { ...f, completed: true } : f
        );
        return { ...o, next_follow_up, followups: updatedFUs };
      }).filter(Boolean));
      if (selected?._id === orderId) {
         load(); // Refresh full data to keep sync
      }
    } catch { } finally { setDoneLoading(null); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-[3px] border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex gap-4 scroll-container-h overflow-hidden animate-slide-up mobile-p-safe">
      {/* ── LEFT PANEL ── */}
      <div className={`flex flex-col gap-4 transition-all duration-300 ${selected ? 'w-full lg:w-[55%]' : 'w-full'} h-full overflow-hidden`}>
        
        {/* Header & Filters */}
        <div className="flex items-center justify-between gap-3 shrink-0 glass px-5 py-3 rounded-3xl border border-white/50 shadow-sm">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
              {[
                ...STAGES,
                { key: 'cnp', label: 'CNP', bar: 'bg-red-600' },
                { key: 'call_again', label: 'Call Again', bar: 'bg-amber-600' }
              ].map(s => (
                <button key={s.key} onClick={() => { setFilter(s.key); setSelected(null); setLeadTask(null); }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border whitespace-nowrap transition-all flex items-center gap-2 ${filter === s.key
                    ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                    : 'bg-white text-gray-400 border-gray-100 hover:bg-gray-50'
                  }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${s.bar}`} />
                  {s.label}
                </button>
              ))}
          </div>
          <div className="relative w-full md:w-1/2 flex items-center gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, phone..."
                className="w-full pl-11 pr-4 py-2.5 rounded-2xl border border-gray-100 bg-white text-sm font-medium text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-green-400/20 transition shadow-sm"
              />
            </div>
            {canManage && (
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="w-full md:w-auto px-4 py-2.5 rounded-2xl border border-gray-100 bg-white text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400/20 transition shadow-sm shrink-0"
              >
                <option value="">All Depts</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
              </select>
            )}
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-bold px-4 py-2 rounded-xl shrink-0 mx-1">{error}</div>}

        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {filter === 'follow_up' && deliveredOrders.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="flex items-center gap-2 px-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-orange-500">Delivered Orders Follow-up</span>
                <div className="flex-1 h-px bg-orange-100" />
              </div>
              {deliveredOrders.map((o, i) => {
                const isActive = selected?._id === o._id;
                const completed = o.followups?.filter(f => f.completed).length || 0;
                return (
                  <div key={o._id} onClick={() => setSelected(isActive ? null : o)}
                    className={`relative flex items-center gap-4 px-4 py-4 rounded-2xl cursor-pointer transition-all duration-200 border
                      ${isActive ? 'bg-orange-50 border-orange-200 shadow-sm' : 'bg-white border-gray-100 hover:border-orange-200'}`}>
                    <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-orange-500" />
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {initials(o.billing_customer_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{o.billing_customer_name}</p>
                      <p className="text-xs text-gray-400">{o.billing_phone}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-orange-100 text-orange-700 uppercase">
                        {completed}/5 Done
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-2 pb-4">
            {filteredItems.length === 0 && (!deliveredOrders.length || filter !== 'follow_up') ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3 text-gray-300">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <p className="text-gray-400 text-sm font-medium">No leads found in this stage</p>
              </div>
            ) : (
              filteredItems.map((item, i) => {
                const lead = item.lead || item;
                const isActive = selected?._id === item._id;
                const color = PIN_COLORS[i % PIN_COLORS.length];
                const stage = STAGES.find(s => s.key === lead.status);
                const staffName = lead.assignedTo?.name || item.assignedTo?.name;
                const addedByName = lead.createdBy?.name || item.createdBy?.name;
                // Bar color for CNP/CallAgain tabs
                const barColor = filter === 'cnp' ? 'bg-red-600' : filter === 'call_again' ? 'bg-amber-600' : (stage?.bar || 'bg-gray-300');
                const stageLabel = filter === 'cnp' ? 'CNP' : filter === 'call_again' ? 'CALL AGAIN' : (stage?.label || lead.status || 'unknown');
                
                return (
                  <div key={item._id} onClick={async () => {
                    if (isActive) { setSelected(null); setLeadTask(null); return; }
                    setSelected(item);
                    setLeadTask(null);
                    const leadId = item.lead?._id || item._id;
                    // For CNP, use the record itself as task data (it has address fields synced)
                    if (filter === 'cnp') {
                      setLeadTask(null);
                      const leadId = item.lead?._id || item.lead;
                      if (leadId) {
                        try {
                          const [fullLead, task] = await Promise.all([
                            getLead(leadId),
                            getTaskByLead(leadId).catch(() => null),
                          ]);
                          if (fullLead) setSelected(prev => ({ ...prev, lead: fullLead }));
                          if (task) setLeadTask(task);
                        } catch { }
                      }
                    } else if (filter === 'call_again') {
                      const leadId = item.lead?._id || item._id;
                      try {
                        const [task, fullLead] = await Promise.all([
                          getTaskByLead(leadId).catch(() => null),
                          getLead(leadId).catch(() => null),
                        ]);
                        setLeadTask(task || fullLead);
                        if (fullLead) setSelected(prev => ({ ...prev, lead: fullLead }));
                      } catch { }
                    } else {
                      try {
                        const [task, fullLead] = await Promise.all([
                          getTaskByLead(leadId).catch(() => null),
                          getLead(leadId).catch(() => null),
                        ]);
                        // Use task if it has address data, otherwise use lead
                        const hasAddress = task && (task.houseNo || task.cityVillage || task.district || task.pincode);
                        setLeadTask(hasAddress ? task : (fullLead || task));
                        if (fullLead) setSelected(prev => ({ ...prev, lead: fullLead }));
                      } catch { }
                    }
                  }}
                    className={`relative flex items-center gap-4 px-4 py-4 rounded-2xl cursor-pointer transition-all duration-200 border
                      ${isActive ? 'bg-green-50 border-green-200 shadow-sm' : 'bg-white border-gray-100 hover:border-green-200'}`}>
                    
                    <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${barColor}`} />
                    
                    <span className="text-[11px] font-bold text-gray-400 w-5 text-center shrink-0">{i + 1}</span>

                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 ${color}`}>
                      {initials(lead.name || item.title)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{lead.name || item.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{lead.phone}</span>
                        {item.cnpCount > 0 && <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md">{item.cnpCount}/3 CNP</span>}
                        {(lead.department || item.department) && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 uppercase">{lead.department || item.department}</span>}
                      </div>
                    </div>

                    <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500`}>
                        {stageLabel.toUpperCase()}
                      </span>
                      {staffName && <span className="text-[10px] text-gray-400">Assigned: {staffName}</span>}
                      {addedByName && <span className="text-[10px] text-blue-400">Added by: {addedByName}</span>}
                    </div>

                    <svg className={`w-4 h-4 text-gray-300 transition-transform ${isActive ? 'rotate-90 text-green-400' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                );
              }))}
          </div>
        </div>
      </div>

      {/* ── RIGHT DETAIL PANEL ── */}
      {selected && (
        <div className="hidden lg:flex flex-col w-[45%] bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden h-full">
          {(() => {
            const isOrder = !!selected.billing_customer_name;
            const lead = selected.lead || selected;
            const stage = STAGES.find(s => s.key === lead.status);
            const color = isOrder ? 'bg-orange-500' : (stage?.bar || 'bg-green-500');

            return (
              <>
                <div className={`h-1.5 shrink-0 ${color}`} />
                <div className="px-6 py-5 flex items-center justify-between border-b border-gray-50 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white text-sm font-bold shrink-0 ${color}`}>
                      {initials(lead.name || lead.billing_customer_name || selected.title)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800 leading-tight">{lead.name || lead.billing_customer_name || 'Details'}</p>
                      <p className="text-xs text-gray-400">{lead.phone || lead.billing_phone}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition text-2xl">×</button>
                </div>

                <div className="px-6 py-4 overflow-y-auto flex-1 custom-scrollbar">
                  {isOrder ? (
                    <>
                      <SectionHead label="Order Details" color="blue" />
                      <DetailRow label="City" value={selected.billing_city} />
                      <DetailRow label="Product" value={selected.order_items?.[0]?.name} />
                      <DetailRow label="Amount" value={`₹${selected.sub_total}`} />
                      <DetailRow label="Delivered At" value={selected.delivered_at && new Date(selected.delivered_at).toLocaleDateString('en-IN')} />
                      
                      <SectionHead label="Follow-up Checklist" color="blue" />
                      <div className="space-y-3 mt-3">
                        {Array.from({ length: 5 }, (_, i) => {
                          const fu = selected.followups?.find(f => f.followup_number === i + 1);
                          const isDone = fu?.completed;
                          const completedCount = selected.followups?.filter(f => f.completed).length || 0;
                          const isActive = i === completedCount;
                          const ordinal = ['1st','2nd','3rd','4th','5th'][i];

                          return (
                            <div key={i} className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${isDone ? 'bg-gray-50 border-gray-100 opacity-60' : isActive ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'}`}>
                              <span className={`text-xs font-bold ${isActive ? 'text-orange-600' : 'text-gray-400'}`}>{ordinal} Follow-up</span>
                              {isActive ? (
                                <button onClick={() => handleFollowUpDone(selected._id)} disabled={doneLoading === String(selected._id)}
                                  className="px-3 py-1.5 bg-orange-500 text-white text-[10px] font-bold rounded-lg hover:bg-orange-600 shadow-sm transition-all disabled:opacity-50">
                                  {doneLoading === String(selected._id) ? '...' : 'Mark Done'}
                                </button>
                              ) : isDone ? (
                                <span className="text-emerald-500 font-bold text-[10px]">✓ COMPLETED</span>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <>
                      <SectionHead label="Lead Information" />
                      <DetailRow label="Status" value={lead.status?.replace(/_/g,' ')} />
                      <DetailRow label="Department" value={lead.department || selected.department} color="blue" />
                      <DetailRow label="Assigned To" value={lead.assignedTo?.name || selected.assignedTo?.name} />
                      <DetailRow label="Added By" value={lead.createdBy?.name || selected.createdBy?.name} />
                      {lead.status === 'on_hold' && lead.onHoldReason && (
                        <div className="mt-2 mb-1 p-3 rounded-xl bg-gray-50 border border-gray-200">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">On Hold Info</p>
                          <p className="text-sm text-gray-700 font-medium">{lead.onHoldReason}</p>
                          {lead.onHoldUntil && (
                            <p className="text-xs text-gray-500 mt-0.5">Until: {new Date(lead.onHoldUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          )}
                        </div>
                      )}
                      <DetailRow label="Source" value={lead.source} />
                      <DetailRow label="Problem" value={leadTask?.problem || lead.problem} />
                      {(leadTask?.age || leadTask?.weight || leadTask?.height) && (
                        <>
                          <SectionHead label="Health Info" />
                          <DetailRow label="Age" value={leadTask?.age ? `${leadTask.age} yrs` : null} />
                          <DetailRow label="Weight" value={leadTask?.weight ? `${leadTask.weight} kg` : null} />
                          <DetailRow label="Height" value={leadTask?.height ? `${leadTask.height} ft` : null} />
                          <DetailRow label="Other Problems" value={leadTask?.otherProblems} />
                          <DetailRow label="Duration" value={leadTask?.problemDuration} />
                          <DetailRow label="Price" value={leadTask?.price ? `₹${leadTask.price}` : null} />
                        </>
                      )}
                      
                      <SectionHead label="Contact Details" />
                      <DetailRow label="Email" value={lead.email} />
                      <DetailRow label="Phone" value={leadTask?.phone || lead.phone} />

                      <SectionHead label="Address" />
                      <DetailRow label="House No" value={leadTask?.houseNo || lead.houseNo} />
                      <DetailRow label="City/Village" value={leadTask?.cityVillage || lead.cityVillage} />
                      <DetailRow label="Post Office" value={leadTask?.postOffice || lead.postOffice} />
                      <DetailRow label="Landmark" value={leadTask?.landmark || lead.landmark} />
                      <DetailRow label="District" value={leadTask?.district || lead.district} />
                      <DetailRow label="State" value={leadTask?.state || lead.state} />
                      <DetailRow label="Pincode" value={leadTask?.pincode || lead.pincode} />
                      <DetailRow label="Address" value={leadTask?.address || lead.address} />

                      <SectionHead label="Follow-up Action" />
                      <div className="space-y-3 mt-3 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2">
                             <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Add Note</label>
                             <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className={`${inputCls} bg-white`} placeholder="What happened on the call?" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Next Date</label>
                            <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} className={`${inputCls} bg-white`} />
                          </div>
                          <div className="flex items-end">
                            <button onClick={handleFollowUpNote} disabled={savingNote || (!note.trim() && !nextDate)}
                              className="w-full py-2.5 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 shadow-md transition-all disabled:opacity-50">
                              {savingNote ? '...' : 'Save Activity'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {(lead.notes?.length > 0 || lead.follow_ups?.length > 0) && (
                        <div className="mt-4">
                           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Activity History</p>
                           <div className="space-y-2">
                             {[
                               ...(lead.follow_ups || []).map(n => ({ text: n.note, createdAt: n.date, next: n.next_date })),
                               ...(lead.notes || []).map(n => ({ text: n.text, createdAt: n.createdAt }))
                             ].filter(n => n.text || n.next).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10).map((n, i) => (
                               <div key={i} className="p-3 rounded-2xl bg-white border border-gray-100 shadow-sm">
                                 {n.text && <p className="text-xs text-gray-700 leading-relaxed">{n.text}</p>}
                                 {n.next && <p className="text-[10px] text-green-600 font-bold mt-1">Next: {new Date(n.next).toLocaleDateString('en-IN')}</p>}
                                 <p className="text-[9px] text-gray-400 mt-1 font-bold uppercase tracking-tight">{new Date(n.createdAt).toLocaleString()}</p>
                               </div>
                             ))}
                           </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="px-6 py-5 border-t border-gray-50 bg-white shrink-0 flex flex-col gap-2">
                  {!isOrder && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <button disabled={updating} onClick={() => handleMove(lead, 'interested')}
                          className="py-3 rounded-2xl text-xs font-bold text-white bg-purple-500 hover:bg-purple-600 shadow-md shadow-purple-100 transition-all">
                          Interested
                        </button>
                        <button disabled={updating} onClick={() => handleMove(lead, 'on_hold')}
                          className="py-3 rounded-2xl text-xs font-bold text-white bg-gray-500 hover:bg-gray-600 shadow-md shadow-gray-100 transition-all">
                          On Hold
                        </button>
                      </div>
                      {/* Verification button removed as requested */}
                      <div className="grid grid-cols-2 gap-2">
                         <button onClick={async () => {
                           if (filter === 'closed_lost') await updateLead(lead._id, { status: 'on_hold' }).catch(() => {});
                           openTaskModal(lead);
                         }}
                           className="py-3 rounded-2xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-100 transition-all">
                           Task
                         </button>
                         <button disabled={updating} onClick={() => handleMove(lead, 'closed_lost')}
                           className="py-3 rounded-2xl text-xs font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all">
                           Mark Lost
                         </button>
                      </div>
                      {filter !== 'closed_lost' && (
                        <div className="grid grid-cols-2 gap-2">
                          <button disabled={updating} onClick={async () => {
                            setUpdating(lead._id);
                            try {
                              await markCNP(lead._id);
                              if (filter === 'call_again' && selected?._id && selected._id !== lead._id) {
                                await updateCallAgain(selected._id, { status: 'interested' }).catch(() => {});
                              }
                              await load(); setSelected(null);
                            } catch { } finally { setUpdating(null); }
                          }} className="py-3 rounded-2xl text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-all">CNP</button>
                          <button disabled={updating} onClick={async () => {
                            setUpdating(lead._id);
                            try {
                              await createCallAgain(lead._id);
                              if (filter === 'cnp' && selected?._id) {
                                await deleteCnpRecord(selected._id).catch(() => {});
                              }
                              await load(); setSelected(null);
                            } catch { } finally { setUpdating(null); }
                          }} className="py-3 rounded-2xl text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">Call Again</button>
                        </div>
                      )}

                      <button disabled={updating} onClick={() => handleDelete(lead._id)}
                        className="w-full py-3 mt-4 rounded-2xl text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 transition-all hover:bg-rose-100 active:scale-[0.98] flex items-center justify-center gap-2">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                        DELETE LEAD
                      </button>

                    </>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Mobile Modal */}
      {selected && (
        <div className="lg:hidden">
          <Modal hideHeader={true} onClose={() => setSelected(null)}>
            <div className={`-mx-4 -mt-4 mb-5 px-6 py-7 rounded-b-[2.5rem] relative shrink-0 bg-gradient-to-br from-gray-900 to-gray-800`}>
              <button onClick={() => setSelected(null)} className="absolute right-5 top-5 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white transition text-xl">×</button>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-xl ${PIN_COLORS[0]}`}>
                  {initials(selected.name || selected.billing_customer_name || selected.title)}
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg tracking-tight truncate">{selected.name || selected.billing_customer_name || selected.title}</h3>
                  <p className="text-white/50 text-sm">{selected.phone || selected.billing_phone}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-2 pb-8">
              {(() => { const ml = selected.lead || selected; return (
                <>
                  <DetailRow label="Status" value={ml.status?.replace(/_/g,' ')} />
                  <DetailRow label="Problem" value={ml.problem} />
                  <DetailRow label="House No" value={leadTask?.houseNo || ml.houseNo} />
                  <DetailRow label="City/Village" value={leadTask?.cityVillage || ml.cityVillage} />
                  <DetailRow label="Post Office" value={leadTask?.postOffice || ml.postOffice} />
                  <DetailRow label="Landmark" value={leadTask?.landmark || ml.landmark} />
                  <DetailRow label="District" value={leadTask?.district || ml.district} />
                  <DetailRow label="State" value={leadTask?.state || ml.state} />
                  <DetailRow label="Pincode" value={leadTask?.pincode || ml.pincode} />
                  <DetailRow label="Address" value={leadTask?.address || ml.address} />
                </>
              );})()}
              
              <div className="grid grid-cols-2 gap-3 pt-6">
                <button disabled={updating} onClick={() => handleMove(selected.lead || selected, 'interested')}
                  className="py-4 rounded-2xl text-xs font-bold text-white bg-purple-500 active:scale-95 transition shadow-lg shadow-purple-100">Interested</button>
                <button disabled={updating} onClick={() => handleMove(selected.lead || selected, 'on_hold')}
                  className="py-4 rounded-2xl text-xs font-bold text-white bg-gray-500 active:scale-95 transition shadow-lg shadow-gray-100">On Hold</button>
                <button onClick={async () => { const l = selected.lead || selected; if (filter === 'closed_lost') await updateLead(l._id, { status: 'on_hold' }).catch(() => {}); openTaskModal(l); }}
                  className="py-4 rounded-2xl text-xs font-bold text-white bg-blue-600 active:scale-95 transition shadow-lg shadow-blue-100">Task</button>
                <button disabled={updating} onClick={() => handleMove(selected.lead || selected, 'closed_lost')}
                  className="py-4 rounded-2xl text-xs font-bold text-gray-500 bg-gray-100 active:scale-95 transition">Mark Lost</button>
                <button disabled={updating} onClick={async () => {
                  setUpdating(selected._id);
                  try { await markCNP(selected._id); await load(); setSelected(null); } catch { } finally { setUpdating(null); }
                }} className="py-4 rounded-2xl text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100">CNP</button>
                <button disabled={updating} onClick={async () => {
                  setUpdating(selected._id);
                  try { await createCallAgain(selected.lead?._id || selected._id); await load(); setSelected(null); } catch { } finally { setUpdating(null); }
                }} className="py-4 rounded-2xl text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100">Call Again</button>
              </div>
            </div>
          </Modal>
        </div>
      )}


      {/* Task Create Modal */}
      {taskModal && (
        <Modal title="Create Task" onClose={() => setTaskModal(false)}>
          {taskError && <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-3 rounded-xl mb-4">{taskError}</div>}
          <form onSubmit={handleTaskSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Name *</label>
                <input required className={`${inputCls} mt-1`} value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone</label>
                <input className={`${inputCls} mt-1`} value={taskForm.phone} onChange={e => setTaskForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Confirmation Date</label>
              <input type="date" className={`${inputCls} mt-1`} value={taskForm.reminderAt} onChange={e => setTaskForm(f => ({ ...f, reminderAt: e.target.value }))} /></div>
            <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Problem</label>
              <textarea rows={1} className={`${inputCls} mt-1`} value={taskForm.problem} onChange={e => setTaskForm(f => ({ ...f, problem: e.target.value }))} /></div>
            <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Vitals (Age / Wt / Ht)</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <input type="number" placeholder="Age" className={inputCls} value={taskForm.age} onChange={e => setTaskForm(f => ({ ...f, age: e.target.value }))} />
                <input type="number" placeholder="Kg" className={inputCls} value={taskForm.weight} onChange={e => setTaskForm(f => ({ ...f, weight: e.target.value }))} />
                <input type="number" step="0.1" placeholder="Ft" className={inputCls} value={taskForm.height} onChange={e => setTaskForm(f => ({ ...f, height: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Other Problems</label>
                <textarea rows={1} className={`${inputCls} mt-1`} value={taskForm.otherProblems} onChange={e => setTaskForm(f => ({ ...f, otherProblems: e.target.value }))} /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Duration</label>
                <input className={`${inputCls} mt-1`} placeholder="e.g. 2y" value={taskForm.problemDuration} onChange={e => setTaskForm(f => ({ ...f, problemDuration: e.target.value }))} /></div>
            </div>
            <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Price</label>
              <input type="number" className={`${inputCls} mt-1`} placeholder="₹" value={taskForm.price} onChange={e => setTaskForm(f => ({ ...f, price: e.target.value }))} /></div>
            <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Address</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <input placeholder="City/Village" className={inputCls} value={taskForm.cityVillage} onChange={e => setTaskForm(f => ({ ...f, cityVillage: e.target.value }))} />
                <input placeholder="H.No" className={inputCls} value={taskForm.houseNo} onChange={e => setTaskForm(f => ({ ...f, houseNo: e.target.value }))} />
                <input placeholder="District" className={inputCls} value={taskForm.district} onChange={e => setTaskForm(f => ({ ...f, district: e.target.value }))} />
                <input placeholder="Pincode" maxLength={6} className={inputCls} value={taskForm.pincode} onChange={e => setTaskForm(f => ({ ...f, pincode: e.target.value }))} />
                <input placeholder="State" className={inputCls} value={taskForm.state} onChange={e => setTaskForm(f => ({ ...f, state: e.target.value }))} />
                <input placeholder="Landmark" className={inputCls} value={taskForm.landmark} onChange={e => setTaskForm(f => ({ ...f, landmark: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={taskLoading}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60 shadow-md"
                style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
                {taskLoading ? 'Saving...' : 'Create Task'}
              </button>
              <button type="button" onClick={() => setTaskModal(false)}
                className="flex-1 border border-gray-100 hover:bg-gray-50 py-3 rounded-xl text-sm font-bold text-gray-500">Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
