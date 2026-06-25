import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAppointments, createAppointment, updateAppointment, deleteAppointment, searchByPhone, getAvailability, getBookedSlots, addFieldNote } from '../services/appointment.service';
import { getUsers } from '../services/user.service';
import Modal from '../components/ui/Modal';

const TYPES = ['consultation', 'follow_up', 'panchakarma', 'ayurveda', 'other'];
const STATUSES = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'];

const EMPTY = {
  patientName: '', phone: '', email: '', doctorName: '',
  appointmentDate: '', timeSlot: '', type: 'consultation',
  status: 'scheduled', notes: '', patientType: 'new',
  problem: '', address: '', houseNo: '', cityVillage: '',
  postOffice: '', landmark: '', district: '', state: '', pincode: '',
  medicineDeliveryDate: '',
};

const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition';

const STATUS_COLORS = {
  scheduled: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
  no_show: 'bg-amber-100 text-amber-700',
};

const initials = (name = '') =>
  name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const fmt = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const DetailRow = ({ label, value }) =>
  value ? (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-28 shrink-0 mt-0.5">{label}</span>
      <span className="text-sm text-gray-800 font-medium flex-1 capitalize">{value}</span>
    </div>
  ) : null;

function FormFields({ form, sf, error, loading, onSubmit, submitLabel, selected, canManage, onDelete, onPhoneChange, phoneSearching, doctors = [], bookedDoctors = [] }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl font-bold border border-red-100">{error}</div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Patient Name *</label>
          <input required className={`${inputCls} mt-1`} value={form.patientName} onChange={e => sf('patientName', e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone *</label>
          <div className="relative mt-1">
            <input required className={inputCls} value={form.phone}
              onChange={e => { sf('phone', e.target.value); onPhoneChange && onPhoneChange(e.target.value); }} />
            {phoneSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email</label>
        <input type="email" className={`${inputCls} mt-1`} value={form.email} onChange={e => sf('email', e.target.value)} />
      </div>
      {/* New / Old Patient */}
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Patient Type</label>
        <div className="flex gap-3 mt-1.5">
          {['new', 'old'].map(t => (
            <button key={t} type="button"
              onClick={() => sf('patientType', t)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                form.patientType === t
                  ? t === 'new' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-blue-600 text-white border-blue-600'
                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
              }`}>
              {t === 'new' ? '🆕 New Patient' : '🔄 Old Patient'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Doctor Name *</label>
        <select required className={`${inputCls} mt-1`} value={form.doctorName} onChange={e => sf('doctorName', e.target.value)}>
          <option value="">Select Doctor</option>
          {doctors.map(d => {
            const isBooked = bookedDoctors.includes(d.name);
            return (
              <option key={d._id} value={d.name} disabled={isBooked}>
                {isBooked ? `🔴 ${d.name} — Booked at this time` : `🟢 ${d.name}${d.specialization ? ` — ${d.specialization}` : ''}`}
              </option>
            );
          })}
          {doctors.length === 0 && <option disabled>No doctors found — add from Staff page</option>}
        </select>
        {form.doctorName && bookedDoctors.includes(form.doctorName) && (
          <p className="mt-1.5 text-xs font-bold text-red-500">⚠️ Dr. {form.doctorName} already has an appointment at this time. Please select another doctor.</p>
        )}
        {form.appointmentDate && form.timeSlot && bookedDoctors.length > 0 && !bookedDoctors.includes(form.doctorName) && form.doctorName && (
          <p className="mt-1.5 text-xs font-bold text-emerald-600">✓ Dr. {form.doctorName} is available at this time.</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date *</label>
          <input type="date" required className={`${inputCls} mt-1`} value={form.appointmentDate} onChange={e => sf('appointmentDate', e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Time Slot *</label>
          <input type="time" required className={`${inputCls} mt-1`} value={form.timeSlot} onChange={e => sf('timeSlot', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type</label>
          <select className={`${inputCls} mt-1`} value={form.type} onChange={e => sf('type', e.target.value)}>
            {TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</label>
          <select className={`${inputCls} mt-1`} value={form.status} onChange={e => sf('status', e.target.value)}>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Problem / Complaint</label>
        <textarea rows={2} className={`${inputCls} mt-1`} value={form.problem} onChange={e => sf('problem', e.target.value)} />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Delivery Address</label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <input placeholder="House No" className={inputCls} value={form.houseNo} onChange={e => sf('houseNo', e.target.value)} />
          <input placeholder="City / Village" className={inputCls} value={form.cityVillage} onChange={e => sf('cityVillage', e.target.value)} />
          <input placeholder="Post Office" className={inputCls} value={form.postOffice} onChange={e => sf('postOffice', e.target.value)} />
          <input placeholder="Landmark" className={inputCls} value={form.landmark} onChange={e => sf('landmark', e.target.value)} />
          <input placeholder="District" className={inputCls} value={form.district} onChange={e => sf('district', e.target.value)} />
          <input placeholder="State" className={inputCls} value={form.state} onChange={e => sf('state', e.target.value)} />
          <input placeholder="Pincode" maxLength={6} className={inputCls} value={form.pincode} onChange={e => sf('pincode', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Medicine Delivery Date</label>
        <input type="date" className={`${inputCls} mt-1`} value={form.medicineDeliveryDate} onChange={e => sf('medicineDeliveryDate', e.target.value)} />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Notes</label>
        <textarea rows={2} className={`${inputCls} mt-1`} value={form.notes} onChange={e => sf('notes', e.target.value)} />
      </div>
      <div className="pt-2 flex gap-3">
        <button type="submit" disabled={loading}
          className="flex-1 py-3 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg disabled:opacity-50 transition-all hover:scale-[1.01]">
          {loading ? 'Saving...' : submitLabel}
        </button>
        {selected && canManage && (
          <button type="button" onClick={() => onDelete(selected._id)}
            className="px-4 py-3 rounded-2xl text-xs font-bold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition">
            Delete
          </button>
        )}
      </div>
    </form>
  );
}

export default function AppointmentBook() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'staff';

  const [data, setData] = useState({ appointments: [], total: 0, totalPages: 1 });
  const today = new Date().toISOString().split('T')[0];
  const [filters, setFilters] = useState({ search: '', dateFrom: today, dateTo: today, status: '', page: 1 });
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'completed' | 'cancelled' | 'no_show'
  const [loadError, setLoadError] = useState('');
  const [rightPanel, setRightPanel] = useState(null); // { mode: 'view'|'edit', appt }
  const selected = rightPanel?.mode === 'edit' ? rightPanel.appt : null;
  const [form, setForm] = useState(EMPTY);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [bookedDoctors, setBookedDoctors] = useState([]);
  const [waConfirm, setWaConfirm] = useState(null);
  const [fieldNote, setFieldNote] = useState('');
  const [fieldNoteSaving, setFieldNoteSaving] = useState(false);
  const [phoneSearching, setPhoneSearching] = useState(false);
  const phoneTimerRef = useRef(null);

  const openWhatsApp = (phone, name) => {
    setWaConfirm({ phone: phone?.replace(/\D/g, ''), name });
  };

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const params = { page: filters.page, limit: 20 };
      if (filters.search) params.search = filters.search;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (user?.role === 'doctor' && activeTab === 'all') params.doctorName = user.name;
      if (activeTab === 'completed') params.status = 'completed';
      else if (activeTab === 'cancelled') params.status = 'cancelled';
      else if (activeTab === 'no_show') params.status = 'no_show';
      else params.status = filters.status || undefined;
      if (!params.status) delete params.status;
      if (activeTab === 'all' && !filters.status) params.excludeStatus = 'completed,cancelled,no_show';
      const res = await getAppointments(params);
      setData(res || { appointments: [], total: 0, totalPages: 1 });
    } catch (err) {
      setLoadError(err.response?.data?.message || err.message || 'Failed to load appointments');
      setData({ appointments: [], total: 0, totalPages: 1 });
    } finally {
      setPageLoading(false);
    }
  }, [filters, activeTab, user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getUsers({ role: 'doctor' })
      .then(r => {
        const list = r?.results || r?.users || (Array.isArray(r) ? r : []);
        setDoctors(list);
      })
      .catch(() => {});
  }, []);

  const sf = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (error) setError('');
  };

  useEffect(() => {
    if (!form.appointmentDate || !form.timeSlot) { setBookedDoctors([]); return; }
    getAvailability(form.appointmentDate, form.timeSlot)
      .then(list => setBookedDoctors(list || []))
      .catch(() => setBookedDoctors([]));
  }, [form.appointmentDate, form.timeSlot]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.patientName.trim() || !form.phone.trim() || !form.doctorName.trim() || !form.appointmentDate || !form.timeSlot) {
      setError('Patient name, phone, doctor, date and time slot are required');
      return;
    }
    setLoading(true); setError('');
    try {
      await createAppointment(form);
      setIsCreating(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create appointment');
    } finally { setLoading(false); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await updateAppointment(rightPanel.appt._id, form);
      setRightPanel(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update appointment');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this appointment?')) return;
    try {
      await deleteAppointment(id);
      setRightPanel(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete');
    }
  };

  const openCreate = () => { setIsCreating(true); setRightPanel(null); setForm(EMPTY); setError(''); };

  const handlePhoneChange = (phone) => {
    clearTimeout(phoneTimerRef.current);
    if (phone.replace(/\D/g, '').length < 5) return;
    phoneTimerRef.current = setTimeout(async () => {
      setPhoneSearching(true);
      try {
        const r = await searchByPhone(phone);
        if (r) {
          setForm(f => ({
            ...f,
            patientName: r.patientName || f.patientName,
            email: r.email || f.email,
            address: r.address || f.address,
            houseNo: r.houseNo || f.houseNo,
            cityVillage: r.cityVillage || r.city || f.cityVillage,
            postOffice: r.postOffice || f.postOffice,
            landmark: r.landmark || f.landmark,
            district: r.district || f.district,
            state: r.state || f.state,
            pincode: r.pincode || f.pincode,
            problem: r.problem || f.problem,
            medicineDeliveryDate: r.medicineDeliveryDate || f.medicineDeliveryDate,
            patientType: r.patientType || f.patientType,
          }));
        }
      } catch {}
      finally { setPhoneSearching(false); }
    }, 600);
  };

  const handleQuickStatus = async (id, status, e) => {
    e.stopPropagation();
    try {
      await updateAppointment(id, { status });
      setRightPanel(null);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    }
  };

  const openView = (appt, e) => {
    e.stopPropagation();
    setIsCreating(false);
    setFieldNote(appt.fieldNote || '');
    setRightPanel({ mode: 'view', appt });
  };

  const openEdit = (appt) => {
    setIsCreating(false);
    setError('');
    setFieldNote(appt.fieldNote || '');
    const d = appt.appointmentDate ? new Date(appt.appointmentDate).toISOString().split('T')[0] : '';
    const md = appt.medicineDeliveryDate ? new Date(appt.medicineDeliveryDate).toISOString().split('T')[0] : '';
    setForm({ ...EMPTY, ...appt, appointmentDate: d, medicineDeliveryDate: md });
    setRightPanel({ mode: 'edit', appt });
  };

  const applyPreset = (preset) => {
    const now = new Date();
    const f = d => d.toISOString().split('T')[0];
    let from = f(now), to = f(now);
    if (preset === 'yesterday') { const y = new Date(now); y.setDate(y.getDate() - 1); from = to = f(y); }
    else if (preset === 'week') { const w = new Date(now); w.setDate(w.getDate() - 6); from = f(w); }
    else if (preset === 'month') { const m = new Date(now); m.setDate(1); from = f(m); }
    setFilters(prev => ({ ...prev, dateFrom: from, dateTo: to, page: 1 }));
  };

  const sharedFormProps = { form, sf, error, loading, selected: rightPanel?.appt, canManage, onDelete: handleDelete, doctors, bookedDoctors };

  if (pageLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex gap-4 scroll-container-h overflow-hidden animate-slide-up mobile-p-safe">

      {/* LEFT PANEL */}
      <div className={`flex flex-col gap-4 transition-all duration-300 ${rightPanel || isCreating ? 'w-full lg:w-[55%]' : 'w-full'} h-full overflow-hidden`}>

        {/* Tabs */}
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => { setActiveTab('all'); setFilters(f => ({ ...f, status: '', page: 1 })); setRightPanel(null); }}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}>
            All Appointments
          </button>
          <button onClick={() => { setActiveTab('completed'); setFilters(f => ({ ...f, status: '', page: 1 })); setRightPanel(null); }}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'completed'
                ? 'bg-gray-700 text-white shadow-md'
                : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Completed
          </button>
          <button onClick={() => { setActiveTab('cancelled'); setFilters(f => ({ ...f, status: '', page: 1 })); setRightPanel(null); }}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'cancelled'
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
            </svg>
            Cancelled
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 shrink-0 glass p-5 rounded-3xl border border-white/50 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
              {[['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'Week'], ['month', 'Month']].map(([key, label]) => (
                <button key={key} onClick={() => applyPreset(key)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                    (key === 'today' && filters.dateFrom === today && filters.dateTo === today)
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-gray-400 border-gray-100 hover:bg-gray-50'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[180px]">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))}
                placeholder="Search patient, phone, doctor..."
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-100 bg-white text-sm font-medium text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition shadow-sm" />
            </div>

            <button onClick={openCreate}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg hover:shadow-xl transition-all flex items-center gap-2 shrink-0"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <span className="text-lg leading-none">+</span> Book Appointment
            </button>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-gray-400 font-medium ml-auto">
              {data.total} appointment{data.total !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {loadError && (
            <div className="mb-3 bg-red-50 text-red-600 text-xs p-3 rounded-xl font-bold border border-red-100">{loadError}</div>
          )}
          {data.appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
              <svg className="w-10 h-10 text-gray-200 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              <p className="text-gray-400 text-sm font-medium">No appointments found</p>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {data.appointments.map((appt) => {
                const isActive = selected?._id === appt._id;
                return (
                  <div key={appt._id}
                    onClick={(e) => openView(appt, e)}
                    className={`relative flex items-center gap-4 px-4 py-4 rounded-2xl cursor-pointer transition-all duration-200 border
                      ${rightPanel?.appt?._id === appt._id ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-white border-gray-100 hover:border-emerald-200'}`}>

                    <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${
                      appt.status === 'completed' ? 'bg-gray-400' :
                      appt.status === 'confirmed' ? 'bg-emerald-500' :
                      appt.status === 'cancelled' ? 'bg-red-400' :
                      appt.status === 'no_show' ? 'bg-amber-400' : 'bg-blue-400'
                    }`} />

                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 bg-emerald-600">
                      {initials(appt.patientName)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{appt.patientName}</p>
                      <p className="text-xs text-gray-400">{appt.phone} · Dr. {appt.doctorName}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{fmt(appt.appointmentDate)} · {appt.timeSlot}</p>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[appt.status] || 'bg-gray-100 text-gray-500'}`}>
                        {appt.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-white rounded-2xl border border-gray-100 mt-2 mb-6">
              <button disabled={filters.page <= 1}
                onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-50 rounded-lg disabled:opacity-30 transition">← Prev</button>
              <span className="text-xs font-bold text-emerald-600">Page {filters.page} of {data.totalPages}</span>
              <button disabled={filters.page >= data.totalPages}
                onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-50 rounded-lg disabled:opacity-30 transition">Next →</button>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL — View / Edit (desktop) */}
      {rightPanel && !isCreating && (
        <div className="hidden lg:flex flex-col w-[45%] bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden h-full">
          <div className={`h-1.5 shrink-0 ${rightPanel.mode === 'view' ? 'bg-emerald-600' : 'bg-blue-500'}`} />

          {/* Header */}
          <div className="px-6 py-5 flex items-center justify-between border-b border-gray-50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white text-sm font-bold bg-emerald-600">
                {initials(rightPanel.appt.patientName)}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">{rightPanel.appt.patientName}</p>
                <p className="text-xs text-gray-400">Dr. {rightPanel.appt.doctorName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {rightPanel.mode === 'view' && (
                <button onClick={() => openEdit(rightPanel.appt)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit
                </button>
              )}
              {rightPanel.mode === 'edit' && (
                <button onClick={() => setRightPanel({ mode: 'view', appt: rightPanel.appt })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                  </svg>
                  View
                </button>
              )}
              <button onClick={() => setRightPanel(null)}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition text-2xl">×</button>
            </div>
          </div>

          {/* VIEW mode */}
          {rightPanel.mode === 'view' && (
            <div className="px-6 py-5 overflow-y-auto flex-1 custom-scrollbar">
              <div className="space-y-0">
                <DetailRow label="Doctor" value={`Dr. ${rightPanel.appt.doctorName}`} />
                <DetailRow label="Patient Type" value={rightPanel.appt.patientType} />
                <DetailRow label="Date" value={fmt(rightPanel.appt.appointmentDate)} />
                <DetailRow label="Time" value={rightPanel.appt.timeSlot} />
                <DetailRow label="Type" value={rightPanel.appt.type?.replace(/_/g, ' ')} />
                <DetailRow label="Status" value={rightPanel.appt.status?.replace(/_/g, ' ')} />
                <DetailRow label="Phone" value={rightPanel.appt.phone} />
                <DetailRow label="Email" value={rightPanel.appt.email} />
                <DetailRow label="Problem" value={rightPanel.appt.problem} />
                <DetailRow label="Address" value={[rightPanel.appt.houseNo, rightPanel.appt.cityVillage, rightPanel.appt.postOffice, rightPanel.appt.landmark, rightPanel.appt.district, rightPanel.appt.state, rightPanel.appt.pincode].filter(Boolean).join(', ')} />
                <DetailRow label="Medicine Delivery" value={fmt(rightPanel.appt.medicineDeliveryDate)} />
                <DetailRow label="Notes" value={rightPanel.appt.notes} />
                <DetailRow label="Booked By" value={rightPanel.appt.createdBy?.name} />
                <DetailRow label="Created" value={fmt(rightPanel.appt.createdAt)} />

                {/* Field Notes */}
                <div className="py-2.5 border-b border-gray-50">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Field Notes</span>
                  {rightPanel.appt.fieldNotes?.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {[...rightPanel.appt.fieldNotes].reverse().map((n, i) => (
                        <div key={i} className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                          <p className="text-xs text-gray-800">{n.text}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{n.addedBy} · {new Date(n.addedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {!['completed', 'cancelled', 'no_show'].includes(rightPanel.appt.status) && (
                    <div className="flex gap-2 mt-2">
                      <textarea rows={2} value={fieldNote} onChange={e => setFieldNote(e.target.value)}
                        placeholder="Add a note..."
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
                      <button disabled={fieldNoteSaving || !fieldNote.trim()}
                        onClick={async () => {
                          setFieldNoteSaving(true);
                          try {
                            const updated = await addFieldNote(rightPanel.appt._id, fieldNote.trim());
                            setRightPanel(p => ({ ...p, appt: { ...p.appt, fieldNotes: updated.fieldNotes } }));
                            setData(d => ({ ...d, appointments: d.appointments.map(a => a._id === rightPanel.appt._id ? { ...a, fieldNotes: updated.fieldNotes } : a) }));
                            setFieldNote('');
                          } catch {}
                          finally { setFieldNoteSaving(false); }
                        }}
                        className="self-end px-3 py-2 rounded-xl text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition">
                        {fieldNoteSaving ? '...' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Status Buttons */}
              {!['completed', 'cancelled', 'no_show'].includes(rightPanel.appt.status) && (
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button onClick={(e) => handleQuickStatus(rightPanel.appt._id, 'completed', e)}
                    className="py-2.5 rounded-xl text-[10px] font-bold text-gray-700 bg-gray-100 border border-gray-200 hover:bg-gray-200 transition">
                    ✓ Completed
                  </button>
                  <button onClick={(e) => handleQuickStatus(rightPanel.appt._id, 'cancelled', e)}
                    className="py-2.5 rounded-xl text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition">
                    ✕ Cancelled
                  </button>
                </div>
              )}

              {/* Video Call & WhatsApp — only for active appointments */}
              {!['completed', 'cancelled', 'no_show'].includes(rightPanel.appt.status) && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                <a href="https://meet.google.com/new" target="_blank" rel="noopener noreferrer"
                  className="py-3 rounded-2xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg hover:scale-[1.01] transition-all"
                  style={{ background: 'linear-gradient(135deg, #1a73e8, #1557b0)' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
                  </svg>
                  Video Call
                </a>
                <button onClick={() => openWhatsApp(rightPanel.appt.phone, rightPanel.appt.patientName)}
                  className="py-3 rounded-2xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg hover:scale-[1.01] transition-all"
                  style={{ background: 'linear-gradient(135deg, #25d366, #128c7e)' }}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </button>
              </div>
              )}

              {canManage && !['completed', 'cancelled', 'no_show'].includes(rightPanel.appt.status) && (
                <button onClick={() => handleDelete(rightPanel.appt._id)}
                  className="mt-2 w-full py-3 rounded-2xl text-xs font-bold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition">
                  Delete Appointment
                </button>
              )}
            </div>
          )}

          {/* EDIT mode */}
          {rightPanel.mode === 'edit' && (
            <div className="px-6 py-5 overflow-y-auto flex-1 custom-scrollbar">
              <FormFields {...sharedFormProps} onSubmit={handleUpdate} submitLabel="Save Changes" />
            </div>
          )}
        </div>
      )}

      {/* CREATE MODAL */}
      {isCreating && (
        <Modal title="Book Appointment" onClose={() => setIsCreating(false)}>
          <FormFields {...sharedFormProps} onSubmit={handleCreate} submitLabel="Book Appointment"
            onPhoneChange={handlePhoneChange} phoneSearching={phoneSearching} />
        </Modal>
      )}

      {/* MOBILE — View/Edit Modal */}
      {rightPanel && !isCreating && (
        <div className="lg:hidden">
          {rightPanel.mode === 'view' ? (
            <Modal title="Appointment Detail" onClose={() => setRightPanel(null)}>
              <div className="space-y-0 mb-4">
                <DetailRow label="Doctor" value={`Dr. ${rightPanel.appt.doctorName}`} />
                <DetailRow label="Patient Type" value={rightPanel.appt.patientType} />
                <DetailRow label="Date" value={fmt(rightPanel.appt.appointmentDate)} />
                <DetailRow label="Time" value={rightPanel.appt.timeSlot} />
                <DetailRow label="Type" value={rightPanel.appt.type?.replace(/_/g, ' ')} />
                <DetailRow label="Status" value={rightPanel.appt.status?.replace(/_/g, ' ')} />
                <DetailRow label="Phone" value={rightPanel.appt.phone} />
                <DetailRow label="Email" value={rightPanel.appt.email} />
                <DetailRow label="Problem" value={rightPanel.appt.problem} />
                <DetailRow label="Address" value={[rightPanel.appt.houseNo, rightPanel.appt.cityVillage, rightPanel.appt.postOffice, rightPanel.appt.landmark, rightPanel.appt.district, rightPanel.appt.state, rightPanel.appt.pincode].filter(Boolean).join(', ')} />
                <DetailRow label="Medicine Delivery" value={fmt(rightPanel.appt.medicineDeliveryDate)} />
                <DetailRow label="Notes" value={rightPanel.appt.notes} />
                <DetailRow label="Booked By" value={rightPanel.appt.createdBy?.name} />
                <DetailRow label="Created" value={fmt(rightPanel.appt.createdAt)} />

                {/* Field Notes */}
                <div className="py-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Field Notes</span>
                  {rightPanel.appt.fieldNotes?.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {[...rightPanel.appt.fieldNotes].reverse().map((n, i) => (
                        <div key={i} className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                          <p className="text-xs text-gray-800">{n.text}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{n.addedBy} · {new Date(n.addedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {!['completed', 'cancelled', 'no_show'].includes(rightPanel.appt.status) && (
                    <div className="flex gap-2 mt-2">
                      <textarea rows={2} value={fieldNote} onChange={e => setFieldNote(e.target.value)}
                        placeholder="Add a note..."
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
                      <button disabled={fieldNoteSaving || !fieldNote.trim()}
                        onClick={async () => {
                          setFieldNoteSaving(true);
                          try {
                            const updated = await addFieldNote(rightPanel.appt._id, fieldNote.trim());
                            setRightPanel(p => ({ ...p, appt: { ...p.appt, fieldNotes: updated.fieldNotes } }));
                            setData(d => ({ ...d, appointments: d.appointments.map(a => a._id === rightPanel.appt._id ? { ...a, fieldNotes: updated.fieldNotes } : a) }));
                            setFieldNote('');
                          } catch {}
                          finally { setFieldNoteSaving(false); }
                        }}
                        className="self-end px-3 py-2 rounded-xl text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition">
                        {fieldNoteSaving ? '...' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {!['completed', 'cancelled', 'no_show'].includes(rightPanel.appt.status) && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button onClick={(e) => handleQuickStatus(rightPanel.appt._id, 'completed', e)}
                    className="py-2.5 rounded-xl text-[10px] font-bold text-gray-700 bg-gray-100 border border-gray-200 hover:bg-gray-200 transition">
                    ✓ Completed
                  </button>
                  <button onClick={(e) => handleQuickStatus(rightPanel.appt._id, 'cancelled', e)}
                    className="py-2.5 rounded-xl text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition">
                    ✕ Cancelled
                  </button>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => openEdit(rightPanel.appt)}
                  className="flex-1 py-3 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg">
                  Edit
                </button>
                <a href="https://meet.google.com/new" target="_blank" rel="noopener noreferrer"
                  className="px-4 py-3 rounded-2xl text-xs font-bold text-white flex items-center gap-1.5 shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #1a73e8, #1557b0)' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
                  </svg>
                  Video
                </a>
                <button onClick={() => openWhatsApp(rightPanel.appt.phone, rightPanel.appt.patientName)}
                  className="px-4 py-3 rounded-2xl text-xs font-bold text-white flex items-center gap-1.5 shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #25d366, #128c7e)' }}>
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WA
                </button>
                {canManage && !['completed', 'cancelled', 'no_show'].includes(rightPanel.appt.status) && (
                  <button onClick={() => handleDelete(rightPanel.appt._id)}
                    className="px-4 py-3 rounded-2xl text-xs font-bold text-red-600 bg-red-50 border border-red-100">
                    Delete
                  </button>
                )}
              </div>
            </Modal>
          ) : (
            <Modal title="Edit Appointment" onClose={() => setRightPanel(null)}>
              <FormFields {...sharedFormProps} onSubmit={handleUpdate} submitLabel="Save Changes" />
            </Modal>
          )}
        </div>
      )}
      {/* WhatsApp Confirm Popup */}
      {waConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                style={{ background: 'linear-gradient(135deg, #25d366, #128c7e)' }}>
                <svg className="w-6 h-6" fill="white" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">WhatsApp Call</p>
                <p className="text-xs text-gray-400">{waConfirm.name} · {waConfirm.phone}</p>
              </div>
              <button onClick={() => setWaConfirm(null)} className="ml-auto w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition text-xl">×</button>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 mb-5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Message that will be sent</p>
              <p className="text-xs text-gray-700 italic">"Thanks for booking your appointment. Please receive my WhatsApp call shortly."</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setWaConfirm(null)}
                className="px-4 py-3 rounded-2xl text-xs font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition">
                Cancel
              </button>
              <button
                onClick={() => {
                  const msg = encodeURIComponent('Thanks for booking your appointment. Please receive my WhatsApp call shortly.');
                  window.open(`https://wa.me/${waConfirm.phone}?text=${msg}`, '_blank');
                  setTimeout(() => window.open(`https://wa.me/${waConfirm.phone}`, '_blank'), 800);
                  setWaConfirm(null);
                }}
                className="flex-1 py-3 rounded-2xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.01]"
                style={{ background: 'linear-gradient(135deg, #25d366, #128c7e)' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.61 19a19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 3.09 4.18 2 2 0 0 1 5.07 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L9.91 9.91a16 16 0 0 0 6.18 6.18l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                Send Message & Call Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
