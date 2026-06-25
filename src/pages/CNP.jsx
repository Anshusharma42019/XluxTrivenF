import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '../context/AuthContext';
import API from '../api';
import {
  getLeads,
  getLead,
  updateLead,
  markCNP,
  unmarkCNP,
  getCallAgains,
  createCallAgain,
  updateCallAgain,
} from "../services/lead.service";
import {
  getCnpRecords,
  incrementCnpCount,
  updateTask,
  deleteCnpRecord,
  createTask,
} from "../services/task.service";
import Modal from "../components/ui/Modal";

const PIN_COLORS = [
  'bg-rose-500', 'bg-orange-500', 'bg-amber-500',
  'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-emerald-500',
];

const DEPARTMENTS = ['migraine', 'piles'];

const initials = (name = '') =>
  name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const DetailRow = ({ label, value, color = "gray" }) => (
  <div className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-28 shrink-0 mt-0.5">{label}</span>
    <span className={`text-sm font-medium capitalize flex-1 ${color === 'red' ? 'text-red-600' : value ? 'text-gray-800' : 'text-gray-400'}`}>
      {value || 'Not provided'}
    </span>
  </div>
);

const SectionHead = ({ label, color = "red" }) => (
  <div className="flex items-center gap-2 mt-4 mb-1">
    <span className={`text-[10px] font-extrabold uppercase tracking-widest ${color === 'red' ? 'text-red-500' : 'text-amber-500'}`}>{label}</span>
    <div className={`flex-1 h-px ${color === 'red' ? 'bg-red-100' : 'bg-amber-100'}`} />
  </div>
);

export default function CNP() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'manager';
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [allLeads, setAllLeads] = useState([]);
  const [callAgainLeads, setCallAgainLeads] = useState([]);
  const [cnpTasks, setCnpTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const _initPhone = new URLSearchParams(window.location.search).get('phone') || '';
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab') || 'tasks');
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState(() => _initPhone);
  const [department, setDepartment] = useState('');
  const [dateFilter, setDateFilter] = useState(() => _initPhone ? 'all' : 'today');
  const [callAgainDateFilter, setCallAgainDateFilter] = useState(() => _initPhone ? 'all' : 'today');
  const [note, setNote] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({});
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskError, setTaskError] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  const todayISO = () => { const d = new Date(); d.setHours(23,59,59,999); return d.toISOString(); };
  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-400 transition";

  const openTaskModal = (item) => {
    const lead = item.lead || {};
    setTaskForm({ title: lead.name || item.title || '', phone: lead.phone || '', problem: lead.problem || '', age: '', weight: '', height: '', otherProblems: '', problemDuration: '', price: '', reminderAt: '', dueDate: todayISO(), cityVillageType: 'city', cityVillage: '', houseNo: '', postOffice: '', district: '', landmark: '', pincode: '', state: '', type: 'task', priority: 'medium', lead: lead._id || '', assignedTo: item.assignedTo?._id || '', cnpRecordId: item._id, isCallAgain: tab === 'callAgain' });
    setTaskError('');
    setTaskModal(true);
  };

  const openEditModal = (item) => {
    const lead = item.lead || {};
    setEditForm({
      name: lead.name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      address: lead.address || '',
      problem: lead.problem || '',
      houseNo: lead.houseNo || '',
      cityVillage: lead.cityVillage || '',
      postOffice: lead.postOffice || '',
      district: lead.district || '',
      state: lead.state || '',
      pincode: lead.pincode || '',
      landmark: lead.landmark || '',
      department: lead.department || ''
    });
    setEditError('');
    setEditModal(true);
  };

  const handleTaskSubmit = async (e) => {
    e.preventDefault(); setTaskLoading(true); setTaskError('');
    try {
      const { cnpRecordId, isCallAgain, ...payload } = taskForm;
      if (!payload.assignedTo) delete payload.assignedTo;
      await createTask(payload);
      if (cnpRecordId) {
        if (isCallAgain) await updateCallAgain(cnpRecordId, { status: 'done' }).catch(() => {});
        else await deleteCnpRecord(cnpRecordId).catch(() => {});
      }
      if (payload.lead) await updateLead(payload.lead, { cnp: false, status: 'contacted' }).catch(() => {});
      setTaskModal(false);
      setSelected(null);
      load(dateFilter, callAgainDateFilter, department);
    } catch (err) { setTaskError(err.response?.data?.message || 'Failed'); }
    finally { setTaskLoading(false); }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault(); setEditLoading(true); setEditError('');
    try {
      const leadId = selected?.lead?._id;
      if (!leadId) throw new Error('No lead ID found');
      
      console.log('Sending edit data:', editForm);
      
      // Save to database first
      const updated = await updateLead(leadId, editForm);
      console.log('Server response:', updated);
      
      // Merge all data: original + form + server response
      const updatedLeadData = { 
        ...selected.lead, 
        ...editForm, 
        ...(updated || {})
      };
      
      console.log('Final merged data:', updatedLeadData);
      
      // Update the selected item with new data immediately
      setSelected(prev => ({ 
        ...prev, 
        lead: updatedLeadData
      }));
      
      // Update the lists as well
      setCnpTasks(prev => prev.map(task => 
        task._id === selected._id 
          ? { ...task, lead: updatedLeadData }
          : task
      ));
      
      setCallAgainLeads(prev => prev.map(lead => 
        lead._id === selected._id 
          ? { ...lead, lead: updatedLeadData }
          : lead
      ));
      
      setEditModal(false);
      
    } catch (err) { 
      console.error('Failed to update lead:', err);
      setEditError(err.response?.data?.message || 'Failed to update lead permanently'); 
    }
    finally { 
      setEditLoading(false); 
    }
  };

  const handleSaveNote = async () => {
    if (!note.trim() && !nextDate) return;
    setSavingNote(true);
    const leadId = selected?.lead?._id;
    try {
      const res = await API.post(`/leads/${leadId}/follow-up`, { note, next_date: nextDate || undefined });
      const updated = res.data.data;
      const newFollowUp = { note, next_date: nextDate || undefined, date: new Date().toISOString() };
      const updatedLead = { 
        ...(selected.lead || {}), 
        ...updated,
        follow_ups: [...(selected.lead?.follow_ups || []), newFollowUp]
      };
      setSelected(prev => ({ ...prev, lead: updatedLead }));
      setCnpTasks(prev => prev.map(task =>
        task._id === selected._id ? { ...task, lead: updatedLead } : task
      ));
      setCallAgainLeads(prev => prev.map(lead =>
        lead._id === selected._id ? { ...lead, lead: updatedLead } : lead
      ));
      setNote(''); setNextDate('');
    } catch { }
    finally { setSavingNote(false); }
  };

  const load = useCallback(async (cnpFilter = '', caFilter = '', deptFilter = '') => {
    try {
      const [cnpRes, allRes, tasksRes, callAgainRes] = await Promise.all([
        getLeads({ cnp: "true", limit: 200, department: deptFilter || undefined }),
        getLeads({ limit: 200, department: deptFilter || undefined }),
        getCnpRecords({ filter: cnpFilter || undefined, department: deptFilter || undefined }),
        getCallAgains({ filter: caFilter || undefined, department: deptFilter || undefined }),
      ]);
      setLeads(Array.isArray(cnpRes?.leads) ? cnpRes.leads : []);
      setAllLeads(Array.isArray(allRes?.leads) ? allRes.leads : []);
      setCnpTasks(Array.isArray(tasksRes) ? tasksRes.filter(t => t.lead?.status !== 'closed_lost') : []);
      setCallAgainLeads(Array.isArray(callAgainRes) ? callAgainRes : []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(dateFilter, callAgainDateFilter, department); }, [load, dateFilter, callAgainDateFilter, department]);

  const handleStatusChange = async (leadId, status, taskId = null) => {
    setUpdating(leadId);
    try {
      await updateLead(leadId, { status, cnp: false });
      if (taskId) await deleteCnpRecord(taskId);
      // For Call Again tab, mark the call-again record as done
      if (tab === 'callAgain' && selected?._id) {
        try { await updateCallAgain(selected._id, { status: 'done' }); } catch { }
      }
      if (tab === 'tasks') {
        setCnpTasks(prev => prev.filter(t => t._id !== taskId));
      } else {
        setCallAgainLeads(prev => prev.filter(r => r._id !== selected?._id));
      }
      setSelected(null);
      load(dateFilter, callAgainDateFilter, department);
    } catch { } finally { setUpdating(null); }
  };

  const handleIncrementCnp = async (id) => {
    setUpdating(id);
    try {
      const updated = await incrementCnpCount(id);
      setCnpTasks((prev) =>
        prev.map((t) => t._id === id ? { ...t, cnpCount: updated.cnpCount, lastCnpAt: updated.lastCnpAt, cnpHistory: updated.cnpHistory } : t)
      );
      if (selected?._id === id) {
        setSelected(prev => ({ ...prev, cnpCount: updated.cnpCount, lastCnpAt: updated.lastCnpAt, cnpHistory: updated.cnpHistory }));
      }
    } catch { /* ignore */ } finally { setUpdating(null); }
  };

  const handleGoToTask = (item) => openTaskModal(item);

  const filteredItems = useMemo(() => {
    const items = tab === 'tasks' ? cnpTasks : callAgainLeads;
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(item => {
      const lead = item.lead || {};
      return (
        item.title?.toLowerCase().includes(q) ||
        lead.name?.toLowerCase().includes(q) ||
        lead.phone?.includes(q)
      );
    });
  }, [tab, cnpTasks, callAgainLeads, search]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-[3px] border-red-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Loading CNP data...</p>
        </div>
      </div>
    );

  return (
    <div className="flex gap-4 scroll-container-h overflow-hidden animate-slide-up mobile-p-safe">
      {/* ── LEFT PANEL ── */}
      <div className={`flex flex-col gap-4 transition-all duration-300 ${selected ? 'w-full lg:w-[55%]' : 'w-full'} h-full overflow-hidden`}>
        
        {/* Header & Filters */}
        <div className="flex flex-col gap-5 shrink-0 glass p-5 rounded-2xl border border-white/50 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-fit">
              <button onClick={() => { setTab("tasks"); setSelected(null); }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${tab === "tasks" ? "bg-white text-red-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                Tasks ({cnpTasks.length})
              </button>
              <button onClick={() => { setTab("callAgain"); setSelected(null); }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${tab === "callAgain" ? "bg-white text-amber-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                Call Again ({callAgainLeads.length})
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
              {[
                { label: 'Today', value: 'today' },
                { label: 'Yesterday', value: 'yesterday' },
                { label: 'Week', value: 'this_week' },
                { label: 'Month', value: 'this_month' },
              ].map(f => {
                const active = tab === 'tasks' ? dateFilter === f.value : callAgainDateFilter === f.value;
                return (
                  <button key={f.value}
                    onClick={() => tab === 'tasks' ? setDateFilter(f.value) : setCallAgainDateFilter(f.value)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border whitespace-nowrap transition-all ${active
                      ? (tab === 'tasks' ? 'bg-red-600 text-white border-red-600 shadow-md' : 'bg-amber-600 text-white border-amber-600 shadow-md')
                      : 'bg-white text-gray-400 border-gray-100 hover:bg-gray-50'
                    }`}>{f.label}</button>
                );
              })}
            </div>
            <div className="relative w-full md:w-1/2 flex items-center gap-2">
              <div className="relative flex-1">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search name, phone..."
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-100 bg-white text-sm font-medium text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-red-400/20 focus:border-red-400 transition shadow-sm"
                />
              </div>
              {canManage && (
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  className="w-full md:w-auto px-4 py-2.5 rounded-xl border border-gray-100 bg-white text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400/20 transition shadow-sm shrink-0"
                >
                  <option value="">All Depts</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${tab === 'tasks' ? 'bg-red-50 text-red-300' : 'bg-amber-50 text-amber-300'}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.18 6.18l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /><line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm font-medium">No {tab === 'tasks' ? 'CNP tasks' : 'call-again leads'} found</p>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {filteredItems.map((item, i) => {
                const color = PIN_COLORS[i % PIN_COLORS.length];
                const isActive = selected?._id === item._id;
                const lead = item.lead || {};
                return (
                  <div key={item._id} onClick={() => setSelected(isActive ? null : item)}
                    className={`relative flex items-center gap-4 px-4 py-3.5 rounded-2xl cursor-pointer transition-all duration-200 border
                      ${isActive
                        ? (tab === 'tasks' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200') + ' shadow-sm'
                        : 'bg-white border-gray-100 hover:border-red-200 hover:bg-red-50/30'}`}>
                    
                    <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${tab === 'tasks' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    
                    <span className="text-[11px] font-bold text-gray-400 w-5 text-center shrink-0">{i + 1}</span>

                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 ${color}`}>
                      {initials(lead.name || item.title)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{lead.name || item.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{lead.phone || 'No Phone'}</span>
                        {tab === 'tasks' && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${item.cnpCount >= 3 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                            {item.cnpCount || 1}/3
                          </span>
                        )}
                        {(lead.department || item.department) && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 uppercase">{lead.department || item.department}</span>}
                      </div>
                    </div>

                    <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {new Date(item.lastCnpAt || item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                      {item.assignedTo?.name && (
                        <span className="text-[10px] text-gray-400">By {item.assignedTo.name}</span>
                      )}
                    </div>

                    <svg className={`w-4 h-4 text-gray-300 transition-transform ${isActive ? 'rotate-90 text-red-400' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
          <div className={`h-1.5 shrink-0 ${tab === 'tasks' ? 'bg-red-500' : 'bg-amber-500'}`} />
          
          <div className="px-5 py-4 flex items-center justify-between border-b border-gray-50 shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold ${PIN_COLORS[filteredItems.findIndex(i => i._id === selected._id) % PIN_COLORS.length]}`}>
                {initials(selected.lead?.name || selected.title)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-800 leading-tight">{selected.lead?.name || 'Task Details'}</p>
                <p className="text-xs text-gray-400">{selected.lead?.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => openEditModal(selected)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-purple-500 hover:bg-purple-50 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition text-xl">×</button>
            </div>
          </div>

          <div className="px-5 py-4 overflow-y-auto flex-1 custom-scrollbar">
            <SectionHead label="Contact Information" color={tab === 'tasks' ? 'red' : 'amber'} />
            <DetailRow label="Phone" value={selected.lead?.phone} />
            <DetailRow label="Department" value={selected.lead?.department || selected.department} color="blue" />
            <DetailRow label="Problem" value={selected.lead?.problem} />
            
            <SectionHead label="Address Details" color={tab === 'tasks' ? 'red' : 'amber'} />
            <DetailRow label="Address" value={selected.lead?.address} />
            <DetailRow label="House No" value={selected.lead?.houseNo} />
            <DetailRow label="City/Village" value={selected.lead?.cityVillage} />
            <DetailRow label="Post Office" value={selected.lead?.postOffice} />
            <DetailRow label="District" value={selected.lead?.district} />
            <DetailRow label="State" value={selected.lead?.state} />
            <DetailRow label="Pincode" value={selected.lead?.pincode} />
            <DetailRow label="Landmark" value={selected.lead?.landmark} />

            <SectionHead label="Status & History" color={tab === 'tasks' ? 'red' : 'amber'} />
            <DetailRow label="Current Status" value={selected.lead?.status?.replace(/_/g, ' ')} />
            <DetailRow label="Assigned To" value={selected.assignedTo?.name || selected.lead?.assignedTo?.name} />
            {tab === 'tasks' && (
              <>
                <DetailRow label="CNP Count" value={`${selected.cnpCount || 1} of 3`} color="red" />
                <DetailRow label="Last Attempt" value={selected.lastCnpAt ? new Date(selected.lastCnpAt).toLocaleString() : 'N/A'} />
              </>
            )}

            {tab === 'tasks' && selected.cnpHistory?.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Attempt History</p>
                <div className="space-y-2">
                  {[...selected.cnpHistory].reverse().map((h, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-red-50 border border-red-100/50">
                      <div className="w-6 h-6 rounded-lg bg-red-500 flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                        {selected.cnpHistory.length - i}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-700">{new Date(h.clickedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        <p className="text-[10px] text-gray-400 font-medium">{new Date(h.clickedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(selected.notes?.length > 0 || selected.lead?.notes?.length > 0) && (
              <div className="mt-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</p>
                <div className="space-y-2">
                  {[...(selected.notes?.length ? selected.notes : selected.lead?.notes || [])].reverse().slice(0, 3).map((n, i) => (
                    <div key={i} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <p className="text-xs text-gray-600 leading-relaxed">{n.text}</p>
                      <p className="text-[9px] text-gray-400 mt-1 font-bold uppercase">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Add Note</p>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400 transition mb-2"
                placeholder="What happened on the call?" />
              <div className="flex gap-2">
                <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400 transition" />
                <button onClick={handleSaveNote} disabled={savingNote || (!note.trim() && !nextDate)}
                  className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-600 disabled:opacity-50 transition">
                  {savingNote ? '...' : 'Save'}
                </button>
              </div>
              {/* Activity history */}
              {(selected.lead?.follow_ups?.length > 0) && (
                <div className="mt-3 space-y-2 max-h-32 overflow-y-auto">
                  {[...selected.lead.follow_ups].reverse().slice(0, 5).map((f, i) => (
                    <div key={i} className="p-2 rounded-lg bg-white border border-gray-100">
                      {f.note && <p className="text-xs text-gray-700">{f.note}</p>}
                      {f.next_date && <p className="text-[10px] text-green-600 font-bold">Next: {new Date(f.next_date).toLocaleDateString('en-IN')}</p>}
                      <p className="text-[9px] text-gray-400 font-bold uppercase">{new Date(f.date).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="px-5 py-4 border-t border-gray-50 bg-white shrink-0">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button disabled={updating} onClick={() => handleStatusChange(selected.lead?._id, 'interested', tab === 'tasks' ? selected._id : null)}
                className="py-2.5 rounded-xl text-xs font-bold text-white bg-green-500 hover:bg-green-600 transition shadow-md shadow-green-100 disabled:opacity-50">
                Interested
              </button>
              <button disabled={updating} onClick={() => handleStatusChange(selected.lead?._id, 'on_hold', tab === 'tasks' ? selected._id : null)}
                className="py-2.5 rounded-xl text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 transition shadow-md shadow-amber-100 disabled:opacity-50">
                On Hold
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button disabled={updating} onClick={() => handleStatusChange(selected.lead?._id, 'closed_lost', tab === 'tasks' ? selected._id : null)}
                className="py-2.5 rounded-xl text-xs font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition disabled:opacity-50">
                Mark Lost
              </button>
              {tab === 'tasks' ? (
                <button disabled={updating || (selected.cnpCount || 1) >= 3} onClick={() => handleIncrementCnp(selected._id)}
                  className="py-2.5 rounded-xl text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition shadow-md shadow-red-100 disabled:opacity-50">
                  CNP {selected.cnpCount || 1}/3
                </button>
              ) : (
                <button onClick={() => handleGoToTask(selected)}
                  className="py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-md shadow-blue-100">
                  Task
                </button>
              )}
            </div>
            {tab === 'tasks' && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button onClick={() => handleGoToTask(selected)}
                  className="py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-md shadow-blue-100">
                  Task
                </button>
                <button disabled={updating} onClick={async () => {
                  setUpdating(selected._id);
                  try {
                    await createCallAgain(selected.lead?._id);
                    await deleteCnpRecord(selected._id);
                    load(dateFilter, callAgainDateFilter);
                    setSelected(null);
                  } catch { } finally { setUpdating(null); }
                }} className="py-2.5 rounded-xl text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition disabled:opacity-50">
                  Call Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Modal */}
      {selected && (
        <div className="lg:hidden">
          <Modal hideHeader={true} onClose={() => setSelected(null)}>
            <div className={`-mx-4 -mt-4 mb-5 px-6 py-6 rounded-b-3xl relative ${tab === 'tasks' ? 'bg-gradient-to-br from-red-900 to-red-800' : 'bg-gradient-to-br from-amber-900 to-amber-800'}`}>
              <div className="absolute right-4 top-4 flex items-center gap-2">
                <button onClick={() => openEditModal(selected)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button onClick={() => setSelected(null)} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 text-white transition text-xl">×</button>
              </div>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-xl ${PIN_COLORS[filteredItems.findIndex(i => i._id === selected._id) % PIN_COLORS.length]}`}>
                  {initials(selected.lead?.name || selected.title)}
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-bold text-lg tracking-tight">{selected.lead?.name || selected.title}</h3>
                  <p className="text-white/60 text-sm">{selected.lead?.phone}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-2 pb-6">
              <DetailRow label="Status" value={selected.lead?.status?.replace(/_/g, ' ')} />
              <DetailRow label="Address" value={selected.lead?.address} />
              
              {tab === 'tasks' && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-100">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-red-600 uppercase tracking-widest">CNP Progress</span>
                    <span className="text-xs font-black text-red-600">{selected.cnpCount || 1}/3</span>
                  </div>
                  <div className="w-full h-2 bg-red-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${((selected.cnpCount || 1) / 3) * 100}%` }} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-4">
                <button disabled={updating} onClick={() => handleStatusChange(selected.lead?._id, 'interested', tab === 'tasks' ? selected._id : null)}
                  className="py-4 rounded-xl text-xs font-bold text-white bg-green-500 active:scale-95 transition shadow-lg shadow-green-100">Interested</button>
                <button disabled={updating} onClick={() => handleStatusChange(selected.lead?._id, 'on_hold', tab === 'tasks' ? selected._id : null)}
                  className="py-4 rounded-xl text-xs font-bold text-white bg-amber-500 active:scale-95 transition shadow-lg shadow-amber-100">On Hold</button>
                <button disabled={updating} onClick={() => handleStatusChange(selected.lead?._id, 'closed_lost', tab === 'tasks' ? selected._id : null)}
                  className="py-4 rounded-xl text-xs font-bold text-gray-500 bg-gray-100 active:scale-95 transition">Mark Lost</button>
                {tab === 'tasks' ? (
                  <button disabled={updating || (selected.cnpCount || 1) >= 3} onClick={() => handleIncrementCnp(selected._id)}
                    className="py-4 rounded-xl text-xs font-bold text-white bg-red-500 active:scale-95 transition shadow-lg shadow-red-100">CNP {selected.cnpCount || 1}/3</button>
                ) : (
                  <button onClick={() => handleGoToTask(selected)}
                    className="py-4 rounded-xl text-xs font-bold text-white bg-blue-600 active:scale-95 transition shadow-lg shadow-blue-100">Task</button>
                )}
              </div>
              {tab === 'tasks' && (
                <button onClick={() => handleGoToTask(selected)}
                  className="w-full mt-2 py-4 rounded-xl text-xs font-bold text-white bg-blue-600 active:scale-95 transition shadow-lg shadow-blue-100">Task</button>
              )}
            </div>
          </Modal>
        </div>
      )}
      {/* Task Modal */}
      {taskModal && (
        <Modal title="Create Task" onClose={() => setTaskModal(false)}>
          {taskError && <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-3 rounded-xl mb-4">{taskError}</div>}
          <form onSubmit={handleTaskSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Name *</label>
                <input required className={`${inputCls} mt-1`} value={taskForm.title||''} onChange={e => setTaskForm(f => ({...f, title: e.target.value}))} /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone</label>
                <input className={`${inputCls} mt-1`} value={taskForm.phone||''} onChange={e => setTaskForm(f => ({...f, phone: e.target.value}))} /></div>
            </div>
            <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Confirmation Date</label>
              <input type="date" className={`${inputCls} mt-1`} value={taskForm.reminderAt||''} onChange={e => setTaskForm(f => ({...f, reminderAt: e.target.value}))} /></div>
            <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Problem</label>
              <textarea rows={1} className={`${inputCls} mt-1`} value={taskForm.problem||''} onChange={e => setTaskForm(f => ({...f, problem: e.target.value}))} /></div>
            <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Vitals (Age / Wt / Ht)</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <input type="number" placeholder="Age" className={inputCls} value={taskForm.age||''} onChange={e => setTaskForm(f => ({...f, age: e.target.value}))} />
                <input type="number" placeholder="Kg" className={inputCls} value={taskForm.weight||''} onChange={e => setTaskForm(f => ({...f, weight: e.target.value}))} />
                <input type="number" step="0.1" placeholder="Ft" className={inputCls} value={taskForm.height||''} onChange={e => setTaskForm(f => ({...f, height: e.target.value}))} />
              </div>
            </div>
            <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Price</label>
              <input type="number" className={`${inputCls} mt-1`} placeholder="₹" value={taskForm.price||''} onChange={e => setTaskForm(f => ({...f, price: e.target.value}))} /></div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={taskLoading} className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60" style={{background:'linear-gradient(135deg,#16a34a,#15803d)'}}>
                {taskLoading ? 'Saving...' : 'Create Task'}
              </button>
              <button type="button" onClick={() => setTaskModal(false)} className="flex-1 border border-gray-100 hover:bg-gray-50 py-3 rounded-xl text-sm font-bold text-gray-500">Cancel</button>
            </div>
          </form>
        </Modal>
      )}
      
      {/* Edit Modal */}
      {editModal && (
        <Modal title="Edit Lead" onClose={() => setEditModal(false)}>
          {editError && <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-3 rounded-xl mb-4">{editError}</div>}
          <form onSubmit={handleEditSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Name *</label>
                <input required className={`${inputCls} mt-1`} value={editForm.name||''} onChange={e => setEditForm(f => ({...f, name: e.target.value}))} /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone</label>
                <input className={`${inputCls} mt-1`} value={editForm.phone||''} onChange={e => setEditForm(f => ({...f, phone: e.target.value}))} /></div>
            </div>
            <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Problem</label>
              <textarea rows={2} className={`${inputCls} mt-1`} value={editForm.problem||''} onChange={e => setEditForm(f => ({...f, problem: e.target.value}))} /></div>
            <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Department</label>
              <select className={`${inputCls} mt-1`} value={editForm.department||''} onChange={e => setEditForm(f => ({...f, department: e.target.value}))}>
                <option value="">No Department</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
              </select>
            </div>
            <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Address</label>
              <textarea rows={2} className={`${inputCls} mt-1`} value={editForm.address||''} onChange={e => setEditForm(f => ({...f, address: e.target.value}))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">House No</label>
                <input className={`${inputCls} mt-1`} value={editForm.houseNo||''} onChange={e => setEditForm(f => ({...f, houseNo: e.target.value}))} /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">City/Village</label>
                <input className={`${inputCls} mt-1`} value={editForm.cityVillage||''} onChange={e => setEditForm(f => ({...f, cityVillage: e.target.value}))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Post Office</label>
                <input className={`${inputCls} mt-1`} value={editForm.postOffice||''} onChange={e => setEditForm(f => ({...f, postOffice: e.target.value}))} /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">District</label>
                <input className={`${inputCls} mt-1`} value={editForm.district||''} onChange={e => setEditForm(f => ({...f, district: e.target.value}))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">State</label>
                <input className={`${inputCls} mt-1`} value={editForm.state||''} onChange={e => setEditForm(f => ({...f, state: e.target.value}))} /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pincode</label>
                <input className={`${inputCls} mt-1`} value={editForm.pincode||''} onChange={e => setEditForm(f => ({...f, pincode: e.target.value}))} /></div>
            </div>
            <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Landmark</label>
              <input className={`${inputCls} mt-1`} value={editForm.landmark||''} onChange={e => setEditForm(f => ({...f, landmark: e.target.value}))} /></div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={editLoading} className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60 bg-purple-500 hover:bg-purple-600">
                {editLoading ? 'Saving...' : 'Update Lead'}
              </button>
              <button type="button" onClick={() => setEditModal(false)} className="flex-1 border border-gray-100 hover:bg-gray-50 py-3 rounded-xl text-sm font-bold text-gray-500">Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
