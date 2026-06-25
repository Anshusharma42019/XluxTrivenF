import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCallAgains, updateCallAgain, updateLead } from '../services/lead.service';
import { createTask } from '../services/task.service';

const TASK_EMPTY = { title: '', description: '', problem: '', reminderAt: '', cityVillageType: 'city', cityVillage: '', houseNo: '', postOffice: '', district: '', landmark: '', pincode: '', state: '', age: '', weight: '', height: '', otherProblems: '', problemDuration: '' };
const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition";

function TaskModal({ lead, assignedTo, recordId, onClose }) {
  const [form, setForm] = useState({ ...TASK_EMPTY, lead: lead?._id || '', assignedTo: assignedTo || '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const payload = { ...form, type: 'task', status: 'pending' };
      if (!payload.assignedTo) delete payload.assignedTo;
      if (!payload.reminderAt) delete payload.reminderAt;
      await createTask(payload);
      if (recordId) await updateCallAgain(recordId, { status: 'done' });
      if (lead?._id || lead) await updateLead(lead?._id || lead, { status: 'contacted' });
      onClose(true);
    } catch (err) { setError(err.response?.data?.message || 'Something went wrong'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">New Task — {lead?.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3">
          {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-3 rounded-xl">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name *</label>
              <input required className={`${inputCls} mt-1.5`} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Confirmation Call Date</label>
              <input type="date" className={`${inputCls} mt-1.5`} value={form.reminderAt} onChange={e => setForm({ ...form, reminderAt: e.target.value })} /></div>
          </div>
          <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Problem</label>
            <textarea rows={2} className={`${inputCls} mt-1.5`} value={form.problem} onChange={e => setForm({ ...form, problem: e.target.value })} /></div>
          <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</label>
            <textarea rows={2} className={`${inputCls} mt-1.5`} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Age</label>
              <input type="number" min="0" className={`${inputCls} mt-1.5`} value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} /></div>
            <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Weight (kg)</label>
              <input type="number" min="0" className={`${inputCls} mt-1.5`} value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} /></div>
            <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Height (cm)</label>
              <input type="number" min="0" className={`${inputCls} mt-1.5`} value={form.height} onChange={e => setForm({ ...form, height: e.target.value })} /></div>
          </div>
          <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Other Problems</label>
            <textarea rows={2} className={`${inputCls} mt-1.5`} value={form.otherProblems} onChange={e => setForm({ ...form, otherProblems: e.target.value })} /></div>
          <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Problem Duration</label>
            <input className={`${inputCls} mt-1.5`} placeholder="e.g. 2 years" value={form.problemDuration} onChange={e => setForm({ ...form, problemDuration: e.target.value })} /></div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">City / Village</label>
            <div className="flex items-center gap-3 mt-1.5 mb-1.5">
              <span className={`text-xs font-semibold ${form.cityVillageType === 'city' ? 'text-green-600' : 'text-gray-400'}`}>City</span>
              <div onClick={() => setForm({ ...form, cityVillageType: form.cityVillageType === 'city' ? 'village' : 'city' })}
                className="relative w-12 h-6 rounded-full cursor-pointer transition-colors duration-300"
                style={{ background: form.cityVillageType === 'village' ? '#16a34a' : '#d1d5db' }}>
                <span className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300"
                  style={{ left: form.cityVillageType === 'village' ? '28px' : '4px' }} />
              </div>
              <span className={`text-xs font-semibold ${form.cityVillageType === 'village' ? 'text-green-600' : 'text-gray-400'}`}>Village</span>
            </div>
            <input className={inputCls} placeholder={`Enter ${form.cityVillageType} name`} value={form.cityVillage} onChange={e => setForm({ ...form, cityVillage: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">House No</label>
              <input className={`${inputCls} mt-1.5`} value={form.houseNo} onChange={e => setForm({ ...form, houseNo: e.target.value })} /></div>
            <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Post Office</label>
              <input className={`${inputCls} mt-1.5`} value={form.postOffice} onChange={e => setForm({ ...form, postOffice: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">District</label>
              <input className={`${inputCls} mt-1.5`} value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} /></div>
            <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Landmark</label>
              <input className={`${inputCls} mt-1.5`} value={form.landmark} onChange={e => setForm({ ...form, landmark: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pincode</label>
              <input className={`${inputCls} mt-1.5`} value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })} /></div>
            <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">State</label>
              <input className={`${inputCls} mt-1.5`} value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 shadow-md transition"
              style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
              {loading ? 'Saving...' : 'Create Task'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 hover:bg-gray-50 py-2.5 rounded-xl text-sm font-medium text-gray-600 transition">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CallAgain() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [taskModal, setTaskModal] = useState(null);
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('phone') || '');
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const res = await getCallAgains();
      setLeads(Array.isArray(res) ? res : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStatus = async (record, status) => {
    setUpdating(record._id);
    try { await updateCallAgain(record._id, { status }); load(); }
    catch { /* ignore */ }
    finally { setUpdating(null); }
  };

  const filtered = leads.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.lead?.name?.toLowerCase().includes(q) || r.lead?.phone?.includes(q);
  });

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-[3px] border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-xl"
        style={{ background: 'linear-gradient(135deg, #1a1200, #3d2800, #1a1200)' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.18 6.18l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold tracking-tight">Call Again</h2>
            </div>
            <p className="text-gray-400 text-sm">Leads marked for follow-up callback</p>
          </div>
          <div className="text-center px-4 py-2 rounded-xl bg-white/10 border border-white/10">
            <p className="text-2xl font-bold text-amber-400">{leads.length}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Leads</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50 bg-gray-50/50 flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <h3 className="font-semibold text-gray-700 text-sm">Call Again Leads</h3>
          </div>
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-100 bg-white text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-300/50 focus:border-amber-400 transition shadow-sm" />
          </div>
          <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full font-medium shrink-0">
            {filtered.length} lead{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-amber-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.18 6.18l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm font-medium">No call again leads</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((record, i) => (
              <div key={record._id} className="px-5 py-4 hover:bg-amber-50/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-gray-400 w-5 text-center shrink-0">{i + 1}</span>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-bold text-sm shrink-0 uppercase text-white shadow-sm">
                    {record.lead?.name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">{record.lead?.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">{record.lead?.phone}</span>
                      {record.assignedTo && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                          </svg>
                          {record.assignedTo.name}
                        </span>
                      )}
                      {record.createdBy && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                          Added by: {record.createdBy.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                  <button disabled={updating === record._id} onClick={() => setTaskModal({ lead: record.lead, assignedTo: record.assignedTo?._id || '', recordId: record._id })}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-100 transition">
                    + Task
                  </button>
                  <button disabled={updating === record._id} onClick={() => handleStatus(record, 'contacted')}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-100 transition disabled:opacity-40">
                    Contacted
                  </button>
                  <button disabled={updating === record._id} onClick={() => handleStatus(record, 'interested')}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-100 transition disabled:opacity-40">
                    Interested
                  </button>
                  <button disabled={updating === record._id} onClick={async () => {
                    setUpdating(record._id);
                    try {
                      await updateCallAgain(record._id, { status: 'converted' });
                      if (record.lead?._id) {
                        await updateLead(record.lead._id, { status: 'interested' });
                        await createTask({ title: record.lead.name, lead: record.lead._id, assignedTo: record.assignedTo?._id || undefined, type: 'task', status: 'verification', priority: 'medium' });
                      }
                      navigate('/verification');
                    } catch { /* ignore */ }
                    finally { setUpdating(null); }
                  }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-green-50 text-green-700 hover:bg-green-100 border border-green-100 transition disabled:opacity-40">
                    Converted
                  </button>
                </div>
                </div>

                {record.notes?.length > 0 && (
                  <div className="mt-3 ml-11 pl-2">
                    <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-100/50">
                      <p className="text-[11px] text-amber-800/80 font-medium leading-relaxed">
                        <span className="font-bold text-amber-700 uppercase tracking-wider mr-2">Note:</span>
                        {record.notes[record.notes.length - 1].text}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {taskModal && (
        <TaskModal lead={taskModal.lead} assignedTo={taskModal.assignedTo} recordId={taskModal.recordId} onClose={(refresh) => { setTaskModal(null); if (refresh) load(); }} />
      )}
    </div>
  );
}
