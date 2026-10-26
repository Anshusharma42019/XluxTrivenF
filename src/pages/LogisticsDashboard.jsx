import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchLogisticsStats, saveStaffTarget } from '../services/dashboard.service';
import * as attendanceSvc from '../services/attendance.service';
import {
  sendToVerification as smSendToVerification,
  ndrAction,
  ndrBulkAction,
  trackShipment,
  generateLabel,
  getManifest,
  getWeightDisputes,
  getWeightDisputeHistory,
  acceptWeightDispute,
  rejectWeightDispute,
  syncShipmaxx
} from '../services/shipmaxx.service';
import { sendToVerification as srSendToVerification } from '../services/shiprocket.service';
import {
  Truck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Phone,
  MessageCircle,
  PackageCheck,
  Calendar,
  User,
  RotateCcw,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Search,
  ExternalLink,
  ChevronDown,
  Users,
  LogOut,
  Target,
  BarChart3,
  Box,
  MapPin,
  Send,
  Check,
  X,
  FileText,
  Scale,
  Eye,
  Download,
  CheckSquare,
  Square,
  History,
  UploadCloud,
  FileCheck2
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

export default function LogisticsDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error, info } = useToast();
  const toastInfo = info;

  const isManagement = user?.role === 'admin' || user?.role === 'manager';

  // Filters
  const [preset, setPreset] = useState('today');
  const [courierFilter, setCourierFilter] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Main Data States
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingShipmaxx, setSyncingShipmaxx] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Active Queue Tab
  const [activeQueue, setActiveQueue] = useState('ofd'); // 'ofd' | 'ndr' | 'rto' | 'pickup' | 'team' | 'courier' | 'monthly_rto' | 'disputes'
  const [attemptFilter, setAttemptFilter] = useState('all'); // 'all' | '1' | '2' | '3+'
  const [rtoStageFilter, setRtoStageFilter] = useState('all'); // 'all' | 'in_transit' | 'delivered'
  const [queueSearch, setQueueSearch] = useState('');

  // Pagination (20 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [disputesPage, setDisputesPage] = useState(1);
  const disputesPageSize = 20;

  // Reset pagination on queue tab, attempt filter, stage, or search query change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeQueue, attemptFilter, rtoStageFilter, queueSearch]);

  useEffect(() => {
    setDisputesPage(1);
  }, [activeQueue]);

  // Attendance
  const [attendance, setAttendance] = useState(null);
  const [attLoading, setAttLoading] = useState(false);
  const hasCheckedIn = Boolean(attendance?.checkIn || attendance?.checkInTime);
  const hasCheckedOut = Boolean(attendance?.checkOut || attendance?.checkOutTime);
  const isShiftActive = hasCheckedIn && !hasCheckedOut;
  const liveShiftTime = useLiveTimer(isShiftActive ? (attendance?.checkIn || attendance?.checkInTime) : null);

  // Daily Target
  const [targetInput, setTargetInput] = useState('');
  const [savingTarget, setSavingTarget] = useState(false);
  const [editingTarget, setEditingTarget] = useState(false);

  // Action states
  const [reAttemptingId, setReAttemptingId] = useState(null);

  // ShipMaxx NDR & Bulk Action States
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [ndrModal, setNdrModal] = useState({ open: false, order: null, action: 'reattempt', notes: '', submitting: false });
  const [bulkDockAction, setBulkDockAction] = useState('reattempt');
  const [bulkDockNotes, setBulkDockNotes] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Live Tracking Modal State
  const [trackingModal, setTrackingModal] = useState({ open: false, awb: '', order: null, data: null, loading: false, error: null });

  // Document Downloading
  const [docLoading, setDocLoading] = useState({}); // { [awb]: 'label' | 'manifest' }

  // Weight Disputes Workspace States
  const [disputes, setDisputes] = useState([]);
  const disputesList = useMemo(() => (Array.isArray(disputes) ? disputes : []), [disputes]);
  const [disputesLoading, setDisputesLoading] = useState(false);
  const [disputeStatusFilter, setDisputeStatusFilter] = useState('all');
  const [disputeSearch, setDisputeSearch] = useState('');
  const [disputeHistoryModal, setDisputeHistoryModal] = useState({ open: false, dispute: null, history: [], loading: false });
  const [challengeModal, setChallengeModal] = useState({
    open: false,
    dispute: null,
    length: '',
    breadth: '',
    height: '',
    dead_weight: '',
    images: [],
    video: null,
    submitting: false
  });

  // Load Dashboard Data
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const params = {
        preset,
        from: preset === 'custom' ? customFrom : undefined,
        to: preset === 'custom' ? customTo : undefined,
        courier: courierFilter !== 'all' ? courierFilter : undefined,
        staffId: user?.role === 'logistics' ? user?._id : 'all',
      };

      const [res, attRes] = await Promise.all([
        fetchLogisticsStats(params, true),
        attendanceSvc.getTodayStatus().catch(() => null)
      ]);

      if (res) {
        setStats(res);
        if (res.personalStats?.target && !targetInput) {
          setTargetInput(String(res.personalStats.target));
        }
      }
      setAttendance(attRes || null);
      setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Error fetching logistics dashboard stats:', err);
      if (!isSilent) error('Failed to load logistics dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [preset, customFrom, customTo, courierFilter, user?._id, user?.role, error]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh timer
  useEffect(() => {
    let timer;
    if (autoRefresh) {
      timer = setInterval(() => {
        loadData(true);
      }, 20000); // 20s
    }
    return () => { if (timer) clearInterval(timer); };
  }, [autoRefresh, loadData]);

  // Attendance Clock-in / Clock-out
  const handleCheckIn = async () => {
    setAttLoading(true);
    try {
      const res = await attendanceSvc.checkIn();
      success('Shift started! Checked in successfully.');
      if (res) setAttendance(res);
      await loadData(true);
    } catch (err) {
      error(err.response?.data?.message || 'Check-in failed');
    } finally {
      setAttLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!window.confirm('Are you sure you want to clock out for today?')) return;
    setAttLoading(true);
    try {
      const res = await attendanceSvc.checkOut();
      success('Shift ended! Checked out successfully.');
      if (res) setAttendance(res);
      await loadData(true);
    } catch (err) {
      error(err.response?.data?.message || 'Check-out failed');
    } finally {
      setAttLoading(false);
    }
  };

  // Save Daily Target
  const handleSaveTarget = async (e) => {
    e?.preventDefault();
    const val = parseInt(targetInput, 10);
    if (isNaN(val) || val <= 0) {
      error('Please enter a valid target count');
      return;
    }
    setSavingTarget(true);
    try {
      await saveStaffTarget(val);
      success(`Daily resolution target set to ${val}!`);
      setEditingTarget(false);
      setStats(prev => {
        if (!prev) return prev;
        const totalDone = prev.personalStats?.totalDone || 0;
        const completionPct = val > 0 ? Math.round((totalDone / val) * 100) : 0;
        return {
          ...prev,
          personalStats: {
            ...prev.personalStats,
            target: val,
            completionPct
          }
        };
      });
      await loadData(true);
    } catch (err) {
      error(err.response?.data?.message || 'Failed to save target');
    } finally {
      setSavingTarget(false);
    }
  };

  // Sync fresh orders and tracking directly from ShipMaxx
  const handleSyncShipmaxx = async () => {
    setSyncingShipmaxx(true);
    try {
      info('ShipMaxx se sync start ho gaya hai...');
      await syncShipmaxx();
      success('ShipMaxx sync request initiated! Latest data refresh ho raha hai...');
      setTimeout(() => {
        loadData(true);
        setSyncingShipmaxx(false);
      }, 3000);
    } catch (err) {
      error(err.response?.data?.message || err.message || 'ShipMaxx sync me issue aayi');
      setSyncingShipmaxx(false);
    }
  };

  // Handoff order to Verification
  const handleSendToVerification = async (order) => {
    if (!order?._id && !order?.order_id) return;
    const identifier = order.billing_customer_name || order.name || 'this customer';
    if (!window.confirm(`Are you sure you want to send "${identifier}" (${order.awb_code || order.awb || order.order_id}) back to Verification Team?`)) {
      return;
    }

    const orderId = order._id || order.order_id;
    setReAttemptingId(String(orderId));
    try {
      if (order.platform === 'shiprocket') {
        await srSendToVerification(orderId, { source: 'logistics_dashboard' });
      } else {
        await smSendToVerification(orderId, { source: 'logistics_dashboard' });
      }
      success('Order handed off to Verification team successfully!');
      loadData(true);
    } catch (err) {
      error(err.response?.data?.message || 'Failed to send to verification');
    } finally {
      setReAttemptingId(null);
    }
  };

  // WhatsApp Helpers
  const sendOfdWhatsApp = (phone, name, awb) => {
    const clean = String(phone || '').replace(/\D/g, '').slice(-10);
    if (!clean) return;
    const text = encodeURIComponent(
      `Namaste ${name || 'ji'}, Triven Ayurveda se aapka parcel (AWB: ${awb || 'On Delivery'}) aaj delivery boy ke paas out-for-delivery hai. Kripya apna phone active rakhein aur delivery boy ka OTP/Cash ready rakhein. Dhanyawad!`
    );
    window.open(`https://wa.me/91${clean}?text=${text}`, '_blank');
  };

  const sendNdrWhatsApp = (phone, name, awb, reason) => {
    const clean = String(phone || '').replace(/\D/g, '').slice(-10);
    if (!clean) return;
    const text = encodeURIComponent(
      `Namaste ${name || 'ji'}, Triven Ayurveda se delivery boy ne aapka parcel attempt kiya tha par deliver nahi ho paya (Reason: ${reason || 'Customer Unreachable'}). Kya hum kal parcel ka re-attempt karwayen? Kripya confirm karein.`
    );
    window.open(`https://wa.me/91${clean}?text=${text}`, '_blank');
  };

  const sendRtoWhatsApp = (phone, name, awb, reason) => {
    const clean = String(phone || '').replace(/\D/g, '').slice(-10);
    if (!clean) return;
    const text = encodeURIComponent(
      `Namaste ${name || 'ji'}, Triven Ayurveda se aapka parcel (AWB: ${awb || ''}) return hone ja raha hai (${reason || 'Delivery Attempt Failed'}). Agar aap abhi bhi delivery chahte hain to kripya hume reply karein taaki hum return cancel karke delivery boy ko re-attempt ke liye bhej sakein.`
    );
    window.open(`https://wa.me/91${clean}?text=${text}`, '_blank');
  };

  // ── ShipMaxx ID & Selection Helpers ──────────────────────────
  const getOrderId = (order) => String(order?.shipmaxx_ndr_id || order?.awb_code || order?.order_id || order?._id || '');

  const toggleSelectOrder = (order) => {
    const id = getOrderId(order);
    if (!id) return;
    const exists = selectedOrders.some(o => getOrderId(o) === id);
    if (exists) {
      setSelectedOrders(prev => prev.filter(o => getOrderId(o) !== id));
    } else {
      if (selectedOrders.length >= 10) {
        toastInfo('ShipMaxx bulk API allows maximum 10 NDR records per request.');
        return;
      }
      setSelectedOrders(prev => [...prev, order]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedOrders.length > 0) {
      setSelectedOrders([]);
    } else {
      const activeList = paginatedQueueList || currentQueueList;
      const first10 = activeList.slice(0, 10);
      setSelectedOrders(first10);
      if (activeList.length > 10) {
        toastInfo('Selected first 10 orders on this page (ShipMaxx bulk API limit is 10).');
      }
    }
  };

  const clearSelection = () => {
    setSelectedOrders([]);
  };

  // ── Single NDR Action Submit ─────────────────────────────────
  const handleOpenNdrModal = (order) => {
    setNdrModal({
      open: true,
      order,
      action: 'reattempt',
      notes: '',
      submitting: false
    });
  };

  const handleSingleNdrSubmit = async (e) => {
    e?.preventDefault();
    if (!ndrModal.order) return;
    const ndrId = getOrderId(ndrModal.order);
    setNdrModal(prev => ({ ...prev, submitting: true }));
    try {
      await ndrAction(ndrId, {
        action: ndrModal.action,
        notes: ndrModal.notes
      });
      success(`NDR Action "${ndrModal.action.toUpperCase()}" submitted successfully for AWB ${ndrModal.order.awb_code || ndrId}!`);
      setNdrModal({ open: false, order: null, action: 'reattempt', notes: '', submitting: false });
      loadData(true);
    } catch (err) {
      error(err.response?.data?.message || 'Failed to submit NDR action');
      setNdrModal(prev => ({ ...prev, submitting: false }));
    }
  };

  // ── Bulk NDR Action Submit ───────────────────────────────────
  const handleBulkNdrSubmit = async () => {
    if (selectedOrders.length === 0) return;
    if (selectedOrders.length > 10) {
      error('Maximum 10 NDR records allowed per bulk request.');
      return;
    }
    const ndr_ids = selectedOrders.map(getOrderId);
    setBulkSubmitting(true);
    try {
      await ndrBulkAction({
        ndr_ids,
        action: bulkDockAction,
        notes: bulkDockNotes
      });
      success(`Bulk "${bulkDockAction.toUpperCase()}" submitted successfully for ${ndr_ids.length} orders!`);
      clearSelection();
      setBulkDockNotes('');
      loadData(true);
    } catch (err) {
      error(err.response?.data?.message || 'Failed to submit bulk NDR actions');
    } finally {
      setBulkSubmitting(false);
    }
  };

  // ── Live Tracking Modal ──────────────────────────────────────
  const handleTrackShipment = async (order) => {
    const awb = order?.awb_code || order?.awb;
    if (!awb) {
      error('AWB number is missing for this shipment');
      return;
    }
    setTrackingModal({ open: true, awb, order, data: null, loading: true, error: null });
    try {
      const res = await trackShipment(awb);
      const trackingData = res?.data?.data || res?.data || res;
      setTrackingModal(prev => ({ ...prev, data: trackingData, loading: false }));
    } catch (err) {
      console.error('Tracking fetch error:', err);
      setTrackingModal(prev => ({
        ...prev,
        loading: false,
        error: err.response?.data?.message || 'Could not fetch live tracking checkpoints'
      }));
    }
  };

  // ── Shipping Label & Manifest Downloads ──────────────────────
  const handleDownloadLabel = async (awb) => {
    if (!awb) return;
    setDocLoading(prev => ({ ...prev, [awb]: 'label' }));
    try {
      const res = await generateLabel(awb);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `shipping-label-${awb}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      success(`Label downloaded for AWB ${awb}`);
    } catch (err) {
      console.error('Download label error:', err);
      error(err.response?.data?.message || 'Failed to download shipping label');
    } finally {
      setDocLoading(prev => ({ ...prev, [awb]: null }));
    }
  };

  const handleGetManifest = async (awb) => {
    if (!awb) return;
    setDocLoading(prev => ({ ...prev, [awb]: 'manifest' }));
    try {
      const res = await getManifest(awb);
      const blob = new Blob([res.data], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      success(`Manifest opened for printing AWB ${awb}`);
    } catch (err) {
      console.error('Manifest fetch error:', err);
      error(err.response?.data?.message || 'Failed to generate shipment manifest');
    } finally {
      setDocLoading(prev => ({ ...prev, [awb]: null }));
    }
  };

  // ── Weight Disputes Handlers ─────────────────────────────────
  const loadWeightDisputes = useCallback(async () => {
    setDisputesLoading(true);
    try {
      const params = {};
      if (disputeStatusFilter !== 'all') params.status = parseInt(disputeStatusFilter, 10);
      if (disputeSearch.trim()) params.search = disputeSearch.trim();
      const res = await getWeightDisputes(params);
      let rawList = res?.data?.data?.data || res?.data?.data || res?.data || res;
      if (rawList && typeof rawList === 'object' && !Array.isArray(rawList)) {
        if (Array.isArray(rawList.data)) rawList = rawList.data;
        else if (Array.isArray(rawList.disputes)) rawList = rawList.disputes;
        else if (Array.isArray(rawList.list)) rawList = rawList.list;
      }
      const list = Array.isArray(rawList) ? rawList : [];
      setDisputes(list);
    } catch (err) {
      console.error('Error fetching weight disputes:', err);
      setDisputes([]);
    } finally {
      setDisputesLoading(false);
    }
  }, [disputeStatusFilter, disputeSearch]);

  useEffect(() => {
    if (activeQueue === 'disputes') {
      loadWeightDisputes();
    }
  }, [activeQueue, loadWeightDisputes]);

  const handleAcceptDispute = async (dispute) => {
    const id = dispute?.dispute_id || dispute?.id || dispute?._id;
    const diff = dispute?.extra_charge || dispute?.charged_amount || 0;
    if (!window.confirm(`Accept courier weight charge? Extra amount of ₹${diff} will be immediately deducted from your ShipMaxx wallet. This action CANNOT be reversed.`)) {
      return;
    }
    try {
      await acceptWeightDispute(id);
      success('Weight dispute accepted. Charge deducted from wallet.');
      loadWeightDisputes();
    } catch (err) {
      error(err.response?.data?.message || 'Failed to accept weight dispute');
    }
  };

  const handleOpenDisputeHistory = async (dispute) => {
    const id = dispute?.dispute_id || dispute?.id || dispute?._id;
    setDisputeHistoryModal({ open: true, dispute, history: [], loading: true });
    try {
      const res = await getWeightDisputeHistory(id);
      const events = res?.data?.data || res?.data || (Array.isArray(res) ? res : []);
      setDisputeHistoryModal(prev => ({ ...prev, history: events, loading: false }));
    } catch (err) {
      setDisputeHistoryModal(prev => ({ ...prev, loading: false }));
      error(err.response?.data?.message || 'Failed to load timeline events');
    }
  };

  const handleOpenChallenge = (dispute) => {
    setChallengeModal({
      open: true,
      dispute,
      length: dispute?.entered_length || '',
      breadth: dispute?.entered_breadth || '',
      height: dispute?.entered_height || '',
      dead_weight: dispute?.entered_weight || '',
      images: [],
      video: null,
      submitting: false
    });
  };

  const handleSubmitChallenge = async (e) => {
    e?.preventDefault();
    const { dispute, length, breadth, height, dead_weight, images, video } = challengeModal;
    const id = dispute?.dispute_id || dispute?.id || dispute?._id;

    if (!length || !breadth || !height || !dead_weight) {
      error('Please enter all dimension measurements and dead weight');
      return;
    }
    if (!images || images.length !== 4) {
      error('Exactly 4 proof images (JPEG/PNG/WebP) are required by courier guidelines');
      return;
    }

    setChallengeModal(prev => ({ ...prev, submitting: true }));
    try {
      const formData = new FormData();
      formData.append('length', length);
      formData.append('breadth', breadth);
      formData.append('height', height);
      formData.append('dead_weight', dead_weight);
      images.forEach((file) => {
        formData.append('images', file);
      });
      if (video) {
        formData.append('images', video);
      }

      await rejectWeightDispute(id, formData);
      success('Dispute challenge submitted with proof images for Admin review!');
      setChallengeModal({
        open: false,
        dispute: null,
        length: '',
        breadth: '',
        height: '',
        dead_weight: '',
        images: [],
        video: null,
        submitting: false
      });
      loadWeightDisputes();
    } catch (err) {
      error(err.response?.data?.message || 'Failed to challenge weight dispute');
      setChallengeModal(prev => ({ ...prev, submitting: false }));
    }
  };

  // Extract metrics
  const kpis = stats?.kpis || {};
  const attempts = stats?.attempts || { delivered: {}, active: {}, undelivered: {} };
  const personal = stats?.personalStats || {};
  const queues = stats?.queues || { ofdOrders: [], ndrOrders: [], rtoOrders: [], pickupPendingOrders: [] };
  const leaderboard = stats?.leaderboard || [];
  const courierPerf = stats?.courierPerformance || [];
  const monthlyRto = stats?.monthlyRtoBreakdown || [];

  // Filter current active queue list by search and attempt
  const currentQueueList = useMemo(() => {
    let list = [];
    if (activeQueue === 'ofd') list = queues.ofdOrders || [];
    else if (activeQueue === 'ndr') list = queues.ndrOrders || [];
    else if (activeQueue === 'rto') list = queues.rtoOrders || [];
    else if (activeQueue === 'pickup') list = queues.pickupPendingOrders || [];

    // Filter by attempt
    if (attemptFilter === '1') {
      list = list.filter(o => (o.calculated_attempt || o.delivery_attempt || 1) === 1);
    } else if (attemptFilter === '2') {
      list = list.filter(o => (o.calculated_attempt || o.delivery_attempt || 1) === 2);
    } else if (attemptFilter === '3+') {
      list = list.filter(o => (o.calculated_attempt || o.delivery_attempt || 1) >= 3);
    }

    // Filter RTO by Stage
    if (activeQueue === 'rto') {
      if (rtoStageFilter === 'in_transit') {
        list = list.filter(o => !String(o.status || '').toLowerCase().includes('delivered'));
      } else if (rtoStageFilter === 'delivered') {
        list = list.filter(o => String(o.status || '').toLowerCase().includes('delivered'));
      }
    }

    if (!queueSearch.trim()) return list;
    const s = queueSearch.toLowerCase();
    return list.filter(o =>
      (o.billing_customer_name || '').toLowerCase().includes(s) ||
      (o.billing_phone || '').includes(s) ||
      (o.awb_code || '').toLowerCase().includes(s) ||
      (o.billing_city || '').toLowerCase().includes(s) ||
      (o.courier_name || '').toLowerCase().includes(s) ||
      (o.courier_reason || '').toLowerCase().includes(s)
    );
  }, [activeQueue, queues, queueSearch, attemptFilter, rtoStageFilter]);

  // Paginated Queue Records (20 per page)
  const totalQueueItems = currentQueueList.length;
  const totalQueuePages = Math.ceil(totalQueueItems / pageSize) || 1;
  const paginatedQueueList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return currentQueueList.slice(start, start + pageSize);
  }, [currentQueueList, currentPage, pageSize]);

  // Paginated Disputes (20 per page)
  const totalDisputesItems = disputesList.length;
  const totalDisputesPages = Math.ceil(totalDisputesItems / disputesPageSize) || 1;
  const paginatedDisputes = useMemo(() => {
    const start = (disputesPage - 1) * disputesPageSize;
    return disputesList.slice(start, start + disputesPageSize);
  }, [disputesList, disputesPage, disputesPageSize]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-sm font-bold text-gray-500">Loading Logistics Operations Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-4 lg:p-6 font-['Inter',sans-serif]">
      <div className="max-w-[1500px] mx-auto space-y-6">

        {/* ═══ Header & Shift Banner ═══ */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <Truck size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Logistics Operations Dashboard
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                  {isManagement ? 'Fleet Control' : 'Specialist Desk'}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-1 flex items-center gap-2">
                <span>Real-time OFD confirmations, NDR dispute recovery & RTO prevention</span>
                {lastUpdated && <span className="text-slate-400">· Synced at {lastUpdated}</span>}
              </p>
            </div>
          </div>

          {/* Shift & Attendance Widget */}
          <div className="flex items-center gap-3 flex-wrap bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
            <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Shift Status</span>
              <div className="flex items-center gap-2 mt-0.5">
                <div className={`w-2.5 h-2.5 rounded-full ${isShiftActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                <span className="text-xs font-extrabold text-slate-800">
                  {isShiftActive ? `Active (${liveShiftTime})` : hasCheckedOut ? 'Shift Completed' : 'Not Punched In'}
                </span>
              </div>
            </div>

            {!hasCheckedIn ? (
              <button
                onClick={handleCheckIn}
                disabled={attLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-60"
              >
                <Clock size={14} className={attLoading ? 'animate-spin' : ''} />
                <span>{attLoading ? 'Punching In...' : 'Punch In Shift'}</span>
              </button>
            ) : !hasCheckedOut ? (
              <button
                onClick={handleCheckOut}
                disabled={attLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-60"
              >
                <LogOut size={14} className={attLoading ? 'animate-spin' : ''} />
                <span>{attLoading ? 'Punching Out...' : 'Punch Out'}</span>
              </button>
            ) : null}

            <button
              onClick={handleSyncShipmaxx}
              disabled={syncingShipmaxx}
              title="Sync latest orders and tracking from ShipMaxx"
              className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw size={13} className={syncingShipmaxx ? 'animate-spin' : ''} />
              <span>{syncingShipmaxx ? 'Syncing...' : 'Sync ShipMaxx'}</span>
            </button>

            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              title="Refresh live data"
              className="p-2 bg-white hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition cursor-pointer"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin text-blue-600' : ''} />
            </button>
          </div>
        </div>

        {/* ═══ Filter Bar & Daily Target Strip ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Filters (8 Cols) */}
          <div className="lg:col-span-8 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'last7', label: 'Last 7 Days' },
                { id: 'month', label: 'This Month' },
                { id: 'all', label: 'All Time' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setPreset(f.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    preset === f.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Courier Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">Courier:</span>
              <select
                value={courierFilter}
                onChange={e => setCourierFilter(e.target.value)}
                className="text-xs font-extrabold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">All Couriers</option>
                <option value="Delhivery">Delhivery</option>
                <option value="Bluedart">Bluedart</option>
                <option value="Xpressbees">Xpressbees</option>
                <option value="Shadowfax">Shadowfax</option>
                <option value="DTDC">DTDC</option>
              </select>
            </div>
          </div>

          {/* Daily Resolution Target (4 Cols) */}
          <div className="lg:col-span-4 bg-gradient-to-tr from-slate-900 to-indigo-950 text-white rounded-2xl p-4 border border-slate-800 shadow-xs flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Target size={16} className="text-blue-400" />
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Daily Case Target</span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-white">{personal.totalDone || 0}</span>
                <span className="text-xs font-bold text-slate-400">/ {personal.target || 35} Resolved</span>
                <span className="text-xs font-extrabold text-emerald-400 ml-1">
                  ({personal.completionPct || 0}%)
                </span>
              </div>
            </div>

            {editingTarget ? (
              <form onSubmit={handleSaveTarget} className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={targetInput}
                  onChange={e => setTargetInput(e.target.value)}
                  className="w-16 px-2 py-1 text-xs bg-slate-800 border border-slate-600 rounded text-white font-bold"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={savingTarget}
                  title="Save Target"
                  className="p-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded text-white cursor-pointer transition flex items-center justify-center disabled:opacity-50"
                >
                  <Check size={14} className={savingTarget ? 'animate-spin' : ''} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTarget(false)}
                  title="Cancel"
                  className="p-1.5 bg-slate-700 hover:bg-slate-600 active:scale-95 rounded text-slate-300 hover:text-white cursor-pointer transition flex items-center justify-center"
                >
                  <X size={14} />
                </button>
              </form>
            ) : (
              <button
                onClick={() => setEditingTarget(true)}
                className="text-[11px] font-bold text-blue-300 hover:text-white underline underline-offset-4 cursor-pointer"
              >
                Edit Target
              </button>
            )}
          </div>
        </div>

        {/* ═══ 6 Main Logistics KPI Cards ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* 1. Out For Delivery (OFD) */}
          <div
            onClick={() => setActiveQueue('ofd')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
              activeQueue === 'ofd'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                : 'bg-white border-slate-200/80 hover:border-blue-300 hover:shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] font-black uppercase tracking-wider ${activeQueue === 'ofd' ? 'text-blue-100' : 'text-slate-400'}`}>
                Today's OFD
              </span>
              <Truck size={16} className={activeQueue === 'ofd' ? 'text-white' : 'text-blue-600'} />
            </div>
            <p className="text-3xl font-black tracking-tight">{kpis.ofd ?? 0}</p>
            <p className={`text-[11px] font-semibold mt-1 ${activeQueue === 'ofd' ? 'text-blue-100' : 'text-slate-500'}`}>
              Active on delivery bikes
            </p>
          </div>

          {/* 2. Live NDR Queue */}
          <div
            onClick={() => setActiveQueue('ndr')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
              activeQueue === 'ndr'
                ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                : 'bg-white border-slate-200/80 hover:border-amber-300 hover:shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] font-black uppercase tracking-wider ${activeQueue === 'ndr' ? 'text-amber-100' : 'text-slate-400'}`}>
                Undelivered (NDR)
              </span>
              <AlertTriangle size={16} className={activeQueue === 'ndr' ? 'text-white' : 'text-amber-600'} />
            </div>
            <p className="text-3xl font-black tracking-tight">{kpis.ndr ?? 0}</p>
            <p className={`text-[11px] font-semibold mt-1 ${activeQueue === 'ndr' ? 'text-amber-100' : 'text-slate-500'}`}>
              Pending dispute calls
            </p>
          </div>

          {/* 3. Critical RTO Risk & Percentage */}
          <div
            onClick={() => setActiveQueue('rto')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
              activeQueue === 'rto'
                ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20'
                : 'bg-white border-slate-200/80 hover:border-rose-300 hover:shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[10px] font-black uppercase tracking-wider ${activeQueue === 'rto' ? 'text-rose-100' : 'text-slate-400'}`}>
                RTO Analytics
              </span>
              <ShieldAlert size={16} className={activeQueue === 'rto' ? 'text-white' : 'text-rose-600'} />
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-black tracking-tight">{kpis.rto ?? 0}</p>
              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${activeQueue === 'rto' ? 'bg-rose-700 text-white' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                {kpis.rtoBreakdown?.rtoRate ?? kpis.rtoRate ?? 0}% Rate
              </span>
            </div>
            
            {/* RTO In-Transit vs Delivered Breakdown Percentages */}
            <div className="mt-2 pt-2 border-t border-slate-100/30 flex items-center justify-between gap-1 text-[10px] font-bold flex-wrap">
              <span className={activeQueue === 'rto' ? 'text-rose-100' : 'text-amber-700'} title="Return In-Transit">
                🚚 In-Transit: <b className="font-extrabold">{kpis.rtoBreakdown?.inTransitPct ?? 100}%</b> ({kpis.rtoBreakdown?.inTransit ?? kpis.rto ?? 0})
              </span>
              <span className={activeQueue === 'rto' ? 'text-rose-100' : 'text-slate-600'} title="Delivered to Warehouse">
                📦 Delv: <b className="font-extrabold">{kpis.rtoBreakdown?.deliveredPct ?? 0}%</b> ({kpis.rtoBreakdown?.delivered ?? 0})
              </span>
            </div>
          </div>

          {/* 4. Delivered (Period) */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Delivered
              </span>
              <PackageCheck size={16} className="text-emerald-600" />
            </div>
            <p className="text-3xl font-black text-slate-900 tracking-tight">{kpis.delivered ?? 0}</p>
            <p className="text-[11px] font-semibold text-emerald-600 mt-1">
              {kpis.deliveryRate ?? 0}% Delivery Rate
            </p>
          </div>

          {/* 5. Pickup Breach (> 24 hrs) */}
          <div
            onClick={() => setActiveQueue('pickup')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
              activeQueue === 'pickup'
                ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20'
                : 'bg-white border-slate-200/80 hover:border-purple-300 hover:shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] font-black uppercase tracking-wider ${activeQueue === 'pickup' ? 'text-purple-100' : 'text-slate-400'}`}>
                Pickup Pending
              </span>
              <Box size={16} className={activeQueue === 'pickup' ? 'text-white' : 'text-purple-600'} />
            </div>
            <p className="text-3xl font-black tracking-tight">{kpis.pickupPending ?? 0}</p>
            <p className={`text-[11px] font-semibold mt-1 ${activeQueue === 'pickup' ? 'text-purple-100' : 'text-slate-500'}`}>
              Pending courier pickup
            </p>
          </div>

          {/* 6. Turnaround Time (TAT) */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Avg Delivery TAT
              </span>
              <Clock size={16} className="text-indigo-600" />
            </div>
            <p className="text-3xl font-black text-slate-900 tracking-tight">{kpis.avgTat ?? '3.2'}d</p>
            <p className="text-[11px] font-semibold text-indigo-600 mt-1">
              FADR: {kpis.fadr ?? 0}% 1st Attempt
            </p>
          </div>
        </div>

        {/* ═══ Delivery Attempt Breakdown (1st, 2nd, 3rd+ Attempt) ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Card 1: Undelivered (NDR) Attempt Breakdown */}
          <div className="bg-white rounded-2xl p-5 border border-amber-200/90 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-black">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Undelivered (NDR) by Attempt</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Failed delivery breakdown needing customer resolution</p>
                </div>
              </div>
              <span className="text-xs font-black text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                {attempts.undelivered?.total || 0} Undelivered
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {/* 1st Attempt Undelivered */}
              <div
                onClick={() => {
                  setActiveQueue('ndr');
                  setAttemptFilter(attemptFilter === '1' && activeQueue === 'ndr' ? 'all' : '1');
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  activeQueue === 'ndr' && attemptFilter === '1'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                    : 'bg-amber-50/50 hover:bg-amber-100/70 border-amber-200/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${activeQueue === 'ndr' && attemptFilter === '1' ? 'text-amber-100' : 'text-amber-800'}`}>
                      1st Attempt
                    </span>
                    <span className={`text-xs font-black ${activeQueue === 'ndr' && attemptFilter === '1' ? 'text-white' : 'text-amber-700'}`}>
                      {attempts.undelivered?.attempt1Rate || 0}%
                    </span>
                  </div>
                  <p className={`text-2xl font-black mt-1 ${activeQueue === 'ndr' && attemptFilter === '1' ? 'text-white' : 'text-amber-950'}`}>
                    {attempts.undelivered?.attempt1 || 0}
                  </p>
                </div>
                <div className="mt-2">
                  <span className={`text-[9px] font-bold block ${activeQueue === 'ndr' && attemptFilter === '1' ? 'text-amber-100' : 'text-amber-700'}`}>
                    {activeQueue === 'ndr' && attemptFilter === '1' ? '✓ Filter Active' : 'Click to view'}
                  </span>
                </div>
              </div>

              {/* 2nd Attempt Undelivered */}
              <div
                onClick={() => {
                  setActiveQueue('ndr');
                  setAttemptFilter(attemptFilter === '2' && activeQueue === 'ndr' ? 'all' : '2');
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  activeQueue === 'ndr' && attemptFilter === '2'
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : 'bg-orange-50/50 hover:bg-orange-100/70 border-orange-200/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${activeQueue === 'ndr' && attemptFilter === '2' ? 'text-orange-100' : 'text-orange-800'}`}>
                      2nd Attempt
                    </span>
                    <span className={`text-xs font-black ${activeQueue === 'ndr' && attemptFilter === '2' ? 'text-white' : 'text-orange-700'}`}>
                      {attempts.undelivered?.attempt2Rate || 0}%
                    </span>
                  </div>
                  <p className={`text-2xl font-black mt-1 ${activeQueue === 'ndr' && attemptFilter === '2' ? 'text-white' : 'text-orange-950'}`}>
                    {attempts.undelivered?.attempt2 || 0}
                  </p>
                </div>
                <div className="mt-2">
                  <span className={`text-[9px] font-bold block ${activeQueue === 'ndr' && attemptFilter === '2' ? 'text-orange-100' : 'text-orange-700'}`}>
                    {activeQueue === 'ndr' && attemptFilter === '2' ? '✓ Filter Active' : 'Click to view'}
                  </span>
                </div>
              </div>

              {/* 3rd Attempt Undelivered */}
              <div
                onClick={() => {
                  setActiveQueue('ndr');
                  setAttemptFilter(attemptFilter === '3+' && activeQueue === 'ndr' ? 'all' : '3+');
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  activeQueue === 'ndr' && attemptFilter === '3+'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                    : 'bg-rose-50/50 hover:bg-rose-100/70 border-rose-200/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${activeQueue === 'ndr' && attemptFilter === '3+' ? 'text-rose-100' : 'text-rose-800'}`}>
                      3rd+ Attempt
                    </span>
                    <span className={`text-xs font-black ${activeQueue === 'ndr' && attemptFilter === '3+' ? 'text-white' : 'text-rose-700'}`}>
                      {attempts.undelivered?.attempt3PlusRate || 0}%
                    </span>
                  </div>
                  <p className={`text-2xl font-black mt-1 ${activeQueue === 'ndr' && attemptFilter === '3+' ? 'text-white' : 'text-rose-950'}`}>
                    {attempts.undelivered?.attempt3Plus || 0}
                  </p>
                </div>
                <div className="mt-2">
                  <span className={`text-[9px] font-bold block ${activeQueue === 'ndr' && attemptFilter === '3+' ? 'text-rose-100' : 'text-rose-700'}`}>
                    {activeQueue === 'ndr' && attemptFilter === '3+' ? '✓ Filter Active' : 'Imminent RTO!'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Live Active Cases by Attempt */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                  <Truck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Live Active Orders Attempt Stage</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Click to filter queue orders directly below</p>
                </div>
              </div>
              <span className="text-xs font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                {attempts.active?.total || 0} Active Deliveries
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {/* Attempt 1 */}
              <div
                onClick={() => setAttemptFilter(attemptFilter === '1' ? 'all' : '1')}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  attemptFilter === '1' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-50/80 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${attemptFilter === '1' ? 'text-blue-100' : 'text-slate-500'}`}>1st Attempt</span>
                    <span className={`text-xs font-black ${attemptFilter === '1' ? 'text-white' : 'text-blue-600'}`}>{attempts.active?.attempt1Rate || 0}%</span>
                  </div>
                  <p className={`text-2xl font-black mt-1 ${attemptFilter === '1' ? 'text-white' : 'text-slate-900'}`}>{attempts.active?.attempt1 || 0}</p>
                </div>
                <span className={`text-[9px] font-bold mt-2 ${attemptFilter === '1' ? 'text-blue-200' : 'text-slate-400'}`}>
                  {attemptFilter === '1' ? '✓ Filter Active' : 'Click to filter'}
                </span>
              </div>

              {/* Attempt 2 */}
              <div
                onClick={() => setAttemptFilter(attemptFilter === '2' ? 'all' : '2')}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  attemptFilter === '2' ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-slate-50/80 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${attemptFilter === '2' ? 'text-amber-100' : 'text-slate-500'}`}>2nd Attempt</span>
                    <span className={`text-xs font-black ${attemptFilter === '2' ? 'text-white' : 'text-amber-600'}`}>{attempts.active?.attempt2Rate || 0}%</span>
                  </div>
                  <p className={`text-2xl font-black mt-1 ${attemptFilter === '2' ? 'text-white' : 'text-slate-900'}`}>{attempts.active?.attempt2 || 0}</p>
                </div>
                <span className={`text-[9px] font-bold mt-2 ${attemptFilter === '2' ? 'text-amber-200' : 'text-slate-400'}`}>
                  {attemptFilter === '2' ? '✓ Filter Active' : 'Click to filter'}
                </span>
              </div>

              {/* Attempt 3+ */}
              <div
                onClick={() => setAttemptFilter(attemptFilter === '3+' ? 'all' : '3+')}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  attemptFilter === '3+' ? 'bg-rose-600 text-white border-rose-600 shadow-sm' : 'bg-rose-50/50 hover:bg-rose-100/70 border-rose-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${attemptFilter === '3+' ? 'text-rose-100' : 'text-rose-700'}`}>3rd+ (Critical)</span>
                    <span className={`text-xs font-black ${attemptFilter === '3+' ? 'text-white' : 'text-rose-600'}`}>{attempts.active?.attempt3PlusRate || 0}%</span>
                  </div>
                  <p className={`text-2xl font-black mt-1 ${attemptFilter === '3+' ? 'text-white' : 'text-rose-900'}`}>{attempts.active?.attempt3Plus || 0}</p>
                </div>
                <span className={`text-[9px] font-bold mt-2 ${attemptFilter === '3+' ? 'text-rose-200' : 'text-rose-500'}`}>
                  {attemptFilter === '3+' ? '✓ Filter Active' : 'Click to filter'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Delivered Orders by Attempt */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Delivered Orders Attempt Distribution</h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {attempts.delivered?.isBaseline
                      ? `Fleet Delivery Benchmark (FADR ${attempts.delivered?.attempt1Rate || 95}%)`
                      : 'Successful delivery breakdown by attempt sequence'}
                  </p>
                </div>
              </div>
              <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                {attempts.delivered?.total || 0} Delivered
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {/* 1st Attempt */}
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">1st Attempt (FADR)</span>
                    <span className="text-xs font-black text-emerald-700">{attempts.delivered?.attempt1Rate || 0}%</span>
                  </div>
                  <p className="text-2xl font-black text-emerald-900 mt-1">{attempts.delivered?.attempt1 || 0}</p>
                </div>
                <div className="w-full h-1.5 bg-emerald-200/60 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${attempts.delivered?.attempt1Rate || 0}%` }} />
                </div>
              </div>

              {/* 2nd Attempt */}
              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-800">2nd Attempt</span>
                    <span className="text-xs font-black text-blue-700">{attempts.delivered?.attempt2Rate || 0}%</span>
                  </div>
                  <p className="text-2xl font-black text-blue-900 mt-1">{attempts.delivered?.attempt2 || 0}</p>
                </div>
                <div className="w-full h-1.5 bg-blue-200/60 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${attempts.delivered?.attempt2Rate || 0}%` }} />
                </div>
              </div>

              {/* 3rd+ Attempt */}
              <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-200/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-800">3rd+ Attempt</span>
                    <span className="text-xs font-black text-purple-700">{attempts.delivered?.attempt3PlusRate || 0}%</span>
                  </div>
                  <p className="text-2xl font-black text-purple-900 mt-1">{attempts.delivered?.attempt3Plus || 0}</p>
                </div>
                <div className="w-full h-1.5 bg-purple-200/60 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-purple-600 rounded-full" style={{ width: `${attempts.delivered?.attempt3PlusRate || 0}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Action Queues & Workspace Strip ═══ */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Queue Tab Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3 bg-slate-50/50">
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                onClick={() => setActiveQueue('ofd')}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer ${
                  activeQueue === 'ofd'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                <Truck size={14} />
                <span>OFD Confirmations</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${activeQueue === 'ofd' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {kpis.ofd ?? queues.ofdOrders?.length ?? 0}
                </span>
              </button>

              <button
                onClick={() => setActiveQueue('ndr')}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer ${
                  activeQueue === 'ndr'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                <AlertTriangle size={14} />
                <span>NDR Dispute Cases</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${activeQueue === 'ndr' ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {kpis.ndr ?? queues.ndrOrders?.length ?? 0}
                </span>
              </button>

              <button
                onClick={() => setActiveQueue('rto')}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer ${
                  activeQueue === 'rto'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                <ShieldAlert size={14} />
                <span>RTO Protection</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${activeQueue === 'rto' ? 'bg-rose-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {kpis.rto ?? queues.rtoOrders?.length ?? 0}
                </span>
              </button>

              <button
                onClick={() => setActiveQueue('pickup')}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer ${
                  activeQueue === 'pickup'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                <Box size={14} />
                <span>Pickup Breach</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${activeQueue === 'pickup' ? 'bg-purple-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {kpis.pickupPending ?? queues.pickupPendingOrders?.length ?? 0}
                </span>
              </button>

              <button
                onClick={() => setActiveQueue('team')}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer ${
                  activeQueue === 'team'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                <Users size={14} />
                <span>Team Leaderboard</span>
              </button>

              <button
                onClick={() => setActiveQueue('courier')}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer ${
                  activeQueue === 'courier'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                <BarChart3 size={14} />
                <span>Courier Radar</span>
              </button>

              <button
                onClick={() => setActiveQueue('monthly_rto')}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer ${
                  activeQueue === 'monthly_rto'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                <RotateCcw size={14} />
                <span>Monthly RTO Matrix</span>
              </button>

              <button
                onClick={() => setActiveQueue('disputes')}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer ${
                  activeQueue === 'disputes'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                <Scale size={14} />
                <span>Weight Disputes</span>
                {disputesList.length > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${activeQueue === 'disputes' ? 'bg-rose-900 text-white' : 'bg-rose-100 text-rose-700'}`}>
                    {disputesList.length}
                  </span>
                )}
              </button>
            </div>

            {/* Attempt Filter Pills + Search Box */}
            {['ofd', 'ndr', 'rto', 'pickup'].includes(activeQueue) && (
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  {(() => {
                    const getOrderAttempt = (o) => Number(o.calculated_attempt || o.delivery_attempt || 1);
                    const currentList = activeQueue === 'ndr'
                      ? (queues.ndrOrders || [])
                      : activeQueue === 'ofd'
                        ? (queues.ofdOrders || [])
                        : activeQueue === 'rto'
                          ? (queues.rtoOrders || [])
                          : (queues.pickupPendingOrders || []);

                    const a1 = currentList.filter(o => getOrderAttempt(o) === 1).length;
                    const a2 = currentList.filter(o => getOrderAttempt(o) === 2).length;
                    const a3 = currentList.filter(o => getOrderAttempt(o) >= 3).length;
                    const totalQ = currentList.length;

                    const labelPrefix = activeQueue === 'ndr' ? 'NDR' : activeQueue === 'ofd' ? 'OFD' : activeQueue === 'rto' ? 'RTO' : 'Pickup';

                    const pills = [
                      { id: 'all', label: `All ${labelPrefix} (${totalQ})` },
                      { id: '1', label: `1st Attempt (${a1})` },
                      { id: '2', label: `2nd Attempt (${a2})` },
                      { id: '3+', label: activeQueue === 'ndr' ? `3rd+ Imminent (${a3})` : `3rd+ Attempt (${a3})` },
                    ];

                    return pills.map(af => (
                      <button
                        key={af.id}
                        onClick={() => setAttemptFilter(af.id)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                          attemptFilter === af.id
                            ? af.id === '3+'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : af.id === '2'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {af.label}
                      </button>
                    ));
                  })()}
                </div>

                {activeQueue === 'rto' && (
                  <div className="flex items-center gap-1 bg-rose-50/80 p-1 rounded-xl border border-rose-200">
                    {[
                      { id: 'all', label: `All Stages (${queues.rtoOrders?.length || 0})` },
                      { id: 'in_transit', label: `🚚 In-Transit (${kpis.rtoBreakdown?.inTransitPct ?? 0}%)` },
                      { id: 'delivered', label: `📦 Delivered Back (${kpis.rtoBreakdown?.deliveredPct ?? 0}%)` },
                    ].map(sf => (
                      <button
                        key={sf.id}
                        onClick={() => setRtoStageFilter(sf.id)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                          rtoStageFilter === sf.id
                            ? 'bg-rose-700 text-white shadow-xs'
                            : 'text-rose-800 hover:bg-rose-100'
                        }`}
                      >
                        {sf.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="relative min-w-[220px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search customer, phone, AWB..."
                    value={queueSearch}
                    onChange={e => setQueueSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-semibold"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Queue Content */}
          <div className="p-4">
            {/* 1. Orders Queue Table (OFD, NDR, RTO, Pickup) */}
            {['ofd', 'ndr', 'rto', 'pickup'].includes(activeQueue) && (
              <div className="overflow-x-auto">
                {currentQueueList.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2 opacity-80" />
                    <p className="text-sm font-bold text-slate-700">All caught up!</p>
                    <p className="text-xs text-slate-400 mt-0.5">No orders found in this queue right now.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-black uppercase tracking-wider text-[10px]">
                        <th className="pb-3 px-3 w-8">
                          <button
                            type="button"
                            onClick={toggleSelectAll}
                            title="Select up to 10 orders for Bulk Action"
                            className="cursor-pointer text-slate-400 hover:text-blue-600 transition flex items-center"
                          >
                            {selectedOrders.length > 0 ? (
                              <CheckSquare size={16} className="text-blue-600" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        </th>
                        <th className="pb-3 px-3">Order / Patient</th>
                        <th className="pb-3 px-3">Courier & AWB</th>
                        <th className="pb-3 px-3">Location</th>
                        <th className="pb-3 px-3">Attempt / Reason</th>
                        <th className="pb-3 px-3">Latest Status & Timeline</th>
                        <th className="pb-3 px-3">Amount</th>
                        <th className="pb-3 px-3 text-right">Quick Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {paginatedQueueList.map((o) => {
                        const cleanPhone = String(o.billing_phone || '').replace(/\D/g, '').slice(-10);
                        const isWorkingOnIt = reAttemptingId === String(o._id || o.order_id);
                        const isSelected = selectedOrders.some(so => getOrderId(so) === getOrderId(o));

                        return (
                          <tr key={o._id || o.order_id} className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                            {/* Checkbox Selection */}
                            <td className="py-3 px-3">
                              <button
                                type="button"
                                onClick={() => toggleSelectOrder(o)}
                                className="cursor-pointer transition flex items-center"
                              >
                                {isSelected ? (
                                  <CheckSquare size={16} className="text-blue-600" />
                                ) : (
                                  <Square size={16} className="text-slate-300 hover:text-slate-500" />
                                )}
                              </button>
                            </td>

                            {/* Patient Info */}
                            <td className="py-3 px-3">
                              <div className="font-extrabold text-slate-900">{o.billing_customer_name || 'Customer'}</div>
                              <div className="text-[11px] text-slate-500 font-semibold mt-0.5 flex items-center gap-1.5">
                                <a href={`tel:+91${cleanPhone}`} className="hover:text-blue-600 flex items-center gap-1">
                                  <Phone size={11} className="text-blue-500" />
                                  <span>{cleanPhone}</span>
                                </a>
                              </div>
                              {o.createdAt && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Booked: {new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                </div>
                              )}
                            </td>

                            {/* Courier & AWB */}
                            <td className="py-3 px-3">
                              <span className="font-bold text-slate-800">
                                {o.courier_name && o.courier_name !== 'Courier'
                                  ? o.courier_name
                                  : (o.awb_code?.startsWith('SF') ? 'Shadowfax' : o.awb_code?.startsWith('779') ? 'Delhivery' : o.awb_code?.startsWith('770') ? 'Bluedart' : 'Delhivery')}
                              </span>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">{o.awb_code || o.order_id || '—'}</div>
                            </td>

                            {/* Location */}
                            <td className="py-3 px-3">
                              <div className="font-semibold text-slate-700 flex items-center gap-1">
                                <MapPin size={11} className="text-slate-400" />
                                <span>{o.billing_city && o.billing_city.toLowerCase() !== 'india' ? o.billing_city : (o.billing_state || 'New Delhi, India')}</span>
                              </div>
                              <div className="text-[10px] text-slate-400">{o.billing_state || ''}</div>
                            </td>

                            {/* Status & Attempt */}
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {activeQueue === 'rto' && (
                                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-extrabold border flex items-center gap-1 ${
                                    o.is_live_rescue || o.rto_stage === 'RTO In-Transit'
                                      ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                                      : o.rto_stage === 'RTO Initiated'
                                      ? 'bg-purple-100 text-purple-800 border-purple-300'
                                      : 'bg-slate-100 text-slate-700 border-slate-300'
                                  }`}>
                                    <ShieldAlert size={10} />
                                    <span>{o.rto_stage || 'RTO'}</span>
                                  </span>
                                )}
                                {(() => {
                                  const att = o.calculated_attempt || o.delivery_attempt || 1;
                                  return (
                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider border ${
                                      att >= 3
                                        ? 'bg-rose-100 text-rose-800 border-rose-300 font-black shadow-2xs'
                                        : att === 2
                                        ? 'bg-amber-100 text-amber-800 border-amber-300 font-extrabold'
                                        : 'bg-blue-50 text-blue-700 border-blue-200 font-bold'
                                    }`}>
                                      {att >= 3 ? `3rd+ Attempt (Critical)` : att === 2 ? `2nd Attempt` : `1st Attempt`}
                                    </span>
                                  );
                                })()}
                              </div>
                              {o.courier_reason && (
                                <p className={`text-[11px] font-semibold mt-1 max-w-xs truncate ${activeQueue === 'rto' ? 'text-rose-700 font-bold' : 'text-amber-700'}`} title={o.courier_reason}>
                                  {o.courier_reason}
                                </p>
                              )}
                            </td>

                            {/* Latest Status & Timeline (Date & Time) */}
                            <td className="py-3 px-3">
                              {(() => {
                                const rawDate = o.latest_status_date || o.status_updated_at || o.updatedAt || o.updated_at || o.createdAt;
                                if (!rawDate) return <span className="text-slate-400 text-[11px] font-semibold">—</span>;
                                const d = new Date(rawDate);
                                if (isNaN(d.getTime())) return <span className="text-slate-400 text-[11px] font-semibold">—</span>;

                                const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                                const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

                                const diffMs = Math.max(0, Date.now() - d.getTime());
                                const diffMins = Math.floor(diffMs / (1000 * 60));
                                const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                                const isToday = new Date().toDateString() === d.toDateString();
                                const relTime = diffMins < 60 ? `${diffMins}m ago` : diffHours < 24 ? `${diffHours}h ago` : dateStr;

                                let statusLabel = o.status_event_label || 'Status Updated';
                                let labelClass = 'bg-slate-100 text-slate-700 border-slate-200';

                                if (activeQueue === 'ofd') {
                                  statusLabel = 'OFD Dispatch';
                                  labelClass = 'bg-blue-100 text-blue-800 border-blue-200';
                                } else if (activeQueue === 'ndr') {
                                  statusLabel = 'Attempt Failed';
                                  labelClass = 'bg-amber-100 text-amber-800 border-amber-200';
                                } else if (activeQueue === 'rto') {
                                  statusLabel = 'RTO Event';
                                  labelClass = 'bg-rose-100 text-rose-800 border-rose-200';
                                } else if (activeQueue === 'pickup') {
                                  statusLabel = 'Manifested';
                                  labelClass = 'bg-purple-100 text-purple-800 border-purple-200';
                                }

                                return (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-wider border ${labelClass}`}>
                                        {statusLabel}
                                      </span>
                                      <span className="text-[10px] font-bold text-slate-400">
                                        {isToday ? `Today (${relTime})` : relTime}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[11px] font-black text-slate-800">
                                      <Clock size={11} className="text-slate-400 shrink-0" />
                                      <span>{dateStr}, {timeStr}</span>
                                    </div>
                                  </div>
                                );
                              })()}
                            </td>

                            {/* Amount */}
                            <td className="py-3 px-3 font-extrabold text-slate-900">
                              ₹{(o.sub_total || 0).toLocaleString('en-IN')}
                            </td>

                            {/* Quick Actions */}
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                {/* Track Shipment */}
                                {o.awb_code && (
                                  <button
                                    onClick={() => handleTrackShipment(o)}
                                    title="Live Courier Tracking Timeline"
                                    className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition cursor-pointer"
                                  >
                                    <Eye size={14} />
                                  </button>
                                )}

                                {/* Download Label */}
                                {o.awb_code && (
                                  <button
                                    onClick={() => handleDownloadLabel(o.awb_code)}
                                    disabled={docLoading[o.awb_code] === 'label'}
                                    title="Download PDF Shipping Label"
                                    className="p-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg border border-sky-200 transition cursor-pointer disabled:opacity-50"
                                  >
                                    {docLoading[o.awb_code] === 'label' ? (
                                      <RefreshCw size={14} className="animate-spin" />
                                    ) : (
                                      <Download size={14} />
                                    )}
                                  </button>
                                )}

                                {/* Manifest */}
                                {o.awb_code && (
                                  <button
                                    onClick={() => handleGetManifest(o.awb_code)}
                                    disabled={docLoading[o.awb_code] === 'manifest'}
                                    title="Print Manifest"
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition cursor-pointer disabled:opacity-50"
                                  >
                                    {docLoading[o.awb_code] === 'manifest' ? (
                                      <RefreshCw size={14} className="animate-spin" />
                                    ) : (
                                      <FileCheck2 size={14} />
                                    )}
                                  </button>
                                )}

                                {/* Single NDR Action Modal Trigger */}
                                {['ndr', 'rto'].includes(activeQueue) && (
                                  <button
                                    onClick={() => handleOpenNdrModal(o)}
                                    title="ShipMaxx Courier NDR Action"
                                    className="px-2 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition cursor-pointer shadow-xs"
                                  >
                                    <Sparkles size={12} />
                                    <span>Action</span>
                                  </button>
                                )}

                                {/* WhatsApp Alert */}
                                <button
                                  onClick={() => {
                                    if (activeQueue === 'ofd') {
                                      sendOfdWhatsApp(cleanPhone, o.billing_customer_name, o.awb_code);
                                    } else if (activeQueue === 'rto') {
                                      sendRtoWhatsApp(cleanPhone, o.billing_customer_name, o.awb_code, o.courier_reason);
                                    } else {
                                      sendNdrWhatsApp(cleanPhone, o.billing_customer_name, o.awb_code, o.courier_reason);
                                    }
                                  }}
                                  title="Send WhatsApp Alert"
                                  className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 transition cursor-pointer"
                                >
                                  <MessageCircle size={14} />
                                </button>

                                {/* Direct Call link */}
                                <a
                                  href={`tel:+91${cleanPhone}`}
                                  title="Direct Call"
                                  className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition cursor-pointer"
                                >
                                  <Phone size={14} />
                                </a>

                                {/* Send to Verification (for NDR/RTO cases) */}
                                {['ndr', 'rto'].includes(activeQueue) && (
                                  <button
                                    onClick={() => handleSendToVerification(o)}
                                    disabled={isWorkingOnIt}
                                    title="Send back to Verification team"
                                    className="px-2 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg border border-purple-200 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                                  >
                                    <RotateCcw size={12} />
                                    <span>Handoff</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {/* ── Pagination Bar for Queue Table (20 items per page) ── */}
                {totalQueueItems > 0 && (
                  <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 bg-white mt-2 flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-slate-500 font-medium">
                        Showing <span className="font-extrabold text-slate-900">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                        <span className="font-extrabold text-slate-900">{Math.min(currentPage * pageSize, totalQueueItems)}</span> of{' '}
                        <span className="font-extrabold text-slate-900">{totalQueueItems}</span> orders
                      </p>
                      <span className="text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                        20 Per Page
                      </span>
                    </div>

                    {totalQueuePages > 1 && (
                      <div className="flex items-center gap-1">
                        <button
                          disabled={currentPage === 1}
                          onClick={() => {
                            setCurrentPage(1);
                            window.scrollTo({ top: 500, behavior: 'smooth' });
                          }}
                          title="First Page"
                          className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          «
                        </button>
                        <button
                          disabled={currentPage === 1}
                          onClick={() => {
                            setCurrentPage(prev => Math.max(prev - 1, 1));
                            window.scrollTo({ top: 500, behavior: 'smooth' });
                          }}
                          title="Previous Page"
                          className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          ‹ Prev
                        </button>

                        <div className="flex items-center gap-1 mx-1">
                          {Array.from({ length: Math.min(5, totalQueuePages) }, (_, i) => {
                            let pageNum = currentPage - 2 + i;
                            if (currentPage <= 2) pageNum = i + 1;
                            if (currentPage >= totalQueuePages - 1) pageNum = totalQueuePages - 4 + i;
                            pageNum = Math.max(1, Math.min(pageNum, totalQueuePages));
                            if (pageNum < 1 || pageNum > totalQueuePages) return null;
                            const isPageActive = currentPage === pageNum;

                            return (
                              <button
                                key={pageNum}
                                onClick={() => {
                                  setCurrentPage(pageNum);
                                  window.scrollTo({ top: 500, behavior: 'smooth' });
                                }}
                                className={`w-8 h-8 text-xs font-black rounded-lg transition flex items-center justify-center cursor-pointer ${
                                  isPageActive
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                        </div>

                        <button
                          disabled={currentPage === totalQueuePages}
                          onClick={() => {
                            setCurrentPage(prev => Math.min(prev + 1, totalQueuePages));
                            window.scrollTo({ top: 500, behavior: 'smooth' });
                          }}
                          title="Next Page"
                          className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          Next ›
                        </button>
                        <button
                          disabled={currentPage === totalQueuePages}
                          onClick={() => {
                            setCurrentPage(totalQueuePages);
                            window.scrollTo({ top: 500, behavior: 'smooth' });
                          }}
                          title="Last Page"
                          className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          »
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 2. Team Leaderboard Tab */}
            {activeQueue === 'team' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-extrabold text-slate-800">
                    Logistics Department Performance & Live Leaderboard
                  </h3>
                  <span className="text-xs text-slate-400 font-semibold">Today's Live Tallies</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-black uppercase tracking-wider text-[10px]">
                        <th className="pb-3 px-3">Rank / Specialist</th>
                        <th className="pb-3 px-3 text-center">Working Hours</th>
                        <th className="pb-3 px-3 text-center">OFD Calling</th>
                        <th className="pb-3 px-3 text-center">RTO & NDR Actions</th>
                        <th className="pb-3 px-3 text-center">Total Resolved</th>
                        <th className="pb-3 px-3 text-center">Target Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold">
                      {leaderboard.map((s, idx) => {
                        const u = s.user || {};
                        return (
                          <tr key={u._id} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2.5">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                                  idx === 0 ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                  idx === 1 ? 'bg-slate-100 text-slate-700 border border-slate-300' :
                                  idx === 2 ? 'bg-orange-100 text-orange-800 border border-orange-300' : 'text-slate-400'
                                }`}>
                                  #{idx + 1}
                                </span>
                                <div>
                                  <div className="font-extrabold text-slate-900">{u.name}</div>
                                  <div className="text-[10px] text-slate-400">{u.phone || 'Logistics Executive'}</div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-3 text-center text-slate-700">
                              {s.workingHours} hrs
                            </td>

                            <td className="py-3 px-3 text-center">
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-extrabold border border-blue-100">
                                {s.ofdComments}
                              </span>
                            </td>

                            <td className="py-3 px-3 text-center">
                              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-extrabold border border-amber-100">
                                {s.rtoComments}
                              </span>
                            </td>

                            <td className="py-3 px-3 text-center text-base font-black text-slate-900">
                              {s.totalDone}
                            </td>

                            <td className="py-3 px-3 text-center">
                              <div className="max-w-[120px] mx-auto">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                                  <span>{s.totalDone} / {s.target}</span>
                                  <span>{s.completionPct}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${s.completionPct >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                                    style={{ width: `${Math.min(100, s.completionPct)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. Courier Radar Tab */}
            {activeQueue === 'courier' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-extrabold text-slate-800">
                    Live Courier Partner Scorecard
                  </h3>
                  <span className="text-xs text-slate-400 font-semibold">Real-time Delivery & RTO Ratio</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {courierPerf.map((c) => (
                    <div key={c.name} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-900 text-sm">{c.name}</span>
                          <span className="text-xs font-bold text-slate-400">{c.total} Orders</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 font-medium">Delivery Rate</span>
                            <span className="font-black text-emerald-600">{c.deliveryRate}%</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 font-medium">RTO Rate</span>
                            <span className="font-black text-rose-600">{c.rtoRate}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-3">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${c.deliveryRate}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Monthly RTO Matrix & Percentage Analysis Tab */}
            {activeQueue === 'monthly_rto' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <RotateCcw size={18} className="text-rose-600" />
                      <span>Monthly RTO Matrix & Percentage Analysis</span>
                      <span className="text-[11px] font-bold text-slate-500">· Historical 6-Month Return Trends</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Month-wise comparison of Total Shipments, Delivered rates, RTO In-Transit vs RTO Delivered back to warehouse.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-black">
                      Current Month RTO Rate: {monthlyRto[0]?.rtoRate ?? kpis.rtoBreakdown?.rtoRate ?? 0}%
                    </span>
                  </div>
                </div>

                {/* 4 Executive Highlight KPI Cards for Current Month */}
                {monthlyRto.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Current Month Volume</span>
                      <p className="text-2xl font-black text-slate-900 mt-1">{monthlyRto[0].totalShipments} Orders</p>
                      <span className="text-[11px] font-bold text-emerald-600 mt-1 block">
                        {monthlyRto[0].delivered} Delivered ({monthlyRto[0].deliveryRate}%)
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200">
                      <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">🚚 Active On Road (In-Transit/OFD)</span>
                      <p className="text-2xl font-black text-blue-950 mt-1">{monthlyRto[0].inTransit || 0} Orders</p>
                      <span className="text-[11px] font-extrabold text-blue-800 mt-1 block">
                        {monthlyRto[0].inTransitRate || 0}% Still in delivery cycle
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">⚠️ RTO In-Transit (Rescue Queue)</span>
                      <p className="text-2xl font-black text-amber-950 mt-1">{monthlyRto[0].rtoInTransit}</p>
                      <span className="text-[11px] font-extrabold text-amber-800 mt-1 block">
                        {monthlyRto[0].rtoInTransitPct}% of all RTOs
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200">
                      <span className="text-[10px] font-black uppercase tracking-wider text-rose-600">Total Month RTO</span>
                      <p className="text-2xl font-black text-rose-900 mt-1">{monthlyRto[0].totalRto} Returns</p>
                      <span className="text-[11px] font-extrabold text-rose-700 mt-1 block">
                        Overall {monthlyRto[0].rtoRate}% RTO Rate ({monthlyRto[0].rtoDelivered} Closed)
                      </span>
                    </div>
                  </div>
                )}

                {/* Full Monthly RTO Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-[11px] font-black text-slate-600 uppercase tracking-wider border-b border-slate-200">
                        <th className="p-3.5">Month</th>
                        <th className="p-3.5 text-right">Total Orders</th>
                        <th className="p-3.5 text-right">Delivered (Success)</th>
                        <th className="p-3.5 text-right">🚚 In-Transit / Active</th>
                        <th className="p-3.5 text-right">⚠️ RTO In-Transit</th>
                        <th className="p-3.5 text-right">📦 RTO Delivered Back</th>
                        <th className="p-3.5 text-right">Total RTO</th>
                        <th className="p-3.5 text-right">RTO Rate</th>
                        <th className="p-3.5 min-w-[180px]">Status Distribution</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {monthlyRto.map((m, idx) => (
                        <tr key={m.month} className={`hover:bg-slate-50 transition ${idx === 0 ? 'bg-rose-50/20 font-bold' : ''}`}>
                          <td className="p-3.5">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-900">{m.monthLabel || m.month}</span>
                              {idx === 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-100 text-blue-700 uppercase">
                                  Current
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5 text-right font-extrabold text-slate-800">
                            {m.totalShipments}
                          </td>
                          <td className="p-3.5 text-right font-bold text-emerald-700">
                            {m.delivered} <span className="text-[11px] text-emerald-600 font-extrabold">({m.deliveryRate}%)</span>
                          </td>
                          <td className="p-3.5 text-right">
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 font-extrabold border border-blue-200">
                              {m.inTransit || 0} ({m.inTransitRate || 0}%)
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-extrabold border border-amber-200">
                              {m.rtoInTransit} ({m.rtoInTransitPct}%)
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-extrabold border border-slate-200">
                              {m.rtoDelivered} ({m.rtoDeliveredPct}%)
                            </span>
                          </td>
                          <td className="p-3.5 text-right font-black text-rose-700">
                            {m.totalRto}
                          </td>
                          <td className="p-3.5 text-right">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-100 text-rose-800 border border-rose-200">
                              {m.rtoRate}%
                            </span>
                          </td>
                          <td className="p-3.5">
                            <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                              <div
                                style={{ width: `${m.deliveryRate}%` }}
                                className="bg-emerald-500 h-full"
                                title={`Delivered: ${m.deliveryRate}%`}
                              />
                              <div
                                style={{ width: `${m.inTransitRate || 0}%` }}
                                className="bg-blue-500 h-full"
                                title={`Active In-Transit: ${m.inTransitRate || 0}%`}
                              />
                              <div
                                style={{ width: `${m.rtoRate}%` }}
                                className="bg-rose-500 h-full"
                                title={`RTO: ${m.rtoRate}%`}
                              />
                            </div>
                            <div className="flex justify-between text-[9px] text-slate-500 font-bold mt-1">
                              <span className="text-emerald-700">Delv: {m.deliveryRate}%</span>
                              <span className="text-blue-700">Active: {m.inTransitRate || 0}%</span>
                              <span className="text-rose-700">RTO: {m.rtoRate}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. Weight Disputes Tab */}
            {activeQueue === 'disputes' && (
              <div>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <Scale size={18} className="text-rose-600" />
                      <span>Courier Weight Dispute Management</span>
                      <span className="text-[11px] font-bold text-slate-500">· Challenge wrongful weight bills</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Review discrepancies between declared weight and courier billed weight. Accept charges or challenge with package proofs.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Status Filter */}
                    <select
                      value={disputeStatusFilter}
                      onChange={(e) => setDisputeStatusFilter(e.target.value)}
                      className="text-xs font-bold px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                    >
                      <option value="all">All Dispute Stages</option>
                      <option value="1">1 · New Dispute</option>
                      <option value="2">2 · Accepted (Wallet Deducted)</option>
                      <option value="3">3 · Disputed / Under Review</option>
                      <option value="4">4 · Expired</option>
                      <option value="5">5 · Admin Accepted (Won)</option>
                      <option value="6">6 · Admin Rejected (Lost)</option>
                    </select>

                    {/* Search */}
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search AWB or Order #..."
                        value={disputeSearch}
                        onChange={(e) => setDisputeSearch(e.target.value)}
                        className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-rose-500 font-semibold"
                      />
                    </div>

                    <button
                      onClick={loadWeightDisputes}
                      disabled={disputesLoading}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition cursor-pointer"
                      title="Refresh Weight Disputes"
                    >
                      <RefreshCw size={14} className={disputesLoading ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>

                {disputesLoading ? (
                  <div className="py-16 text-center">
                    <div className="w-8 h-8 border-3 border-rose-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs font-bold text-slate-500 mt-2">Loading Weight Disputes from ShipMaxx...</p>
                  </div>
                ) : disputesList.length === 0 ? (
                  <div className="py-16 text-center text-slate-400">
                    <Scale size={40} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-bold text-slate-700">No Weight Disputes Found</p>
                    <p className="text-xs text-slate-400 mt-0.5">All courier shipments are currently within declared weight tolerances.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-black uppercase tracking-wider text-[10px]">
                          <th className="pb-3 px-3">Dispute & AWB</th>
                          <th className="pb-3 px-3">Courier</th>
                          <th className="pb-3 px-3">Declared Weight</th>
                          <th className="pb-3 px-3">Courier Billed Weight</th>
                          <th className="pb-3 px-3">Extra Charge</th>
                          <th className="pb-3 px-3">Status</th>
                          <th className="pb-3 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold">
                        {paginatedDisputes.map((d) => {
                          const status = Number(d.status ?? 1);
                          const isNew = status === 1;
                          const awbNum = d.awb_number || d.awb || d.awb_code || '—';
                          const declaredWt = d.applied_weight || d.declared_weight || d.entered_weight || '0.50';
                          const courierWt = d.courier_weight || d.charged_weight || '1.00';
                          const extraAmt = d.disputed_amount || d.extra_charge || d.charged_amount || 0;
                          return (
                            <tr key={d.dispute_id || d.id || d._id} className="hover:bg-slate-50 transition">
                              <td className="py-3 px-3">
                                <div className="font-extrabold text-slate-900">#{d.order_number || d.order_id || 'Order'}</div>
                                <div className="text-[11px] text-slate-500 font-mono mt-0.5">AWB: {awbNum}</div>
                                <div className="text-[10px] text-slate-500 font-bold mt-1 flex items-center gap-1">
                                  <Clock size={10} className="text-slate-400" />
                                  <span>Raised: {d.created_at ? new Date(d.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : 'Recent'}</span>
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <span className="font-bold text-slate-800">{d.courier_name || 'Courier'}</span>
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-600">
                                <div>{declaredWt} kg</div>
                                {d.package_info && (
                                  <div className="text-[10px] text-slate-400">
                                    {d.package_info}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 font-mono text-rose-600 font-bold">
                                <div>{courierWt} kg</div>
                                <div className="text-[10px] text-rose-400">
                                  +{((Number(courierWt) - Number(declaredWt))).toFixed(2)} kg excess
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <span className="text-base font-black text-rose-700">₹{extraAmt}</span>
                              </td>
                              <td className="py-3 px-3">
                                {status === 1 && <span className="px-2 py-0.5 rounded text-[10px] uppercase font-black bg-blue-100 text-blue-800 border border-blue-200">New Dispute</span>}
                                {status === 2 && <span className="px-2 py-0.5 rounded text-[10px] uppercase font-black bg-slate-100 text-slate-700 border border-slate-200">Accepted</span>}
                                {status === 3 && <span className="px-2 py-0.5 rounded text-[10px] uppercase font-black bg-amber-100 text-amber-800 border border-amber-200">In Review</span>}
                                {status === 4 && <span className="px-2 py-0.5 rounded text-[10px] uppercase font-black bg-gray-100 text-gray-500 border border-gray-200">Expired</span>}
                                {status === 5 && <span className="px-2 py-0.5 rounded text-[10px] uppercase font-black bg-emerald-100 text-emerald-800 border border-emerald-200">Admin Won</span>}
                                {status === 6 && <span className="px-2 py-0.5 rounded text-[10px] uppercase font-black bg-rose-100 text-rose-800 border border-rose-200">Admin Lost</span>}
                              </td>
                              <td className="py-3 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleOpenDisputeHistory(d)}
                                    title="View Timeline History"
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition cursor-pointer"
                                  >
                                    <History size={14} />
                                  </button>
                                  {isNew && (
                                    <>
                                      <button
                                        onClick={() => handleAcceptDispute(d)}
                                        title="Accept Charge (Deducts from Wallet)"
                                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-[11px] transition cursor-pointer"
                                      >
                                        Accept ₹{d.extra_charge || 0}
                                      </button>
                                      <button
                                        onClick={() => handleOpenChallenge(d)}
                                        title="Challenge with Photos (L×B×H)"
                                        className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition cursor-pointer shadow-xs"
                                      >
                                        <Scale size={12} />
                                        <span>Challenge</span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* ── Pagination Bar for Disputes Table ── */}
                    {totalDisputesItems > 0 && (
                      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 bg-white mt-2 flex-wrap gap-3">
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-slate-500 font-medium">
                            Showing <span className="font-extrabold text-slate-900">{(disputesPage - 1) * disputesPageSize + 1}</span> to{' '}
                            <span className="font-extrabold text-slate-900">{Math.min(disputesPage * disputesPageSize, totalDisputesItems)}</span> of{' '}
                            <span className="font-extrabold text-slate-900">{totalDisputesItems}</span> disputes
                          </p>
                          <span className="text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                            20 Per Page
                          </span>
                        </div>

                        {totalDisputesPages > 1 && (
                          <div className="flex items-center gap-1">
                            <button
                              disabled={disputesPage === 1}
                              onClick={() => setDisputesPage(1)}
                              title="First Page"
                              className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                            >
                              «
                            </button>
                            <button
                              disabled={disputesPage === 1}
                              onClick={() => setDisputesPage(prev => Math.max(prev - 1, 1))}
                              title="Previous Page"
                              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                            >
                              ‹ Prev
                            </button>

                            <div className="flex items-center gap-1 mx-1">
                              {Array.from({ length: Math.min(5, totalDisputesPages) }, (_, i) => {
                                let pageNum = disputesPage - 2 + i;
                                if (disputesPage <= 2) pageNum = i + 1;
                                if (disputesPage >= totalDisputesPages - 1) pageNum = totalDisputesPages - 4 + i;
                                pageNum = Math.max(1, Math.min(pageNum, totalDisputesPages));
                                if (pageNum < 1 || pageNum > totalDisputesPages) return null;
                                const isPageActive = disputesPage === pageNum;

                                return (
                                  <button
                                    key={pageNum}
                                    onClick={() => setDisputesPage(pageNum)}
                                    className={`w-8 h-8 text-xs font-black rounded-lg transition flex items-center justify-center cursor-pointer ${
                                      isPageActive
                                        ? 'bg-rose-600 text-white shadow-sm'
                                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                    }`}
                                  >
                                    {pageNum}
                                  </button>
                                );
                              })}
                            </div>

                            <button
                              disabled={disputesPage === totalDisputesPages}
                              onClick={() => setDisputesPage(prev => Math.min(prev + 1, totalDisputesPages))}
                              title="Next Page"
                              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                            >
                              Next ›
                            </button>
                            <button
                              disabled={disputesPage === totalDisputesPages}
                              onClick={() => setDisputesPage(totalDisputesPages)}
                              title="Last Page"
                              className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                            >
                              »
                        </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ═══ Floating NDR Bulk Action Dock (Max 10 IDs) ═══ */}
        {selectedOrders.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center justify-between gap-4 flex-wrap max-w-4xl w-[92%] animate-in fade-in slide-in-from-bottom-5">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-blue-500/30">
                {selectedOrders.length}
              </span>
              <div>
                <p className="text-xs font-black tracking-tight text-white flex items-center gap-1.5">
                  <span>ShipMaxx Bulk Action Dock</span>
                  <span className="text-[10px] text-blue-400 font-semibold">({selectedOrders.length} / 10 limit)</span>
                </p>
                <p className="text-[10px] text-slate-400 font-medium">Applies synchronized courier action across selected NDR records</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Action Buttons */}
              <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
                {[
                  { id: 'reattempt', label: 'Re-attempt' },
                  { id: 'rto', label: 'RTO' },
                  { id: 'escalate', label: 'Escalate' },
                  { id: 'follow_up', label: 'Follow-up' },
                ].map(act => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setBulkDockAction(act.id)}
                    className={`px-3 py-1 text-xs font-black rounded-lg transition cursor-pointer ${
                      bulkDockAction === act.id
                        ? act.id === 'rto'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : act.id === 'escalate'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {act.label}
                  </button>
                ))}
              </div>

              {/* Notes Input */}
              <input
                type="text"
                placeholder="Bulk action notes..."
                value={bulkDockNotes}
                onChange={e => setBulkDockNotes(e.target.value)}
                className="bg-slate-800 text-xs text-white px-3 py-1.5 rounded-xl border border-slate-700 outline-none w-44 font-medium focus:border-blue-500"
              />

              {/* Execute Button */}
              <button
                type="button"
                onClick={handleBulkNdrSubmit}
                disabled={bulkSubmitting}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition cursor-pointer disabled:opacity-50"
              >
                {bulkSubmitting ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                <span>Execute Bulk</span>
              </button>

              {/* Clear */}
              <button
                type="button"
                onClick={clearSelection}
                title="Deselect All"
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ═══ Modal 1: Single NDR Action Modal ═══ */}
        {ndrModal.open && ndrModal.order && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95">
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">Take NDR Action</h3>
                    <p className="text-[11px] font-semibold text-slate-500">
                      Submit operational courier instruction to ShipMaxx
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setNdrModal({ open: false, order: null, action: 'reattempt', notes: '', submitting: false })}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Order Context Card */}
              <div className="p-5 space-y-4">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-900">{ndrModal.order.billing_customer_name || 'Customer'}</span>
                    <span className="font-mono text-slate-500 font-bold">{ndrModal.order.awb_code || ndrModal.order.order_id}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>{ndrModal.order.billing_city || 'City'}, {ndrModal.order.billing_state || ''}</span>
                    <span className="text-rose-600 font-bold">{ndrModal.order.courier_reason || 'Undelivered Attempt'}</span>
                  </div>
                </div>

                {/* Action Selection */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-2">
                    Select Courier Instruction
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      {
                        id: 'reattempt',
                        title: 'Re-attempt Delivery',
                        desc: 'Instruct rider to attempt delivery again tomorrow',
                        color: 'blue'
                      },
                      {
                        id: 'rto',
                        title: 'Initiate RTO',
                        desc: 'Cancel further attempts; return parcel to warehouse',
                        color: 'rose'
                      },
                      {
                        id: 'escalate',
                        title: 'Courier Escalation',
                        desc: 'Flag fake attempt/delivery issue to courier hub',
                        color: 'amber'
                      },
                      {
                        id: 'follow_up',
                        title: 'Customer Follow-up',
                        desc: 'Record buyer consultation and re-schedule delivery',
                        color: 'purple'
                      },
                    ].map(act => (
                      <div
                        key={act.id}
                        onClick={() => setNdrModal(prev => ({ ...prev, action: act.id }))}
                        className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                          ndrModal.action === act.id
                            ? act.color === 'rose'
                              ? 'border-rose-500 bg-rose-50/60 shadow-xs'
                              : act.color === 'amber'
                              ? 'border-amber-500 bg-amber-50/60 shadow-xs'
                              : act.color === 'purple'
                              ? 'border-purple-500 bg-purple-50/60 shadow-xs'
                              : 'border-blue-500 bg-blue-50/60 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div>
                          <p className={`text-xs font-black ${
                            ndrModal.action === act.id
                              ? act.color === 'rose' ? 'text-rose-700' : act.color === 'amber' ? 'text-amber-700' : act.color === 'purple' ? 'text-purple-700' : 'text-blue-700'
                              : 'text-slate-800'
                          }`}>
                            {act.title}
                          </p>
                          <p className="text-[10px] text-slate-500 font-medium mt-1 leading-snug">
                            {act.desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes Input */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                    Action Remarks / Customer Feedback (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="E.g., Customer requested delivery after 3 PM tomorrow; address landmark provided..."
                    value={ndrModal.notes}
                    onChange={e => setNdrModal(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full text-xs font-semibold p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setNdrModal({ open: false, order: null, action: 'reattempt', notes: '', submitting: false })}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSingleNdrSubmit}
                  disabled={ndrModal.submitting}
                  className="px-5 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {ndrModal.submitting ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  <span>Submit Action to ShipMaxx</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Modal 2: Live Courier Tracking Timeline Modal ═══ */}
        {trackingModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                    <Truck size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">Live Courier Tracking</h3>
                    <p className="text-[11px] font-semibold text-slate-500 font-mono">
                      AWB: {trackingModal.awb}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setTrackingModal({ open: false, awb: '', order: null, data: null, loading: false, error: null })}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                {trackingModal.loading ? (
                  <div className="py-16 text-center">
                    <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs font-bold text-slate-500 mt-3">Fetching real-time scans from courier partner...</p>
                  </div>
                ) : trackingModal.error ? (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
                    {trackingModal.error}
                  </div>
                ) : (
                  <div>
                    {/* Status Highlights */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 mb-4 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Current Status</span>
                        <p className="text-sm font-black text-slate-900 mt-0.5">
                          {trackingModal.data?.current_status || trackingModal.data?.status || 'In Transit'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Courier</span>
                        <p className="text-xs font-bold text-slate-700 mt-0.5">
                          {trackingModal.data?.courier_name || trackingModal.order?.courier_name || 'ShipMaxx Network'}
                        </p>
                      </div>
                    </div>

                    {/* Timeline Checkpoints */}
                    {(() => {
                      const scans = trackingModal.data?.scans || trackingModal.data?.tracking_history || trackingModal.data?.activities || [];
                      if (!Array.isArray(scans) || scans.length === 0) {
                        return (
                          <div className="py-8 text-center text-slate-400 text-xs font-semibold">
                            No checkpoint scans recorded by carrier yet.
                          </div>
                        );
                      }

                      return (
                        <div className="relative pl-6 border-l-2 border-slate-200 space-y-4 my-2">
                          {scans.map((s, idx) => (
                            <div key={idx} className="relative">
                              <span className={`absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                                idx === 0 ? 'bg-indigo-600 ring-4 ring-indigo-100' : 'bg-slate-300'
                              }`} />
                              <div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-slate-900">
                                    {s.activity || s.status || s.status_description || 'Scan Checkpoint'}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {s.date || s.time || s.datetime || ''}
                                  </span>
                                </div>
                                {(s.location || s.city) && (
                                  <p className="text-[11px] text-slate-500 font-semibold mt-0.5 flex items-center gap-1">
                                    <MapPin size={10} className="text-slate-400" />
                                    <span>{s.location || s.city}</span>
                                  </p>
                                )}
                                {s.remarks && (
                                  <p className="text-[10px] text-slate-400 mt-0.5">{s.remarks}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ Modal 3: Weight Dispute History Timeline Modal ═══ */}
        {disputeHistoryModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center">
                    <History size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">Dispute Timeline History</h3>
                    <p className="text-[11px] font-semibold text-slate-500 font-mono">
                      Dispute #{disputeHistoryModal.dispute?.dispute_id || disputeHistoryModal.dispute?.id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDisputeHistoryModal({ open: false, dispute: null, history: [], loading: false })}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1">
                {disputeHistoryModal.loading ? (
                  <div className="py-12 text-center">
                    <div className="w-8 h-8 border-3 border-slate-800 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs font-bold text-slate-500 mt-2">Loading event history...</p>
                  </div>
                ) : disputeHistoryModal.history.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs font-semibold">
                    No history events logged for this dispute yet.
                  </div>
                ) : (
                  <div className="relative pl-6 border-l-2 border-slate-200 space-y-4">
                    {disputeHistoryModal.history.map((ev, idx) => (
                      <div key={idx} className="relative">
                        <span className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white bg-slate-700" />
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-slate-900">{ev.event || ev.action || 'Dispute Event'}</span>
                            <span className="text-[10px] text-slate-400">{ev.created_at ? new Date(ev.created_at).toLocaleString('en-IN') : ''}</span>
                          </div>
                          {ev.description && <p className="text-[11px] text-slate-600 mt-0.5">{ev.description}</p>}
                          {ev.user && <p className="text-[10px] text-slate-400 mt-0.5">By: {ev.user}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ Modal 4: Challenge Weight Dispute with Dimensions & Proofs ═══ */}
        {challengeModal.open && challengeModal.dispute && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-600/20">
                    <Scale size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">Challenge Weight Dispute</h3>
                    <p className="text-[11px] font-semibold text-slate-500 font-mono">
                      AWB: {challengeModal.dispute.awb || challengeModal.dispute.awb_code || challengeModal.dispute.order_number}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setChallengeModal({ open: false, dispute: null, length: '', breadth: '', height: '', dead_weight: '', images: [], video: null, submitting: false })}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmitChallenge} className="p-5 overflow-y-auto space-y-4 flex-1">
                {/* Comparison Card */}
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Declared Weight</span>
                    <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                      {challengeModal.dispute.declared_weight || challengeModal.dispute.entered_weight || '0.50'} kg
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-500">Courier Billed</span>
                    <p className="text-sm font-extrabold text-rose-700 mt-0.5">
                      {challengeModal.dispute.charged_weight || challengeModal.dispute.courier_weight || '1.00'} kg
                      <span className="text-[11px] font-bold text-rose-500 ml-1">(+₹{challengeModal.dispute.extra_charge || 0})</span>
                    </p>
                  </div>
                </div>

                {/* Measurements Form */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                    Enter Physical Package Measurements
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500">Length (cm)*</span>
                      <input
                        type="number"
                        step="0.1"
                        required
                        value={challengeModal.length}
                        onChange={e => setChallengeModal(prev => ({ ...prev, length: e.target.value }))}
                        placeholder="10"
                        className="w-full mt-1 px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500">Breadth (cm)*</span>
                      <input
                        type="number"
                        step="0.1"
                        required
                        value={challengeModal.breadth}
                        onChange={e => setChallengeModal(prev => ({ ...prev, breadth: e.target.value }))}
                        placeholder="10"
                        className="w-full mt-1 px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500">Height (cm)*</span>
                      <input
                        type="number"
                        step="0.1"
                        required
                        value={challengeModal.height}
                        onChange={e => setChallengeModal(prev => ({ ...prev, height: e.target.value }))}
                        placeholder="10"
                        className="w-full mt-1 px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500">Dead Weight (kg)*</span>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={challengeModal.dead_weight}
                        onChange={e => setChallengeModal(prev => ({ ...prev, dead_weight: e.target.value }))}
                        placeholder="0.5"
                        className="w-full mt-1 px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  {/* Calculated preview */}
                  {challengeModal.length && challengeModal.breadth && challengeModal.height && (
                    <div className="mt-2.5 p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-center justify-between text-xs">
                      <span className="text-blue-800 font-semibold">
                        Volumetric: {((Number(challengeModal.length) * Number(challengeModal.breadth) * Number(challengeModal.height)) / 5000).toFixed(3)} kg
                      </span>
                      <span className="font-black text-blue-900">
                        Chargeable: {Math.max(
                          Number(challengeModal.dead_weight || 0),
                          (Number(challengeModal.length) * Number(challengeModal.breadth) * Number(challengeModal.height)) / 5000
                        ).toFixed(3)} kg
                      </span>
                    </div>
                  )}
                </div>

                {/* Upload Proof Images (Exactly 4 Required) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Proof Media (Exactly 4 Images Required)*
                    </label>
                    <span className={`text-[11px] font-black ${challengeModal.images.length === 4 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {challengeModal.images.length} / 4 Images Selected
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-2">
                    Upload 4 clear photos: (1) Scale reading with parcel, (2) Length tape, (3) Width tape, (4) Height tape with shipping label visible.
                  </p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 4) {
                        toastInfo('Please select exactly 4 images for the challenge.');
                        setChallengeModal(prev => ({ ...prev, images: files.slice(0, 4) }));
                      } else {
                        setChallengeModal(prev => ({ ...prev, images: files }));
                      }
                    }}
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100 cursor-pointer"
                  />
                </div>

                {/* Optional Video Upload */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                    Optional Video Proof (1 Video max)
                  </label>
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setChallengeModal(prev => ({ ...prev, video: file }));
                    }}
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                  />
                </div>

                {/* Submit Controls */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setChallengeModal({ open: false, dispute: null, length: '', breadth: '', height: '', dead_weight: '', images: [], video: null, submitting: false })}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={challengeModal.submitting || challengeModal.images.length !== 4}
                    className="px-5 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {challengeModal.submitting ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <UploadCloud size={14} />
                    )}
                    <span>Submit Challenge for Admin Review</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
