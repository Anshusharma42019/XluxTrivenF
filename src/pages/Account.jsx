import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as smxSvc from '../services/shipmaxx.service';
import { useLanguage } from '../context/LanguageContext';
import InvoiceModal from '../components/InvoiceModal';
import BulkInvoiceModal from '../components/BulkInvoiceModal';
import CsvExportModal from '../components/CsvExportModal';

const DATE_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 Days' },
  { id: 'month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'all', label: 'All Time' },
  { id: 'custom', label: 'Custom' },
];

const fmtDate = (dStr) => {
  if (!dStr) return '—';
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return String(dStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, '0');
    return `${day}/${month}/${year} ${strHours}:${minutes} ${ampm}`;
  } catch {
    return String(dStr);
  }
};

const getTrackingUrl = (awb, courierName = '') => {
  const c = String(courierName || '').toLowerCase();
  if (c.includes('shadowfax')) return `https://tracker.shadowfax.in/track?awb=${awb}`;
  if (c.includes('xpressbees')) return `https://www.xpressbees.com/track?awb=${awb}`;
  if (c.includes('delhivery')) return `https://www.delhivery.com/tracking`;
  if (c.includes('bluedart')) return `https://www.bluedart.com/tracking`;
  return `https://shipmaxx.in/track/${awb}`;
};

const getOrGenerateBillNumber = (order) => {
  if (!order) return 'TW-0001';
  if (order.bill_seq) return `TW-${String(order.bill_seq).padStart(4, '0')}`;
  if (order.bill_number && /^TW-\d{4,}$/.test(order.bill_number)) return order.bill_number;
  if (order.billNumber && /^TW-\d{4,}$/.test(order.billNumber)) return order.billNumber;
  const idPart = (order.order_id || order._id || '000').toString().replace(/\D/g, '').slice(-4) || '0001';
  return `TW-${idPart.padStart(4, '0')}`;
};

export default function Account() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [exporting, setExporting] = useState(false);

  // Stats & Revenue
  const [stats, setStats] = useState({ count: 0, revenue: 0, codCount: 0, prepaidCount: 0, statusBreakdown: [] });
  const [filteredRevenue, setFilteredRevenue] = useState(0);

  // Filters & Pagination
  const [preset, setPreset] = useState('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);

  // Selected Order for Modal View
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Bulk Selection & Invoices
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceShipment, setInvoiceShipment] = useState(null);
  const [invoiceDoctorFee, setInvoiceDoctorFee] = useState(0);
  const [invoiceTaxMode, setInvoiceTaxMode] = useState('inter');
  const [bulkInvoiceModalOpen, setBulkInvoiceModalOpen] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  // Initialize date range based on preset
  const applyPresetDates = useCallback((p) => {
    const today = new Date();
    const formatDateInput = (date) => {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    if (p === 'today') {
      const day = formatDateInput(today);
      setFrom(day); setTo(day);
    } else if (p === 'yesterday') {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      const day = formatDateInput(d);
      setFrom(day); setTo(day);
    } else if (p === 'last7') {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      setFrom(formatDateInput(d));
      setTo(formatDateInput(today));
    } else if (p === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setFrom(formatDateInput(start));
      setTo(formatDateInput(end));
    } else if (p === 'last_month') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      setFrom(formatDateInput(start));
      setTo(formatDateInput(end));
    } else if (p === 'all') {
      setFrom(''); setTo('');
    }
  }, []);

  useEffect(() => {
    applyPresetDates('month');
  }, [applyPresetDates]);

  // Fetch Delivered Stats
  const fetchStats = useCallback(() => {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    smxSvc.getDeliveredStats(params)
      .then(res => {
        const d = res.data?.data || {};
        setStats({
          count: d.count || 0,
          revenue: d.revenue || 0,
          codCount: d.codCount || 0,
          prepaidCount: d.prepaidCount || 0,
          statusBreakdown: d.statusBreakdown || []
        });
      })
      .catch(() => {});
  }, [from, to]);

  // Fetch Delivered Orders
  const fetchDeliveredOrders = useCallback(() => {
    setLoading(true);
    const params = { page, per_page: perPage, payment_method: paymentFilter };
    if (search.trim()) params.search = search.trim();
    if (from) params.from = from;
    if (to) params.to = to;

    smxSvc.getDeliveredOrders(params)
      .then(res => {
        const d = res.data?.data || {};
        const list = Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : [];
        setOrders(list);
        setTotalOrders(d.total ?? list.length);
        setFilteredRevenue(d.totalRevenue ?? 0);
      })
      .catch(err => {
        console.error('[Account] Error fetching delivered orders:', err);
        setOrders([]);
        setTotalOrders(0);
        setFilteredRevenue(0);
      })
      .finally(() => setLoading(false));
  }, [page, perPage, search, from, to, paymentFilter]);

  useEffect(() => {
    fetchStats();
    fetchDeliveredOrders();
  }, [fetchStats, fetchDeliveredOrders]);

  const handlePresetChange = (p) => {
    setPreset(p);
    setPage(1);
    applyPresetDates(p);
  };

  const handleSync = async () => {
    setSyncing(true); setSyncMsg('');
    try {
      await smxSvc.syncShipmaxx();
      setSyncMsg('ShipMaxx sync completed successfully!');
      fetchStats();
      fetchDeliveredOrders();
    } catch (e) {
      setSyncMsg('Sync failed: ' + (e?.response?.data?.message || e.message));
    } finally {
      setSyncing(false);
    }
  };

  const handleExecuteExportCSV = async ({ doctorFee = 0, gstRate = 12 } = {}) => {
    setExporting(true);
    try {
      let exportList = orders;
      // If table is paginated and total exceeds current page size, fetch all matching records for complete export
      if (totalOrders > orders.length) {
        const params = { page: 1, per_page: 'all', payment_method: paymentFilter };
        if (search.trim()) params.search = search.trim();
        if (from) params.from = from;
        if (to) params.to = to;
        const res = await smxSvc.getDeliveredOrders(params);
        const d = res.data?.data || {};
        exportList = Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : orders;
      }

      if (!exportList.length) return alert('No delivered orders to export.');

      const headers = [
        'Bill Number',
        'Sl. No.',
        'Description of Goods / Services',
        'SAC / HSN Code',
        'Doctor Fee (Rs)',
        'Medicine Taxable Value (Rs)',
        'GST Rate',
        'CGST (Rs)',
        'SGST/UTGST (Rs)',
        'IGST (Rs)',
        'Medicine Charge (Rs)',
        'GST Amount (Rs)',
        'Total Amount (Rs)',
        'Delivered Date'
      ];

      const doctorFeeNum = Number(doctorFee) || 0;
      const defaultGstPct = Number(gstRate) >= 0 ? Number(gstRate) : 12;

      const rows = [];
      exportList.forEach((o, index) => {
        const billNum = getOrGenerateBillNumber(o);
        const dateStr = fmtDate(o.delivered_at || o.status_updated_at || o.createdAt);

        const cleanState = (o.billing_state || '').toLowerCase().replace(/[^a-z]/g, '');
        const isIntra = cleanState === 'up' || cleanState === 'uttarpradesh' || cleanState.includes('uttarpradesh');

        const orderSubTotal = Number(o.sub_total || 0);

        const items = (o.order_items && o.order_items.length > 0)
          ? o.order_items
          : [{ name: 'Ayurvedic Wellness Package', units: 1, selling_price: orderSubTotal, hsn: '30049011', tax: defaultGstPct }];

        const itemNames = items.map(it => it.name || it.product_name || 'Ayurvedic Medicine').join(', ');
        const desc = doctorFeeNum > 0 ? `Doctor Consultation Charges + ${itemNames}` : itemNames;
        const hsn = doctorFeeNum > 0 ? '999312 / 30049011' : (items[0]?.hsn || '30049011');

        // Calculate Medicine (Inclusive of GST) and Doctor fee breakdown
        const medicineInclusive = Math.max(0, orderSubTotal - doctorFeeNum);
        const taxPct = defaultGstPct;

        let medTaxableVal = 0;
        let medGstAmount = 0;

        if (taxPct > 0) {
          medTaxableVal = Math.round((medicineInclusive / (1 + (taxPct / 100))) * 100) / 100;
          medGstAmount = Math.round((medicineInclusive - medTaxableVal) * 100) / 100;
        } else {
          medTaxableVal = medicineInclusive;
        }

        let cgst = 0;
        let sgst = 0;
        let igst = 0;

        if (isIntra) {
          cgst = Math.round((medGstAmount / 2) * 100) / 100;
          sgst = Math.round((medGstAmount - cgst) * 100) / 100;
        } else {
          igst = medGstAmount;
        }

        rows.push([
          `"${billNum}"`,
          index + 1,
          `"${desc.replace(/"/g, '""')}"`,
          `"${hsn}"`,
          doctorFeeNum.toFixed(2),
          medTaxableVal.toFixed(2),
          taxPct > 0 ? `"${taxPct}%"` : '"Exempt (0%)"',
          isIntra ? cgst.toFixed(2) : '"-"',
          isIntra ? sgst.toFixed(2) : '"-"',
          !isIntra ? igst.toFixed(2) : '"-"',
          medicineInclusive.toFixed(2),
          medGstAmount.toFixed(2),
          orderSubTotal.toFixed(2),
          `"${dateStr}"`
        ]);
      });

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `ShipMaxx_Delivered_Tax_Invoices_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export CSV failed:', err);
      alert('Failed to export CSV: ' + (err.message || err));
    } finally {
      setExporting(false);
    }
  };

  // Filtered orders in table (already filtered by backend API)
  const filteredOrders = orders;

  // Checkbox selection logic
  const toggleSelectAll = () => {
    if (selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map(o => o._id || o.order_id));
    }
  };

  const toggleSelectRow = (id) => {
    setSelectedOrderIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Open single invoice modal
  const openSingleInvoice = (order) => {
    const cleanState = (order.billing_state || '').toLowerCase().replace(/[^a-z]/g, '');
    const isIntra = cleanState === 'up' || cleanState === 'uttarpradesh' || cleanState.includes('uttarpradesh');
    setInvoiceTaxMode(isIntra ? 'intra' : 'inter');
    setInvoiceDoctorFee(0);
    setInvoiceShipment(order);
    setInvoiceModalOpen(true);
  };

  // Bulk print selected invoices
  const handleBulkPrintSelected = () => {
    if (!selectedOrderIds.length) return;
    const selectedOrders = orders.filter(o => selectedOrderIds.includes(o._id || o.order_id));
    if (selectedOrders.length === 1) {
      openSingleInvoice(selectedOrders[0]);
    } else {
      setBulkInvoiceModalOpen(true);
    }
  };

  // Total Revenue & Payment breakdown calculation across full dataset
  const hasActiveFilters = Boolean(search.trim() || paymentFilter !== 'all');
  const totalRevenueCalc = hasActiveFilters ? filteredRevenue : (stats.revenue || filteredRevenue || 0);

  const displayCodCount = paymentFilter === 'prepaid' ? 0 : (paymentFilter === 'cod' ? totalOrders : (stats.codCount || filteredOrders.filter(o => String(o.payment_method || '').toLowerCase().includes('cod')).length));
  const displayPrepaidCount = paymentFilter === 'cod' ? 0 : (paymentFilter === 'prepaid' ? totalOrders : (stats.prepaidCount || filteredOrders.filter(o => !String(o.payment_method || '').toLowerCase().includes('cod')).length));

  const totalPages = perPage === 'all' ? 1 : Math.ceil(totalOrders / Number(perPage || 50));

  const handlePageChange = (newPage) => {
    const target = Math.max(1, Math.min(totalPages, newPage));
    setPage(target);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/2 -top-12 w-48 h-48 bg-teal-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Tax Invoices & NDR Settlement
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              ShipMaxx Delivered Accounts & Invoices
            </h1>
            <p className="text-emerald-200/80 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Automated Tax Invoice generation with unique Bill Numbers stored in database schema. Print single or download bulk invoices for all delivered orders.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setBulkInvoiceModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-teal-950 font-bold text-xs shadow-lg shadow-teal-500/20 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Bulk Invoice Print
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {syncing ? 'Syncing...' : 'Sync ShipMaxx'}
            </button>
            <button
              onClick={() => setCsvModalOpen(true)}
              disabled={exporting}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/15 transition flex items-center gap-2 disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${exporting ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>

        {syncMsg && (
          <div className="mt-4 p-3 rounded-xl bg-white/10 text-emerald-200 text-xs font-semibold border border-white/10">
            {syncMsg}
          </div>
        )}
      </div>

      {/* KPI Cards Row (3 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Delivered */}
        <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Delivered</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-gray-900 tracking-tight">
              {(hasActiveFilters ? totalOrders : (stats.count || totalOrders)).toLocaleString()}
            </div>
            <p className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
              <span>Verified Delivered Orders</span>
            </p>
          </div>
        </div>

        {/* Delivered Revenue */}
        <div className="bg-white rounded-2xl p-5 border border-teal-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Delivered Revenue</span>
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
              <span className="text-base font-extrabold">₹</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-gray-900 tracking-tight">
              ₹{totalRevenueCalc.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] font-semibold text-teal-600 mt-1">
              {preset === 'month' ? 'This Month Delivered Total' : preset === 'last_month' ? 'Last Month Delivered Total' : preset === 'today' ? "Today's Delivered Total" : 'Selected Period Total'}
            </p>
          </div>
        </div>

        {/* COD vs Prepaid */}
        <div className="bg-white rounded-2xl p-5 border border-purple-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Payment Breakdown</span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-100/80 min-w-0">
              <div className="text-sm font-extrabold text-amber-900 leading-tight truncate">COD: {displayCodCount}</div>
              <div className="text-[10px] text-amber-700 font-medium mt-0.5 truncate">Cash On Delivery</div>
            </div>
            <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100/80 min-w-0">
              <div className="text-sm font-extrabold text-emerald-900 leading-tight truncate">Prepaid: {displayPrepaidCount}</div>
              <div className="text-[10px] text-emerald-700 font-medium mt-0.5 truncate">Online Paid</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header & Date Filter Bar */}
      <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Delivered Orders List ({totalOrders})
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-gray-100 p-1 text-xs font-semibold">
            {DATE_PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => handlePresetChange(p.id)}
                className={`px-3 py-1 rounded-lg transition ${preset === p.id ? 'bg-white text-emerald-700 font-bold shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="border border-gray-200 rounded-xl px-2.5 py-1 text-xs bg-white focus:outline-none focus:border-emerald-500"
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="border border-gray-200 rounded-xl px-2.5 py-1 text-xs bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Bulk Action Bar (when rows are selected) */}
      {selectedOrderIds.length > 0 && (
        <div className="bg-gradient-to-r from-teal-900 to-emerald-900 text-white rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-teal-400 text-teal-950 font-bold text-xs flex items-center justify-center">
              {selectedOrderIds.length}
            </span>
            <span className="text-xs font-bold">Selected Orders for Invoicing</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleBulkPrintSelected}
              className="px-4 py-2 rounded-xl bg-teal-400 hover:bg-teal-300 text-teal-950 font-bold text-xs shadow-md transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print / Download {selectedOrderIds.length} Invoice(s)
            </button>
            <button
              onClick={() => setSelectedOrderIds([])}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* DELIVERED ORDERS TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Table Header & Search Filter */}
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-gray-50/40">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by AWB, Order ID, Customer Name, Phone or City..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <select
              value={paymentFilter}
              onChange={e => { setPaymentFilter(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white font-semibold text-gray-700 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Payment Types</option>
              <option value="cod">COD Only</option>
              <option value="prepaid">Prepaid Only</option>
            </select>
          </div>

          <div className="text-xs text-gray-500 font-semibold">
            Showing <span className="text-gray-900 font-bold">{filteredOrders.length > 0 ? (page - 1) * (perPage === 'all' ? totalOrders : Number(perPage)) + 1 : 0}</span> to <span className="text-gray-900 font-bold">{Math.min(page * (perPage === 'all' ? totalOrders : Number(perPage)), totalOrders)}</span> of {totalOrders} delivered records
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm flex flex-col items-center gap-2">
            <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading ShipMaxx delivered records...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h4 className="font-bold text-gray-800 text-sm">No Delivered Orders Found</h4>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              No orders match your selected search or date range parameters. Try adjusting filters or click Sync ShipMaxx.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="px-3 py-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 font-bold">Bill No. & AWB</th>
                  <th className="px-4 py-3 font-bold">Customer Info</th>
                  <th className="px-4 py-3 font-bold">Courier & City</th>
                  <th className="px-4 py-3 font-bold">Payment</th>
                  <th className="px-4 py-3 font-bold">Amount</th>
                  <th className="px-4 py-3 font-bold">Delivered Date</th>
                  <th className="px-4 py-3 font-bold">Staff / Rep</th>
                  <th className="px-4 py-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map(o => {
                  const billNum = getOrGenerateBillNumber(o);
                  const isSelected = selectedOrderIds.includes(o._id || o.order_id);
                  return (
                    <tr key={o._id || o.order_id} className={`transition-colors ${isSelected ? 'bg-emerald-50/60' : 'hover:bg-emerald-50/30'}`}>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(o._id || o.order_id)}
                          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>

                      <td className="px-4 py-3">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-100/70 text-emerald-800 font-mono text-[10px] font-extrabold mb-1">
                          🧾 {billNum}
                        </div>
                        <a
                          href={getTrackingUrl(o.awb_code, o.courier_name)}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-emerald-600 font-bold hover:underline block"
                        >
                          {o.awb_code || 'No AWB'}
                        </a>
                        <span className="text-[10px] font-mono text-gray-400 block mt-0.5">Order #{o.order_id}</span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-900">{o.billing_customer_name || 'Customer'}</div>
                        <div className="text-[11px] text-gray-500 font-mono">{o.billing_phone || '—'}</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800">{o.courier_name || 'ShipMaxx'}</div>
                        <div className="text-[10px] text-gray-400 truncate max-w-[140px]">
                          {[o.billing_city, o.billing_state].filter(Boolean).join(', ') || '—'}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-md font-bold text-[10px] uppercase border ${
                          String(o.payment_method || '').toLowerCase().includes('cod')
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {o.payment_method || 'COD'}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-extrabold text-gray-900">
                        ₹{Number(o.sub_total || 0).toLocaleString('en-IN')}
                      </td>

                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {fmtDate(o.delivered_at || o.status_updated_at || o.createdAt)}
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800">{o.staff_name || o.verification_staff_name || 'System / Auto'}</div>
                        {o.staff_role && <div className="text-[10px] text-gray-400 capitalize">{o.staff_role}</div>}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openSingleInvoice(o)}
                            className="px-2.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-600 hover:text-white text-teal-700 border border-teal-200/80 text-[11px] font-bold transition flex items-center gap-1"
                            title="Tax Invoice / Bill"
                          >
                            <span>🧾</span>
                            <span>Invoice</span>
                          </button>
                          <button
                            onClick={() => setSelectedOrder(o)}
                            className="px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold transition"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalOrders > 0 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-gray-600">
            <div className="flex items-center gap-3">
              <span>
                Showing <span className="text-gray-900 font-bold">{orders.length > 0 ? (page - 1) * (perPage === 'all' ? totalOrders : Number(perPage)) + 1 : 0}</span> to{' '}
                <span className="text-gray-900 font-bold">{Math.min(page * (perPage === 'all' ? totalOrders : Number(perPage)), totalOrders)}</span> of{' '}
                <span className="text-gray-900 font-bold">{totalOrders}</span> delivered records
              </span>

              <div className="flex items-center gap-1.5 ml-2 border-l border-gray-200 pl-3">
                <span className="text-gray-400 font-normal">Per page:</span>
                <select
                  value={perPage}
                  onChange={e => {
                    const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                    setPerPage(val);
                    setPage(1);
                  }}
                  className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={500}>500</option>
                  <option value="all">All ({totalOrders})</option>
                </select>
              </div>
            </div>

            {perPage !== 'all' && totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={page === 1}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 font-bold transition"
                  title="First Page"
                >
                  «
                </button>
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 font-bold transition flex items-center gap-1"
                >
                  ‹ Prev
                </button>

                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || (p >= page - 2 && p <= page + 2))
                    .reduce((acc, p, idx, arr) => {
                      if (idx > 0 && p - arr[idx - 1] > 1) {
                        acc.push(<span key={`dots-${p}`} className="px-1 text-gray-400">...</span>);
                      }
                      acc.push(
                        <button
                          key={p}
                          onClick={() => handlePageChange(p)}
                          className={`w-8 h-8 rounded-lg font-bold transition ${
                            page === p
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {p}
                        </button>
                      );
                      return acc;
                    }, [])}
                </div>

                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 font-bold transition flex items-center gap-1"
                >
                  Next ›
                </button>
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={page === totalPages}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 font-bold transition"
                  title="Last Page"
                >
                  »
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="h-1.5 bg-emerald-500" />
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                  Delivered Order Details
                </span>
                <h3 className="text-lg font-bold text-gray-900 mt-1">Order #{selectedOrder.order_id}</h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-50 p-3 rounded-2xl">
                  <div className="text-gray-400 font-bold uppercase text-[9px]">Bill Number</div>
                  <div className="text-emerald-700 font-mono font-extrabold text-sm mt-0.5">
                    {getOrGenerateBillNumber(selectedOrder)}
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-2xl">
                  <div className="text-gray-400 font-bold uppercase text-[9px]">AWB Code</div>
                  <a href={getTrackingUrl(selectedOrder.awb_code, selectedOrder.courier_name)} target="_blank" rel="noreferrer" className="text-emerald-600 font-mono font-bold hover:underline text-sm block mt-0.5">
                    {selectedOrder.awb_code || '—'}
                  </a>
                </div>

                <div className="bg-gray-50 p-3 rounded-2xl">
                  <div className="text-gray-400 font-bold uppercase text-[9px]">Payment & Amount</div>
                  <div className="font-extrabold text-gray-900 text-sm mt-0.5">
                    ₹{Number(selectedOrder.sub_total || 0).toLocaleString('en-IN')}{' '}
                    <span className="text-[10px] font-normal text-gray-500 uppercase">({selectedOrder.payment_method})</span>
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-2xl">
                  <div className="text-gray-400 font-bold uppercase text-[9px]">Customer Name</div>
                  <div className="font-bold text-gray-800 text-xs mt-0.5">{selectedOrder.billing_customer_name || '—'}</div>
                </div>

                <div className="bg-gray-50 p-3 rounded-2xl">
                  <div className="text-gray-400 font-bold uppercase text-[9px]">Phone Number</div>
                  <div className="font-mono text-gray-800 text-xs mt-0.5">{selectedOrder.billing_phone || '—'}</div>
                </div>

                <div className="bg-gray-50 p-3 rounded-2xl col-span-2">
                  <div className="text-gray-400 font-bold uppercase text-[9px]">Delivery Address</div>
                  <div className="font-medium text-gray-700 text-xs mt-0.5">
                    {[selectedOrder.billing_address, selectedOrder.billing_city, selectedOrder.billing_state, selectedOrder.billing_pincode].filter(Boolean).join(', ') || '—'}
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-2xl">
                  <div className="text-gray-400 font-bold uppercase text-[9px]">Delivered Timestamp</div>
                  <div className="font-medium text-gray-800 text-xs mt-0.5">
                    {fmtDate(selectedOrder.delivered_at || selectedOrder.status_updated_at || selectedOrder.createdAt)}
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-2xl">
                  <div className="text-gray-400 font-bold uppercase text-[9px]">Verification Staff</div>
                  <div className="font-bold text-gray-800 text-xs mt-0.5">
                    {selectedOrder.staff_name || selectedOrder.verification_staff_name || 'System Auto'}
                  </div>
                </div>
              </div>

              {/* Order Items */}
              {selectedOrder.order_items && selectedOrder.order_items.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Package Contents</h4>
                  <div className="bg-gray-50 rounded-2xl p-3 divide-y divide-gray-200/60">
                    {selectedOrder.order_items.map((item, idx) => (
                      <div key={idx} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-semibold text-gray-800">{item.name || item.product_name || 'Item'}</div>
                          {item.sku && <div className="text-[10px] text-gray-400 font-mono">SKU: {item.sku}</div>}
                        </div>
                        <div className="font-bold text-gray-700">
                          {item.units || item.quantity || 1} x ₹{item.selling_price || item.price || 0}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  const o = selectedOrder;
                  setSelectedOrder(null);
                  openSingleInvoice(o);
                }}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition flex items-center gap-1.5"
              >
                <span>🧾</span>
                <span>Print Tax Invoice</span>
              </button>
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE INVOICE MODAL */}
      <InvoiceModal
        isOpen={invoiceModalOpen}
        onClose={() => { setInvoiceModalOpen(false); setInvoiceShipment(null); }}
        shipment={invoiceShipment}
        deliveryIndex={1}
        doctorFee={invoiceDoctorFee}
        onDoctorFeeChange={setInvoiceDoctorFee}
        taxMode={invoiceTaxMode}
        onTaxModeChange={setInvoiceTaxMode}
      />

      {/* BULK INVOICE MODAL */}
      <BulkInvoiceModal
        isOpen={bulkInvoiceModalOpen}
        onClose={() => setBulkInvoiceModalOpen(false)}
        selectedOrders={orders.filter(o => selectedOrderIds.includes(o._id || o.order_id))}
        from={from}
        to={to}
      />

      {/* CSV EXPORT MODAL */}
      <CsvExportModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onExport={handleExecuteExportCSV}
        totalOrders={totalOrders}
      />
    </div>
  );
}
