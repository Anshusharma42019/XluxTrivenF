import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchSupportStats, saveStaffTarget, fetchStaffCommission, fetchStaffMonthlyChart } from '../services/dashboard.service';
import * as attendanceSvc from '../services/attendance.service';
import { sendToVerification as smSendToVerification } from '../services/shipmaxx.service';
import { sendToVerification as srSendToVerification } from '../services/shiprocket.service';
import { createAppointment } from '../services/appointment.service';
import {
  HeartPulse,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Phone,
  MessageCircle,
  TrendingUp,
  PackageCheck,
  AlertCircle,
  Calendar,
  ChevronRight,
  ChevronLeft,
  BarChart2,
  User,
  Stethoscope,
  RotateCcw,
  DollarSign,
  Filter,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Search,
  ExternalLink,
  ChevronDown,
  Percent,
  Users,
  Repeat,
  LogOut
} from 'lucide-react';

/* ─── Live Shift Timer Hook ──────────────────────────────────── */
function useLiveTimer(checkInTime) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!checkInTime) {
      setElapsed('');
      return;
    }
    const update = () => {
      const diff = Math.max(0, Math.floor((Date.now() - new Date(checkInTime).getTime()) / 1000));
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(`${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [checkInTime]);
  return elapsed;
}

export default function SupportDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error } = useToast();

  const isManagement = user?.role === 'admin' || user?.role === 'manager';

  // Dynamic Filters
  const [preset, setPreset] = useState('month');
  const [department, setDepartment] = useState('all');
  const [selectedStaffId, setSelectedStaffId] = useState('all');
  const [selectedTargetRate, setSelectedTargetRate] = useState(75);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Attendance
  const [attendance, setAttendance] = useState(null);
  const [attLoading, setAttLoading] = useState(false);
  const hasCheckedIn = Boolean(attendance?.checkIn || attendance?.checkInTime);
  const hasCheckedOut = Boolean(attendance?.checkOut || attendance?.checkOutTime);
  const isShiftActive = hasCheckedIn && !hasCheckedOut;
  const liveShiftTime = useLiveTimer(isShiftActive ? (attendance?.checkIn || attendance?.checkInTime) : null);

  // Main Dynamic Stats Data
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Daily Target States
  const [targetInput, setTargetInput] = useState('');
  const [savingTarget, setSavingTarget] = useState(false);
  const [editingTarget, setEditingTarget] = useState(false);

  // Monthly Earnings State
  const [commMonth, setCommMonth] = useState(() => {
    const n = new Date();
    return { month: n.getMonth(), year: n.getFullYear() };
  });
  const [commission, setCommission] = useState(null);
  const [commLoading, setCommLoading] = useState(false);

  // Verification & Ready to Ship Trend Chart State
  const [monthlyChart, setMonthlyChart] = useState([]);
  const [chartFilter, setChartFilter] = useState('month');
  const [chartLoading, setChartLoading] = useState(false);


  // Interactive Dynamic Drawer for Clickable Cards (Funnel, Relief, Re-Orders)
  const [drilldownDrawer, setDrilldownDrawer] = useState({
    open: false,
    title: '',
    subtitle: '',
    type: '', // 'funnel' | 'relief' | 'reorder'
    items: [],
  });

  // Action Modals
  const [bookingModal, setBookingModal] = useState({
    open: false,
    patient: null,
    price: '',
    medicine: '',
    notes: '',
    saving: false,
  });

  const [doctorModal, setDoctorModal] = useState({
    open: false,
    patient: null,
    doctorId: '',
    doctorName: '',
    date: '',
    timeSlot: '11:00 AM - 12:00 PM',
    problem: '',
    notes: '',
    saving: false,
  });

  // Fetch Attendance
  const loadAttendance = useCallback(async () => {
    try {
      const res = await attendanceSvc.getTodayStatus();
      setAttendance(res?.data || res);
    } catch (_) {}
  }, []);

  const handleCheckIn = async () => {
    setAttLoading(true);
    try {
      await attendanceSvc.checkIn();
      success('Shift Started! Successfully clocked in.', 'Shift Online');
      loadAttendance();
    } catch (err) {
      error(err.response?.data?.message || 'Check-in failed');
    } finally {
      setAttLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!window.confirm('Kya aap aaj ki shift complete karke Check Out karna chahte hain?')) return;
    setAttLoading(true);
    try {
      await attendanceSvc.checkOut();
      success('Shift Completed! Great job today.', 'Checked Out');
      loadAttendance();
    } catch (err) {
      error(err.response?.data?.message || 'Check-out failed');
    } finally {
      setAttLoading(false);
    }
  };

  // Fetch Live Support Stats
  const loadStats = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const params = {
          preset,
          department,
          staffId: isManagement ? selectedStaffId : undefined,
          targetRate: selectedTargetRate,
          from: preset === 'custom' ? customFrom : undefined,
          to: preset === 'custom' ? customTo : undefined,
        };
        const res = await fetchSupportStats(params, isRefresh);
        setData(res);
      } catch (err) {
        error(err?.response?.data?.message || 'Failed to load support dashboard stats');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [preset, department, selectedStaffId, selectedTargetRate, customFrom, customTo, isManagement, error]
  );

  // Load Monthly Commission
  const loadCommission = useCallback(async (isRefresh = false) => {
    setCommLoading(true);
    try {
      const targetStaff = isManagement ? (selectedStaffId !== 'all' ? selectedStaffId : null) : (user?._id || user?.id);
      const res = await fetchStaffCommission(commMonth.month, commMonth.year, targetStaff, isRefresh);
      setCommission(res);
    } catch (_) {
      // ignore
    } finally {
      setCommLoading(false);
    }
  }, [commMonth, selectedStaffId, isManagement, user]);

  // Load Monthly Chart Data
  const loadMonthlyChart = useCallback(async (isRefresh = false) => {
    setChartLoading(true);
    try {
      const targetStaff = isManagement ? (selectedStaffId !== 'all' ? selectedStaffId : null) : (user?._id || user?.id);
      const res = await fetchStaffMonthlyChart(targetStaff, isRefresh);
      setMonthlyChart(Array.isArray(res) ? res : []);
    } catch (_) {
      // ignore
    } finally {
      setChartLoading(false);
    }
  }, [selectedStaffId, isManagement, user]);

  useEffect(() => {
    loadAttendance();
    loadStats();
    loadCommission();
    loadMonthlyChart();
    const attTimer = setInterval(loadAttendance, 60000);
    return () => clearInterval(attTimer);
  }, [loadAttendance, loadStats, loadCommission, loadMonthlyChart]);

  // Open Re-Order Modal
  const openBookingModal = (patient) => {
    setBookingModal({
      open: true,
      patient,
      price: patient.amount || '',
      medicine: patient.productName || 'Ayurvedic Treatment Kit',
      notes: `Re-order booked via Support Dashboard (Course Day: ${patient.days_elapsed || '—'})`,
      saving: false,
    });
  };

  const handleConfirmReorder = async (e) => {
    e.preventDefault();
    if (!bookingModal.patient?._id) return;
    setBookingModal((prev) => ({ ...prev, saving: true }));

    try {
      const isSmx = bookingModal.patient.platform === 'shipmaxx' || !bookingModal.patient.platform;
      const payload = {
        source: 'reorder_followup',
        price: Number(bookingModal.price) || 0,
        medicine: bookingModal.medicine,
        notes: bookingModal.notes,
      };

      if (isSmx) {
        await smSendToVerification(bookingModal.patient._id, payload);
      } else {
        await srSendToVerification(bookingModal.patient._id, payload);
      }

      success(`Re-order for "${bookingModal.patient.name}" successfully sent to Verification!`, 'Re-Verification Created');
      setBookingModal({ open: false, patient: null, price: '', medicine: '', notes: '', saving: false });
      loadStats(true);
    } catch (err) {
      error(err?.response?.data?.message || 'Failed to book re-order');
      setBookingModal((prev) => ({ ...prev, saving: false }));
    }
  };

  // Open Doctor Consultation Bridge Modal
  const openDoctorModal = (patient) => {
    const today = new Date().toISOString().slice(0, 10);
    const defaultDoctor = data?.meta?.doctors?.[0] || { name: 'Dr. Arvind yadav', specialization: 'Ayurveda' };

    setDoctorModal({
      open: true,
      patient,
      doctorId: defaultDoctor.id || '',
      doctorName: defaultDoctor.name,
      date: today,
      timeSlot: '02:00 PM - 03:00 PM',
      problem: patient.department === 'piles' ? 'Piles / Fissure Chronic Support' : 'Migraine Frequent Headache Alert',
      notes: `Follow-up evaluation (${patient.relief_percentage !== undefined ? patient.relief_percentage + '% relief reported' : 'Course advice requested'}). Doctor consultation needed.`,
      saving: false,
    });
  };

  const handleConfirmDoctorBooking = async (e) => {
    e.preventDefault();
    if (!doctorModal.patient) return;
    setDoctorModal((prev) => ({ ...prev, saving: true }));

    try {
      await createAppointment({
        patientName: doctorModal.patient.name || doctorModal.patient.billing_customer_name || 'Patient',
        phone: doctorModal.patient.phone || doctorModal.patient.billing_phone || '',
        doctorName: doctorModal.doctorName,
        appointmentDate: new Date(doctorModal.date),
        timeSlot: doctorModal.timeSlot,
        department: doctorModal.patient.department || 'migraine',
        type: 'follow_up',
        problem: doctorModal.problem,
        notes: doctorModal.notes,
        patientType: 'old',
      });

      success(`Doctor consultation scheduled with ${doctorModal.doctorName}! Doctor notified.`, 'Doctor Appointment Booked');
      setDoctorModal({ open: false, patient: null, doctorId: '', doctorName: '', date: '', timeSlot: '', problem: '', notes: '', saving: false });
    } catch (err) {
      error(err?.response?.data?.message || 'Failed to book doctor appointment');
      setDoctorModal((prev) => ({ ...prev, saving: false }));
    }
  };

  // Direct WhatsApp helper
  const handleDirectWhatsApp = (phone, name, customMsg) => {
    const clean = String(phone).replace(/\D/g, '').slice(-10);
    if (!clean) return;
    const msg = customMsg || `Namaste ${name || 'Patient'} ji, main Triven Ayurveda se baat kar raha hoon aapki health enquiry ke baare mein. Kya hum aapse baat kar sakte hain?`;
    window.open(`https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Daily Target Save Handler
  const handleSaveDailyTarget = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!targetInput || Number(targetInput) < 1) return;
    setSavingTarget(true);
    try {
      const targetStaffId = isManagement ? (selectedStaffId !== 'all' ? selectedStaffId : 'all') : (user?._id || user?.id);
      await saveStaffTarget(Number(targetInput), targetStaffId);
      success(`Today's verification target set to ${targetInput}.`, 'Target Updated');
      setEditingTarget(false);
      setTargetInput('');
      loadStats(true);
      loadMonthlyChart(true);
    } catch (err) {
      error(err?.response?.data?.message || 'Failed to update target');
    } finally {
      setSavingTarget(false);
    }
  };

  // Clickable Drilldown Drawer Handler
  const openDrilldown = (title, subtitle, type, items = []) => {
    setDrilldownDrawer({
      open: true,
      title,
      subtitle,
      type,
      items: items || [],
    });
  };

  const s = data?.summary || {};
  const funnel = data?.funnel || {};
  const relief = data?.reliefMeter || {};
  const radar = data?.refillRadar || {};
  const ndr = data?.ndrRescue || {};
  const sentiment = data?.whatsappSentiment || {};
  const deptStats = data?.departmentStats || {};
  const meta = data?.meta || {};
  const dailyTarget = data?.dailyTarget || {
    target: 0,
    done: 0,
    remaining: 0,
    progressPct: 0,
    monthVerifications: 0,
    pendingTasks: 0,
    todayLeads: 0,
  };
  const isTargetAchieved = dailyTarget.target > 0 && dailyTarget.done >= dailyTarget.target;

  const filteredChartData = useMemo(() => {
    if (!monthlyChart.length) return [];
    const todayDay = new Date().getDate();
    const yesterdayDay = new Date(Date.now() - 86400000).getDate();
    if (chartFilter === 'today') return monthlyChart.filter((d) => d.day === todayDay);
    if (chartFilter === 'yesterday') return monthlyChart.filter((d) => d.day === yesterdayDay);
    if (chartFilter === '7d') {
      const minDay = Math.max(1, todayDay - 6);
      return monthlyChart.filter((d) => d.day >= minDay && d.day <= todayDay);
    }
    return monthlyChart.filter((d) => d.day <= todayDay);
  }, [monthlyChart, chartFilter]);

  const basePay = commission?.basePay || 0;
  const oldDeliveries = (commission?.oldDeliveries !== undefined && commission?.oldDeliveries !== null && commission.oldDeliveries > 0)
    ? commission.oldDeliveries
    : (s.reordersDelivered || 0);
  const oldComm = (commission?.reorderCommission !== undefined && commission?.reorderCommission !== null && commission.reorderCommission > 0)
    ? commission.reorderCommission
    : (s.totalEarnedCommission || 0);

  const totalDeliveries = (commission?.totalDeliveries !== undefined && commission?.totalDeliveries !== null && commission.totalDeliveries > 0)
    ? commission.totalDeliveries
    : (s.thisMonthDelivered || s.totalDelivered || 0);

  const newDeliveries = (commission?.newDeliveries !== undefined && commission?.newDeliveries !== null && commission.newDeliveries > 0)
    ? commission.newDeliveries
    : Math.max(0, totalDeliveries - oldDeliveries);

  const newComm = (commission?.revenueCommission !== undefined && commission?.revenueCommission !== null && commission.revenueCommission > 0)
    ? commission.revenueCommission
    : (newDeliveries * 50);

  const totalCommission = commission?.override?.manualCommission ?? (commission?.totalCommission || (newComm + oldComm));
  const totalPay = commission?.totalPay || (basePay + totalCommission);
  const commRate = commission?.commissionRate || user?.commissionRate || 10;
  const avgReorderRate = oldDeliveries > 0 ? Math.round(oldComm / oldDeliveries) : (commission?.reorderRate || 150);


  return (
    <div className="space-y-4 pb-8 animate-in fade-in duration-200">
      {/* ── Top Header & Shift Bar ──────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-950 text-white p-5 md:p-6 shadow-xl border border-emerald-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold mb-2">
              <HeartPulse className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              Patient Care & Re-Order Command Center
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Support Retention Dashboard
              <span className="text-xs px-2.5 py-1 rounded-xl bg-white/10 text-emerald-200 font-bold tracking-normal uppercase border border-white/10">
                {user?.role === 'support' ? 'Executive Mode' : 'Supervision Mode'}
              </span>
            </h1>
            <p className="text-emerald-100/70 text-xs md:text-sm mt-1 max-w-2xl">
              100% live database metrics for treatment progression, patient recovery relief %, refill countdown alerts, and repeat order attribution.
            </p>
          </div>

          {/* Shift Attendance Pill & Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {/* Shift Timer Card */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold border border-emerald-400/30">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                  {isShiftActive ? 'Shift In-Progress' : 'Shift Status'}
                </p>
                <p className="text-base font-black font-mono text-white">
                  {isShiftActive
                    ? liveShiftTime || 'Active'
                    : hasCheckedOut
                    ? 'Completed'
                    : 'Not Clocked In'}
                </p>
              </div>

              {isShiftActive ? (
                <button
                  type="button"
                  onClick={handleCheckOut}
                  disabled={attLoading}
                  className="ml-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-lg shadow-orange-500/20 active:scale-95 text-white font-black text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {attLoading ? 'Clocking out...' : 'Clock Out Shift'}
                </button>
              ) : hasCheckedOut ? (
                <button
                  type="button"
                  onClick={handleCheckIn}
                  disabled={attLoading}
                  className="ml-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/20 active:scale-95 text-gray-950 font-black text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Clock className="w-3.5 h-3.5" />
                  {attLoading ? 'Clocking in...' : 'Clock In Again'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCheckIn}
                  disabled={attLoading}
                  className="ml-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-green-400 hover:from-emerald-300 hover:to-green-300 shadow-lg shadow-emerald-500/20 active:scale-95 text-emerald-950 font-black text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Clock className="w-3.5 h-3.5" />
                  {attLoading ? 'Clocking in...' : 'Clock In Now'}
                </button>
              )}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => {
                loadAttendance();
                loadStats(true);
                loadCommission(true);
                loadMonthlyChart(true);
              }}
              disabled={refreshing}
              className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 text-white flex items-center justify-center transition cursor-pointer disabled:opacity-50"
              title="Refresh Stats"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Dynamic Controls Bar */}
        <div className="relative z-10 mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-2xl border border-white/10 flex-wrap">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'last7', label: 'Last 7 Days' },
              { id: 'month', label: 'This Month' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: 'Custom' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  preset === p.id
                    ? 'bg-emerald-500 text-gray-950 shadow-md font-black'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Department, Staff & Target Rate Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Dynamic Support Staff Dropdown for Management */}
            {isManagement && (
              <div className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-2xl border border-white/10">
                <span className="text-[10px] font-black uppercase text-gray-400 px-2 flex items-center gap-1">
                  <Users className="w-3 h-3 text-teal-400" /> Staff:
                </span>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="bg-transparent text-xs text-white border-0 font-bold focus:outline-none cursor-pointer pr-2"
                >
                  <option value="all" className="bg-gray-900 text-white">All Support Team</option>
                  {(meta.supportStaff || []).map((st) => (
                    <option key={st.id} value={st.id} className="bg-gray-900 text-white">
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Dynamic Target Rate Selector (60% to 75%) */}
            <div className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-2xl border border-white/10">
              <span className="text-[10px] font-black uppercase text-gray-400 px-2 flex items-center gap-1">
                <Percent className="w-3 h-3 text-emerald-400" /> Target:
              </span>
              {[60, 65, 70, 75].map((rate) => (
                <button
                  key={rate}
                  onClick={() => setSelectedTargetRate(rate)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    selectedTargetRate === rate
                      ? 'bg-emerald-400 text-gray-950 font-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {rate}%
                </button>
              ))}
            </div>

            {/* Department Selector */}
            <div className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-2xl border border-white/10">
              <span className="text-[10px] font-black uppercase text-gray-400 px-2 flex items-center gap-1">
                <Filter className="w-3 h-3 text-emerald-400" /> Dept:
              </span>
              {[
                { id: 'all', label: 'All' },
                ...(meta.departments && meta.departments.length > 0
                  ? meta.departments.map((dep) => ({ id: dep, label: dep.charAt(0).toUpperCase() + dep.slice(1) }))
                  : [
                      { id: 'migraine', label: 'Migraine' },
                      { id: 'piles', label: 'Piles' },
                    ]),
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDepartment(d.id)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    department === d.id
                      ? 'bg-teal-500 text-gray-950 font-black'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {preset === 'custom' && (
              <div className="flex items-center gap-2 bg-black/30 p-1.5 rounded-2xl border border-white/10">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="bg-transparent text-xs text-white border border-white/20 rounded-lg px-2 py-1 focus:outline-none"
                />
                <span className="text-gray-400 text-xs">to</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="bg-transparent text-xs text-white border border-white/20 rounded-lg px-2 py-1 focus:outline-none"
                />
                <button
                  onClick={() => loadStats(true)}
                  className="px-2.5 py-1 bg-emerald-500 text-gray-950 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            Aggregating live customer retention & relief database...
          </p>
        </div>
      ) : (
        <>
          {/* ── Cohort Retention & Target Bridge Banner (Answers User Invariant) ── */}
          <div className="rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/20 p-4 backdrop-blur-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Repeat className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm md:text-base font-black text-gray-900 tracking-tight">
                      Monthly Repeat Target Formula (Cohort Retention Engine)
                    </h2>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Live Cohort
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                    Orders delivered <b>last month ({s.lastCohortMonthName || 'Previous Month'})</b> (<b>{s.lastMonthDeliveredBase || 0} orders / {s.lastMonthUniquePatients || 0} unique patients</b>) are completing their 30-day course this month. Based on the <b>{s.reorderTargetRatePercent || selectedTargetRate}%</b> retention benchmark, this month's re-order target is set to <b>{s.targetReorders || 0} kits</b>.
                  </p>
                </div>
              </div>

              {/* Quick Cohort Stats Pill */}
              <div className="flex items-center gap-2 shrink-0 bg-white/80 p-2 rounded-xl border border-emerald-100 shadow-sm">
                <div className="text-right px-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase">Cohort Deliveries</p>
                  <p className="text-sm font-black text-emerald-700">
                    {s.reordersDeliveredFromCohort || 0} <span className="text-xs font-semibold text-gray-500">/ {s.lastMonthDeliveredBase || 0}</span>
                  </p>
                </div>
                <div className="h-7 w-px bg-gray-200" />
                <div className="px-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase">Target Achieved</p>
                  <p className="text-sm font-black text-teal-700">
                    {s.targetAchievementPercent || 0}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Daily Command Center & Performance Station ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
            {/* Left Column: Daily Target + Monthly Earnings */}
            <div className="xl:col-span-1 flex flex-col gap-4 h-full">
              {/* Daily Target Card (Fits content snugly, no blank white space) */}
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3 shrink-0">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                  <div>
                    <h3 className="text-sm font-black text-gray-900 tracking-tight">
                      {isManagement && selectedStaffId === 'all' ? 'Support Team Daily Target' : 'Daily Target'}
                    </h3>
                    <p className="text-[11px] text-gray-400 font-semibold">
                      {isManagement && selectedStaffId === 'all' ? 'Combined Verifications Goal' : 'Verifications Goal'}
                    </p>
                  </div>
                  {dailyTarget.target > 0 && !editingTarget && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTarget(true);
                        setTargetInput(String(dailyTarget.target));
                      }}
                      className="text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-full transition border border-emerald-100 cursor-pointer shadow-2xs"
                    >
                      Change
                    </button>
                  )}
                </div>

                {(!dailyTarget.target || editingTarget) ? (
                  <form onSubmit={handleSaveDailyTarget} className="space-y-3 pt-1">
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Quick Target Preset</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[5, 10, 15, 20, 25].map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setTargetInput(String(q))}
                          className={`w-10 h-10 rounded-xl text-xs font-black border-2 transition cursor-pointer ${
                            targetInput === String(q)
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-gray-50 text-gray-700 border-gray-100 hover:border-emerald-300'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={targetInput}
                        onChange={(e) => setTargetInput(e.target.value)}
                        placeholder="Custom"
                        className="w-20 h-10 border-2 border-gray-100 rounded-xl px-2 text-center text-xs font-black focus:outline-none focus:border-emerald-500 bg-gray-50 text-gray-900"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={savingTarget || !targetInput}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition shadow-sm disabled:opacity-50 cursor-pointer"
                      >
                        {savingTarget ? 'Saving...' : 'Confirm Target'}
                      </button>
                      {editingTarget && dailyTarget.target > 0 && (
                        <button
                          type="button"
                          onClick={() => setEditingTarget(false)}
                          className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center gap-3 pt-0.5">
                    {/* Circular Progress Ring */}
                    <div className="relative shrink-0 w-18 h-18 flex items-center justify-center">
                      <svg width="72" height="72" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="32" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                        <circle
                          cx="40"
                          cy="40"
                          r="32"
                          fill="none"
                          stroke={isTargetAchieved ? '#10b981' : dailyTarget.progressPct >= 60 ? '#10b981' : '#10b981'}
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 32}`}
                          strokeDashoffset={`${2 * Math.PI * 32 * (1 - (dailyTarget.progressPct || 0) / 100)}`}
                          transform="rotate(-90 40 40)"
                          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-sm font-black leading-none ${isTargetAchieved ? 'text-emerald-600' : 'text-gray-900'}`}>
                          {dailyTarget.progressPct || 0}%
                        </span>
                      </div>
                    </div>

                    {/* Score Stats: DONE and LEFT */}
                    <div className="flex-1 grid grid-cols-2 gap-2.5">
                      <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 text-center">
                        <p className="text-xl font-black text-emerald-800 leading-none">{dailyTarget.done || 0}</p>
                        <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 mt-1">DONE</p>
                      </div>
                      <div className={`p-3 rounded-xl border text-center ${isTargetAchieved ? 'bg-emerald-50/70 border-emerald-100' : 'bg-amber-50/70 border-amber-100'}`}>
                        <p className={`text-xl font-black leading-none ${isTargetAchieved ? 'text-emerald-800' : 'text-amber-800'}`}>
                          {isTargetAchieved ? 'Done' : dailyTarget.remaining || 0}
                        </p>
                        <p className={`text-[10px] font-black uppercase tracking-wider mt-1 ${isTargetAchieved ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {isTargetAchieved ? 'COMPLETE' : 'LEFT'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Monthly Earnings Card - Flex-1 stretches to match right column height perfectly */}
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2.5 mb-3">
                    <h3 className="text-sm font-black text-gray-800 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      {isManagement && selectedStaffId === 'all' ? 'Team Monthly Payout' : 'Monthly Earnings'}
                    </h3>
                    <div className="flex items-center gap-1 bg-gray-50 p-0.5 rounded-lg border border-gray-100">
                      <button
                        type="button"
                        onClick={() => {
                          const m = commMonth.month - 1;
                          setCommMonth(m < 0 ? { month: 11, year: commMonth.year - 1 } : { month: m, year: commMonth.year });
                        }}
                        className="w-5 h-5 rounded-md bg-white shadow-2xs flex items-center justify-center text-gray-500 hover:bg-gray-100 transition cursor-pointer"
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      <span className="text-[10px] font-bold text-gray-700 min-w-[65px] text-center uppercase tracking-tight">
                        {new Date(commMonth.year, commMonth.month).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const m = commMonth.month + 1;
                          setCommMonth(m > 11 ? { month: 0, year: commMonth.year + 1 } : { month: m, year: commMonth.year });
                        }}
                        className="w-5 h-5 rounded-md bg-white shadow-2xs flex items-center justify-center text-gray-500 hover:bg-gray-100 transition cursor-pointer"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {commLoading && !commission ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-gradient-to-r from-gray-900 to-slate-900 rounded-xl p-4 text-center shadow-md relative text-white border border-gray-800">
                        <p className="text-2xl font-black text-emerald-400">₹{totalPay.toLocaleString('en-IN')}</p>
                        <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mt-0.5">
                          {isManagement && selectedStaffId === 'all' ? 'Total Support Payout' : 'Total Estimated Pay'}
                        </p>
                        <div className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-400/30">
                          <span>{totalDeliveries} Delivered</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                          <p className="text-[9px] font-black uppercase text-emerald-700 tracking-wider">Base Pay</p>
                          <p className="text-sm font-black text-emerald-900 my-0.5 leading-none">₹{basePay.toLocaleString('en-IN')}</p>
                          <p className="text-[9px] font-bold text-emerald-600">Per Month</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-center">
                          <p className="text-[9px] font-black uppercase text-blue-700 tracking-wider">New Comm ({commRate}%)</p>
                          <p className="text-sm font-black text-blue-900 my-0.5 leading-none">₹{newComm.toLocaleString('en-IN')}</p>
                          <p className="text-[9px] font-bold text-blue-600">{newDeliveries} Deliv</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-100 text-center">
                          <p className="text-[9px] font-black uppercase text-purple-700 tracking-wider">Old / Re-Order</p>
                          <p className="text-sm font-black text-purple-900 my-0.5 leading-none">₹{oldComm.toLocaleString('en-IN')}</p>
                          <p className="text-[9px] font-bold text-purple-600 truncate">
                            ₹{avgReorderRate.toLocaleString('en-IN')} ({oldDeliveries})
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Hero Retention Metrics + Activity Trend Chart */}
            <div className="xl:col-span-2 flex flex-col gap-4">
              {/* Top Hero Retention Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Card 1: Last Month Cohort (Target Base) */}
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-gray-400 mb-1.5">
                      <span className="text-[11px] font-black uppercase tracking-wider text-gray-500">
                        Last Month Delivered (Target Base)
                      </span>
                      <PackageCheck className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-black text-gray-900 tracking-tight">{s.lastMonthDeliveredBase || s.totalDelivered || 0}</p>
                      <span className="text-xs font-bold text-gray-500">Delivered Base</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {s.lastMonthUniquePatients || 0} unique patients finishing 30-day course
                    </p>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-gray-50">
                    <span className="text-gray-500 font-medium">This Month New:</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg text-xs">
                      {s.thisMonthDelivered || s.totalDelivered || 0} Delivered
                    </span>
                  </div>
                </div>

                {/* Card 2: Re-Order Target & Forecast */}
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-gray-400 mb-1.5">
                      <span className="text-[11px] font-black uppercase tracking-wider text-teal-700">
                        This Month Target ({s.reorderTargetRatePercent || selectedTargetRate}%)
                      </span>
                      <TrendingUp className="w-4 h-4 text-teal-600" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-black text-gray-900 tracking-tight">{s.targetReorders || 0}</p>
                      <span className="text-xs font-bold text-gray-400">Target Kits</span>
                    </div>
                    {/* Progress mini-bar */}
                    <div className="mt-2 w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, s.targetAchievementPercent || 0)}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-2 pt-1 flex items-center justify-between text-xs">
                    <span className="text-teal-700 font-black">
                      {s.reordersDelivered || 0} Delivered ({s.targetAchievementPercent || 0}%)
                    </span>
                    <span className={`font-bold ${s.gapToTarget > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {s.gapToTarget > 0 ? `${s.gapToTarget} Gap` : 'Target Done!'}
                    </span>
                  </div>
                </div>

                {/* Card 3: Re-Orders Delivered & Revenue */}
                <div
                  onClick={() => openDrilldown('Re-Orders Delivered This Month', 'Successfully delivered repeat courses this month', 'reorder', data?.reorderLists?.delivered)}
                  className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition bg-gradient-to-br from-white to-emerald-50/40 cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-emerald-600 mb-1.5">
                      <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                        Re-Orders Delivered <ChevronRight className="w-3.5 h-3.5 text-emerald-500" />
                      </span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-black text-emerald-700 tracking-tight">{s.reordersDelivered || 0}</p>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        {s.reordersDeliveredFromCohort || 0} from {s.lastCohortMonthShort || 'Cohort'}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                      +{s.reordersDeliveredFromExtendedCohort || 0} from {s.returningCohortMonthShort || 'Previous'} returning patients
                    </p>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-emerald-100/60 flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">Repeat Revenue:</span>
                    <span className="font-mono font-black text-gray-900">₹{(s.reordersRevenue || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Card 4: Support Commission Wallet */}
                <div className="bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950 text-white rounded-2xl p-4 shadow-lg border border-gray-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-gray-400 mb-1.5">
                      <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Commission Wallet
                      </span>
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-2xl font-black font-mono text-emerald-400 tracking-tight">
                      ₹{(s.totalEarnedCommission || 0).toLocaleString('en-IN')}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Earned from {s.reordersDelivered || 0} delivered refills
                    </p>
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
                    <span>In-Transit ({s.reordersInTransit || 0} orders):</span>
                    <span className="font-mono font-bold text-teal-300">
                      +₹{(s.expectedInTransitCommission || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Verification & Ready to Ship Trend vs Target Chart Card */}
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5 flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-emerald-600" />
                      Verification & Ready to Ship Trend vs Target
                    </h3>
                    <p className="text-[10px] text-gray-400">Track daily verified leads, ready to ship orders, and target progress</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
                      {[
                        { id: 'today', label: 'Today' },
                        { id: 'yesterday', label: 'Yest.' },
                        { id: '7d', label: '7D' },
                        { id: 'month', label: 'Month' }
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setChartFilter(f.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition cursor-pointer ${
                            chartFilter === f.id ? 'bg-emerald-600 text-white shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-bold text-gray-500">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" /> Verified
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500" /> Ready to Ship
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-slate-300" /> Target
                      </span>
                    </div>
                  </div>
                </div>

                {chartLoading && filteredChartData.length === 0 ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredChartData.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-end gap-1 px-1 h-32">
                      {filteredChartData.map((d, i) => {
                        const maxVal = Math.max(...filteredChartData.map((x) => Math.max(x.count, x.readyToShip || 0, x.target || 0)), 1);
                        const doneH = Math.max((d.count / maxVal) * 100, d.count > 0 ? 6 : 0);
                        const rtsH = Math.max(((d.readyToShip || 0) / maxVal) * 100, (d.readyToShip || 0) > 0 ? 6 : 0);
                        const targetH = Math.max(((d.target || 0) / maxVal) * 100, (d.target || 0) > 0 ? 6 : 0);
                        const isToday = d.day === new Date().getDate();
                        const targetAchieved = d.target > 0 && d.count >= d.target;

                        return (
                          <div key={i} className="flex-1 h-full flex items-end gap-0.5 group relative">
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] px-2.5 py-2 rounded-xl opacity-0 group-hover:opacity-100 z-30 whitespace-nowrap pointer-events-none shadow-xl border border-gray-700">
                              <p className="font-bold text-gray-200 border-b border-gray-800 pb-1 mb-1">
                                {d.day} {new Date().toLocaleString('default', { month: 'short' })}
                              </p>
                              <p className="text-emerald-300 font-bold">Verified: {d.count}</p>
                              <p className="text-blue-300 font-bold">Ready to Ship: {d.readyToShip || 0}</p>
                              {d.target > 0 && <p className="text-gray-400 font-medium">Target: {d.target}</p>}
                            </div>

                            {/* Target Bar */}
                            {d.target > 0 && (
                              <div
                                className="flex-1 rounded-t-sm transition-all duration-500"
                                style={{ height: `${targetH}%`, background: isToday ? '#cbd5e1' : '#e2e8f0' }}
                              />
                            )}
                            {/* Ready to Ship Bar */}
                            <div
                              className="flex-1 rounded-t-sm transition-all duration-500"
                              style={{
                                height: `${rtsH}%`,
                                background: (d.readyToShip || 0) > 0 ? (isToday ? '#2563eb' : '#3b82f6') : '#f8fafc',
                                boxShadow: isToday && (d.readyToShip || 0) > 0 ? '0 0 6px #3b82f6' : 'none',
                              }}
                            />
                            {/* Verified Bar */}
                            <div
                              className="flex-1 rounded-t-sm transition-all duration-500"
                              style={{
                                height: `${doneH}%`,
                                background: targetAchieved ? '#10b981' : isToday ? '#34d399' : d.count > 0 ? '#6ee7b7' : '#f1f5f9',
                                boxShadow: isToday && d.count > 0 ? '0 0 6px #10b981' : 'none',
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 px-1 pt-1 border-t border-gray-100">
                      <span>
                        {filteredChartData[0]?.day} {new Date().toLocaleString('default', { month: 'short' })}
                      </span>
                      <span className="font-black bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-200 flex items-center gap-2 shadow-2xs">
                        <span className="text-emerald-700">{filteredChartData.reduce((acc, d) => acc + d.count, 0)} Verified</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-blue-700">{filteredChartData.reduce((acc, d) => acc + (d.readyToShip || 0), 0)} Ready to Ship</span>
                      </span>
                      <span>
                        {filteredChartData.at(-1)?.day} {new Date().toLocaleString('default', { month: 'short' })}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-8">No activity data available for this range</p>
                )}
              </div>
            </div>
          </div>

          {/* ── Patient Treatment Funnel (Delivered ➔ FU 1 to 5) ──────── */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4 text-emerald-600" />
                  Patient Treatment Funnel (Click any stage to view matching patients)
                </h3>
                <p className="text-xs text-gray-500">
                  Live distribution of delivered patients currently undergoing recovery stages.
                </p>
              </div>
              <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                {funnel.counts?.completedAll || 0} Patients Completed All 5 Follow-ups
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {[
                { stage: '1st Follow-up', sub: 'Day 6 (Unboxing & Dose)', key: 'fu1', count: funnel.counts?.fu1 || 0, color: 'border-purple-200 bg-purple-50/50 text-purple-700 hover:border-purple-400' },
                { stage: '2nd Follow-up', sub: 'Day 12 (Early Reaction)', key: 'fu2', count: funnel.counts?.fu2 || 0, color: 'border-blue-200 bg-blue-50/50 text-blue-700 hover:border-blue-400' },
                { stage: '3rd Follow-up', sub: 'Day 18 (Relief Progress)', key: 'fu3', count: funnel.counts?.fu3 || 0, color: 'border-teal-200 bg-teal-50/50 text-teal-700 hover:border-teal-400' },
                { stage: '4th Follow-up', sub: 'Day 24 (Refill Booking)', key: 'fu4', count: funnel.counts?.fu4 || 0, color: 'border-amber-200 bg-amber-50/50 text-amber-700 hover:border-amber-400' },
                { stage: '5th Follow-up', sub: 'Day 30 (Course Done)', key: 'fu5', count: funnel.counts?.fu5 || 0, color: 'border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:border-emerald-400' },
              ].map((f, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => openDrilldown(f.stage, f.sub, 'funnel', funnel.lists?.[f.key])}
                  className={`rounded-xl p-3 border flex flex-col justify-between text-left transition hover:shadow-md cursor-pointer ${f.color}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">{f.stage}</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                  </div>
                  <p className="text-2xl font-black mt-1.5 leading-none">{f.count}</p>
                  <p className="text-[10px] font-semibold opacity-75 mt-2 pt-1.5 border-t border-black/5">{f.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Two Column Row: Relief Health Meter & Re-Order Lifecycle ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Patient Relief Health Matrix */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
                      <HeartPulse className="w-4 h-4 text-rose-500" />
                      Patient Health Relief Matrix
                    </h3>
                    <p className="text-xs text-gray-500">Recovery satisfaction reported across follow-up consultations.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-emerald-600">{relief.averageRelief || 0}%</p>
                    <p className="text-[10px] uppercase font-bold text-gray-400">Avg Overall Relief</p>
                  </div>
                </div>

                {/* Progress bars for High, Moderate, Low */}
                <div className="space-y-2.5 my-3">
                  {/* High Relief */}
                  <div
                    onClick={() => openDrilldown('High Relief Patients (> 70%)', 'Satisfied patients ready for course continuation', 'relief', relief.lists?.high)}
                    className="p-2 rounded-xl hover:bg-gray-50 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs font-bold mb-1">
                      <span className="text-emerald-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" /> High Relief (70% – 100%)
                      </span>
                      <span className="text-gray-900 font-black">{relief.highReliefCount || 0} Patients</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${relief.reliefRecordedCount > 0 ? (relief.highReliefCount / relief.reliefRecordedCount) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Moderate Relief */}
                  <div
                    onClick={() => openDrilldown('Moderate Relief Patients (40% - 69%)', 'Patients showing positive response, need reassurance & diet tips', 'relief', relief.lists?.moderate)}
                    className="p-2 rounded-xl hover:bg-gray-50 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs font-bold mb-1">
                      <span className="text-amber-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500" /> Moderate Relief (40% – 69%)
                      </span>
                      <span className="text-gray-900 font-black">{relief.moderateReliefCount || 0} Patients</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${relief.reliefRecordedCount > 0 ? (relief.moderateReliefCount / relief.reliefRecordedCount) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Low or Zero Relief */}
                  <div
                    onClick={() => openDrilldown('Low or Zero Relief Patients (< 40%)', 'Urgent doctor consultation or dosage adjustment needed', 'relief', relief.lists?.low)}
                    className="p-2 rounded-xl bg-rose-50/50 hover:bg-rose-50 border border-rose-100 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs font-bold mb-1">
                      <span className="text-rose-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> Low / Zero Relief (&lt; 40%) ⚠️
                      </span>
                      <span className="text-rose-700 font-black">{relief.lowOrNoReliefCount || 0} Patients</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-rose-500 h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${relief.reliefRecordedCount > 0 ? (relief.lowOrNoReliefCount / relief.reliefRecordedCount) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Stage Average Relief Progression */}
                <div className="mt-3 pt-2.5 border-t border-gray-100 grid grid-cols-5 gap-1.5 text-center">
                  {[
                    { label: 'FU 1', val: relief.stageAverageRelief?.fu1 },
                    { label: 'FU 2', val: relief.stageAverageRelief?.fu2 },
                    { label: 'FU 3', val: relief.stageAverageRelief?.fu3 },
                    { label: 'FU 4', val: relief.stageAverageRelief?.fu4 },
                    { label: 'FU 5', val: relief.stageAverageRelief?.fu5 },
                  ].map((st, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-1.5 border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400">{st.label}</p>
                      <p className="text-xs font-black text-gray-800 mt-0.5">{st.val ? `${st.val}%` : '—'}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button for Low Relief Patients */}
              {(relief.lowOrNoReliefCount || 0) > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <p className="text-xs font-bold text-rose-900">
                      {relief.lowOrNoReliefCount} patient(s) reported low/no relief. Doctor intervention advised.
                    </p>
                  </div>
                  <button
                    onClick={() => openDrilldown('Low or Zero Relief Patients', 'Connect with Doctor to save customer from drop-out', 'relief', relief.lists?.low)}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm shrink-0 cursor-pointer"
                  >
                    Review Patients
                  </button>
                </div>
              )}
            </div>

            {/* Right: End-to-End Re-Verification Order Lifecycle */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
                      <RotateCcw className="w-4 h-4 text-teal-600" />
                      Re-Order Lifecycle (Booking to Delivery)
                    </h3>
                    <p className="text-xs text-gray-500">Track repeat continuation orders from support verification to doorstep.</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-gray-500">
                    Total Booked: <b>{s.reordersBooked || 0}</b>
                  </span>
                </div>

                <div className="space-y-2.5 my-3">
                  {[
                    { label: '1. Re-orders Booked (Sent to Verif)', count: s.reordersBooked || 0, sub: 'Created by Support', listKey: 'booked', icon: User, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
                    { label: '2. In-Transit via Courier', count: s.reordersInTransit || 0, sub: 'Currently on the way', listKey: 'inTransit', icon: PackageCheck, color: 'text-blue-600 bg-blue-50 border-blue-200' },
                    { label: '3. Successfully Delivered', count: s.reordersDelivered || 0, sub: 'Commission Credited to Staff', listKey: 'delivered', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                    { label: '4. Lost / RTO Returns', count: s.reordersRto || 0, sub: 'Returned to warehouse', listKey: 'rto', icon: AlertTriangle, color: 'text-rose-600 bg-rose-50 border-rose-200' },
                  ].map((step, idx) => (
                    <div
                      key={idx}
                      onClick={() => openDrilldown(step.label, step.sub, 'reorder', data?.reorderLists?.[step.listKey])}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/70 hover:bg-gray-100 border border-gray-100 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center border font-bold ${step.color}`}>
                          <step.icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-gray-900 flex items-center gap-1">
                            {step.label} <ChevronRight className="w-3 h-3 text-gray-400" />
                          </p>
                          <p className="text-[10px] text-gray-500 font-medium">{step.sub}</p>
                        </div>
                      </div>
                      <p className="text-base font-black text-gray-900 font-mono">{step.count}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Commission Highlight Footer */}
              <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/60 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold text-emerald-800">Support Re-Order Incentive</p>
                  <p className="text-xs text-gray-700 font-medium mt-0.5">Every delivered re-order adds direct commission to your wallet.</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-emerald-700 font-mono">+₹{(s.totalEarnedCommission || 0).toLocaleString('en-IN')}</p>
                  <p className="text-[9px] font-bold text-emerald-600 uppercase">Earned This Period</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Two Column Bottom Row: WhatsApp Sentiment & Re-Order NDR Rescue ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* WhatsApp Patient Sentiment / Intent Radar */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
                      <MessageCircle className="w-4 h-4 text-green-600" />
                      WhatsApp Patient Intent Radar
                    </h3>
                    <p className="text-xs text-gray-500">Incoming automated keyword replies from Interakt WhatsApp messaging.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 my-1.5">
                  <div
                    onClick={() => openDrilldown('WhatsApp: "अगले महीने की दवाई बुक करें"', 'Patients who requested next course kit booking via WhatsApp', 'reorder', sentiment.lists?.bookNextMonth)}
                    className="p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 transition cursor-pointer group"
                    title="Click to view patients"
                  >
                    <p className="text-xl font-black text-emerald-800 flex items-center justify-between">
                      <span>{sentiment.bookNextMonth || 0}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-emerald-600 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition" />
                    </p>
                    <p className="text-xs font-bold text-emerald-700 mt-0.5 truncate">"अगले महीने की दवाई बुक करें"</p>
                    <span className="text-[10px] text-emerald-600 font-semibold">Immediate re-order intent</span>
                  </div>

                  <div
                    onClick={() => openDrilldown('WhatsApp: "डॉक्टर से बात करनी है"', 'Patients requesting doctor consultation/escalation via WhatsApp', 'reorder', sentiment.lists?.talkDoctor)}
                    className="p-3 rounded-xl bg-blue-50 hover:bg-blue-100/80 border border-blue-200 transition cursor-pointer group"
                    title="Click to view patients"
                  >
                    <p className="text-xl font-black text-blue-800 flex items-center justify-between">
                      <span>{sentiment.talkDoctor || 0}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-blue-600 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition" />
                    </p>
                    <p className="text-xs font-bold text-blue-700 mt-0.5 truncate">"डॉक्टर से बात करनी है"</p>
                    <span className="text-[10px] text-blue-600 font-semibold">Doctor escalation requested</span>
                  </div>

                  <div
                    onClick={() => openDrilldown('WhatsApp: "दवाई कैसे लें / सेवन विधि"', 'Patients asking about medicine dosage or diet instructions', 'reorder', sentiment.lists?.dosageEnquiry)}
                    className="p-3 rounded-xl bg-amber-50 hover:bg-amber-100/80 border border-amber-200 transition cursor-pointer group"
                    title="Click to view patients"
                  >
                    <p className="text-xl font-black text-amber-800 flex items-center justify-between">
                      <span>{sentiment.dosageEnquiry || 0}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-amber-600 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition" />
                    </p>
                    <p className="text-xs font-bold text-amber-700 mt-0.5 truncate">"दवाई कैसे लें / सेवन विधि"</p>
                    <span className="text-[10px] text-amber-600 font-semibold">Diet & dosage instructions</span>
                  </div>

                  <div
                    onClick={() => openDrilldown('WhatsApp: "आराम नहीं है / कम आराम"', 'Urgent attention required: Patients reporting low or no relief via WhatsApp', 'reorder', sentiment.lists?.reliefNegative)}
                    className="p-3 rounded-xl bg-rose-50 hover:bg-rose-100/80 border border-rose-200 transition cursor-pointer group"
                    title="Click to view patients"
                  >
                    <p className="text-xl font-black text-rose-800 flex items-center justify-between">
                      <span>{sentiment.reliefNegative || 0}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-rose-600 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition" />
                    </p>
                    <p className="text-xs font-bold text-rose-700 mt-0.5 truncate">"आराम नहीं है / कम आराम"</p>
                    <span className="text-[10px] text-rose-600 font-semibold">Urgent attention required</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>Want to reply or chat directly with patients?</span>
                <a href="/whatsapp" className="font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                  Open WhatsApp Inbox <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Re-Order NDR & Delivery Rescue Radar */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                      Re-Order NDR Rescue Alert (Repeat Parcel At-Risk)
                    </h3>
                    <p className="text-xs text-gray-500">Existing customer re-orders facing delivery failure. Call immediately before RTO.</p>
                  </div>
                  <span className="text-xs font-black text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-lg border border-rose-200">
                    {ndr.count || 0} Alerts
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                  {!ndr.orders || ndr.orders.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 font-bold text-xs">
                      No re-orders currently stuck in NDR! All parcels delivering smoothly.
                    </div>
                  ) : (
                    ndr.orders.map((o) => (
                      <div key={String(o._id)} className="p-2.5 rounded-xl bg-rose-50/50 border border-rose-100 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-xs text-gray-900 truncate">{o.name}</p>
                          <p className="text-[11px] text-gray-600 font-medium flex items-center gap-2 mt-0.5">
                            <span>{o.phone}</span>
                            <span className="font-mono text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100 text-[10px]">
                              AWB: {o.awb}
                            </span>
                          </p>
                          <p className="text-[10px] text-rose-700 font-bold mt-0.5 truncate">Courier Reason: {o.reason}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={`tel:${o.phone}`}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm"
                          >
                            <Phone className="w-3 h-3" /> Call
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-gray-100 text-[11px] text-gray-500 font-medium">
                Tip: 85% of repeat NDR parcels deliver successfully when support confirms customer address & timing directly.
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Interactive Drilldown Drawer (Opens on clicking ANY card) ── */}
      {drilldownDrawer.open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-end">
          <div className="bg-white h-full max-w-xl w-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto custom-scrollbar animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
                <div>
                  <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <HeartPulse className="w-5 h-5 text-emerald-600" />
                    {drilldownDrawer.title}
                  </h3>
                  <p className="text-xs text-gray-500">{drilldownDrawer.subtitle}</p>
                </div>
                <button
                  onClick={() => setDrilldownDrawer({ open: false, title: '', subtitle: '', type: '', items: [] })}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 hover:bg-gray-200 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                {drilldownDrawer.items.length === 0 ? (
                  <p className="text-center py-16 text-gray-400 font-bold text-xs">
                    No records found in this category for the selected filter period.
                  </p>
                ) : (
                  drilldownDrawer.items.map((item, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-gray-50 hover:bg-white border border-gray-100 transition shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div
                          onClick={() => {
                            if (item.order_id || item._id) {
                              setDrilldownDrawer({ open: false, title: '', subtitle: '', type: '', items: [] });
                              navigate(`/orders/${item.order_id || item._id}`);
                            }
                          }}
                          className="cursor-pointer group/item"
                          title="Click to view full Order Details page"
                        >
                          <p className="font-black text-xs text-gray-900 group-hover/item:text-emerald-700 transition flex items-center gap-1">
                            <span>{item.name}</span>
                            <ExternalLink className="w-3 h-3 text-gray-400 group-hover/item:text-emerald-600 opacity-60 group-hover/item:opacity-100" />
                          </p>
                          <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                            <span>{item.phone}</span> · <span className="font-mono group-hover/item:text-emerald-700">#{item.order_id}</span>
                          </p>
                        </div>
                        {item.relief_percentage !== undefined && item.relief_percentage !== null && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                            item.relief_percentage >= 70 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            item.relief_percentage >= 40 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {item.relief_percentage}% Relief
                          </span>
                        )}
                        {item.status && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                            {item.status}
                          </span>
                        )}
                      </div>

                      {item.notes && (
                        <p className="text-xs font-medium text-gray-700 italic bg-white p-2 rounded-xl border border-gray-100">
                          "{item.notes}"
                        </p>
                      )}

                      <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
                        {(item.order_id || item._id) && (
                          <button
                            onClick={() => {
                              setDrilldownDrawer({ open: false, title: '', subtitle: '', type: '', items: [] });
                              navigate(`/orders/${item.order_id || item._id}`);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                            title="Open Order Details Page"
                          >
                            <ExternalLink className="w-3 h-3" /> Order
                          </button>
                        )}

                        {item.phone && item.phone !== '—' && (
                          <>
                            <a
                              href={`tel:${item.phone}`}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-xs hover:bg-emerald-100 transition flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3" /> Call
                            </a>
                            <button
                              onClick={() => handleDirectWhatsApp(item.phone, item.name)}
                              className="px-2.5 py-1.5 rounded-xl bg-green-50 text-green-700 font-bold text-xs hover:bg-green-100 transition flex items-center gap-1 cursor-pointer"
                            >
                              <MessageCircle className="w-3 h-3" /> WhatsApp
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => {
                            setDrilldownDrawer({ open: false, title: '', subtitle: '', type: '', items: [] });
                            openBookingModal(item);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" /> Book Re-Order
                        </button>

                        <button
                          onClick={() => {
                            setDrilldownDrawer({ open: false, title: '', subtitle: '', type: '', items: [] });
                            openDoctorModal(item);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm cursor-pointer"
                        >
                          <Stethoscope className="w-3 h-3" /> Doctor Call
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 text-center">
              <button
                onClick={() => setDrilldownDrawer({ open: false, title: '', subtitle: '', type: '', items: [] })}
                className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Book Re-Order (Send to Verification) ───────────── */}
      {bookingModal.open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="bg-gradient-to-r from-emerald-950 to-teal-950 p-6 text-white relative">
              <button
                onClick={() => setBookingModal({ open: false, patient: null, price: '', medicine: '', notes: '', saving: false })}
                className="absolute right-5 top-5 w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 font-bold transition cursor-pointer"
              >
                ✕
              </button>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold mb-2">
                <RotateCcw className="w-3 h-3" /> Next Course Re-Order
              </div>
              <h3 className="text-xl font-black">Book Re-Order for {bookingModal.patient?.name}</h3>
              <p className="text-emerald-200/80 text-xs mt-1">
                Phone: {bookingModal.patient?.phone} · Order: #{bookingModal.patient?.order_id}
              </p>
            </div>

            <form onSubmit={handleConfirmReorder} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-black text-gray-700 uppercase tracking-wider text-[10px] mb-1">
                  Medicine / Kit Description
                </label>
                <input
                  type="text"
                  required
                  value={bookingModal.medicine}
                  onChange={(e) => setBookingModal({ ...bookingModal, medicine: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 bg-gray-50 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block font-black text-gray-700 uppercase tracking-wider text-[10px] mb-1">
                  Re-Order Price (₹)
                </label>
                <input
                  type="number"
                  required
                  value={bookingModal.price}
                  onChange={(e) => setBookingModal({ ...bookingModal, price: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:border-emerald-500 bg-gray-50 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block font-black text-gray-700 uppercase tracking-wider text-[10px] mb-1">
                  Follow-up Notes / Relief Feedback
                </label>
                <textarea
                  rows={3}
                  value={bookingModal.notes}
                  onChange={(e) => setBookingModal({ ...bookingModal, notes: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl p-3 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 bg-gray-50 focus:bg-white transition"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setBookingModal({ open: false, patient: null, price: '', medicine: '', notes: '', saving: false })}
                  className="px-4 py-2 rounded-xl text-gray-500 hover:text-gray-700 font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookingModal.saving}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black transition shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {bookingModal.saving ? 'Sending to Verification...' : 'Confirm & Send to Verification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Book Doctor Consultation (Dynamic Doctors List) ─── */}
      {doctorModal.open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="bg-gradient-to-r from-blue-950 to-indigo-950 p-6 text-white relative">
              <button
                onClick={() => setDoctorModal({ open: false, patient: null, doctorId: '', doctorName: '', date: '', timeSlot: '', problem: '', notes: '', saving: false })}
                className="absolute right-5 top-5 w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 font-bold transition cursor-pointer"
              >
                ✕
              </button>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold mb-2">
                <Stethoscope className="w-3 h-3" /> Doctor Consultation Bridge
              </div>
              <h3 className="text-xl font-black">Schedule Doctor Call for {doctorModal.patient?.name}</h3>
              <p className="text-blue-200/80 text-xs mt-1">
                Direct consultation appointment to adjust treatment dosage and boost patient confidence.
              </p>
            </div>

            <form onSubmit={handleConfirmDoctorBooking} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-gray-700 uppercase tracking-wider text-[10px] mb-1">
                    Appointment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={doctorModal.date}
                    onChange={(e) => setDoctorModal({ ...doctorModal, date: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 bg-gray-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-black text-gray-700 uppercase tracking-wider text-[10px] mb-1">
                    Time Slot
                  </label>
                  <select
                    value={doctorModal.timeSlot}
                    onChange={(e) => setDoctorModal({ ...doctorModal, timeSlot: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 bg-gray-50 focus:bg-white"
                  >
                    <option value="10:00 AM - 11:00 AM">10:00 AM - 11:00 AM</option>
                    <option value="11:00 AM - 12:00 PM">11:00 AM - 12:00 PM</option>
                    <option value="02:00 PM - 03:00 PM">02:00 PM - 03:00 PM</option>
                    <option value="04:00 PM - 05:00 PM">04:00 PM - 05:00 PM</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-black text-gray-700 uppercase tracking-wider text-[10px] mb-1">
                  Select Doctor / Vaidya
                </label>
                <select
                  value={doctorModal.doctorName}
                  onChange={(e) => {
                    const selDoc = (meta.doctors || []).find((d) => d.name === e.target.value);
                    setDoctorModal({
                      ...doctorModal,
                      doctorName: e.target.value,
                      doctorId: selDoc?.id || '',
                    });
                  }}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 bg-gray-50 focus:bg-white font-bold"
                >
                  {(meta.doctors || []).map((doc) => (
                    <option key={doc.id} value={doc.name}>
                      {doc.name} ({doc.specialization || 'Ayurvedic Consultant'})
                    </option>
                  ))}
                  {(!meta.doctors || meta.doctors.length === 0) && (
                    <option value="Dr. Ayurveda Vaidya">Dr. Ayurveda Vaidya (General)</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block font-black text-gray-700 uppercase tracking-wider text-[10px] mb-1">
                  Reason / Chief Complaint
                </label>
                <textarea
                  rows={3}
                  value={doctorModal.notes}
                  onChange={(e) => setDoctorModal({ ...doctorModal, notes: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl p-3 text-xs text-gray-900 bg-gray-50 focus:bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDoctorModal({ open: false, patient: null, doctorId: '', doctorName: '', date: '', timeSlot: '', problem: '', notes: '', saving: false })}
                  className="px-4 py-2 rounded-xl text-gray-500 hover:text-gray-700 font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={doctorModal.saving}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black transition shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {doctorModal.saving ? 'Booking Appointment...' : 'Confirm Doctor Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
