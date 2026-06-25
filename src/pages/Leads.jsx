import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useToast } from '../context/ToastContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getLeads, getLead, createLead, updateLead, deleteLead, assignLead, addLeadNote, deleteLeadNote, markCNP, createCallAgain, distributeUnassigned, sendLeadWhatsApp } from '../services/lead.service';
import { getUsers } from '../services/user.service';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';

const STATUSES = ['new', 'old'];
const HIDDEN_LEAD_LIST_STATUSES = new Set(['follow_up', 'on_hold']);
const SOURCES = ['website', 'referral', 'social_media', 'cold_call', 'email', 'walk_in', 'other'];
const TYPES = ['general', 'ayurveda', 'panchakarma', 'consultation', 'product', 'other'];
const DEPARTMENTS = ['migraine', 'piles'];
const EMPTY = { name: '', phone: '', email: '', address: '', houseNo: '', cityVillage: '', cityVillageType: 'city', postOffice: '', landmark: '', district: '', state: '', pincode: '', source: 'other', status: 'new', type: 'general', problem: '', note: '', revenue: '', department: '' };

const PIN_COLORS = [
  'bg-emerald-500', 'bg-blue-500', 'bg-indigo-500',
  'bg-violet-500', 'bg-rose-500', 'bg-amber-500', 'bg-cyan-500',
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
    <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-500">{label}</span>
    <div className="flex-1 h-px bg-emerald-100" />
  </div>
);

const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition";

export default function Leads() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState({ leads: [], total: 0, totalPages: 1 });
  const today = new Date().toISOString().split('T')[0];
  const [filters, setFilters] = useState({ search: '', dateFrom: today, dateTo: today, status: 'new', datePreset: 'today', page: 1, department: '' });
  const [highlightId, setHighlightId] = useState(null);
  const [salesUsers, setSalesUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [assignTo, setAssignTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const pendingOpenId = searchParams.get('openId');

  const { success: toastSuccess, error: toastError } = useToast();
  const navigate = useNavigate();
  const canManage = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'support';
  const canEdit = canManage || user?.role === 'sales';
  const chatEndRef = useRef(null);
  const [chatMsg, setChatMsg] = useState('');
  const [chatNotes, setChatNotes] = useState([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const params = { page: filters.page, limit: 15 };
      if (filters.search) params.search = filters.search;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.status) params.status = filters.status;
      if (filters.department) params.department = filters.department;

      const res = await getLeads(params);
      const nextData = res || { leads: [], total: 0, totalPages: 1 };
      setData({
        ...nextData,
        leads: (nextData.leads || []).filter(lead => !HIDDEN_LEAD_LIST_STATUSES.has(lead.status)),
      });
    } catch (err) {
      setLoadError(err.response?.data?.message || err.message || 'Failed to load leads');
    } finally { setPageLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (pendingOpenId) {
      getLead(pendingOpenId).then(full => {
        setSelected(full);
        setIsCreating(false);
        setHighlightId(full._id);
        setChatNotes(full.notes || []);
        const { assignedTo, notes, follow_ups, cnpCount, createdAt, updatedAt, __v, ...formFields } = full;
        setForm({ ...EMPTY, ...formFields });
        setSearchParams({}, { replace: true });
      }).catch(() => {});
    }
  }, [pendingOpenId, setSearchParams]);

  useEffect(() => {
    if (canManage) getUsers({ role: 'sales' }).then(r => setSalesUsers(r.results || [])).catch(() => {});
  }, [canManage]);

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatNotes]);

  const handleCreate = async (e, action) => {
    if (e?.preventDefault) e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Name and Phone are required');
      return;
    }
    setLoading(true); setError('');
    try {
      const payload = { ...form, revenue: form.revenue ? Number(form.revenue) : 0 };
      if (!payload.department) delete payload.department;
      const lead = await createLead(payload);
      if (action === 'cnp') { await markCNP(lead._id).catch(() => {}); }
      else if (action === 'callAgain') { await createCallAgain(lead._id).catch(() => {}); }
      else if (action === 'lost') { await updateLead(lead._id, { status: 'closed_lost' }).catch(() => {}); }
      setIsCreating(false);
      load();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create lead';
      if (err.response?.status === 409) { toastError(`Phone ${form.phone} already exists`, 'Duplicate Number'); }
      else { setError(msg); }
    }
    finally { setLoading(false); }
  };

  const handleUpdate = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setLoading(true); setError('');
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        email: form.email || '',
        address: form.address || '',
        houseNo: form.houseNo || '',
        cityVillage: form.cityVillage || '',
        cityVillageType: form.cityVillageType || 'city',
        postOffice: form.postOffice || '',
        landmark: form.landmark || '',
        district: form.district || '',
        state: form.state || '',
        pincode: form.pincode || '',
        source: form.source,
        type: form.type,
        problem: form.problem || '',
        revenue: form.revenue ? Number(form.revenue) : 0,
      };
      if (form.department) payload.department = form.department;
      await updateLead(selected._id, payload);
      setSelected(null);
      await load();
    } catch (err) { setError(err.response?.data?.message || 'Failed to update lead'); }
    finally { setLoading(false); }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;
    try {
      await deleteLeadNote(selected._id, noteId);
      setChatNotes(prev => prev.filter(n => n._id !== noteId));
      toastSuccess('Message deleted');
    } catch (err) {
      toastError(err?.response?.data?.message || 'Failed to delete message');
    }
  };

  const handleDistribute = async () => {
    if (!window.confirm('Distribute all pending night leads to currently checked-in staff?')) return;
    setLoading(true);
    try {
      const res = await distributeUnassigned();
      toastSuccess(res.message, 'Distributed');
      await load();
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to distribute leads', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault(); setLoading(true);
    try { 
      await assignLead(selected._id, assignTo); 
      setShowAssignModal(false); 
      load(); 
      const fresh = await getLead(selected._id);
      setSelected(fresh);
    } catch (err) { setError(err.response?.data?.message || 'Failed to assign'); }
    finally { setLoading(false); }
  };

  const applyPreset = (preset) => {
    const today = new Date();
    const fmt = d => d.toISOString().split('T')[0];
    let from = '', to = fmt(today);
    if (preset === 'today') { from = fmt(today); }
    else if (preset === 'yesterday') { const y = new Date(today); y.setDate(y.getDate() - 1); from = fmt(y); to = fmt(y); }
    else if (preset === 'week') { const w = new Date(today); w.setDate(w.getDate() - 6); from = fmt(w); }
    else if (preset === 'month') { const m = new Date(today); m.setDate(1); from = fmt(m); }
    setFilters(f => ({ ...f, dateFrom: from, dateTo: to, datePreset: preset, status: preset === 'today' ? 'new' : '', page: 1 }));
  };

  const sf = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (error) setError('');
  };

  if (pageLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex gap-4 scroll-container-h overflow-hidden animate-slide-up mobile-p-safe">
      {/* ── LEFT PANEL ── */}
      <div className={`flex flex-col gap-4 transition-all duration-300 ${selected ? 'hidden lg:flex lg:w-[55%]' : isCreating ? 'w-full lg:w-[55%]' : 'w-full'} h-full overflow-hidden`}>
        
        {/* Header & Filters */}
        <div className="flex flex-col gap-4 shrink-0 glass p-4 sm:p-5 rounded-3xl border border-white/50 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar shrink-0">
              <div className="inline-flex items-center gap-1 rounded-xl bg-gray-100/50 p-1">
                {[['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'Week'], ['month', 'Month']].map(([key, label]) => (
                  <button key={key}
                    onClick={() => filters.datePreset === key ? applyPreset('today') : applyPreset(key)}
                    className={`px-3.5 py-2 rounded-lg text-[10px] font-black transition-all whitespace-nowrap ${filters.datePreset === key
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-emerald-600'
                    }`}>{t(label).toUpperCase()}</button>
                ))}
              </div>
            </div>
            <div className="relative flex-1">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                placeholder={t('Search name, phone...')}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-100 bg-white text-xs font-bold text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 transition shadow-sm"
              />
            </div>
            {canManage && (
              <select
                value={filters.department}
                onChange={e => setFilters(f => ({ ...f, department: e.target.value, page: 1 }))}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl border border-gray-100 bg-white text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 transition shadow-sm shrink-0"
              >
                <option value="">{t('All Departments')}</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
              </select>
            )}
            <button onClick={() => { setIsCreating(true); setSelected(null); setForm(EMPTY); }}
              className="w-full md:w-auto px-5 py-2.5 rounded-xl text-[10px] font-black text-white shadow-lg hover:shadow-emerald-200 transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <span className="text-sm leading-none">+</span> {t('ADD NEW LEAD')}
            </button>
            {canManage && (
              <button onClick={handleDistribute} disabled={loading}
                className="w-full md:w-auto px-5 py-2.5 rounded-xl text-[10px] font-black text-white shadow-lg hover:shadow-blue-200 transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                {t('DISTRIBUTE NIGHT LEADS')}
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {data.leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
               <p className="text-gray-400 text-sm font-medium">{t('No leads found')}</p>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {data.leads.map((lead, i) => {
                const isActive = selected?._id === lead._id;
                const color = PIN_COLORS[i % PIN_COLORS.length];
                return (
                  <div key={lead._id}
                    className={`relative flex items-center gap-4 px-4 py-4 rounded-2xl cursor-pointer transition-all duration-200 border
                      ${isActive ? 'bg-emerald-50 border-emerald-200 shadow-sm' : highlightId === lead._id ? 'bg-yellow-50 border-yellow-300 shadow-sm' : 'bg-white border-gray-100 hover:border-emerald-200'}`}
                    onClick={async () => {
                      if (isActive) { setSelected(null); setChatNotes([]); setAttachment(null); setAttachmentPreview(null); return; }
                      setIsCreating(false); setHighlightId(null);
                      const full = await getLead(lead._id).catch(() => lead);
                      setSelected(full);
                      setChatNotes(full.notes || []);
                      setAttachment(null);
                      setAttachmentPreview(null);
                      setSendError('');
                      const { assignedTo, notes, follow_ups, cnpCount, createdAt, updatedAt, __v, ...formFields } = full;
                      setForm({ ...EMPTY, ...formFields });
                    }}>
                    
                    <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${
                      lead.status === 'closed_won' ? 'bg-green-500' :
                      lead.status === 'closed_lost' ? 'bg-red-400' :
                      lead.status === 'interested' ? 'bg-purple-500' :
                      lead.status === 'follow_up' ? 'bg-orange-400' :
                      lead.status === 'contacted' ? 'bg-amber-400' : 'bg-blue-400'
                    }`} />
                    
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 ${color}`}>
                      {initials(lead.name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{lead.name}</p>
                      <p className="text-xs text-gray-400">{lead.phone}</p>
                      {lead.problem && (
                        <p className="text-[10px] text-emerald-600 truncate mt-0.5 font-medium bg-emerald-50 inline-block px-1.5 py-0.5 rounded">
                          {lead.problem}
                        </p>
                      )}
                    </div>

                    <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                      <Badge value={lead.status} />
                      {lead.department && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                          {lead.department.toUpperCase()}
                        </span>
                      )}
                      {lead.assignedTo?.name && <span className="text-[10px] text-gray-400">By {lead.assignedTo.name}</span>}
                    </div>

                    <svg className={`w-4 h-4 text-gray-300 transition-transform ${isActive ? 'rotate-90 text-emerald-400' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-white rounded-2xl border border-gray-100 mt-2 mb-6">
               <button disabled={filters.page <= 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-50 rounded-lg disabled:opacity-30 transition">← Prev</button>
               <span className="text-xs font-bold text-emerald-600">Page {filters.page} of {data.totalPages}</span>
               <button disabled={filters.page >= data.totalPages} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-50 rounded-lg disabled:opacity-30 transition">Next →</button>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      {selected && !isCreating && (
        <div className="flex flex-col w-full lg:w-[45%] bg-white rounded-none lg:rounded-[2rem] border-0 lg:border border-gray-100 shadow-xl overflow-hidden h-full relative z-10">

          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-6 py-4 bg-emerald-600 relative overflow-hidden">
             {/* Decorative background element */}
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl mix-blend-overlay"></div>
            <div className="flex items-center gap-3 relative z-10">
              <button 
                onClick={() => { setSelected(null); setChatNotes([]); setAttachment(null); setAttachmentPreview(null); }} 
                className="lg:hidden w-8 h-8 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 rounded-full transition-colors -ml-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-emerald-600 bg-white text-base sm:text-lg font-bold shadow-sm shrink-0">
                {initials(selected.name)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-bold text-base leading-tight truncate drop-shadow-sm">{selected.name}</h3>
                <p className="text-emerald-50 text-xs mt-0.5 font-medium flex items-center gap-1.5">
                  <svg className="w-3 h-3 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  {selected.phone}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 relative z-10">
               <Badge color={selected.status === 'new' ? 'blue' : 'gray'}>{selected.status}</Badge>
               <button onClick={() => { setSelected(null); setChatNotes([]); setAttachment(null); setAttachmentPreview(null); }} className="hidden lg:flex w-8 h-8 items-center justify-center rounded-full text-emerald-100 hover:bg-emerald-700 hover:text-white transition-colors text-xl backdrop-blur-sm">×</button>
            </div>
          </div>

          {/* Details Form (Redesigned) */}
          <div className="shrink-0 px-6 py-5 bg-white border-b border-gray-100/50 z-10 relative">
            <form onSubmit={handleUpdate} className="space-y-5">
              
              {/* Badges Row (Department & Assigned) */}
              <div className="flex items-center gap-3">
                {canManage && (
                  <div className="flex-1 bg-[#f8fafc] p-1.5 rounded-2xl border border-transparent hover:border-gray-200 transition-colors shadow-sm">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-2.5 pt-1">Department</p>
                    <select className="w-full px-2.5 py-1 bg-transparent text-[13px] font-semibold text-gray-700 focus:outline-none cursor-pointer appearance-none" 
                      value={form.department || ''} onChange={e => sf('department', e.target.value)}>
                      <option value="" disabled className="text-gray-400">Select...</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
                    </select>
                  </div>
                )}
                
                <div className="flex-1 bg-[#f8fafc] p-1.5 rounded-2xl border border-transparent hover:border-gray-200 transition-colors shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-2.5 pt-1">Assigned To</p>
                    <div className="flex items-center gap-2 px-2.5 pb-1 mt-0.5">
                       <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[9px] font-bold">
                         {initials(selected.assignedTo?.name) || '?'}
                       </div>
                       <p className="text-[13px] font-semibold text-gray-700 truncate">{selected.assignedTo?.name || 'Unassigned'}</p>
                    </div>
                  </div>
                  {canManage && (
                    <button type="button" onClick={() => { setAssignTo(selected.assignedTo?._id || ''); setShowAssignModal(true); }}
                      className="w-7 h-7 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-indigo-600 transition-colors mr-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <button type="submit" disabled={loading}
                  className="col-span-1 py-3 rounded-2xl text-[12px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-[0_4px_10px_rgba(5,150,105,0.2)] hover:shadow-[0_6px_15px_rgba(5,150,105,0.3)] hover:-translate-y-0.5 flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Save
                </button>
                <button type="button" disabled={loading} onClick={async () => {
                  setLoading(true);
                  try { await markCNP(selected._id); load(); setSelected(null); setChatNotes([]); }
                  catch (err) { setError(err.response?.data?.message || 'Failed'); }
                  finally { setLoading(false); }
                }} className="col-span-1 py-3 rounded-2xl text-[12px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-all border border-rose-100 hover:border-rose-200 hover:-translate-y-0.5 flex items-center justify-center gap-1.5 shadow-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                  CNP
                </button>
                <button type="button" disabled={loading} onClick={async () => {
                  setLoading(true);
                  try { await createCallAgain(selected._id); load(); setSelected(null); setChatNotes([]); }
                  catch (err) { setError(err.response?.data?.message || 'Failed'); }
                  finally { setLoading(false); }
                }} className="col-span-1 py-3 rounded-2xl text-[12px] font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 transition-all border border-amber-100 hover:border-amber-200 hover:-translate-y-0.5 flex items-center justify-center gap-1.5 shadow-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  Call
                </button>
              </div>
            </form>
          </div>

          {/* ── WhatsApp Chat Area ── */}
          <div className="flex flex-col flex-1 overflow-hidden relative" style={{ backgroundColor: '#efeae2' }}>
             {/* WhatsApp Doodles Background */}
            <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: 'url("https://w0.peakpx.com/wallpaper/818/148/HD-wallpaper-whatsapp-background-cool-dark-green-light-pattern-patterns-wpp-thumbnail.jpg")', backgroundSize: 'cover', mixBlendMode: 'multiply' }}></div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 custom-scrollbar relative z-10">
              <div className="flex justify-center mb-6">
                <span className="bg-white/80 backdrop-blur text-gray-500 text-[10px] font-bold px-3 py-1 rounded-full shadow-sm border border-gray-200/50">Chat History</span>
              </div>
              
              {(() => {
                const displayNotes = [...chatNotes];
                if (selected.problem && !displayNotes.some(n => n.text === selected.problem)) {
                  displayNotes.push({
                    text: selected.problem,
                    direction: 'inbound',
                    createdAt: selected.createdAt,
                    isSyntheticProblem: true
                  });
                }
                displayNotes.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

                if (displayNotes.length === 0) {
                  return (
                    <div className="flex items-center justify-center h-full pb-10">
                      <div className="bg-[#fff9c4] text-[#8a6d3b] rounded-2xl px-6 py-4 text-center shadow-sm max-w-[80%] border border-[#fae88a]">
                        <svg className="w-8 h-8 mx-auto mb-2 opacity-80" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.969-1.406A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18c-1.637 0-3.18-.415-4.523-1.15l-.324-.19-3.216.91.928-3.12-.208-.33A7.95 7.95 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"/></svg>
                        <p className="text-xs font-semibold leading-relaxed">No messages yet. Send a message to start the conversation.</p>
                      </div>
                    </div>
                  );
                }

                return displayNotes.map((note, i) => {
                  const isOutbound = note.direction === 'outbound';
                  const isInterakt = (!isOutbound && note.text?.includes('[Interakt Message]')) || note.isSyntheticProblem;
                  const displayText = note.text?.replace(/^\[Interakt Message\]\s*/, '') || note.text || '';
                  const time = note.createdAt ? new Date(note.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
                  return (
                    <div key={i} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} group`}>
                      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 shadow-sm relative ${
                        isOutbound
                          ? 'bg-[#d9fdd3] rounded-tr-sm'
                          : 'bg-white rounded-tl-sm'
                      }`}>
                        {isInterakt && !isOutbound && (
                          <div className="flex items-center gap-1.5 mb-1 opacity-80">
                            <svg className="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.558 4.12 1.532 5.845L.057 23.941l6.26-1.643A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.034-1.383l-.36-.214-3.732.979.998-3.642-.235-.374A9.818 9.818 0 1 1 12 21.818z"/></svg>
                            <span className="text-[10px] font-bold text-emerald-700">WhatsApp Lead</span>
                          </div>
                        )}
                        
                        {note._id && canManage && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteNote(note._id); }}
                            className={`absolute top-1 ${isOutbound ? '-left-6' : '-right-6'} opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-rose-500 transition-all rounded-full hover:bg-rose-50`}
                            title="Delete message"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                        <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                          <p className="text-[14px] text-gray-800 leading-snug whitespace-pre-wrap break-words">{displayText}</p>
                          <div className="flex items-center gap-1 min-w-max ml-auto opacity-70">
                            <span className="text-[10px] text-gray-500 font-medium">{time}</span>
                            {isOutbound && (
                              <svg className="w-4 h-4 text-blue-500" viewBox="0 0 16 11" fill="currentColor">
                                <path d="M11.071.653a.75.75 0 0 1 .025 1.06l-6.5 7a.75.75 0 0 1-1.086 0l-3-3.228a.75.75 0 1 1 1.086-1.034l2.457 2.643L10.01.678a.75.75 0 0 1 1.06-.025z"/>
                                <path d="M14.571.653a.75.75 0 0 1 .025 1.06l-6.5 7a.75.75 0 0 1-1.086 0 .75.75 0 0 1 0-1.034l6-6.5a.75.75 0 0 1 1.061-.026l.5.5z" opacity=".8"/>
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
              <div ref={chatEndRef} className="h-2" />
            </div>

            {/* Send Area */}
            <div className="shrink-0 px-4 py-3 bg-[#f0f2f5] relative z-10">
              {sendError && <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-rose-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">{sendError}</div>}
              
              {attachmentPreview && (
                <div className="absolute bottom-full left-4 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 p-2 flex items-center gap-3">
                  {attachment?.type?.startsWith('image/') ? (
                    <img src={attachmentPreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg" />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-700 truncate max-w-[120px]">{attachment.name}</span>
                    <span className="text-[10px] text-gray-400">{(attachment.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  <button onClick={() => { setAttachment(null); setAttachmentPreview(null); }} className="w-6 h-6 bg-gray-100 hover:bg-rose-100 text-gray-500 hover:text-rose-600 rounded-full flex items-center justify-center transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}

              <div className="flex items-end gap-3">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*,video/*,application/pdf"
                  onChange={e => {
                    const file = e.target.files[0];
                    if (file) {
                      setAttachment(file);
                      if (file.type.startsWith('image/')) {
                        setAttachmentPreview(URL.createObjectURL(file));
                      } else {
                        setAttachmentPreview('document');
                      }
                    }
                    e.target.value = '';
                  }}
                />
                
                <div className="flex-1 bg-white rounded-3xl shadow-sm overflow-hidden flex items-end relative border border-white focus-within:border-emerald-200 transition-colors">
                  <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-emerald-600 transition-colors shrink-0 pl-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  </button>
                  <textarea
                    rows={1}
                    value={chatMsg}
                    onChange={e => { setChatMsg(e.target.value); setSendError(''); }}
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if ((!chatMsg.trim() && !attachment) || sending) return;
                        setSending(true); setSendError('');
                        
                        let optimisticText = chatMsg;
                        if (attachment) optimisticText = `[Sending: ${attachment.name}] ${optimisticText}`;
                        
                        const optimistic = { text: optimisticText, direction: 'outbound', createdAt: new Date().toISOString() };
                        setChatNotes(prev => [...prev, optimistic]);
                        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                        const msgToSend = chatMsg;
                        const attachedFile = attachment;
                        setChatMsg('');
                        setAttachment(null);
                        setAttachmentPreview(null);
                        try {
                          await sendLeadWhatsApp(selected._id, msgToSend, templateName || undefined, undefined, attachedFile);
                        } catch (err) {
                          setSendError(err?.response?.data?.message || 'Failed to send');
                        } finally { setSending(false); }
                      }
                    }}
                    placeholder="Type a message"
                    className="w-full py-3.5 pr-4 text-[15px] text-gray-800 resize-none focus:outline-none placeholder-gray-400 custom-scrollbar leading-snug"
                    style={{ maxHeight: 120, minHeight: 48 }}
                  />
                </div>
                <button
                  disabled={(!chatMsg.trim() && !attachment) || sending}
                  onClick={async () => {
                    if ((!chatMsg.trim() && !attachment) || sending) return;
                    setSending(true); setSendError('');
                    
                    let optimisticText = chatMsg;
                    if (attachment) optimisticText = `[Sending: ${attachment.name}] ${optimisticText}`;
                    
                    const optimistic = { text: optimisticText, direction: 'outbound', createdAt: new Date().toISOString() };
                    setChatNotes(prev => [...prev, optimistic]);
                    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                    const msgToSend = chatMsg;
                    const attachedFile = attachment;
                    setChatMsg('');
                    setAttachment(null);
                    setAttachmentPreview(null);
                    try {
                      await sendLeadWhatsApp(selected._id, msgToSend, templateName || undefined, undefined, attachedFile);
                    } catch (err) {
                      setSendError(err?.response?.data?.message || 'Failed to send');
                    } finally { setSending(false); }
                  }}
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:scale-100 shrink-0"
                  style={{ backgroundColor: (chatMsg.trim() || attachment) ? '#00a884' : '#cbd5e1' }}
                >
                  {sending ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="3"/><path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8z"/></svg>
                  ) : (
                    <svg className="w-5 h-5 ml-1" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ── CREATE MODAL ── */}
      {isCreating && (
        <Modal title="Add New Lead" onClose={() => setIsCreating(false)}>
           <form onSubmit={handleCreate} className="space-y-4">
              {error && <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl font-bold border border-red-100">{error}</div>}
              
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Name *</label>
                  <input required className={`${inputCls} mt-1.5`} value={form.name} onChange={e => sf('name', e.target.value)} /></div>
                <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone *</label>
                  <input required className={`${inputCls} mt-1.5`} value={form.phone} onChange={e => sf('phone', e.target.value)} /></div>
              </div>

              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Problem / Inquiry</label>
                <textarea rows={3} className={`${inputCls} mt-1.5`} value={form.problem} onChange={e => sf('problem', e.target.value)} /></div>
              
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</label>
                <select className={`${inputCls} mt-1.5`} value={form.status} onChange={e => sf('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                </select></div>
                
              <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Department</label>
                <select className={`${inputCls} mt-1.5`} value={form.department || ''} onChange={e => sf('department', e.target.value)}>
                  <option value="">Select Department</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
                </select>
              </div>

              <div className="pt-6 grid grid-cols-5 gap-3">
                 <button type="submit" disabled={loading}
                  className="py-3.5 rounded-2xl text-sm font-bold text-white bg-[#16a34a] hover:bg-[#15803d] transition-all shadow-lg shadow-green-100 disabled:opacity-50">
                  {loading ? '...' : 'Create Lead'}
                </button>
                <button type="button" onClick={(e) => handleCreate(e, 'cnp')} disabled={loading}
                  className="py-3.5 rounded-2xl text-sm font-bold text-white bg-[#ef4444] hover:bg-[#dc2626] transition-all shadow-lg shadow-red-100 disabled:opacity-50">
                  {loading ? '...' : 'CNP'}
                </button>
                <button type="button" onClick={(e) => handleCreate(e, 'callAgain')} disabled={loading}
                  className="py-3.5 rounded-2xl text-sm font-bold text-white bg-[#f59e0b] hover:bg-[#d97706] transition-all shadow-lg shadow-amber-100 disabled:opacity-50">
                  {loading ? '...' : 'Call Again'}
                </button>
                <button type="button" onClick={(e) => handleCreate(e, 'lost')} disabled={loading}
                  className="py-3.5 rounded-2xl text-sm font-bold text-white bg-[#6b7280] hover:bg-[#4b5563] transition-all shadow-lg shadow-gray-100 disabled:opacity-50">
                  {loading ? '...' : 'Mark Lost'}
                </button>
                <button type="button" onClick={() => setIsCreating(false)}
                  className="py-3.5 rounded-2xl text-sm font-bold text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 transition-all">
                  Cancel
                </button>
              </div>
           </form>
        </Modal>
      )}



      {showAssignModal && (
        <Modal title={`Assign Lead`} onClose={() => setShowAssignModal(false)}>
           <form onSubmit={handleAssign} className="space-y-4">
             <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Select Sales Person</label>
               <select required className={inputCls} value={assignTo} onChange={e => setAssignTo(e.target.value)}>
                 <option value="">Select salesperson</option>
                 {salesUsers.map(u => <option key={u._id} value={u._id}>{u.name} ({u.email})</option>)}
               </select></div>
             <button type="submit" disabled={loading} className="w-full py-3 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-md transition-all">Assign Now</button>
           </form>
        </Modal>
      )}
    </div>
  );
}
