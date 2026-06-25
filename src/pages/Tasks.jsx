import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getTasks, getDailyTasks, createTask, updateTask, deleteTask, addTaskNote, getTask } from '../services/task.service';
import { getUsers } from '../services/user.service';
import { updateLead, createCallAgain } from '../services/lead.service';
import Modal from '../components/ui/Modal';
import Whatsapp from './Whatsapp';

const PIN_COLORS = [
  'bg-emerald-500', 'bg-blue-500', 'bg-indigo-500',
  'bg-violet-500', 'bg-rose-500', 'bg-orange-500', 'bg-amber-500',
];

const initials = (name = '') =>
  name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const DetailRow = ({ label, value, color = "gray", icon }) =>
  value ? (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      {icon && <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-100/50">{icon}</div>}
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-0.5">{label}</span>
        <span className={`text-sm font-semibold capitalize break-words ${color === 'red' ? 'text-red-600' : color === 'green' ? 'text-emerald-600' : 'text-gray-800'}`}>{value}</span>
      </div>
    </div>
  ) : null;

const SectionHead = ({ label, color = "emerald" }) => (
  <div className="flex items-center gap-2 mt-6 mb-2">
    <span className={`text-[10px] font-extrabold uppercase tracking-widest ${color === 'emerald' ? 'text-emerald-500' : 'text-amber-500'}`}>{label}</span>
    <div className={`flex-1 h-px ${color === 'emerald' ? 'bg-emerald-100' : 'bg-amber-100'}`} />
  </div>
);

const TYPES = ['call', 'follow_up', 'meeting', 'email', 'task'];
const DEPARTMENTS = ['migraine', 'piles'];
const STATUSES = [
  { value: 'interested', label: 'Interested', color: 'bg-green-600 border-green-600' },
  { value: 'cancel_call', label: 'Not Interested', color: 'bg-red-500 border-red-500' },
  { value: 'cnp', label: 'CNP', color: 'bg-orange-500 border-orange-500' },
  { value: 'cancelled', label: 'On Hold', color: 'bg-gray-500 border-gray-500' },
  { value: 'verification', label: 'Verification', color: 'bg-blue-600 border-blue-600' },
];

const HIDDEN_TASK_STATUSES = new Set(['cnp', 'verification', 'interested', 'cancel_call', 'cancelled', 'on_hold', 'closed_lost']);
const HIDDEN_TASK_LEAD_STATUSES = new Set(['closed_lost', 'on_hold', 'follow_up']);

const EMPTY = { title: '', description: '', problem: '', type: 'task', lead: '', assignedTo: '', dueDate: '', priority: 'medium', reminderAt: '', cityVillageType: 'city', cityVillage: '', houseNo: '', postOffice: '', district: '', landmark: '', pincode: '', state: '', status: 'pending', age: '', weight: '', height: '', otherProblems: '', problemDuration: '', price: '', phone: '', department: '' };

const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition";

const TYPE_SVG = {
  call:      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.18 6.18l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  follow_up: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>,
  meeting:   <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  email:     <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  task:      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
};

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [daily, setDaily] = useState([]);
  const [salesUsers, setSalesUsers] = useState([]);
  const [tab, setTab] = useState('daily');
  const [filters, setFilters] = useState({ status: '', type: '', department: '' });
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('phone') || '');
  const [noteText, setNoteText] = useState('');
  const [pincodeData, setPincodeData] = useState([]);
  const [pincodeLoading, setPincodeLoading] = useState(false);

  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [whatsappLeadId, setWhatsappLeadId] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const pendingOpenId = searchParams.get('openId');
  const canManage = user?.role === 'admin' || user?.role === 'manager';

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.type) params.type = filters.type;
      if (filters.department) params.department = filters.department;
      const [all, day] = await Promise.all([getTasks(params), getDailyTasks(params)]);
      setTasks(Array.isArray(all) ? all : []);
      setDaily(Array.isArray(day) ? day : []);
    } catch (err) {
      setLoadError(err.response?.data?.message || err.message || 'Failed to load tasks');
    } finally { setPageLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (canManage) {
      getUsers({ role: 'sales' }).then(r => setSalesUsers(r.results || [])).catch(() => {});
    }
  }, [canManage]);

  useEffect(() => {
    if (pendingOpenId) {
      getTask(pendingOpenId).then(task => {
        setSelected(task);
        setTab('all');
        setSearchParams({}, { replace: true });
      }).catch(() => {});
    }
  }, [pendingOpenId, setSearchParams]);

  useEffect(() => {
    if (location.state?.leadId) {
      const ld = location.state.leadData || {};
      setForm({
        ...EMPTY,
        lead: location.state.leadId,
        assignedTo: location.state.assignedTo || ld.assignedTo?._id || '',
        title: ld.name || '',
        phone: ld.phone || '',
        problem: ld.problem || '',
        description: ld.description || '',
        age: ld.age || '',
        weight: ld.weight || '',
        height: ld.height || '',
        cityVillageType: ld.cityVillageType || 'city',
        cityVillage: ld.cityVillage || '',
        houseNo: ld.houseNo || '',
        postOffice: ld.postOffice || '',
        district: ld.district || '',
        landmark: ld.landmark || '',
        pincode: ld.pincode || '',
        state: ld.state || '',
        otherProblems: ld.otherProblems || '',
        problemDuration: ld.problemDuration || '',
        price: ld.price || ld.revenue || '',
      });
      setError('');
      setModal('create');
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const openCreate = () => { setForm(EMPTY); setError(''); setPincodeData([]); setModal('create'); };
  const openEdit = (task) => {
    // Parse phone from description if task.phone is missing (legacy format: "Phone: xxx | rest")
    let phone = task.phone || '';
    let description = task.description || '';
    if (!phone && description.startsWith('Phone:')) {
      const match = description.match(/^Phone:\s*([^|]+)(?:\|(.*))?$/);
      if (match) { phone = match[1].trim(); description = (match[2] || '').trim(); }
    }
    setForm({ title: task.title, description, problem: task.problem || '', type: task.type,
      lead: task.lead?._id || '', assignedTo: task.assignedTo?._id || '',
      dueDate: task.dueDate?.slice(0, 16) || '', priority: task.priority,
      reminderAt: task.reminderAt?.slice(0, 16) || '',
      cityVillageType: task.cityVillageType || 'city', cityVillage: task.cityVillage || '', houseNo: task.houseNo || '',
      postOffice: task.postOffice || '', district: task.district || '',
      landmark: task.landmark || '', pincode: task.pincode || '', state: task.state || '',
      status: task.status || 'pending',
      age: task.age || '', weight: task.weight || '', height: task.height || '',
      otherProblems: task.otherProblems || '', problemDuration: task.problemDuration || '', price: task.price || '', phone, department: task.department || '' });
    setError(''); setModal('edit');
  };

  const handlePincodeChange = async (val) => {
    setForm(f => ({ ...f, pincode: val, postOffice: '', district: '', state: '' }));
    setPincodeData([]);
    if (val.length !== 6) return;
    setPincodeLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/pincode/${val}`);
      const data = await res.json();
      const result = Array.isArray(data) ? data[0] : data;
      if (result?.Status === 'Success') {
        const offices = result.PostOffice || [];
        setPincodeData(offices);
        if (offices.length > 0) {
          setForm(f => ({ ...f, district: offices[0].District, state: offices[0].State }));
        }
      }
    } catch { /* ignore */ }
    finally { setPincodeLoading(false); }
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !selected) return;
    try {
      const updated = await addTaskNote(selected._id, noteText.trim());
      setSelected(updated);
      setNoteText('');
      load();
    } catch { /* ignore */ }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const payload = { ...form };
      if (!payload.lead) delete payload.lead;
      if (!payload.assignedTo) delete payload.assignedTo;
      if (!payload.reminderAt) delete payload.reminderAt;
      if (!payload.department) delete payload.department;

      if (modal === 'create') {
        await createTask(payload);
        if (location.state?.cnpId) {
          await deleteCnpRecord(location.state.cnpId).catch(() => {});
          if (payload.lead) await updateLead(payload.lead, { cnp: false }).catch(() => {});
        }
      } else {
        await updateTask(selected._id, payload);
      }

      const leadId = form.lead || (selected?.lead?._id || selected?.lead);
      if (leadId) {
        if (payload.status === 'interested') {
          await updateLead(leadId, { status: 'interested' }).catch(() => {});
        } else if (payload.status === 'cancel_call') {
          await updateLead(leadId, { status: 'closed_lost' }).catch(() => {});
        } else if (payload.status === 'cnp') {
          await updateLead(leadId, { cnp: true }).catch(() => {});
        } else if (payload.status === 'cancelled') {
          await updateLead(leadId, { status: 'on_hold' }).catch(() => {});
        }
      }

      setModal(null);
      if (location.state?.leadId) { navigate('/pipeline'); return; }
      load();
    } catch (err) { setError(err.response?.data?.message || 'Something went wrong'); }
    finally { setLoading(false); }
  };

  const handleComplete = async (id) => { 
    await updateTask(id, { status: 'completed' }).catch(() => {}); 
    load();
    if (selected?._id === id) {
      setSelected(prev => ({ ...prev, status: 'completed' }));
    }
  };
  
  const handleDelete = async (id) => {
    if (!confirm('Delete this task?')) return;
    await deleteTask(id).catch(() => {}); 
    setSelected(null);
    load();
  };

  const handleQuickAction = async (action) => {
    if (!selected) return;
    const actionNames = { cnp: 'CNP', mark_loss: 'Mark to Loss', callagain: 'Call Again' };
    if (!confirm(`Are you sure you want to ${actionNames[action]} this task?`)) return;
    
    setLoading(true);
    const leadId = selected.lead?._id || selected.lead;
    try {
      let finalNotes = selected.notes || [];
      if (noteText.trim()) {
        try {
          const updated = await addTaskNote(selected._id, noteText.trim());
          finalNotes = updated.notes;
          setNoteText('');
        } catch { /* ignore */ }
      }

      if (action === 'cnp') {
        await updateTask(selected._id, { status: 'cnp' }).catch(() => {});
        if (leadId) await updateLead(leadId, { cnp: true }).catch(() => {});
        setSelected(prev => ({ ...prev, status: 'cnp', notes: finalNotes }));
      } else if (action === 'mark_loss') {
        await updateTask(selected._id, { status: 'cancel_call' }).catch(() => {});
        if (leadId) await updateLead(leadId, { status: 'closed_lost' }).catch(() => {});
        setSelected(prev => ({ ...prev, status: 'cancel_call', notes: finalNotes }));
      } else if (action === 'callagain') {
        // createCallAgain API already sets: lead → follow_up, tasks → cancel_call
        if (leadId) await createCallAgain(leadId, finalNotes);
        setSelected(prev => ({ ...prev, status: 'cancel_call', notes: finalNotes }));
      }
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    let items = (tab === 'daily' ? daily : tasks).filter(t =>
      !HIDDEN_TASK_STATUSES.has(t.status) &&
      !HIDDEN_TASK_LEAD_STATUSES.has(t.lead?.status)
    );
    
    // Sort items so newest are at the top (by createdAt, fallback to ObjectId timestamp)
    items = [...items].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : parseInt(a._id.substring(0, 8), 16);
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : parseInt(b._id.substring(0, 8), 16);
      return timeB - timeA;
    });

    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(task => 
      task.title?.toLowerCase().includes(q) || 
      task.lead?.name?.toLowerCase().includes(q) ||
      task.phone?.includes(q)
    );
  }, [tab, tasks, daily, search]);

  if (pageLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400 font-medium">Loading tasks...</p>
      </div>
    </div>
  );

  return (
    <div className="flex gap-4 scroll-container-h overflow-hidden animate-slide-up mobile-p-safe">
      {/* ── LEFT PANEL ── */}
      <div className={`flex flex-col gap-4 transition-all duration-300 ${selected ? 'hidden lg:flex lg:w-[40%]' : 'w-full'} h-full overflow-hidden`}>
        
        {/* Header & Filters */}
        <div className="flex flex-col gap-5 shrink-0 glass p-5 rounded-2xl border border-white/50 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex gap-2">
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                <button onClick={() => { setTab("all"); setSelected(null); }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${tab === "all" ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  All
                </button>
                <button onClick={() => { setTab("daily"); setSelected(null); }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${tab === "daily" ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  Today
                </button>
              </div>
              <button onClick={openCreate}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md hover:shadow-lg transition-all"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                + New Task
              </button>
            </div>
            <button onClick={() => { setWhatsappLeadId(null); setShowWhatsappModal(true); }}
              className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 transition-all shadow-sm">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.558 4.12 1.532 5.845L.057 23.941l6.26-1.643A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.034-1.383l-.36-.214-3.732.979.998-3.642-.235-.374A9.818 9.818 0 1 1 12 21.818z"/></svg>
              Open WhatsApp
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, phone, task..."
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-100 bg-white text-sm font-medium text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 focus:border-emerald-400 transition shadow-sm"
              />
            </div>
            <div className="flex gap-2">
                {canManage && (
                  <select value={filters.department} onChange={(e) => setFilters(f => ({ ...f, department: e.target.value }))}
                    className="border border-gray-100 rounded-xl px-4 py-2 text-xs bg-white font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 shadow-sm min-w-[120px]">
                    <option value="">All Depts</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
                  </select>
                )}
                {tab === 'all' && (
                  <select value={filters.type} onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))}
                    className="border border-gray-100 rounded-xl px-4 py-2 text-xs bg-white font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 shadow-sm min-w-[120px]">
                    <option value="">All Types</option>
                    {TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                )}
              </div>
            </div>
        </div>

        {/* List */}
        <div className="flex items-center justify-between px-2 mb-1 shrink-0">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {`Showing ${filteredItems.length} ${filteredItems.length === 1 ? 'Task' : 'Tasks'}`}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-300 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                </div>
                <p className="text-gray-500 text-sm font-medium">No active tasks found</p>
              </div>
            ) : (
              <div className="space-y-2 pb-4">
                {filteredItems.map((task, i) => {
                  const color = PIN_COLORS[i % PIN_COLORS.length];
                  const isActive = selected?._id === task._id;
                  const isCompleted = task.status === 'completed';
                  
                  return (
                    <div key={task._id} onClick={() => setSelected(isActive ? null : task)}
                      className={`relative flex items-center gap-4 px-4 py-3.5 rounded-2xl cursor-pointer transition-all duration-200 border
                        ${isActive
                          ? 'bg-emerald-50 border-emerald-200 shadow-sm'
                          : 'bg-white border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/30'}`}>
                      
                      <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${isCompleted ? 'bg-gray-300' : 'bg-emerald-500'}`} />
                      
                      <div className="text-xs font-black text-gray-300 w-6 text-right shrink-0 select-none">
                        {i + 1}.
                      </div>

                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 ${isCompleted ? 'bg-gray-300' : color}`}>
                        {initials(task.lead?.name || task.title)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-bold text-gray-800 truncate ${isCompleted ? 'line-through text-gray-400' : ''}`}>{task.title}</p>
                          {isCompleted && (
                            <span className="bg-emerald-100 text-emerald-600 text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase">Done</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400 font-medium">{task.lead?.name || 'No Lead'}</span>
                          <span className="text-xs text-gray-300">•</span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase">{task.type.replace(/_/g, ' ')}</span>
                          {task.department && (
                            <>
                              <span className="text-xs text-gray-300">•</span>
                              <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">{task.department}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                        {task.assignedTo?.name && (
                          <span className="text-[10px] text-gray-400 font-medium">For {task.assignedTo.name}</span>
                        )}
                      </div>

                      <svg className={`w-4 h-4 text-gray-300 transition-transform ${isActive ? 'rotate-90 text-emerald-400' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
        <div className="hidden lg:flex flex-col w-[60%] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-full">
          <div className={`h-1.5 shrink-0 ${selected.status === 'completed' ? 'bg-gray-300' : 'bg-emerald-500'}`} />
          
          <div className="px-5 py-4 flex items-center justify-between border-b border-gray-50 shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold ${selected.status === 'completed' ? 'bg-gray-300' : PIN_COLORS[filteredItems.findIndex(i => i._id === selected._id) % PIN_COLORS.length]}`}>
                {initials(selected.lead?.name || selected.title)}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800 leading-tight truncate max-w-[200px]">{selected.title}</p>
                <p className="text-xs text-gray-400 font-medium">{selected.lead?.name || 'No lead linked'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => openEdit(selected)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-emerald-50 hover:text-emerald-500 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition text-xl">×</button>
            </div>
          </div>

          <div className="px-5 py-4 overflow-y-auto flex-1 custom-scrollbar">
            <SectionHead label="Task Information" />
            <div className="grid grid-cols-1 gap-1">
              <DetailRow label="Due Date" value={new Date(selected.dueDate).toLocaleString()} />
              <DetailRow label="Type" value={selected.type.replace(/_/g, ' ')} />
              <DetailRow label="Priority" value={selected.priority} color={selected.priority === 'high' ? 'red' : 'gray'} />
              <DetailRow label="Status" value={selected.status} color={selected.status === 'completed' ? 'green' : 'amber'} />
            </div>

            <SectionHead label="Contact & Lead" />
            <div className="grid grid-cols-1 gap-1">
              <DetailRow label="Lead Name" value={selected.lead?.name} />
              <DetailRow label="Phone" value={selected.phone || selected.lead?.phone} />
              <DetailRow label="Assigned To" value={selected.assignedTo?.name} />
            </div>

            <SectionHead label="Problem & Details" />
            <div className="grid grid-cols-1 gap-1">
              <DetailRow label="Problem" value={selected.problem} />
              <DetailRow label="Vitals" value={selected.age || selected.weight || selected.height ? `${selected.age ? selected.age+'y ' : ''}${selected.weight ? selected.weight+'kg ' : ''}${selected.height ? selected.height+'ft' : ''}` : null} />
              <DetailRow label="Other Problems" value={selected.otherProblems} />
              <DetailRow label="Price" value={selected.price ? `₹${selected.price}` : null} />
              <DetailRow label="Description" value={selected.description} />
            </div>

            <SectionHead label="Address" />
            <div className="grid grid-cols-1 gap-1">
              <DetailRow label={selected.cityVillageType === 'village' ? 'Village' : 'City'} value={selected.cityVillage} />
              <DetailRow label="Full Address" value={[selected.houseNo, selected.landmark, selected.postOffice, selected.district, selected.pincode, selected.state].filter(Boolean).join(', ')} />
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Task Activity</p>
                <div className="flex-1 h-px bg-gray-50 ml-4" />
              </div>
              
              <div className="space-y-3 mb-4">
                {selected.notes?.length > 0 ? (
                  [...selected.notes].reverse().map((n, i) => (
                    <div key={i} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <p className="text-xs text-gray-600 leading-relaxed font-medium">{n.text}</p>
                      <p className="text-[9px] text-gray-400 mt-2 font-bold uppercase tracking-tight">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 italic text-center py-4">No notes yet</p>
                )}
              </div>

              <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Add Note</p>
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 transition mb-2"
                  placeholder="Type updates here..." />
                <button onClick={handleAddNote} disabled={!noteText.trim()}
                  className="w-full py-2 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 disabled:opacity-50 transition shadow-sm">
                  Save Note
                </button>
              </div>

              {!['completed', 'cnp', 'cancel_call', 'cancelled'].includes(selected.status) && (
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <button onClick={() => handleQuickAction('cnp')} disabled={loading}
                    className="py-3 rounded-xl text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 transition shadow-md shadow-orange-100 disabled:opacity-50">
                    CNP
                  </button>
                  <button onClick={() => handleQuickAction('callagain')} disabled={loading}
                    className="py-3 rounded-xl text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 transition shadow-md shadow-amber-100 disabled:opacity-50">
                    Call Again
                  </button>
                  <button onClick={() => handleQuickAction('mark_loss')} disabled={loading}
                    className="py-3 rounded-xl text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition shadow-md shadow-red-100 disabled:opacity-50">
                    Mark to Loss
                  </button>
                </div>
              )}
              {selected.status === 'cnp' && (
                <div className="flex items-center justify-center bg-orange-50 text-orange-600 rounded-xl py-3 mt-4 text-xs font-bold">
                  ✓ Marked as CNP
                </div>
              )}
              {selected.status === 'cancel_call' && selected.lead?.status === 'follow_up' && (
                <div className="flex items-center justify-center bg-amber-50 text-amber-600 rounded-xl py-3 mt-4 text-xs font-bold">
                  ✓ Moved to Call Again
                </div>
              )}
              {selected.status === 'cancel_call' && selected.lead?.status !== 'follow_up' && (
                <div className="flex items-center justify-center bg-red-50 text-red-600 rounded-xl py-3 mt-4 text-xs font-bold">
                  ✓ Marked as Loss
                </div>
              )}
            </div>
          </div>

          <div className="px-5 py-4 border-t border-gray-50 bg-white shrink-0">
            <div className="grid grid-cols-2 gap-2">
              {selected.status !== 'completed' && (
                <button onClick={() => handleComplete(selected._id)}
                  className="py-3 rounded-xl text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition shadow-md shadow-emerald-100">
                  Mark Completed
                </button>
              )}
              {selected.status === 'completed' && (
                <div className="flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-xl py-3 text-xs font-bold">
                  ✓ Task Finished
                </div>
              )}
              {canManage && (
                <button onClick={() => handleDelete(selected._id)}
                  className="py-3 rounded-xl text-xs font-bold text-gray-400 bg-gray-50 hover:bg-red-50 hover:text-red-500 transition">
                  Delete Task
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Modal Detail */}
      {selected && tab !== 'chat' && (
        <div className="lg:hidden">
          <Modal hideHeader={true} onClose={() => setSelected(null)}>
            <div className="flex flex-col h-[80vh]">
              <div className="-mx-4 -mt-4 mb-5 px-6 py-8 rounded-b-3xl relative bg-gradient-to-br from-emerald-900 to-emerald-800">
                <button onClick={() => setSelected(null)} className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white text-xl">×</button>
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-xl ${selected.status === 'completed' ? 'bg-gray-400' : PIN_COLORS[filteredItems.findIndex(i => i._id === selected._id) % PIN_COLORS.length]}`}>
                    {initials(selected.lead?.name || selected.title)}
                  </div>
                  <div className="min-w-0">
                    <h3 className={`text-white font-bold text-lg tracking-tight truncate ${selected.status === 'completed' ? 'line-through opacity-60' : ''}`}>{selected.title}</h3>
                    <p className="text-white/60 text-sm font-medium">{selected.lead?.name}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-1 space-y-0 custom-scrollbar">
                 <SectionHead label="Task Information" />
                 <DetailRow label="Due Date" value={new Date(selected.dueDate).toLocaleString()} />
                 <DetailRow label="Type" value={selected.type.replace(/_/g, ' ')} />
                 <DetailRow label="Status" value={selected.status} color={selected.status === 'completed' ? 'green' : 'amber'} />
                 
                 <SectionHead label="Lead & Phone" />
                 <DetailRow label="Phone" value={selected.phone || selected.lead?.phone} />
                 <DetailRow label="Address" value={[selected.houseNo, selected.cityVillage, selected.district, selected.pincode].filter(Boolean).join(', ')} />
                 
                 <SectionHead label="Activity" />
                 <div className="space-y-3 pb-6">
                    {selected.notes?.length > 0 ? (
                      selected.notes.map((n, i) => (
                        <div key={i} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                          <p className="text-xs text-gray-600 font-medium">{n.text}</p>
                          <p className="text-[9px] text-gray-400 mt-2 font-bold uppercase">{new Date(n.createdAt).toLocaleString()}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 italic text-center">No notes yet</p>
                    )}
                 </div>
              </div>

              <div className="pt-4 pb-2 flex flex-col gap-2">
                {!['completed', 'cnp', 'cancel_call', 'cancelled'].includes(selected.status) && (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-1">
                      <button onClick={() => handleQuickAction('cnp')} disabled={loading}
                        className="py-3 bg-orange-500 text-white rounded-xl text-[10px] font-bold uppercase shadow-sm disabled:opacity-50">CNP</button>
                      <button onClick={() => handleQuickAction('callagain')} disabled={loading}
                        className="py-3 bg-amber-500 text-white rounded-xl text-[10px] font-bold uppercase shadow-sm disabled:opacity-50">Call Again</button>
                      <button onClick={() => handleQuickAction('mark_loss')} disabled={loading}
                        className="py-3 bg-red-500 text-white rounded-xl text-[10px] font-bold uppercase shadow-sm disabled:opacity-50">Loss</button>
                    </div>
                    <button onClick={() => handleComplete(selected._id)}
                      className="w-full py-4 rounded-xl text-sm font-bold text-white bg-emerald-500 shadow-lg">Complete Task</button>
                  </>
                )}
                {selected.status === 'cnp' && (
                  <div className="w-full py-3 bg-orange-50 text-orange-600 rounded-xl text-sm font-bold text-center">✓ Marked as CNP</div>
                )}
                {selected.status === 'cancel_call' && selected.lead?.status === 'follow_up' && (
                  <div className="w-full py-3 bg-amber-50 text-amber-600 rounded-xl text-sm font-bold text-center">✓ Moved to Call Again</div>
                )}
                {selected.status === 'cancel_call' && selected.lead?.status !== 'follow_up' && (
                  <div className="w-full py-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold text-center">✓ Marked as Loss</div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => openEdit(selected)} className="py-4 rounded-xl text-sm font-bold bg-gray-100 text-gray-600">Edit</button>
                  {canManage && <button onClick={() => handleDelete(selected._id)} className="py-4 rounded-xl text-sm font-bold bg-red-50 text-red-500">Delete</button>}
                </div>
              </div>
            </div>
          </Modal>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(modal === 'create' || modal === 'edit') && (
        <Modal
          title={modal === 'edit' ? 'Edit Task' : 'New Task'}
          onClose={() => setModal(null)}
          footer={
            <div className="flex gap-3">
              <button type="submit" form="task-form" disabled={loading}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60 shadow-md transition"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                {loading ? 'Saving...' : modal === 'edit' ? 'Update Task' : 'Create Task'}
              </button>
              <button type="button" onClick={() => setModal(null)}
                className="flex-1 border border-gray-200 hover:bg-gray-50 py-3 rounded-xl text-sm font-bold text-gray-500 transition">Cancel</button>
            </div>
          }>
          {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-3 rounded-xl mb-4">{error}</div>}
          <form id="task-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Task</label>
                <input required className={`${inputCls} mt-1`} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone</label>
                <input className={`${inputCls} mt-1`} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Due Date *</label>
                <input required type="datetime-local" className={`${inputCls} mt-1`} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
              {canManage && (
                <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Assign To</label>
                  <select className={`${inputCls} mt-1`} value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
                    <option value="">Auto-assign</option>
                    {salesUsers.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                  </select></div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type</label>
                <select className={`${inputCls} mt-1`} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Priority</label>
                <select className={`${inputCls} mt-1`} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {['low', 'medium', 'high'].map(p => <option key={p} value={p}>{p}</option>)}
                </select></div>
            </div>

            {canManage && (
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Department</label>
                <select className={`${inputCls} mt-1`} value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                  <option value="">Select Department</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
                </select></div>
            )}

            <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Problem</label>
              <textarea rows={1} className={`${inputCls} mt-1`} value={form.problem} onChange={(e) => setForm({ ...form, problem: e.target.value })} /></div>
            
            <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Vitals (Age / Wt / Ht)</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <input type="number" placeholder="Age" className={inputCls} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
                <input type="number" placeholder="Kg" className={inputCls} value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
                <input type="number" step="0.1" placeholder="Ft" className={inputCls} value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Price</label>
                <input type="number" className={`${inputCls} mt-1`} placeholder="₹" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Location Type</label>
                <div className="flex items-center gap-4 mt-2">
                  <span className={`text-xs font-bold ${form.cityVillageType === 'city' ? 'text-emerald-600' : 'text-gray-400'}`}>City</span>
                  <div onClick={() => setForm({ ...form, cityVillageType: form.cityVillageType === 'city' ? 'village' : 'city' })}
                    className="relative w-11 h-5.5 rounded-full cursor-pointer bg-gray-200 transition-all"
                    style={{ background: form.cityVillageType === 'village' ? '#10b981' : '#d1d5db' }}>
                    <span className="absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow-sm transition-all"
                      style={{ left: form.cityVillageType === 'village' ? '24px' : '2px' }} />
                  </div>
                  <span className={`text-xs font-bold ${form.cityVillageType === 'village' ? 'text-emerald-600' : 'text-gray-400'}`}>Village</span>
                </div>
              </div>
            </div>

            <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Address Details</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                <input placeholder={`Enter ${form.cityVillageType} name`} className={inputCls} value={form.cityVillage} onChange={(e) => setForm({ ...form, cityVillage: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="H.No" className={inputCls} value={form.houseNo} onChange={(e) => setForm({ ...form, houseNo: e.target.value })} />
                  <input placeholder="P.O." className={inputCls} value={form.postOffice} onChange={(e) => setForm({ ...form, postOffice: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Dist" className={inputCls} value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
                <div className="relative">
                  <input placeholder="Pin" className={inputCls} value={form.pincode} maxLength={6} onChange={(e) => handlePincodeChange(e.target.value)} />
                  {pincodeLoading && <span className="absolute right-3 top-2.5 text-xs text-gray-400">...</span>}
                  {pincodeData.length > 0 && (
                    <select className={`${inputCls} mt-1`} value={form.postOffice}
                      onChange={(e) => setForm(f => ({ ...f, postOffice: e.target.value }))}>
                      <option value="">Select Post Office</option>
                      {pincodeData.map(o => <option key={o.Name} value={o.Name}>{o.Name}</option>)}
                    </select>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Landmark" className={inputCls} value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} />
                <input placeholder="State" className={inputCls} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </div>
            </div>

            {modal === 'edit' && (
              <div className="pt-2 border-t border-gray-100">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Update Status</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {STATUSES.map(({ value, label, color }) => (
                    <button key={value} type="button" onClick={() => setForm({ ...form, status: value })}
                      className={`py-2 rounded-xl text-[11px] font-bold border transition ${
                        form.status === value ? `${color} text-white shadow-md` : `bg-white text-gray-400 border-gray-100 hover:bg-gray-50`
                      }`}>{label}</button>
                  ))}
                </div>
              </div>
            )}
          </form>
        </Modal>
      )}

      {showWhatsappModal && (
        <Whatsapp 
          onClose={() => setShowWhatsappModal(false)} 
          initialLeadId={whatsappLeadId} 
        />
      )}
    </div>
  );
}
