import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAppointments } from '../services/appointment.service';
import * as attendanceSvc from '../services/attendance.service';
import { useToast } from '../context/ToastContext';

const cardStyle = { border: '1px solid rgba(0,0,0,0.05)' };

const STATUS_COLORS = {
  scheduled: 'bg-blue-100 text-blue-700',
  confirmed:  'bg-emerald-100 text-emerald-700',
  completed:  'bg-gray-100 text-gray-600',
  cancelled:  'bg-red-100 text-red-600',
  no_show:    'bg-amber-100 text-amber-700',
};

const STATUS_BAR = {
  scheduled: 'bg-blue-400',
  confirmed:  'bg-emerald-500',
  completed:  'bg-gray-400',
  cancelled:  'bg-red-400',
  no_show:    'bg-amber-400',
};

const fmt = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const initials = (name = '') =>
  name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const StatCard = ({ label, value, icon, colorClass, bgClass }) => (
  <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center gap-4" style={cardStyle}>
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${bgClass}`}>
      <span className={colorClass}>{icon}</span>
    </div>
    <div>
      <p className="text-2xl font-bold text-gray-800">{value ?? 0}</p>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{label}</p>
    </div>
  </div>
);

const AppointmentList = ({ title, list, icon, color, bg, open, onToggle }) => (
  <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={cardStyle}>
    <button className="w-full flex items-center justify-between px-5 py-4" onClick={onToggle}>
      <div className="flex items-center gap-2">
        <span className={`w-8 h-8 rounded-xl ${bg} ${color} flex items-center justify-center`}>{icon}</span>
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${bg} ${color}`}>{list.length}</span>
      </div>
      <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
    </button>
    {open && (
      <div className="px-5 pb-4 max-h-72 overflow-y-auto space-y-2">
        {list.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">No appointments</p>
        ) : list.map((appt) => (
          <div key={appt._id} className="relative flex items-center gap-3 px-3 py-3 rounded-xl bg-gray-50 border border-gray-100">
            <div className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full ${STATUS_BAR[appt.status] || 'bg-gray-300'}`} />
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
              {initials(appt.patientName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-800 truncate">{appt.patientName}</p>
              <p className="text-[10px] text-gray-400">{appt.phone} · {fmt(appt.appointmentDate)} {appt.timeSlot}</p>
            </div>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${STATUS_COLORS[appt.status] || 'bg-gray-100 text-gray-500'}`}>
              {appt.status?.replace(/_/g, ' ')}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default function DoctorDashboard() {
  const { user } = useAuth();
  const { success, error, info } = useToast();
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState('today');
  const [attStatus, setAttStatus] = useState(null);
  const [attLoading, setAttLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    try {
      const [appts, att] = await Promise.allSettled([
        getAppointments({ limit: 200 }),
        attendanceSvc.getTodayStatus(),
      ]);
      if (appts.status === 'fulfilled') setAll(appts.value?.appointments || []);
      if (att.status === 'fulfilled') setAttStatus(att.value);
    } catch { setAll([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Derived lists
  const todayAppts   = all.filter(a => a.appointmentDate?.slice(0, 10) === today);
  const pending      = all.filter(a => ['scheduled', 'confirmed'].includes(a.status));
  const completed    = all.filter(a => a.status === 'completed');
  const cancelled    = all.filter(a => a.status === 'cancelled');
  const noShow       = all.filter(a => a.status === 'no_show');
  const todayPending = todayAppts.filter(a => ['scheduled', 'confirmed'].includes(a.status));
  const todayDone    = todayAppts.filter(a => a.status === 'completed');

  const toggle = (key) => setOpenSection(s => s === key ? null : key);

  const checkedIn  = !!attStatus?.checkIn;
  const checkedOut = !!attStatus?.checkOut;
  const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : null;

  const handleCheckIn = async () => {
    setAttLoading(true);
    try { 
      const res = await attendanceSvc.checkIn(); 
      setAttStatus(res); 
      success('Good morning, Doctor! You have checked in successfully.', 'Clock In');
    }
    catch (e) { error(e.response?.data?.message || 'Check-in failed'); }
    finally { setAttLoading(false); }
  };

  const handleCheckOut = async () => {
    setAttLoading(true);
    try { 
      const res = await attendanceSvc.checkOut(); 
      setAttStatus(res); 
      info('Work day finished. Have a great evening!', 'Clock Out');
    }
    catch (e) { error(e.response?.data?.message || 'Check-out failed'); }
    finally { setAttLoading(false); }
  };

  const todayStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 pb-10 animate-slide-up">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Doctor Dashboard</h2>
        <p className="text-sm text-gray-400 mt-0.5">Welcome, Dr. {user?.name} · {todayStr}</p>
      </div>

      {/* Attendance Card */}
      <div className="rounded-3xl p-5 flex items-center justify-between gap-4 flex-wrap"
        style={{ background: 'linear-gradient(135deg, #0d1f0d, #1a3a1a)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Attendance</p>
            <p className="text-green-300/60 text-xs mt-0.5">
              {checkedIn && checkedOut
                ? `In: ${fmtTime(attStatus.checkIn)} · Out: ${fmtTime(attStatus.checkOut)}`
                : checkedIn
                ? `Checked in at ${fmtTime(attStatus.checkIn)}`
                : 'Not checked in yet'}
            </p>
          </div>
        </div>
        <div>
          {!checkedIn ? (
            <button onClick={handleCheckIn} disabled={attLoading}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all shadow-lg"
              style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
              {attLoading ? 'Processing...' : '🟢 Clock In'}
            </button>
          ) : !checkedOut ? (
            <button onClick={handleCheckOut} disabled={attLoading}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all shadow-lg"
              style={{ background: 'linear-gradient(135deg, #ea580c, #c2410c)' }}>
              {attLoading ? 'Processing...' : '🔴 Clock Out'}
            </button>
          ) : (
            <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-500/20 text-green-300 text-sm font-semibold">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/></svg>
              Day Complete
            </span>
          )}
        </div>
      </div>

      {/* Today Summary Banner */}
      <div className="rounded-3xl p-6 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{ background: 'linear-gradient(135deg, #0d1f0d, #166534)' }}>
        <div>
          <p className="text-green-300/70 text-xs font-bold uppercase tracking-widest mb-1">Today's Overview</p>
          <p className="text-3xl font-bold">{todayAppts.length} <span className="text-lg font-medium text-white/60">appointments</span></p>
        </div>
        <div className="flex gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-300">{todayPending.length}</p>
            <p className="text-[10px] text-white/50 uppercase tracking-widest">Pending</p>
          </div>
          <div className="w-px bg-white/10" />
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{todayDone.length}</p>
            <p className="text-[10px] text-white/50 uppercase tracking-widest">Done</p>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Pending" value={pending.length}
          bgClass="bg-blue-50" colorClass="text-blue-600"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
        <StatCard label="Completed" value={completed.length}
          bgClass="bg-emerald-50" colorClass="text-emerald-600"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>} />
        <StatCard label="Cancelled" value={cancelled.length}
          bgClass="bg-red-50" colorClass="text-red-500"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>} />
        <StatCard label="No Show" value={noShow.length}
          bgClass="bg-amber-50" colorClass="text-amber-600"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/></svg>} />
      </div>

      {/* Appointment Lists */}
      <div className="space-y-3">
        <AppointmentList
          title="Today's Appointments" list={todayAppts}
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>}
          color="text-indigo-600" bg="bg-indigo-50"
          open={openSection === 'today'} onToggle={() => toggle('today')} />

        <AppointmentList
          title="Pending Appointments" list={pending}
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
          color="text-blue-600" bg="bg-blue-50"
          open={openSection === 'pending'} onToggle={() => toggle('pending')} />

        <AppointmentList
          title="Completed Appointments" list={completed}
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
          color="text-emerald-600" bg="bg-emerald-50"
          open={openSection === 'completed'} onToggle={() => toggle('completed')} />

        <AppointmentList
          title="Cancelled Appointments" list={cancelled}
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
          color="text-red-500" bg="bg-red-50"
          open={openSection === 'cancelled'} onToggle={() => toggle('cancelled')} />

        <AppointmentList
          title="No Show" list={noShow}
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/></svg>}
          color="text-amber-600" bg="bg-amber-50"
          open={openSection === 'noshow'} onToggle={() => toggle('noshow')} />
      </div>
    </div>
  );
}
