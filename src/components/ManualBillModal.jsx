import { useState, useEffect } from 'react';
import * as smxSvc from '../services/shipmaxx.service';

const PIN_PREFIX_TO_STATE = {
  '11': 'Delhi',
  '12': 'Haryana', '13': 'Haryana',
  '14': 'Punjab', '15': 'Punjab', '16': 'Chandigarh',
  '17': 'Himachal Pradesh',
  '18': 'Jammu & Kashmir', '19': 'Jammu & Kashmir',
  '20': 'Uttar Pradesh', '21': 'Uttar Pradesh', '22': 'Uttar Pradesh', '23': 'Uttar Pradesh',
  '24': 'Uttar Pradesh', '25': 'Uttar Pradesh', '26': 'Uttar Pradesh', '27': 'Uttar Pradesh', '28': 'Uttar Pradesh',
  '30': 'Rajasthan', '31': 'Rajasthan', '32': 'Rajasthan', '33': 'Rajasthan', '34': 'Rajasthan',
  '36': 'Gujarat', '37': 'Gujarat', '38': 'Gujarat', '39': 'Gujarat',
  '40': 'Maharashtra', '41': 'Maharashtra', '42': 'Maharashtra', '43': 'Maharashtra', '44': 'Maharashtra',
  '45': 'Madhya Pradesh', '46': 'Madhya Pradesh', '47': 'Madhya Pradesh', '48': 'Madhya Pradesh', '49': 'Chhattisgarh',
  '50': 'Telangana',
  '51': 'Andhra Pradesh', '52': 'Andhra Pradesh', '53': 'Andhra Pradesh',
  '56': 'Karnataka', '57': 'Karnataka', '58': 'Karnataka', '59': 'Karnataka',
  '60': 'Tamil Nadu', '61': 'Tamil Nadu', '62': 'Tamil Nadu', '63': 'Tamil Nadu', '64': 'Tamil Nadu',
  '67': 'Kerala', '68': 'Kerala', '69': 'Kerala',
  '70': 'West Bengal', '71': 'West Bengal', '72': 'West Bengal', '73': 'West Bengal', '74': 'West Bengal',
  '75': 'Odisha', '76': 'Odisha', '77': 'Odisha',
  '78': 'Assam', '79': 'North East',
  '80': 'Bihar', '81': 'Bihar', '82': 'Bihar', '83': 'Jharkhand', '84': 'Bihar', '85': 'Bihar'
};

const COURIER_OPTIONS = [
  'Manual Delivery',
  'ShipMaxx',
  'Shadowfax',
  'Xpressbees',
  'Delhivery',
  'BlueDart',
  'DTDC',
  'India Post'
];

const GST_OPTIONS = [
  { value: 0, label: 'Exempt (0%)' },
  { value: 5, label: '5%' },
  { value: 12, label: '12% (Ayurveda)' },
  { value: 18, label: '18%' },
  { value: 28, label: '28%' }
];

export default function ManualBillModal({ isOpen, onClose, onSuccess, editOrder = null }) {
  const [loadingSeq, setLoadingSeq] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [nextBillNumber, setNextBillNumber] = useState('TW-....');
  const [errorMsg, setErrorMsg] = useState('');

  // Bill No & AWB Tracking
  const [billNumber, setBillNumber] = useState('');
  const [awbCode, setAwbCode] = useState('');
  const [courierName, setCourierName] = useState('Manual Delivery');
  const [orderId, setOrderId] = useState('');

  // Organization & Invoice Meta
  const [companyName, setCompanyName] = useState('TRIVEN WELLNESS LLP');
  const [deliveredDate, setDeliveredDate] = useState(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [paymentMethod, setPaymentMethod] = useState('COD');

  // Customer Info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Uttar Pradesh');
  const [pincode, setPincode] = useState('');

  // Doctor Consultation Charges (Fully Editable)
  const [includeDoctorFee, setIncludeDoctorFee] = useState(true);
  const [doctorFeeName, setDoctorFeeName] = useState('Doctor Consultation Charges');
  const [doctorFeeHsn, setDoctorFeeHsn] = useState('999312');
  const [doctorFeeQty, setDoctorFeeQty] = useState(0);
  const [doctorFeeRate, setDoctorFeeRate] = useState(0);
  const [doctorFeeTax, setDoctorFeeTax] = useState(0);

  // Product Items
  const [items, setItems] = useState([
    {
      id: 1,
      name: 'Migraine Wellness',
      sku: 'MIG-01',
      hsn: '30049011',
      units: 1,
      selling_price: 1500,
      tax: 0,
    }
  ]);

  // Initialize form for Create or Edit mode
  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg('');
    if (editOrder) {
      // ── EDIT MODE ──────────────────────────────────────────────────────────
      const bNum = editOrder.bill_number || editOrder.billNumber || '';
      setBillNumber(bNum);
      setNextBillNumber(bNum || 'TW-0001');
      setAwbCode(editOrder.awb_code || '');
      setOrderId(editOrder.order_id || '');
      setCourierName(editOrder.courier_name || 'Manual Delivery');
      setCompanyName(editOrder.company_name || 'TRIVEN WELLNESS LLP');
      setPaymentMethod(editOrder.payment_method || 'COD');

      const dVal = editOrder.delivered_at || editOrder.status_updated_at || editOrder.createdAt;
      if (dVal) {
        try {
          const dObj = new Date(dVal);
          if (!isNaN(dObj.getTime())) {
            const yyyy = dObj.getFullYear();
            const mm = String(dObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dObj.getDate()).padStart(2, '0');
            setDeliveredDate(`${yyyy}-${mm}-${dd}`);
          }
        } catch (_) {}
      }

      setCustomerName(editOrder.billing_customer_name || '');
      setCustomerPhone(editOrder.billing_phone || '');
      setCustomerEmail(editOrder.billing_email || '');
      setAddress(editOrder.billing_address || '');
      setCity(editOrder.billing_city || '');
      setState(editOrder.billing_state || 'Uttar Pradesh');
      setPincode(String(editOrder.billing_pincode || ''));

      // Doctor fee
      const dFee = Number(editOrder.doctor_fee || 0);
      if (dFee > 0) {
        setIncludeDoctorFee(true);
        setDoctorFeeName(editOrder.doctor_fee_name || 'Doctor Consultation Charges');
        setDoctorFeeHsn(editOrder.doctor_fee_hsn || '999312');
        setDoctorFeeQty(1);
        setDoctorFeeRate(dFee);
        setDoctorFeeTax(Number(editOrder.doctor_fee_tax || 0));
      } else {
        setIncludeDoctorFee(false);
        setDoctorFeeRate(0);
        setDoctorFeeQty(0);
        setDoctorFeeTax(0);
      }

      // Order items
      if (Array.isArray(editOrder.order_items) && editOrder.order_items.length > 0) {
        setItems(editOrder.order_items.map((it, idx) => ({
          id: idx + 1,
          name: it.name || it.product_name || 'Ayurvedic Medicine',
          sku: it.sku || `MED-${idx + 1}`,
          hsn: it.hsn || '30049011',
          units: Number(it.units) || 1,
          selling_price: Number(it.selling_price) || 0,
          tax: Number(it.tax) || 0,
        })));
      } else if (Number(editOrder.sub_total || 0) > 0) {
        setItems([{
          id: 1,
          name: 'Ayurvedic Wellness Package',
          sku: 'MED-01',
          hsn: '30049011',
          units: 1,
          selling_price: Math.max(0, Number(editOrder.sub_total) - dFee),
          tax: 0,
        }]);
      } else {
        setItems([]);
      }
    } else {
      // ── CREATE MODE ────────────────────────────────────────────────────────
      setAwbCode('');
      setOrderId('');
      setCourierName('Manual Delivery');
      setCompanyName('TRIVEN WELLNESS LLP');
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      setDeliveredDate(`${yyyy}-${mm}-${dd}`);
      setPaymentMethod('COD');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setAddress('');
      setCity('');
      setState('Uttar Pradesh');
      setPincode('');
      setIncludeDoctorFee(true);
      setDoctorFeeName('Doctor Consultation Charges');
      setDoctorFeeHsn('999312');
      setDoctorFeeQty(0);
      setDoctorFeeRate(0);
      setDoctorFeeTax(0);
      setItems([
        {
          id: 1,
          name: 'Migraine Wellness',
          sku: 'MIG-01',
          hsn: '30049011',
          units: 1,
          selling_price: 1500,
          tax: 0,
        }
      ]);

      setLoadingSeq(true);
      smxSvc.getNextBillSeq()
        .then(res => {
          const autoNum = res.data?.data?.billNumber || 'TW-0001';
          setNextBillNumber(autoNum);
          setBillNumber(autoNum);
        })
        .catch(() => {
          setNextBillNumber('TW-0001');
          setBillNumber('TW-0001');
        })
        .finally(() => setLoadingSeq(false));
    }
  }, [isOpen, editOrder]);

  // Quick generators
  const handleResetToAutoBill = () => {
    setBillNumber(nextBillNumber);
  };

  const handleGenerateRandomAwb = () => {
    const randomAwb = String(Math.floor(100000000000 + Math.random() * 900000000000));
    setAwbCode(randomAwb);
    if (!orderId) {
      setOrderId(`MNL-${randomAwb.slice(-6)}`);
    }
  };

  // Auto detect state on pincode change
  const handlePincodeChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPincode(val);
    if (val.length >= 2 && PIN_PREFIX_TO_STATE[val.slice(0, 2)]) {
      setState(PIN_PREFIX_TO_STATE[val.slice(0, 2)]);
    }
  };

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: Date.now(),
        name: 'Ayurvedic Medicine',
        sku: `MED-${prev.length + 1}`,
        hsn: '30049011',
        units: 1,
        selling_price: 1000,
        tax: 0,
      }
    ]);
  };

  const handleRemoveItem = (id) => {
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const handleUpdateItem = (id, field, value) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      return { ...it, [field]: value };
    }));
  };

  if (!isOpen) return null;

  // Determine state & tax type
  const cleanState = (state || '').toLowerCase().replace(/[^a-z]/g, '');
  const isIntraState = cleanState === 'up' || cleanState === 'uttarpradesh' || cleanState.includes('uttarpradesh');

  // Doctor fee total & tax calculation
  const doctorTotal = includeDoctorFee ? (Number(doctorFeeQty) || 0) * (Number(doctorFeeRate) || 0) : 0;
  let doctorTaxable = doctorTotal;
  let doctorCGST = 0;
  let doctorSGST = 0;
  let doctorIGST = 0;

  if (includeDoctorFee && Number(doctorFeeTax) > 0 && doctorTotal > 0) {
    const dTaxPct = Number(doctorFeeTax);
    doctorTaxable = Math.round((doctorTotal / (1 + (dTaxPct / 100))) * 100) / 100;
    const dGstAmt = Math.round((doctorTotal - doctorTaxable) * 100) / 100;
    if (isIntraState) {
      const half = Math.round((dGstAmt / 2) * 100) / 100;
      doctorCGST = half;
      doctorSGST = Math.round((dGstAmt - half) * 100) / 100;
    } else {
      doctorIGST = dGstAmt;
    }
  }

  // Product items total & tax calculations
  let productTaxableTotal = doctorTaxable;
  let totalCGST = doctorCGST;
  let totalSGST = doctorSGST;
  let totalIGST = doctorIGST;
  let productGrandTotal = 0;

  items.forEach(it => {
    const qty = Number(it.units) || 0;
    const rate = Number(it.selling_price) || 0;
    const lineTotal = rate * qty;
    productGrandTotal += lineTotal;

    const taxPct = Number(it.tax) || 0;
    if (taxPct > 0 && lineTotal > 0) {
      const taxable = Math.round((lineTotal / (1 + (taxPct / 100))) * 100) / 100;
      const gstAmount = Math.round((lineTotal - taxable) * 100) / 100;
      productTaxableTotal += taxable;

      if (isIntraState) {
        const half = Math.round((gstAmount / 2) * 100) / 100;
        totalCGST += half;
        totalSGST += Math.round((gstAmount - half) * 100) / 100;
      } else {
        totalIGST += gstAmount;
      }
    } else {
      productTaxableTotal += lineTotal;
    }
  });

  const grandTotal = Math.round((productGrandTotal + doctorTotal) * 100) / 100;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    setSubmitting(true);
    setErrorMsg('');

    try {
      const finalBill = (billNumber && billNumber.trim()) || nextBillNumber;
      const finalAwb = (awbCode && awbCode.trim()) || undefined;
      const finalOrdId = (orderId && orderId.trim()) || undefined;

      const finalCustName = (customerName && customerName.trim()) || 'Direct Customer';
      const finalCustPhone = (customerPhone && customerPhone.trim()) || '9999999999';

      const payload = {
        customer: {
          name: finalCustName,
          phone: finalCustPhone,
          email: customerEmail.trim(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim() || 'Uttar Pradesh',
          pincode: pincode.trim(),
        },
        bill_number: finalBill,
        awb_code: finalAwb,
        order_id: finalOrdId,
        courier_name: courierName.trim() || 'Manual Delivery',
        payment_method: paymentMethod,
        delivered_at: deliveredDate ? `${deliveredDate}T${new Date().toTimeString().split(' ')[0]}.000+05:30` : new Date().toISOString(),
        doctor_fee: doctorTotal,
        doctor_fee_name: doctorFeeName.trim() || 'Doctor Consultation Charges',
        doctor_fee_hsn: doctorFeeHsn.trim() || '999312',
        doctor_fee_tax: Number(doctorFeeTax) || 0,
        company_name: companyName.trim() || 'TRIVEN WELLNESS LLP',
        sub_total: grandTotal,
        order_items: items.map(it => ({
          name: it.name.trim() || 'Product',
          sku: it.sku.trim() || 'SKU-01',
          units: Number(it.units) || 1,
          selling_price: Number(it.selling_price) || 0,
          tax: String(it.tax || 0),
          hsn: it.hsn.trim() || '30049011',
        })),
      };

      if (editOrder) {
        const targetId = editOrder._id || editOrder.order_id;
        const res = await smxSvc.updateManualBill(targetId, payload);
        const updated = res.data?.data;
        if (onSuccess) {
          onSuccess(updated, true);
        }
        onClose();
      } else {
        const res = await smxSvc.createManualBill(payload);
        const created = res.data?.data;
        if (onSuccess) {
          onSuccess(created, false);
        }
        onClose();
      }
    } catch (err) {
      console.error('[ManualBillModal] Error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to create manual bill';
      setErrorMsg(errMsg);
      alert('Error creating bill: ' + errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && !submitting && onClose()}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div className="bg-white rounded-3xl max-w-3xl w-full my-6 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 border border-emerald-100 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 p-6 text-white relative shrink-0">
          <button
            onClick={onClose}
            disabled={submitting}
            className="absolute right-5 top-5 w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {editOrder ? 'Edit Delivered Bill' : 'Manual Delivered Bill Creation'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-teal-400 text-teal-950 text-xs font-mono font-extrabold shadow-sm">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Bill No: {billNumber || nextBillNumber}</span>
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
            {editOrder ? 'Edit Delivered Bill & Tax Invoice' : 'Create Manual Delivered Bill & Tax Invoice'}
          </h3>
          <p className="text-emerald-200/80 text-xs mt-1 max-w-xl">
            {editOrder
              ? 'Update customer details, bill number, AWB tracking, medicines, and doctor fee. Changes reflect immediately across tax invoices and reports.'
              : 'Enter your custom Bill No. and AWB Tracking Number, or use the automatic consecutive sequence to keep counting accurate.'}
          </p>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Bill Number & AWB Tracking (USER REQUESTED HIGHLIGHT) */}
          <div className="bg-gradient-to-r from-teal-50/90 via-emerald-50/80 to-teal-50/90 p-4 rounded-2xl border-2 border-emerald-300/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                <svg className="w-4 h-4 text-emerald-800 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
                <span>Bill Number & AWB Tracking Information</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-xs">
                Custom or Auto
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Bill Number Field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-emerald-950 flex items-center gap-1">
                    <span>Bill Number / Invoice No.</span>
                    <span className="text-red-500">*</span>
                  </label>
                  {billNumber !== nextBillNumber && (
                    <button
                      type="button"
                      onClick={handleResetToAutoBill}
                      className="text-[10px] text-emerald-700 font-bold hover:underline"
                    >
                      ↺ Reset to {nextBillNumber}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={billNumber}
                    onChange={e => setBillNumber(e.target.value)}
                    placeholder={nextBillNumber}
                    className="w-full pl-8 pr-3 py-2 border-2 border-emerald-300 rounded-xl text-xs font-mono font-extrabold text-emerald-900 bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                </div>
                <p className="text-[10px] text-gray-500">
                  Default: <strong>{nextBillNumber}</strong> (Consecutive sequence). You can edit or enter your own.
                </p>
              </div>

              {/* AWB Tracking Field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-emerald-950 flex items-center gap-1">
                    <span>AWB / Tracking Number</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomAwb}
                    className="text-[10px] text-teal-800 font-bold hover:underline flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5 text-teal-800 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Auto Generate AWB</span>
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={awbCode}
                    onChange={e => setAwbCode(e.target.value)}
                    placeholder="e.g. 372537513255, SF1234567, or AWB code"
                    className="w-full pl-8 pr-3 py-2 border-2 border-teal-300 rounded-xl text-xs font-mono font-extrabold text-teal-900 bg-white focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                  />
                </div>
                <p className="text-[10px] text-gray-500">
                  Courier tracking AWB. Leave blank to auto-generate a unique manual AWB.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-emerald-200/60">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Courier Partner</label>
                <div className="flex gap-2">
                  <select
                    value={courierName}
                    onChange={e => setCourierName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {COURIER_OPTIONS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Order / Ref ID (Optional)</label>
                <input
                  type="text"
                  value={orderId}
                  onChange={e => setOrderId(e.target.value)}
                  placeholder="Leave blank to auto-generate from AWB"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono font-semibold bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Organization & Invoice Parameters */}
          <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-100 space-y-4">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>Organization & Invoice Parameters</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Company / Seller Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Delivered / Bill Date</label>
                <input
                  type="date"
                  value={deliveredDate}
                  onChange={e => setDeliveredDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold bg-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="COD">COD (Cash On Delivery)</option>
                  <option value="Prepaid">Prepaid (Online Paid)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Customer Information */}
          <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-100 space-y-4">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Customer Information</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Customer Name <span className="text-gray-400 font-normal">(Default: Direct Customer)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar (or leave blank for Direct Customer)"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Customer Phone <span className="text-gray-400 font-normal">(Default: 9999999999)</span>
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210 (or leave blank)"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono font-bold bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">Complete Address</label>
              <input
                type="text"
                placeholder="House no, Street, Landmark, Area"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Pincode</label>
                <input
                  type="text"
                  placeholder="e.g. 208017"
                  value={pincode}
                  onChange={handlePincodeChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono font-bold bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  placeholder="e.g. Kanpur"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  placeholder="e.g. Uttar Pradesh"
                  value={state}
                  onChange={e => setState(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold text-emerald-800 bg-white focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-gray-500 mt-1 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${isIntraState ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                  <span>{isIntraState ? 'Intra-State (CGST + SGST)' : 'Inter-State (IGST)'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Line Items (Full Remove & Add Supported) */}
          <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-100 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                <span>Bill Line Items & Services</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!includeDoctorFee && (
                  <button
                    type="button"
                    onClick={() => {
                      setIncludeDoctorFee(true);
                      setDoctorFeeQty(1);
                      setDoctorFeeRate(0);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-teal-100 text-teal-800 hover:bg-teal-200 font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add Doctor Consultation</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add Medicine</span>
                </button>
              </div>
            </div>

            {/* Line: Doctor Consultation Charges (Full Editable: Name, SAC, Qty, Rate, Tax) */}
            {includeDoctorFee && (
              <div className="bg-white p-3.5 rounded-xl border-2 border-teal-200/90 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-teal-800 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>1. {doctorFeeName || 'Doctor Consultation Charges'}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                      {Number(doctorFeeTax) > 0 ? `${doctorFeeTax}% GST` : 'Exempt (0%)'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIncludeDoctorFee(false);
                        setDoctorFeeRate(0);
                        setDoctorFeeQty(0);
                      }}
                      className="px-2.5 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 font-bold rounded-lg transition flex items-center gap-1 border border-red-200 cursor-pointer"
                      title="Remove Doctor Consultation Charges"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Remove</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 text-xs">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Service / Charge Name</label>
                    <input
                      type="text"
                      value={doctorFeeName}
                      onChange={e => setDoctorFeeName(e.target.value)}
                      placeholder="e.g. Doctor Consultation Charges"
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">SAC / HSN Code</label>
                    <input
                      type="text"
                      value={doctorFeeHsn}
                      onChange={e => setDoctorFeeHsn(e.target.value)}
                      placeholder="999312"
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-mono font-semibold focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Quantity</label>
                    <input
                      type="number"
                      min="0"
                      value={doctorFeeQty}
                      onChange={e => setDoctorFeeQty(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Rate / Price (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={doctorFeeRate}
                      onChange={e => setDoctorFeeRate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">GST Rate</label>
                    <select
                      value={doctorFeeTax}
                      onChange={e => setDoctorFeeTax(Number(e.target.value))}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold cursor-pointer focus:outline-none focus:border-teal-500"
                    >
                      {GST_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-1 border-t border-teal-50 text-[11px]">
                  <span className="text-gray-400">
                    {Number(doctorFeeTax) > 0 ? `Includes ${doctorFeeTax}% GST` : 'Tax Exempt (0%)'}
                  </span>
                  <span className="font-extrabold text-teal-900">
                    Line Total: ₹{doctorTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Line: Products (Full Editable: Name, HSN, Qty, Rate, Tax) */}
            <div className="space-y-3">
              {items.length === 0 && (
                <div className="p-4 rounded-xl border border-dashed border-gray-300 text-center text-xs text-gray-500 bg-white space-y-1">
                  <p>No medicines added.</p>
                  {!includeDoctorFee && (
                    <p className="text-[11px] text-amber-700 font-medium">
                      (A blank bill will be created. You can click <strong>&quot;+ Add Doctor Consultation&quot;</strong> or <strong>&quot;+ Add Medicine&quot;</strong> above anytime.)
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-emerald-700 font-bold hover:underline"
                  >
                    + Click here to add a medicine
                  </button>
                </div>
              )}

              {items.map((it, idx) => {
                const lineTotal = (Number(it.units) || 0) * (Number(it.selling_price) || 0);
                const itemNum = (includeDoctorFee ? 1 : 0) + idx + 1;
                return (
                  <div key={it.id} className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <span>{itemNum}. {it.name || 'Medicine Product'}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(it.id)}
                        className="px-2.5 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 font-bold rounded-lg transition flex items-center gap-1 border border-red-200 cursor-pointer"
                        title="Remove this medicine"
                      >
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Remove</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 text-xs">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Product Name</label>
                        <input
                          type="text"
                          value={it.name}
                          onChange={e => handleUpdateItem(it.id, 'name', e.target.value)}
                          placeholder="e.g. Migraine Wellness"
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">HSN Code</label>
                        <input
                          type="text"
                          value={it.hsn}
                          onChange={e => handleUpdateItem(it.id, 'hsn', e.target.value)}
                          placeholder="30049011"
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-mono font-semibold focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Quantity</label>
                        <input
                          type="number"
                          min="0"
                          value={it.units}
                          onChange={e => handleUpdateItem(it.id, 'units', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Rate / Price (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={it.selling_price}
                          onChange={e => handleUpdateItem(it.id, 'selling_price', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">GST Rate</label>
                        <select
                          value={it.tax}
                          onChange={e => handleUpdateItem(it.id, 'tax', Number(e.target.value))}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold cursor-pointer focus:outline-none focus:border-emerald-500"
                        >
                          {GST_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-gray-50 text-[11px]">
                      <span className="text-gray-400">
                        {Number(it.tax) > 0 ? `Includes ${it.tax}% GST` : 'Tax Exempt'}
                      </span>
                      <span className="font-extrabold text-gray-900">
                        Line Total: ₹{lineTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 5: Live Invoice Total Summary */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 p-4 rounded-2xl border border-emerald-100 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-gray-700 space-y-1">
              <div>
                <span className="text-gray-500">Tax Breakdown ({isIntraState ? 'Intra-State: CGST + SGST' : 'Inter-State: IGST'}):</span>{' '}
                <span className="font-mono font-bold text-emerald-800">
                  {isIntraState ? `CGST: ₹${totalCGST.toFixed(2)} | SGST: ₹${totalSGST.toFixed(2)}` : `IGST: ₹${totalIGST.toFixed(2)}`}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Doctor Consultation Fee:</span>{' '}
                <span className="font-mono font-bold text-gray-800">₹{doctorTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Grand Total</span>
              <span className="text-2xl font-extrabold text-emerald-950 font-mono tracking-tight">
                ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Sticky Footer (Always Visible) */}
        <div className="bg-slate-50/90 backdrop-blur-sm border-t border-slate-200 px-6 py-4 shrink-0 space-y-2">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-left">
                <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">Grand Total</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-900 font-mono tracking-tight">
                  ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <span className="text-xs text-gray-400">|</span>
              <div className="text-left">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Bill No</span>
                <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                  {billNumber || nextBillNumber}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-200 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Bill {billNumber}...</span>
                  </>
                ) : editOrder ? (
                  <>
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Save Changes (Update Bill {billNumber})</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Create Bill ({billNumber || nextBillNumber})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
      </div>
    </div>
  );
}
