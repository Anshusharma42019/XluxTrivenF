import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { saveInvoiceHistory } from '../services/opsDashboard.service';
import * as smxSvc from '../services/shipmaxx.service';

/* ─── Company Constants ──────────────────────────────────────────────────── */
const COMPANY = {
  name: 'TRIVEN WELLNESS LLP',
  gstin: '09AAZFT9024A1ZS',
  address: 'RPN/ 341(7), Harmilap Society,\nRana Pratap Nagar, Keshavpuram,\nKalyanpur, Kanpur Nagar,\nUttar Pradesh, India - 208017',
  state: 'Uttar Pradesh',
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const fmtCurrency = (n) => {
  const num = Number(n) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const generateBillNumber = (order) => {
  if (!order) return '—';
  const orderDate = new Date(order.delivered_at || order.status_updated_at || order.createdAt);
  const septCutoff = new Date('2026-09-01T00:00:00.000+05:30');
  if (isNaN(orderDate.getTime()) || orderDate < septCutoff) return '—';

  if (order.bill_seq) return `TW-${String(order.bill_seq).padStart(4, '0')}`;
  if (order.bill_number && /^TW-\d+$/.test(order.bill_number)) return order.bill_number;
  if (order.billNumber && /^TW-\d+$/.test(order.billNumber)) return order.billNumber;
  return '—';
};

const formatDisplayDate = (dStr) => {
  if (!dStr) return '—';
  try {
    const parts = dStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  } catch (_) {}
  return dStr;
};

export const amountInWordsINR = (num) => {
  const n = Math.round(Number(num) * 100) / 100;
  if (!n || isNaN(n) || n <= 0) return 'INR Zero Only';

  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertTwoDigits = (v) => {
    if (v < 20) return a[v];
    const tens = Math.floor(v / 10);
    const ones = v % 10;
    return b[tens] + (ones ? ' ' + a[ones] : '');
  };

  const convertSection = (v) => {
    let str = '';
    if (v >= 100) {
      str += a[Math.floor(v / 100)] + ' Hundred ';
      v %= 100;
    }
    if (v > 0) {
      str += convertTwoDigits(v);
    }
    return str.trim();
  };

  const intPart = Math.floor(n);
  const fracPart = Math.round((n - intPart) * 100);

  let result = '';
  const crore = Math.floor(intPart / 10000000);
  let rem = intPart % 10000000;

  const lakh = Math.floor(rem / 100000);
  rem = rem % 100000;

  const thousand = Math.floor(rem / 1000);
  rem = rem % 1000;

  const hundred = rem;

  if (crore > 0) result += convertSection(crore) + ' Crore ';
  if (lakh > 0) result += convertSection(lakh) + ' Lakh ';
  if (thousand > 0) result += convertSection(thousand) + ' Thousand ';
  if (hundred > 0) result += convertSection(hundred);

  result = result.trim();
  if (!result) result = 'Zero';

  let finalStr = `INR ${result}`;
  if (fracPart > 0) {
    finalStr += ` and ${convertSection(fracPart)} Paise`;
  }
  return `${finalStr} Only`;
};

/* ─── Print Styles ───────────────────────────────────────────────────────── */
const PRINT_STYLES = `
  .invoice-print-only { display: none !important; }
  @media print {
    /* Hide the entire React app */
    #root { display: none !important; }
    
    /* Hide other body elements except the portal container */
    body > *:not(.invoice-portal-container) { display: none !important; }
    
    html, body {
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
    }

    /* Force portal container to be a simple block */
    .invoice-portal-container {
      display: block !important;
      position: static !important;
      width: 100% !important;
      height: 100% !important;
      background: #fff !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    
    /* Remove modal overlays and centering */
    .invoice-overlay {
      position: static !important;
      background: none !important;
      backdrop-filter: none !important;
      display: block !important;
      padding: 0 !important;
      overflow: visible !important;
      width: 100% !important;
      height: 100% !important;
    }
    
    .invoice-modal-box {
      position: static !important;
      box-shadow: none !important;
      max-height: none !important;
      overflow: visible !important;
      width: 100% !important;
      max-width: none !important;
      background: #fff !important;
      border-radius: 0 !important;
      border: none !important;
      padding: 0 !important;
      margin: 0 !important;
      height: 100% !important;
    }
    
    .invoice-print-area {
      padding: 0 !important;
      margin: 0 auto !important;
      width: 100% !important;
      height: 100% !important;
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /* FULL A4 PAGE ENCLOSING BOX (fills full 282mm height) */
    .invoice-outer-box {
      border: 2px solid #000 !important;
      box-sizing: border-box !important;
      width: 100% !important;
      min-height: 282mm !important;
      height: 282mm !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .invoice-table-container {
      flex: 1 1 auto !important;
      display: flex !important;
      flex-direction: column !important;
      width: 100% !important;
      height: 100% !important;
      border-top: 1.5px solid #000 !important;
      border-bottom: 1.5px solid #000 !important;
    }

    .invoice-table {
      border-collapse: collapse !important;
      width: 100% !important;
      height: 100% !important;
      flex: 1 1 auto !important;
    }

    .invoice-table tbody {
      height: 100% !important;
    }

    .invoice-table-spacer {
      height: 100% !important;
    }

    .invoice-table th,
    .invoice-table td {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .invoice-table th.col-total,
    .invoice-table td.col-total {
      border-right: none !important;
    }

    .invoice-no-print { display: none !important; }
    .invoice-print-only { display: block !important; }
    span.invoice-print-only { display: inline-block !important; }
    
    @page {
      margin: 6mm 6mm;
      size: A4 portrait;
    }
  }
`;

/* ─── Shared cell styles ──────────────────────────────────────────────────── */
const thBase = {
  padding: '8px 6px',
  fontSize: 11.5,
  fontWeight: 700,
  color: '#000',
  background: '#f8fafc',
  borderTop: '1.5px solid #000',
  borderRight: '1px solid #000',
  borderBottom: '1.5px solid #000',
  verticalAlign: 'middle',
  boxSizing: 'border-box',
};

const tdBase = {
  padding: '8px 6px',
  fontSize: 12,
  color: '#000',
  borderRight: '1px solid #000',
  borderBottom: '1px solid #000',
  verticalAlign: 'middle',
  boxSizing: 'border-box',
};
/* ─── Component ──────────────────────────────────────────────────────────── */
export default function InvoiceModal({
  isOpen,
  onClose,
  shipment,
  deliveryIndex = 1,
  doctorFee = 0,
  onDoctorFeeChange,
  taxMode = 'inter',
  onTaxModeChange,
  onSaveSuccess
}) {
  const printRef = useRef(null);
  const [lineItemsState, setLineItemsState] = useState([]);

  // Doctor Consultation Charges State (Fully Editable)
  const [showDoctorRow, setShowDoctorRow] = useState(false);
  const [doctorDesc, setDoctorDesc] = useState('Doctor Consultation Charges');
  const [doctorHsn, setDoctorHsn] = useState('999312');
  const [doctorQty, setDoctorQty] = useState(1);
  const [doctorTax, setDoctorTax] = useState(0);

  // FROM / Seller Information (Fully Editable)
  const [fromName, setFromName] = useState(COMPANY.name);
  const [fromGstin, setFromGstin] = useState(COMPANY.gstin);
  const [fromAddress, setFromAddress] = useState(COMPANY.address);

  // TO / Customer Information (Fully Editable)
  const [custName, setCustName] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custCity, setCustCity] = useState('');
  const [custState, setCustState] = useState('Uttar Pradesh');
  const [custPincode, setCustPincode] = useState('');
  const [custPhone, setCustPhone] = useState('');

  // Bill No & Date (Fully Editable)
  const [customBillNumber, setCustomBillNumber] = useState('');
  const [invoiceDateStr, setInvoiceDateStr] = useState('');

  // Save State
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Initialize state based on shipment data
  useEffect(() => {
    if (shipment) {
      // ── FROM Info ──
      setFromName(shipment.company_name || COMPANY.name);
      setFromGstin(shipment.raw_response?.company_gstin || shipment.company_gstin || COMPANY.gstin);
      setFromAddress(shipment.raw_response?.company_address || shipment.company_address || COMPANY.address);

      // ── TO Info ──
      setCustName(shipment.billing_customer_name || '');
      setCustAddress(shipment.billing_address || '');
      setCustCity(shipment.billing_city || '');
      setCustState(shipment.billing_state || 'Uttar Pradesh');
      setCustPincode(shipment.billing_pincode ? String(shipment.billing_pincode) : '');
      setCustPhone(shipment.billing_phone || '');

      // ── Bill Number & Date ──
      const bNum = generateBillNumber(shipment);
      setCustomBillNumber(bNum !== '—' ? bNum : (shipment.bill_number || shipment.billNumber || 'TW-0001'));

      const dVal = shipment.delivered_at || shipment.status_updated_at || shipment.createdAt || new Date();
      try {
        const dObj = new Date(dVal);
        if (!isNaN(dObj.getTime())) {
          const yyyy = dObj.getFullYear();
          const mm = String(dObj.getMonth() + 1).padStart(2, '0');
          const dd = String(dObj.getDate()).padStart(2, '0');
          setInvoiceDateStr(`${yyyy}-${mm}-${dd}`);
        } else {
          setInvoiceDateStr(new Date().toISOString().split('T')[0]);
        }
      } catch (_) {
        setInvoiceDateStr(new Date().toISOString().split('T')[0]);
      }

      // ── Doctor Row ──
      const docFee = Number(doctorFee) || Number(shipment.doctor_fee) || 0;
      const hasDocFee = docFee > 0;
      setShowDoctorRow(hasDocFee);
      setDoctorDesc(shipment.doctor_fee_name || 'Doctor Consultation Charges');
      setDoctorHsn(shipment.doctor_fee_hsn || '999312');
      setDoctorQty(1);
      setDoctorTax(Number(shipment.doctor_fee_tax) || 0);

      // ── Order Line Items ──
      const items = shipment.order_items || [];
      const computedItemsTotal = items.reduce((sum, item) => {
        return sum + (Number(item.selling_price) || 0) * (Number(item.units) || 1);
      }, 0);
      const totalUnits = items.reduce((sum, item) => {
        return sum + (Number(item.units) || 1);
      }, 0);

      const autoHsn = '30049011';

      const initialItems = items.map((item, idx) => {
        const qty = Number(item.units) || 1;
        const taxPct = Number(item.tax) || 0;

        let itemTotalInclusive = 0;
        if (computedItemsTotal === 0) {
          itemTotalInclusive = totalUnits > 0 ? (shipment.sub_total * qty) / totalUnits : 0;
        } else {
          const itemOriginalTotal = (Number(item.selling_price) || 0) * qty;
          itemTotalInclusive = (itemOriginalTotal / computedItemsTotal) * shipment.sub_total;
        }

        const unitRate = qty > 0 ? Math.round((itemTotalInclusive / qty) * 100) / 100 : itemTotalInclusive;

        return {
          id: idx,
          description: item.name || 'Product',
          hsn: item.hsn || autoHsn,
          qty,
          taxPct,
          unitRate,
          totalInclusive: itemTotalInclusive,
        };
      });

      if (initialItems.length === 0) {
        initialItems.push({
          id: 0,
          description: 'Ayurvedic Medicine',
          hsn: autoHsn,
          qty: 1,
          taxPct: 0,
          unitRate: Number(shipment.sub_total) || 0,
          totalInclusive: Number(shipment.sub_total) || 0,
        });
      }

      setLineItemsState(initialItems);
      setSaveSuccessMsg('');
    }
  }, [shipment, deliveryIndex]);

  if (!isOpen || !shipment) return null;

  const isIntraState = taxMode === 'intra';

  const updateItem = (id, field, value) => {
    setLineItemsState((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'qty' && updated.unitRate !== undefined) {
          updated.totalInclusive = updated.unitRate * (Number(value) || 1);
        }
        return updated;
      })
    );
  };

  const updateItemRate = (id, newRate) => {
    setLineItemsState((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const qty = Number(item.qty) || 1;
        return {
          ...item,
          unitRate: newRate,
          totalInclusive: newRate * qty,
        };
      })
    );
  };

  const handleAddProductItem = () => {
    setLineItemsState((prev) => [
      ...prev,
      {
        id: Date.now(),
        description: 'New Ayurvedic Item',
        hsn: '30049011',
        qty: 1,
        taxPct: 0,
        unitRate: 1000,
        totalInclusive: 1000,
      }
    ]);
  };

  const handleRemoveProductItem = (id) => {
    setLineItemsState((prev) => prev.filter((item) => item.id !== id));
  };

  // ── Build line items and perform calculations ──
  const doctorFeeNum = showDoctorRow ? (Number(doctorFee) || 0) : 0;
  const rawProductTotal = lineItemsState.reduce((s, li) => s + (Number(li.totalInclusive) || 0), 0);
  const deductionRatio = (rawProductTotal > 0 && doctorFeeNum > 0) ? (rawProductTotal - doctorFeeNum) / rawProductTotal : 1;

  let docAmount = doctorFeeNum;
  let docCgst = 0;
  let docSgst = 0;
  let docIgst = 0;
  if (doctorTax > 0 && doctorFeeNum > 0) {
    docAmount = Math.round((doctorFeeNum / (1 + (doctorTax / 100))) * 100) / 100;
    const docGst = Math.round((doctorFeeNum - docAmount) * 100) / 100;
    if (isIntraState) {
      docCgst = Math.round((docGst / 2) * 100) / 100;
      docSgst = Math.round((docGst - docCgst) * 100) / 100;
    } else {
      docIgst = docGst;
    }
  }

  const doctorConsultation = showDoctorRow ? {
    id: 'doctor-consultation',
    description: doctorDesc,
    hsn: doctorHsn ? (doctorHsn.includes('SAC') ? doctorHsn : `${doctorHsn}\n(SAC)`) : '999312\n(SAC)',
    qty: doctorQty,
    rate: doctorQty > 0 ? Math.round((docAmount / doctorQty) * 100) / 100 : docAmount,
    amount: docAmount,
    gstRate: doctorTax > 0 ? `${doctorTax}%` : 'Exempt\n(0%)',
    taxPct: doctorTax,
    cgst: docCgst,
    sgst: docSgst,
    igst: docIgst,
    total: doctorFeeNum,
    isDoctor: true,
  } : null;

  const productLineItems = lineItemsState.map((li) => {
    const adjustedTotal = Math.round((li.totalInclusive * deductionRatio) * 100) / 100;
    const qty = li.qty;
    const taxPct = li.taxPct;
    const totalInclusive = adjustedTotal;

    let amount = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (taxPct > 0) {
      amount = Math.round((totalInclusive / (1 + (taxPct / 100))) * 100) / 100;
      const gstAmount = Math.round((totalInclusive - amount) * 100) / 100;

      if (isIntraState) {
        cgst = Math.round((gstAmount / 2) * 100) / 100;
        sgst = Math.round((gstAmount - cgst) * 100) / 100;
      } else {
        igst = gstAmount;
      }
    } else {
      amount = totalInclusive;
    }

    const rate = qty > 0 ? Math.round((amount / qty) * 100) / 100 : 0;
    const itemTotal = Math.round((amount + cgst + sgst + igst) * 100) / 100;

    return {
      id: li.id,
      description: li.description,
      hsn: li.hsn,
      qty,
      rate,
      amount,
      gstRate: taxPct > 0 ? `${taxPct}%` : 'Exempt\n(0%)',
      taxPct,
      cgst,
      sgst,
      igst,
      total: itemTotal,
      isDoctor: false,
    };
  });

  const finalLineItems = [
    ...(doctorConsultation ? [doctorConsultation] : []),
    ...productLineItems
  ].map((item, idx) => ({
    ...item,
    sno: idx + 1
  }));

  // Calculations for totals
  const totalTaxableValue = Math.round(
    (productLineItems.reduce((s, li) => s + li.amount, 0) + (doctorConsultation ? doctorConsultation.amount : 0)) * 100
  ) / 100;
  const totalCGST = Math.round(
    (productLineItems.reduce((s, li) => s + li.cgst, 0) + (doctorConsultation ? doctorConsultation.cgst : 0)) * 100
  ) / 100;
  const totalSGST = Math.round(
    (productLineItems.reduce((s, li) => s + li.sgst, 0) + (doctorConsultation ? doctorConsultation.sgst : 0)) * 100
  ) / 100;
  const totalIGST = Math.round(
    (productLineItems.reduce((s, li) => s + li.igst, 0) + (doctorConsultation ? doctorConsultation.igst : 0)) * 100
  ) / 100;
  const totalGST = Math.round((totalCGST + totalSGST + totalIGST) * 100) / 100;
  const grandTotal = Math.round((totalTaxableValue + totalGST) * 100) / 100;

  // ── Save Changes to Database ──
  const handleSave = async () => {
    setSaving(true);
    setSaveSuccessMsg('');
    try {
      const targetId = shipment._id || shipment.order_id;
      const payload = {
        customer: {
          name: custName.trim() || 'Direct Customer',
          phone: custPhone.trim() || '9999999999',
          email: shipment.billing_email || '',
          address: custAddress.trim(),
          city: custCity.trim(),
          state: custState.trim() || 'Uttar Pradesh',
          pincode: custPincode.trim(),
        },
        bill_number: customBillNumber.trim() || undefined,
        delivered_at: invoiceDateStr ? `${invoiceDateStr}T12:00:00.000+05:30` : undefined,
        company_name: fromName.trim() || COMPANY.name,
        company_gstin: fromGstin.trim() || COMPANY.gstin,
        company_address: fromAddress.trim() || COMPANY.address,
        doctor_fee: doctorFeeNum,
        doctor_fee_name: doctorDesc,
        doctor_fee_hsn: doctorHsn,
        doctor_fee_tax: doctorTax,
        sub_total: grandTotal,
        order_items: lineItemsState.map(li => ({
          name: li.description || 'Product',
          sku: 'MED-01',
          units: Number(li.qty) || 1,
          selling_price: Number(li.unitRate) || Number(li.totalInclusive) || 0,
          tax: String(li.taxPct || 0),
          hsn: li.hsn || '30049011',
        })),
      };

      const res = await smxSvc.updateManualBill(targetId, payload);
      const updatedOrder = res.data?.data;
      setSaveSuccessMsg('Invoice & Order details saved successfully!');
      if (onSaveSuccess) {
        onSaveSuccess(updatedOrder || { ...shipment, ...payload });
      }
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Failed to save invoice changes:', err);
      alert('Failed to save changes: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  // ── Print or Save PDF ──
  const handlePrint = () => {
    const payload = {
      billNumber: customBillNumber || generateBillNumber(shipment),
      orderId: (shipment.order_id || shipment._id || '—').toString(),
      invoiceDate: invoiceDateStr ? new Date(`${invoiceDateStr}T12:00:00.000+05:30`) : new Date(),
      customerName: custName || 'Customer',
      customerPhone: custPhone || '',
      customerAddress: custAddress || '',
      customerState: custState || '',
      customerCity: custCity || '',
      customerPincode: (custPincode || '').toString(),
      companyName: fromName || COMPANY.name,
      companyGstin: fromGstin || COMPANY.gstin,
      companyAddress: fromAddress || COMPANY.address,
      doctorFee: doctorFeeNum,
      taxMode,
      lineItems: finalLineItems.map(li => ({
        sno: li.sno,
        description: li.description,
        hsn: li.hsn,
        qty: li.qty,
        rate: li.rate,
        amount: li.amount,
        gstRate: String(li.gstRate),
        cgst: li.cgst,
        sgst: li.sgst,
        igst: li.igst,
        total: li.total,
        isDoctor: !!li.isDoctor
      })),
      totalTaxableValue: Math.round(totalTaxableValue * 100) / 100,
      totalCGST: Math.round(totalCGST * 100) / 100,
      totalSGST: Math.round(totalSGST * 100) / 100,
      totalIGST: Math.round(totalIGST * 100) / 100,
      totalGST: Math.round(totalGST * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100
    };

    saveInvoiceHistory(payload).catch(err => console.error('Failed to save invoice history:', err));
    const origTitle = document.title;
    document.title = '';
    window.print();
    setTimeout(() => { document.title = origTitle; }, 1000);
  };

  // ── Modal Styles ──
  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    padding: 20, overflowY: 'auto',
  };

  const modal = {
    background: '#fff', borderRadius: 12, maxWidth: 1040, width: '96%',
    maxHeight: '95vh', overflowY: 'auto', position: 'relative',
    boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
  };

  const invoiceBody = {
    padding: '24px 28px', fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif", color: '#000',
    fontSize: 12, lineHeight: 1.45,
  };

  return createPortal(
    <div className="invoice-portal-container">
      <style>{PRINT_STYLES}</style>
      <div className="invoice-overlay" style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="invoice-modal-box" style={modal}>
          {/* ── Action Bar (no-print) ── */}
          <div className="invoice-no-print" style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 24px', borderBottom: '1px solid #e5e7eb', background: '#f8fafc',
            flexWrap: 'wrap', gap: 12, position: 'sticky', top: 0, zIndex: 20
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 8, background: '#e0f2fe', color: '#0284c7',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <svg width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 15 }}>Tax Invoice / Bill</div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{customBillNumber || 'TW-....'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {/* Doctor Fee Input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {showDoctorRow ? (
                  <>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <svg width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Doctor Fee ₹:
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={doctorFee}
                      onChange={(e) => onDoctorFeeChange && onDoctorFeeChange(e.target.value)}
                      style={{
                        width: 85, padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1',
                        fontSize: 12, fontWeight: 700, background: '#fff', color: '#0f172a',
                        textAlign: 'right',
                      }}
                      placeholder="0"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowDoctorRow(false);
                        if (onDoctorFeeChange) onDoctorFeeChange(0);
                      }}
                      title="Remove Doctor Consultation Charges"
                      style={{
                        padding: '5px 8px', borderRadius: 5, border: '1px solid #fecaca',
                        background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 4
                      }}
                    >
                      <svg width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Remove
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowDoctorRow(true);
                      if (onDoctorFeeChange && (!doctorFee || Number(doctorFee) === 0)) {
                        onDoctorFeeChange(500);
                      }
                    }}
                    style={{
                      padding: '6px 12px', borderRadius: 6, border: '1px dashed #0284c7',
                      background: '#f0f9ff', color: '#0284c7', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    + Add Doctor Fee
                  </button>
                )}
              </div>

              {/* Interactive GST Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>GST:</span>
                <select
                  value={taxMode}
                  onChange={(e) => onTaxModeChange && onTaxModeChange(e.target.value)}
                  style={{
                    padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1',
                    fontSize: 12, fontWeight: 600, background: '#fff', color: '#0f172a', cursor: 'pointer',
                  }}
                >
                  <option value="intra">CGST + SGST (Intra-state)</option>
                  <option value="inter">IGST (Inter-state)</option>
                </select>
              </div>

              {/* Success Notification */}
              {saveSuccessMsg && (
                <div style={{
                  padding: '5px 10px', borderRadius: 6, background: '#dcfce7', color: '#15803d',
                  fontSize: 11.5, fontWeight: 700, border: '1px solid #86efac', display: 'flex', alignItems: 'center', gap: 4
                }}>
                  <svg width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {saveSuccessMsg}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    padding: '8px 16px', borderRadius: 6, border: 'none',
                    background: saving ? '#94a3b8' : '#059669', color: '#fff', fontSize: 12.5, fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                    boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)'
                  }}
                  title="Save edited details directly to database"
                >
                  <svg width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  style={{
                    padding: '8px 18px', borderRadius: 6, border: 'none',
                    background: '#0f172a', color: '#fff', fontSize: 12.5, fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  Print / Save PDF
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1',
                    background: '#fff', color: '#475569', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5
                  }}
                >
                  <svg width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Close
                </button>
              </div>
            </div>
          </div>

          {/* ── Invoice Content (printable area) ── */}
          <div ref={printRef} className="invoice-print-area" style={invoiceBody}>
            {/* ═══ ONE SINGLE UNIFIED GST INVOICE FRAME (FULL A4 SIZE) ═══ */}
            <div className="invoice-outer-box" style={{
              border: '2px solid #000',
              background: '#fff',
              boxSizing: 'border-box',
              width: '100%',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 920,
              justifyContent: 'space-between',
            }}>

              {/* ═══════ 1. HEADER SECTION ═══════ */}
              <div style={{ borderBottom: '1.5px solid #000', padding: '12px 16px', background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    {/* Print Version */}
                    <div className="invoice-print-only">
                      <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.5, color: '#000' }}>
                        {fromName}
                      </div>
                      <div style={{ fontSize: 12, color: '#111', marginTop: 3 }}>
                        GSTIN: <strong>{fromGstin}</strong>
                      </div>
                      <div style={{ fontSize: 10.5, color: '#222', marginTop: 2, whiteSpace: 'pre-line', lineHeight: 1.35 }}>
                        {fromAddress}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#222', marginTop: 2 }}>
                        State: <strong>{COMPANY.state || 'Uttar Pradesh'}</strong> (Code: 09)
                      </div>
                    </div>

                    {/* Screen Version */}
                    <div className="invoice-no-print">
                      <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.5, color: '#0f172a' }}>
                        {fromName}
                      </div>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>
                        GSTIN: <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e293b' }}>{fromGstin}</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2, whiteSpace: 'pre-line', lineHeight: 1.35 }}>
                        {fromAddress}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
                        State: <span style={{ fontWeight: 600, color: '#334155' }}>{COMPANY.state || 'Uttar Pradesh'}</span> (Code: 09)
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#000', letterSpacing: 0.5 }}>TAX INVOICE / BILL</div>
                    
                    {/* Print Version */}
                    <div className="invoice-print-only" style={{ fontSize: 12, color: '#111', marginTop: 6, lineHeight: 1.5 }}>
                      <div>Bill No.: <strong>{customBillNumber || '—'}</strong></div>
                      <div>Date: <strong>{formatDisplayDate(invoiceDateStr)}</strong></div>
                      {shipment?.awb_code && <div>AWB: <strong>{shipment.awb_code}</strong></div>}
                      <div>Place of Supply: <strong>{custState || 'Uttar Pradesh'}</strong></div>
                    </div>

                    {/* Screen Version (Editable) */}
                    <div className="invoice-no-print" style={{ fontSize: 11.5, color: '#333', marginTop: 4, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 11, color: '#475569' }}>Bill No.:</span>
                        <input
                          type="text"
                          value={customBillNumber}
                          onChange={(e) => setCustomBillNumber(e.target.value)}
                          placeholder="TW-XXXX"
                          style={{
                            width: 110, padding: '3px 8px', border: '1px solid #cbd5e1', borderRadius: 4,
                            fontSize: 12, fontWeight: 800, textAlign: 'right', background: '#fff', color: '#0f172a',
                            fontFamily: 'monospace'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 11, color: '#475569' }}>Date:</span>
                        <input
                          type="date"
                          value={invoiceDateStr}
                          onChange={(e) => setInvoiceDateStr(e.target.value)}
                          style={{
                            width: 125, padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: 4,
                            fontSize: 11.5, fontWeight: 600, background: '#fff', color: '#0f172a'
                          }}
                        />
                      </div>
                      {shipment?.awb_code && (
                        <div style={{ fontSize: 10.5, color: '#64748b' }}>
                          AWB: <strong style={{ color: '#0f172a' }}>{shipment.awb_code}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ═══════ 2. FROM / TO (CONSIGNOR / CONSIGNEE) ═══════ */}
              <div style={{ display: 'flex', borderTop: '1.5px solid #000', borderBottom: '1.5px solid #000', background: '#fff' }}>
                {/* FROM (SELLER) */}
                <div style={{ flex: 1, padding: '12px 16px', borderRight: '1px solid #000', background: '#fafbfc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#000', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      DETAILS OF SENDER / CONSIGNOR
                    </div>
                    <span className="invoice-no-print" style={{ fontSize: 9, color: '#0284c7', fontWeight: 700, background: '#e0f2fe', padding: '1px 5px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <svg width={9} height={9} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      <span>Editable</span>
                    </span>
                  </div>

                  {/* Print View */}
                  <div className="invoice-print-only">
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#000' }}>{fromName}</div>
                    <div style={{ fontSize: 10.5, color: '#222', marginTop: 2, lineHeight: 1.4 }}>
                      GSTIN: <strong>{fromGstin}</strong><br />
                      {fromAddress.split('\n').map((line, i) => (
                        <span key={i}>{line}<br /></span>
                      ))}
                      State: <strong>{COMPANY.state || 'Uttar Pradesh'}</strong> (Code: 09)
                    </div>
                  </div>

                  {/* Screen View (Interactive Inputs) */}
                  <div className="invoice-no-print" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#64748b', marginBottom: 1 }}>
                        COMPANY / SELLER NAME
                      </label>
                      <input
                        type="text"
                        value={fromName}
                        onChange={(e) => setFromName(e.target.value)}
                        placeholder="Company Name"
                        style={{
                          width: '100%', padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: 4,
                          fontSize: 11, fontWeight: 700, color: '#0f172a', background: '#fff', boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#64748b', marginBottom: 1 }}>
                        GSTIN
                      </label>
                      <input
                        type="text"
                        value={fromGstin}
                        onChange={(e) => setFromGstin(e.target.value)}
                        placeholder="GSTIN"
                        style={{
                          width: '100%', padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: 4,
                          fontSize: 10.5, fontFamily: 'monospace', fontWeight: 700, color: '#334155', background: '#fff', boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#64748b', marginBottom: 1 }}>
                        COMPANY ADDRESS
                      </label>
                      <textarea
                        rows={2}
                        value={fromAddress}
                        onChange={(e) => setFromAddress(e.target.value)}
                        placeholder="Company Address lines..."
                        style={{
                          width: '100%', padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: 4,
                          fontSize: 10, color: '#334155', background: '#fff', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.3
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* TO (BUYER / CUSTOMER) */}
                <div style={{ flex: 1, padding: '12px 16px', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#000', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      DETAILS OF RECEIVER / BUYER (BILLED TO)
                    </div>
                    <span className="invoice-no-print" style={{ fontSize: 9, color: '#059669', fontWeight: 700, background: '#d1fae5', padding: '1px 5px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <svg width={9} height={9} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      <span>Editable</span>
                    </span>
                  </div>

                  {/* Print View */}
                  <div className="invoice-print-only">
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#000' }}>
                      {custName || 'Direct Customer'}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#222', marginTop: 2, lineHeight: 1.4 }}>
                      {custAddress && <>{custAddress}<br /></>}
                      {[custCity, custState].filter(Boolean).join(', ')}
                      {custPincode ? ` - ${custPincode}` : ''}<br />
                      India<br />
                      {custPhone && <>Phone: <strong>{custPhone}</strong><br /></>}
                      State: <strong>{custState || 'Uttar Pradesh'}</strong>
                    </div>
                  </div>

                  {/* Screen View (Interactive Inputs) */}
                  <div className="invoice-no-print" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#64748b', marginBottom: 1 }}>
                        CUSTOMER NAME
                      </label>
                      <input
                        type="text"
                        value={custName}
                        onChange={(e) => setCustName(e.target.value)}
                        placeholder="Customer Name"
                        style={{
                          width: '100%', padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: 4,
                          fontSize: 11, fontWeight: 700, color: '#0f172a', background: '#fff', boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#64748b', marginBottom: 1 }}>
                        DELIVERY ADDRESS
                      </label>
                      <input
                        type="text"
                        value={custAddress}
                        onChange={(e) => setCustAddress(e.target.value)}
                        placeholder="House / Street address / Locality"
                        style={{
                          width: '100%', padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: 4,
                          fontSize: 10.5, color: '#334155', background: '#fff', boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.8fr', gap: 5 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 8.5, fontWeight: 700, color: '#64748b', marginBottom: 1 }}>
                          CITY
                        </label>
                        <input
                          type="text"
                          value={custCity}
                          onChange={(e) => setCustCity(e.target.value)}
                          placeholder="City"
                          style={{
                            width: '100%', padding: '3px 5px', border: '1px solid #cbd5e1', borderRadius: 4,
                            fontSize: 10, color: '#334155', background: '#fff', boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 8.5, fontWeight: 700, color: '#64748b', marginBottom: 1 }}>
                          STATE
                        </label>
                        <input
                          type="text"
                          value={custState}
                          onChange={(e) => setCustState(e.target.value)}
                          placeholder="State"
                          style={{
                            width: '100%', padding: '3px 5px', border: '1px solid #cbd5e1', borderRadius: 4,
                            fontSize: 10, color: '#334155', background: '#fff', boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 8.5, fontWeight: 700, color: '#64748b', marginBottom: 1 }}>
                          PINCODE
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={custPincode}
                          onChange={(e) => setCustPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="Pincode"
                          style={{
                            width: '100%', padding: '3px 5px', border: '1px solid #cbd5e1', borderRadius: 4,
                            fontSize: 10, fontFamily: 'monospace', fontWeight: 600, color: '#334155', background: '#fff', boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#64748b', marginBottom: 1 }}>
                        PHONE NUMBER
                      </label>
                      <input
                        type="text"
                        value={custPhone}
                        onChange={(e) => setCustPhone(e.target.value)}
                        placeholder="Phone / Mobile"
                        style={{
                          width: '100%', padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: 4,
                          fontSize: 10.5, fontFamily: 'monospace', color: '#334155', background: '#fff', boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ═══════ 3. ITEMS TABLE (EXPANDS TO FILL PAGE) ═══════ */}
              <div className="invoice-table-container" style={{ width: '100%', flex: '1 1 auto', display: 'flex', flexDirection: 'column', overflowX: 'auto', borderTop: '1.5px solid #000', borderBottom: '1.5px solid #000' }}>
                <table className="invoice-table" style={{ width: '100%', height: '100%', flex: '1 1 auto', borderCollapse: 'collapse', border: 'none', margin: 0 }}>
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{ ...thBase, width: 36, textAlign: 'center' }}>Sl.</th>
                      <th rowSpan={2} style={{ ...thBase, textAlign: 'left', minWidth: 150 }}>Description of Goods / Services</th>
                      <th rowSpan={2} style={{ ...thBase, width: 85, textAlign: 'center' }}>SAC / HSN Code</th>
                      <th rowSpan={2} style={{ ...thBase, width: 42, textAlign: 'center' }}>Qty</th>
                      <th rowSpan={2} style={{ ...thBase, width: 75, textAlign: 'right' }}>Rate<br />(₹)</th>
                      <th rowSpan={2} style={{ ...thBase, width: 80, textAlign: 'right' }}>Amount<br />(₹)</th>
                      <th rowSpan={2} style={{ ...thBase, width: 68, textAlign: 'center' }}>GST<br />Rate</th>
                      <th colSpan={3} style={{ ...thBase, textAlign: 'center' }}>GST Amount (₹)</th>
                      <th rowSpan={2} className="col-total" style={{ ...thBase, width: 88, textAlign: 'right' }}>Total<br />(₹)</th>
                      <th rowSpan={2} className="invoice-no-print col-action" style={{ ...thBase, width: 34, textAlign: 'center', borderRight: 'none' }}>
                        <svg width={13} height={13} fill="none" stroke="#64748b" strokeWidth={2} viewBox="0 0 24 24" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </th>
                    </tr>
                    <tr>
                      <th style={{ ...thBase, width: 55, textAlign: 'right', fontSize: 10 }}>CGST</th>
                      <th style={{ ...thBase, width: 65, textAlign: 'right', fontSize: 10 }}>SGST/UTGST</th>
                      <th style={{ ...thBase, width: 50, textAlign: 'right', fontSize: 10 }}>IGST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finalLineItems.map((li) => (
                      <tr key={li.sno}>
                        {/* Sl No */}
                        <td style={{ ...tdBase, textAlign: 'center' }}>{li.sno}</td>

                        {/* Description */}
                        <td style={{ ...tdBase, fontWeight: 600 }}>
                          {li.isDoctor ? (
                            <>
                              <span className="invoice-print-only">{doctorDesc}</span>
                              <input
                                type="text"
                                className="invoice-no-print"
                                value={doctorDesc}
                                onChange={(e) => setDoctorDesc(e.target.value)}
                                style={{ width: '100%', padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: 4, boxSizing: 'border-box' }}
                              />
                            </>
                          ) : (
                            <>
                              <span className="invoice-print-only">{li.description}</span>
                              <input
                                type="text"
                                className="invoice-no-print"
                                value={li.description}
                                onChange={(e) => updateItem(li.id, 'description', e.target.value)}
                                style={{ width: '100%', padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: 4, boxSizing: 'border-box' }}
                              />
                            </>
                          )}
                        </td>

                        {/* HSN/SAC */}
                        <td style={{ ...tdBase, textAlign: 'center', fontSize: 10.5 }}>
                          {li.isDoctor ? (
                            <>
                              <span className="invoice-print-only">{li.hsn}</span>
                              <input
                                type="text"
                                className="invoice-no-print"
                                placeholder="SAC Code"
                                value={doctorHsn}
                                onChange={(e) => setDoctorHsn(e.target.value)}
                                style={{ width: '100%', padding: '3px 4px', border: '1px solid #cbd5e1', borderRadius: 4, boxSizing: 'border-box', textAlign: 'center' }}
                              />
                            </>
                          ) : (
                            <>
                              <span className="invoice-print-only">
                                {li.hsn ? li.hsn : '—'}
                              </span>
                              <input
                                type="text"
                                className="invoice-no-print"
                                placeholder="HSN Code"
                                value={li.hsn}
                                onChange={(e) => updateItem(li.id, 'hsn', e.target.value)}
                                style={{ width: '100%', padding: '3px 4px', border: '1px solid #cbd5e1', borderRadius: 4, boxSizing: 'border-box', textAlign: 'center' }}
                              />
                            </>
                          )}
                        </td>

                        {/* Qty */}
                        <td style={{ ...tdBase, textAlign: 'center' }}>
                          {li.isDoctor ? (
                            <>
                              <span className="invoice-print-only">{doctorQty}</span>
                              <input
                                type="number"
                                min="1"
                                className="invoice-no-print"
                                value={doctorQty}
                                onChange={(e) => setDoctorQty(Math.max(1, Number(e.target.value) || 1))}
                                style={{ width: '100%', padding: '3px 4px', border: '1px solid #cbd5e1', borderRadius: 4, boxSizing: 'border-box', textAlign: 'center' }}
                              />
                            </>
                          ) : (
                            <>
                              <span className="invoice-print-only">{li.qty}</span>
                              <input
                                type="number"
                                className="invoice-no-print"
                                value={li.qty}
                                onChange={(e) => updateItem(li.id, 'qty', Number(e.target.value))}
                                style={{ width: '100%', padding: '3px 4px', border: '1px solid #cbd5e1', borderRadius: 4, boxSizing: 'border-box', textAlign: 'center' }}
                              />
                            </>
                          )}
                        </td>

                        {/* Rate */}
                        <td style={{ ...tdBase, textAlign: 'right' }}>
                          {li.isDoctor ? (
                            <>
                              <span className="invoice-print-only">{fmtCurrency(li.rate)}</span>
                              <input
                                type="number"
                                min="0"
                                className="invoice-no-print"
                                value={doctorFee}
                                onChange={(e) => onDoctorFeeChange && onDoctorFeeChange(e.target.value)}
                                style={{ width: '100%', padding: '3px 4px', border: '1px solid #cbd5e1', borderRadius: 4, boxSizing: 'border-box', textAlign: 'right' }}
                              />
                            </>
                          ) : (
                            <>
                              <span className="invoice-print-only">{fmtCurrency(li.rate)}</span>
                              <input
                                type="number"
                                min="0"
                                className="invoice-no-print"
                                value={li.unitRate !== undefined ? li.unitRate : (li.qty > 0 ? Math.round((li.amount / li.qty) * 100) / 100 : 0)}
                                onChange={(e) => updateItemRate(li.id, Number(e.target.value) || 0)}
                                style={{ width: '100%', padding: '3px 4px', border: '1px solid #cbd5e1', borderRadius: 4, boxSizing: 'border-box', textAlign: 'right' }}
                              />
                            </>
                          )}
                        </td>

                        {/* Amount */}
                        <td style={{ ...tdBase, textAlign: 'right' }}>{fmtCurrency(li.amount)}</td>

                        {/* GST Rate */}
                        <td style={{ ...tdBase, textAlign: 'center', fontSize: 10.5 }}>
                          {li.isDoctor ? (
                            <>
                              <span className="invoice-print-only">{li.gstRate}</span>
                              <select
                                className="invoice-no-print"
                                value={doctorTax}
                                onChange={(e) => setDoctorTax(Number(e.target.value))}
                                style={{ width: '100%', padding: '2px 2px', border: '1px solid #cbd5e1', borderRadius: 4, boxSizing: 'border-box', fontSize: 10 }}
                              >
                                <option value={0}>Exempt (0%)</option>
                                <option value={5}>5%</option>
                                <option value={12}>12%</option>
                                <option value={18}>18%</option>
                                <option value={28}>28%</option>
                              </select>
                            </>
                          ) : (
                            <>
                              <span className="invoice-print-only">{li.gstRate}</span>
                              <select
                                className="invoice-no-print"
                                value={li.taxPct}
                                onChange={(e) => updateItem(li.id, 'taxPct', Number(e.target.value))}
                                style={{ width: '100%', padding: '2px 2px', border: '1px solid #cbd5e1', borderRadius: 4, boxSizing: 'border-box', fontSize: 10 }}
                              >
                                <option value={0}>Exempt (0%)</option>
                                <option value={5}>5%</option>
                                <option value={12}>12%</option>
                                <option value={18}>18%</option>
                                <option value={28}>28%</option>
                              </select>
                            </>
                          )}
                        </td>

                        {/* CGST */}
                        <td style={{ ...tdBase, textAlign: 'right' }}>{fmtCurrency(li.cgst)}</td>

                        {/* SGST */}
                        <td style={{ ...tdBase, textAlign: 'right' }}>{fmtCurrency(li.sgst)}</td>

                        {/* IGST */}
                        <td style={{ ...tdBase, textAlign: 'right' }}>{li.igst > 0 ? fmtCurrency(li.igst) : '-'}</td>

                        {/* Total */}
                        <td className="col-total" style={{ ...tdBase, textAlign: 'right', fontWeight: 700 }}>
                          {li.isDoctor ? (
                            fmtCurrency(li.total)
                          ) : (
                            <>
                              <span className="invoice-print-only">{fmtCurrency(li.total)}</span>
                              <input
                                type="number"
                                className="invoice-no-print"
                                value={li.total}
                                onChange={(e) => updateItem(li.id, 'totalInclusive', Number(e.target.value))}
                                style={{ width: '100%', padding: '3px 4px', border: '1px solid #cbd5e1', borderRadius: 4, boxSizing: 'border-box', textAlign: 'right', fontWeight: 700 }}
                              />
                            </>
                          )}
                        </td>

                        {/* Row Delete Action (No Print) */}
                        <td className="invoice-no-print col-action" style={{ ...tdBase, textAlign: 'center', borderRight: 'none' }}>
                          {li.isDoctor ? (
                            <button
                              type="button"
                              onClick={() => {
                                setShowDoctorRow(false);
                                if (onDoctorFeeChange) onDoctorFeeChange(0);
                              }}
                              title="Remove Doctor Consultation"
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <svg width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRemoveProductItem(li.id)}
                              title="Remove item"
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <svg width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}

                    {/* Flexible spacer row so table vertical column borders run all the way down */}
                    <tr className="invoice-table-spacer" style={{ height: '100%' }}>
                      <td style={{ ...tdBase, borderBottom: '1.5px solid #000', textAlign: 'center' }}>&nbsp;</td>
                      <td style={{ ...tdBase, borderBottom: '1.5px solid #000' }}>&nbsp;</td>
                      <td style={{ ...tdBase, borderBottom: '1.5px solid #000' }}>&nbsp;</td>
                      <td style={{ ...tdBase, borderBottom: '1.5px solid #000' }}>&nbsp;</td>
                      <td style={{ ...tdBase, borderBottom: '1.5px solid #000' }}>&nbsp;</td>
                      <td style={{ ...tdBase, borderBottom: '1.5px solid #000' }}>&nbsp;</td>
                      <td style={{ ...tdBase, borderBottom: '1.5px solid #000' }}>&nbsp;</td>
                      <td style={{ ...tdBase, borderBottom: '1.5px solid #000' }}>&nbsp;</td>
                      <td style={{ ...tdBase, borderBottom: '1.5px solid #000' }}>&nbsp;</td>
                      <td style={{ ...tdBase, borderBottom: '1.5px solid #000' }}>&nbsp;</td>
                      <td className="col-total" style={{ ...tdBase, borderBottom: '1.5px solid #000' }}>&nbsp;</td>
                      <td className="invoice-no-print col-action" style={{ ...tdBase, borderBottom: '1.5px solid #000', borderRight: 'none' }}>&nbsp;</td>
                    </tr>
                  </tbody>
                </table>

                {/* Add item buttons (no-print) */}
                <div className="invoice-no-print" style={{ padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={handleAddProductItem}
                    style={{
                      padding: '5px 12px', borderRadius: 5, border: '1px dashed #64748b',
                      background: '#fff', color: '#1e293b', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 4
                    }}
                  >
                    + Add Medicine / Product Item
                  </button>
                  {!showDoctorRow && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowDoctorRow(true);
                        if (onDoctorFeeChange && (!doctorFee || Number(doctorFee) === 0)) {
                          onDoctorFeeChange(500);
                        }
                      }}
                      style={{
                        padding: '5px 12px', borderRadius: 5, border: '1px dashed #0284c7',
                        background: '#f0f9ff', color: '#0284c7', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 4
                      }}
                    >
                      + Add Doctor Consultation Row
                    </button>
                  )}
                </div>
              </div>

              {/* ═══════ 4. TOTALS SUMMARY & AMOUNT IN WORDS ═══════ */}
              <div style={{ display: 'flex', borderTop: '1.5px solid #000', borderBottom: '1.5px solid #000', background: '#fff' }}>
                {/* Left: Words, Payment Details, Declaration */}
                <div style={{ flex: 1, padding: '10px 14px', borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#fafbfc' }}>
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Amount Chargeable (in words):
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#000', marginTop: 3, lineHeight: 1.4 }}>
                      {amountInWordsINR(grandTotal)}
                    </div>
                  </div>
                  
                  <div style={{ marginTop: 10, paddingTop: 6, borderTop: '1px dashed #cbd5e1', fontSize: 10, color: '#475569' }}>
                    <div>Payment Mode: <strong style={{ color: '#0f172a' }}>{shipment.payment_method || 'Cash on Delivery (COD)'}</strong></div>
                    <div style={{ marginTop: 2 }}>Total Items: <strong style={{ color: '#0f172a' }}>{finalLineItems.reduce((acc, li) => acc + (Number(li.qty) || 0), 0)}</strong></div>
                    <div style={{ fontSize: 9, color: '#64748b', fontStyle: 'italic', marginTop: 3 }}>
                      Declaration: We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
                    </div>
                  </div>
                </div>

                {/* Right: Summary Totals Table */}
                <div style={{ width: 330, background: '#fff' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
                    <tbody>
                      <tr>
                        <td style={{ ...tdBase, fontWeight: 600, padding: '5px 12px' }}>Total Taxable Value</td>
                        <td style={{ ...tdBase, textAlign: 'right', fontWeight: 600, borderRight: 'none', padding: '5px 12px' }}>{fmtCurrency(totalTaxableValue)}</td>
                      </tr>
                      <tr>
                        <td style={{ ...tdBase, padding: '5px 12px' }}>Total CGST</td>
                        <td style={{ ...tdBase, textAlign: 'right', borderRight: 'none', padding: '5px 12px' }}>{fmtCurrency(totalCGST)}</td>
                      </tr>
                      <tr>
                        <td style={{ ...tdBase, padding: '5px 12px' }}>Total SGST/UTGST</td>
                        <td style={{ ...tdBase, textAlign: 'right', borderRight: 'none', padding: '5px 12px' }}>{fmtCurrency(totalSGST)}</td>
                      </tr>
                      <tr>
                        <td style={{ ...tdBase, padding: '5px 12px' }}>Total IGST</td>
                        <td style={{ ...tdBase, textAlign: 'right', borderRight: 'none', padding: '5px 12px' }}>{totalIGST > 0 ? fmtCurrency(totalIGST) : '—'}</td>
                      </tr>
                      <tr>
                        <td style={{ ...tdBase, padding: '5px 12px' }}>Total GST Amount</td>
                        <td style={{ ...tdBase, textAlign: 'right', borderRight: 'none', padding: '5px 12px' }}>{fmtCurrency(totalGST)}</td>
                      </tr>
                      <tr>
                        <td style={{ ...tdBase, fontWeight: 900, fontSize: 13, padding: '7px 12px', borderBottom: 'none', background: '#f8fafc' }}>Grand Total (₹)</td>
                        <td style={{ ...tdBase, textAlign: 'right', fontWeight: 900, fontSize: 13, borderRight: 'none', borderBottom: 'none', padding: '7px 12px', background: '#f8fafc' }}>{fmtCurrency(grandTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ═══════ 5. TERMS & CONDITIONS & SIGNATURE ═══════ */}
              <div style={{ display: 'flex', borderTop: '1.5px solid #000', background: '#fff' }}>
                {/* Left: Terms */}
                <div style={{ flex: 1, padding: '12px 16px', borderRight: '1px solid #000', fontSize: 10.5, color: '#334155', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Terms & Conditions:
                  </div>
                  <ol style={{ margin: 0, paddingLeft: 16 }}>
                    <li>Goods once sold will only be replaced or returned as per company refund policy.</li>
                    <li>All disputes are subject to Kanpur, Uttar Pradesh jurisdiction.</li>
                    <li>This is a computer generated invoice issued by Triven Wellness.</li>
                  </ol>
                </div>

                {/* Right: Signature */}
                <div style={{ width: 330, padding: '12px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 110 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#000' }}>
                    For {fromName || COMPANY.name}
                  </div>
                  <div style={{ borderTop: '1px solid #000', paddingTop: 6, fontSize: 11.5, fontWeight: 700, color: '#1e293b' }}>
                    Authorised Signatory
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
