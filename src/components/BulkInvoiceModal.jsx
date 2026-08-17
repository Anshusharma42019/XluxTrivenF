import { useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchShipments, saveInvoiceHistory } from '../services/opsDashboard.service';

/* ─── Company Constants ──────────────────────────────────────────────────── */
const COMPANY = {
  name: 'TRIVEN WELLNESS LLP',
  gstin: '09AAZFT9024A1ZS',
  address: 'RPN/ 341(7), Harmilap Society,\nRana Pratap Nagar, Keshavpuram,\nKalyanpur, Kanpur Nagar,\nUttar Pradesh, India - 208017',
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const fmtCurrency = (n) => {
  const num = Number(n) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getYearMonthPrefix = (order) => {
  const dateStr = order.delivered_at || order.status_updated_at || order.createdAt || new Date();
  const date = new Date(dateStr);
  const yy = date.getFullYear().toString().slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${yy}${mm}`;
};

const generateBillNumber = (order, idx) => {
  const prefix = getYearMonthPrefix(order);
  const seqPart = String(idx).padStart(4, '0');
  return `TW-${prefix}-${seqPart}`;
};

/* ─── Month list ─────────────────────────────────────────────────────────── */
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/* ─── Generate a single invoice HTML string ──────────────────────────────── */
function computeInvoiceData(shipment, idx, doctorFee, gstRate) {
  const billNumber = generateBillNumber(shipment, idx);
  const cleanState = (shipment.billing_state || '').toLowerCase().replace(/[^a-z]/g, '');
  const isIntraState = cleanState === 'up' || cleanState === 'uttarpradesh' || cleanState.includes('uttarpradesh');

  const items = shipment.order_items || [];
  const subTotal = Number(shipment.sub_total) || 0;

  const computedItemsTotal = items.reduce((sum, item) => sum + (Number(item.selling_price) || 0) * (Number(item.units) || 1), 0);
  const totalUnits = items.reduce((sum, item) => sum + (Number(item.units) || 1), 0);

  const initialItems = items.map((item, i) => {
    const qty = Number(item.units) || 1;
    let itemTotalInclusive = 0;
    if (computedItemsTotal === 0) {
      itemTotalInclusive = totalUnits > 0 ? (subTotal * qty) / totalUnits : 0;
    } else {
      const itemOrigTotal = (Number(item.selling_price) || 0) * qty;
      itemTotalInclusive = (itemOrigTotal / computedItemsTotal) * subTotal;
    }
    const itemTax = Number(item.tax);
    const taxPct = (!isNaN(itemTax) && itemTax > 0) ? itemTax : Number(gstRate);

    return {
      description: item.name || 'Product',
      hsn: item.hsn || '30049011',
      qty,
      taxPct,
      totalInclusive: itemTotalInclusive,
    };
  });

  if (initialItems.length === 0) {
    initialItems.push({
      description: 'Order',
      hsn: '30049011',
      qty: 1,
      taxPct: Number(gstRate),
      totalInclusive: subTotal,
    });
  }

  const doctorFeeNum = Number(doctorFee) || 0;
  const rawProductTotal = initialItems.reduce((s, li) => s + li.totalInclusive, 0);
  const deductionRatio = rawProductTotal > 0 ? (rawProductTotal - doctorFeeNum) / rawProductTotal : 1;

  const doctorConsultation = {
    sno: 1,
    description: 'Doctor Consultation Charges',
    hsn: '999312 (SAC)',
    qty: 1,
    rate: doctorFeeNum,
    amount: doctorFeeNum,
    gstRate: 'Exempt (0%)',
    cgst: 0,
    sgst: 0,
    igst: 0,
    total: doctorFeeNum,
    isDoctor: true
  };

  const productLines = initialItems.map((li, i) => {
    const qty = li.qty;
    const taxPct = li.taxPct;
    const totalInclusive = li.totalInclusive * deductionRatio;

    const amount = totalInclusive / (1 + taxPct / 100);
    const rate = qty > 0 ? amount / qty : 0;
    const gstAmount = totalInclusive - amount;
    const cgst = isIntraState ? gstAmount / 2 : 0;
    const sgst = isIntraState ? gstAmount / 2 : 0;
    const igst = isIntraState ? 0 : gstAmount;

    return {
      sno: i + 2,
      description: li.description,
      hsn: li.hsn,
      qty,
      rate: Math.round(rate * 100) / 100,
      amount: Math.round(amount * 100) / 100,
      gstRate: taxPct > 0 ? `${taxPct}%` : 'Exempt (0%)',
      cgst: Math.round(cgst * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      igst: Math.round(igst * 100) / 100,
      total: Math.round(totalInclusive * 100) / 100,
      isDoctor: false
    };
  });

  const allLines = [doctorConsultation, ...productLines];

  const totalTaxableValue = productLines.reduce((s, li) => s + li.amount, 0) + doctorFeeNum;
  const totalCGST = productLines.reduce((s, li) => s + li.cgst, 0);
  const totalSGST = productLines.reduce((s, li) => s + li.sgst, 0);
  const totalIGST = productLines.reduce((s, li) => s + li.igst, 0);
  const totalGST = totalCGST + totalSGST + totalIGST;
  const grandTotal = totalTaxableValue + totalGST;

  return {
    billNumber,
    orderId: (shipment.order_id || shipment._id || '—').toString(),
    invoiceDate: new Date(shipment.delivered_at || shipment.status_updated_at || new Date()),
    customerName: shipment.billing_customer_name || 'Customer',
    customerPhone: shipment.billing_phone || '',
    customerAddress: shipment.billing_address || '',
    customerState: shipment.billing_state || '',
    customerCity: shipment.billing_city || '',
    customerPincode: (shipment.billing_pincode || '').toString(),
    doctorFee: doctorFeeNum,
    taxMode: isIntraState ? 'intra' : 'inter',
    lineItems: allLines.map(li => ({
      sno: li.sno,
      description: li.description,
      hsn: li.hsn,
      qty: li.qty,
      rate: li.rate,
      amount: li.amount,
      gstRate: li.gstRate,
      cgst: li.cgst,
      sgst: li.sgst,
      igst: li.igst,
      total: li.total,
      isDoctor: li.isDoctor
    })),
    totalTaxableValue: Math.round(totalTaxableValue * 100) / 100,
    totalCGST: Math.round(totalCGST * 100) / 100,
    totalSGST: Math.round(totalSGST * 100) / 100,
    totalIGST: Math.round(totalIGST * 100) / 100,
    totalGST: Math.round(totalGST * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
    allLines,
    isIntraState
  };
}



/* ─── Main BulkInvoiceModal Component ───────────────────────────────────── */
export default function BulkInvoiceModal({ isOpen, onClose }) {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [doctorFee, setDoctorFee] = useState(0);
  const [gstSelect, setGstSelect] = useState('12'); // '0', '5', '12', '18', '28', 'custom'
  const [customGst, setCustomGst] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [count, setCount] = useState(null);

  if (!isOpen) return null;

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  const effectiveGstRate = gstSelect === 'custom' ? (Number(customGst) || 0) : Number(gstSelect);

  const handleDownload = async () => {
    setLoading(true);
    setStatus('Fetching delivered shipments...');
    setCount(null);
    try {
      const fromDate = new Date(selectedYear, selectedMonth, 1);
      const toDate = new Date(selectedYear, selectedMonth + 1, 0);
      
      const fmtLocalDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };

      let allShipments = [];
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages) {
        setStatus(`Fetching page ${page}${totalPages > 1 ? ' of ' + totalPages : ''}...`);
        const data = await fetchShipments({
          status: 'delivered',
          preset: 'custom',
          from: fmtLocalDate(fromDate),
          to: fmtLocalDate(toDate),
          page,
          limit: 100,
        });
        const ships = data?.shipments || [];
        allShipments = [...allShipments, ...ships];
        totalPages = data?.pages || 1;
        page++;
        if (ships.length === 0) break;
      }

      setCount(allShipments.length);

      if (allShipments.length === 0) {
        setStatus('❌ No delivered shipments found for this month.');
        setLoading(false);
        return;
      }

      setStatus(`Building ${allShipments.length} invoices...`);

      const invoicesData = allShipments.map((s, i) => computeInvoiceData(s, i + 1, doctorFee, effectiveGstRate));
      
      Promise.all(invoicesData.map(data => {
        const { allLines, isIntraState, ...payload } = data;
        return saveInvoiceHistory(payload);
      })).catch(err => console.error('Failed to save bulk invoice history:', err));

      const invoicesHTML = allShipments.map((s, i) => {
        const data = invoicesData[i];
        const c = 'padding:7px 6px;font-size:12px;color:#000;border-right:1px solid #000;border-bottom:1px solid #000;vertical-align:middle;';

        const rows = data.allLines.map(li => `<tr>
          <td style="${c}text-align:center;border-left:none;">${li.sno}</td>
          <td style="${c}font-weight:600;">${li.description}</td>
          <td style="${c}text-align:center;font-size:11px;">${li.hsn}</td>
          <td style="${c}text-align:center;">${li.qty}</td>
          <td style="${c}text-align:right;">${fmtCurrency(li.rate)}</td>
          <td style="${c}text-align:right;">${fmtCurrency(li.amount)}</td>
          <td style="${c}text-align:center;font-size:11px;">${li.gstRate}</td>
          <td style="${c}text-align:right;">${fmtCurrency(li.cgst)}</td>
          <td style="${c}text-align:right;">${fmtCurrency(li.sgst)}</td>
          <td style="${c}text-align:right;">${li.igst > 0 ? fmtCurrency(li.igst) : '-'}</td>
          <td style="${c}text-align:right;font-weight:700;border-right:none;">${fmtCurrency(li.total)}</td>
        </tr>`).join('');

        const addr = COMPANY.address.replace(/\n/g, '<br/>');
        const custAddr = [
          s.billing_address,
          [s.billing_city, s.billing_state].filter(Boolean).join(', '),
          s.billing_pincode ? `- ${s.billing_pincode}` : '',
          'India',
        ].filter(Boolean).join('<br/>');

        const invoiceDateStr = formatDate(data.invoiceDate);

        return `<div class="invoice-page" style="font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:13px;color:#000;padding:28px 36px;page-break-after:always;">
        <div style="border:1px solid #000;padding:14px 18px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div style="font-size:20px;font-weight:900;">${COMPANY.name}</div>
              <div style="font-size:12px;color:#333;margin-top:3px;">GSTIN: ${COMPANY.gstin}</div>
              <div style="font-size:11px;color:#444;margin-top:2px;line-height:1.4;">${addr}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:15px;font-weight:800;">TAX INVOICE / BILL</div>
              <div style="font-size:12px;color:#333;margin-top:6px;">
                Bill No.: <strong>${data.billNumber}</strong><br/>
                Date: <strong>${invoiceDateStr}</strong><br/>
                AWB: <strong>${s.awb_code || '—'}</strong>
              </div>
            </div>
          </div>
        </div>
        <div style="display:flex;border:1px solid #000;border-top:none;">
          <div style="flex:1;padding:12px 14px;border-right:1px solid #000;">
            <div style="font-size:10px;font-weight:800;text-transform:uppercase;margin-bottom:5px;">FROM</div>
            <div style="font-size:12px;font-weight:700;">${COMPANY.name}</div>
            <div style="font-size:11px;color:#333;margin-top:3px;line-height:1.4;">GSTIN: ${COMPANY.gstin}<br/>${addr}</div>
          </div>
          <div style="flex:1;padding:12px 14px;">
            <div style="font-size:10px;font-weight:800;text-transform:uppercase;margin-bottom:5px;">TO</div>
            <div style="font-size:12px;font-weight:700;">${s.billing_customer_name || 'Customer'}</div>
            <div style="font-size:11px;color:#333;margin-top:3px;line-height:1.4;">${custAddr}<br/>${s.billing_phone ? 'Phone: ' + s.billing_phone + '<br/>' : ''}</div>
          </div>
        </div>
        <div style="margin-top:16px;">
          <table style="width:100%;border-collapse:collapse;border:1px solid #000;">
            <thead>
              <tr>
                <th rowspan="2" style="${c}font-weight:700;background:#f5f5f5;text-align:center;width:35px;border-left:none;border-top:none;">Sl.</th>
                <th rowspan="2" style="${c}font-weight:700;background:#f5f5f5;text-align:left;border-top:none;">Description</th>
                <th rowspan="2" style="${c}font-weight:700;background:#f5f5f5;text-align:center;width:80px;border-top:none;">HSN/SAC</th>
                <th rowspan="2" style="${c}font-weight:700;background:#f5f5f5;text-align:center;width:40px;border-top:none;">Qty</th>
                <th rowspan="2" style="${c}font-weight:700;background:#f5f5f5;text-align:center;width:70px;border-top:none;">Rate (₹)</th>
                <th rowspan="2" style="${c}font-weight:700;background:#f5f5f5;text-align:center;width:70px;border-top:none;">Amt (₹)</th>
                <th rowspan="2" style="${c}font-weight:700;background:#f5f5f5;text-align:center;width:70px;border-top:none;">GST Rate</th>
                <th colspan="3" style="${c}font-weight:700;background:#f5f5f5;text-align:center;border-top:none;">GST Amount (₹)</th>
                <th rowspan="2" style="${c}font-weight:700;background:#f5f5f5;text-align:center;width:80px;border-right:none;border-top:none;">Total (₹)</th>
              </tr>
              <tr>
                <th style="${c}font-weight:700;background:#f5f5f5;text-align:center;width:55px;font-size:10px;">CGST</th>
                <th style="${c}font-weight:700;background:#f5f5f5;text-align:center;width:65px;font-size:10px;">SGST</th>
                <th style="${c}font-weight:700;background:#f5f5f5;text-align:center;width:50px;font-size:10px;">IGST</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:16px;">
          <table style="border-collapse:collapse;border:1px solid #000;min-width:320px;">
            <tbody>
              <tr><td style="${c}font-weight:600;border-left:none;padding:7px 12px;">Total Taxable Value</td><td style="${c}text-align:right;font-weight:600;border-right:none;padding:7px 12px;min-width:90px;">${fmtCurrency(data.totalTaxableValue)}</td></tr>
              <tr><td style="${c}border-left:none;padding:7px 12px;">CGST</td><td style="${c}text-align:right;border-right:none;padding:7px 12px;">${fmtCurrency(data.totalCGST)}</td></tr>
              <tr><td style="${c}border-left:none;padding:7px 12px;">SGST/UTGST</td><td style="${c}text-align:right;border-right:none;padding:7px 12px;">${fmtCurrency(data.totalSGST)}</td></tr>
              <tr><td style="${c}border-left:none;padding:7px 12px;">IGST</td><td style="${c}text-align:right;border-right:none;padding:7px 12px;">${data.totalIGST > 0 ? fmtCurrency(data.totalIGST) : '-'}</td></tr>
              <tr><td style="${c}font-weight:800;font-size:13px;border-left:none;padding:9px 12px;">Grand Total</td><td style="${c}text-align:right;font-weight:800;font-size:13px;border-right:none;padding:9px 12px;">${fmtCurrency(data.grandTotal)}</td></tr>
            </tbody>
          </table>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:40px;">
          <div style="text-align:center;">
            <div style="font-size:12px;font-weight:700;margin-bottom:35px;">For ${COMPANY.name}</div>
            <div style="border-top:1px solid #000;padding-top:6px;font-size:11px;color:#333;min-width:180px;">Authorised Signatory</div>
          </div>
        </div>
      </div>`;
      }).join('');
      const monthLabel = `${MONTHS[selectedMonth]} ${selectedYear}`;

      const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Bulk Invoices — ${monthLabel}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#fff;font-family:'Inter','Segoe UI',Arial,sans-serif;}
.invoice-page{page-break-after:always;}
.invoice-page:last-child{page-break-after:avoid;}
@page{margin:10mm 8mm;size:A4;}
@media print{.no-print{display:none!important;}.invoice-page{page-break-after:always;}}
</style>
</head>
<body>
<div class="invoice-page no-print" style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f0fdf4;padding:60px;text-align:center;">
  <div style="font-size:56px;margin-bottom:16px;">🧾</div>
  <div style="font-size:28px;font-weight:900;color:#15803d;margin-bottom:6px;">${COMPANY.name}</div>
  <div style="font-size:18px;color:#374151;font-weight:700;margin-bottom:4px;">Bulk Tax Invoices</div>
  <div style="font-size:15px;color:#6b7280;">${monthLabel}</div>
  <div style="margin-top:16px;font-size:13px;color:#9ca3af;">Total Invoices: ${allShipments.length}</div>
  <div style="margin-top:4px;font-size:12px;color:#9ca3af;">GST Mode: Auto-detected (CGST+SGST for Uttar Pradesh, IGST for other states)</div>
  <div style="margin-top:8px;font-size:12px;color:#9ca3af;">Doctor Fee: ₹${doctorFee} (deducted from medicines)</div>
  <div style="margin-top:4px;font-size:12px;color:#9ca3af;">Medicine GST: ${effectiveGstRate}%</div>
  <div style="margin-top:36px;display:flex;gap:14px;justify-content:center;">
    <button onclick="window.print()" style="padding:14px 32px;border-radius:8px;border:none;background:#15803d;color:#fff;font-size:15px;font-weight:700;cursor:pointer;">🖨️ Print / Save as PDF</button>
    <button onclick="window.close()" style="padding:14px 28px;border-radius:8px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:15px;font-weight:600;cursor:pointer;">✕ Close</button>
  </div>
</div>
${invoicesHTML}
<script>setTimeout(()=>window.print(),900);<\/script>
</body>
</html>`;

      const blob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) {
        alert('Pop-up blocked! Please allow pop-ups for this site and try again.');
      }
      setStatus(`✅ ${allShipments.length} invoices opened in new tab — use Print → Save as PDF.`);
    } catch (err) {
      console.error('Bulk invoice error:', err);
      setStatus('❌ Error fetching shipments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20,
      }}
    >
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      <div style={{
        background: '#fff', borderRadius: 20, width: '100%', maxWidth: 520,
        boxShadow: '0 25px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
          padding: '22px 26px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 9 }}>
              🧾 Bulk Invoice Download
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.78)', marginTop: 3 }}>
              Month-wise delivered shipment invoices
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 8, color: '#fff',
            width: 34, height: 34, cursor: 'pointer', fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '26px 26px 22px' }}>

          {/* Month + Year */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              📅 Select Month
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                style={{
                  flex: 2, padding: '10px 12px', borderRadius: 9, border: '1.5px solid #d1d5db',
                  fontSize: 14, fontWeight: 600, color: '#111', background: '#fff', cursor: 'pointer', outline: 'none',
                }}
              >
                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 9, border: '1.5px solid #d1d5db',
                  fontSize: 14, fontWeight: 600, color: '#111', background: '#fff', cursor: 'pointer', outline: 'none',
                }}
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Doctor Fee */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              🩺 Doctor Consultation Fee (Per Invoice)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16, color: '#6b7280', fontWeight: 600 }}>₹</span>
              <input
                type="number"
                min="0"
                value={doctorFee}
                onChange={(e) => setDoctorFee(Number(e.target.value) || 0)}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 9, border: '1.5px solid #d1d5db',
                  fontSize: 14, fontWeight: 600, color: '#111', background: '#fff', outline: 'none',
                }}
                placeholder="0"
              />
              <span style={{ fontSize: 11, color: '#6b7280', maxWidth: 180, lineHeight: 1.3 }}>
                Deducted from medicine total proportionally.
              </span>
            </div>
          </div>

          {/* GST Rate Selector */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              📦 Medicine GST Rate
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <select
                value={gstSelect}
                onChange={(e) => setGstSelect(e.target.value)}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 9, border: '1.5px solid #d1d5db',
                  fontSize: 14, fontWeight: 600, color: '#111', background: '#fff', cursor: 'pointer', outline: 'none',
                }}
              >
                <option value="0">Exempt (0%)</option>
                <option value="5">5%</option>
                <option value="12">12% (Ayurvedic Medicine)</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
                <option value="custom">Custom...</option>
              </select>

              {gstSelect === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={customGst}
                    onChange={(e) => setCustomGst(e.target.value)}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 9, border: '1.5px solid #d1d5db',
                      fontSize: 14, fontWeight: 600, color: '#111', background: '#fff', outline: 'none',
                    }}
                    placeholder="Enter %"
                  />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#475569' }}>%</span>
                </div>
              )}
            </div>
          </div>

          {/* GST Mode Auto Detection Info */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              🧾 GST Mode
            </div>
            <div style={{
              background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 9, padding: '10px 14px',
              fontSize: 12.5, color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8
            }}>
              <span>⚡</span>
              <span><strong>Automatic Detection:</strong> CGST + SGST for Uttar Pradesh customers; IGST for all other states.</span>
            </div>
          </div>

          {/* Info */}
          <div style={{
            background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 9,
            padding: '11px 14px', marginBottom: 20, fontSize: 11.5, color: '#0369a1', lineHeight: 1.65,
          }}>
            <strong>ℹ️ How it works:</strong><br />
            1. Fetches all <strong>delivered</strong> shipments for the chosen month<br />
            2. Generates one tax invoice per shipment (same format as individual invoice)<br />
            3. Opens a combined page in a <strong>new tab</strong><br />
            4. Click <strong>"Print / Save as PDF"</strong> to save
          </div>

          {/* Status */}
          {status && (
            <div style={{
              background: status.startsWith('❌') ? '#fef2f2' : status.startsWith('✅') ? '#f0fdf4' : '#f8fafc',
              border: `1px solid ${status.startsWith('❌') ? '#fecaca' : status.startsWith('✅') ? '#86efac' : '#e2e8f0'}`,
              borderRadius: 8, padding: '9px 13px', marginBottom: 14,
              fontSize: 12.5, fontWeight: 600,
              color: status.startsWith('❌') ? '#dc2626' : status.startsWith('✅') ? '#15803d' : '#475569',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {loading && (
                <span style={{
                  display: 'inline-block', width: 13, height: 13, border: '2px solid currentColor',
                  borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0,
                }} />
              )}
              <span>{status}{count !== null && !loading ? ` (${count} shipments)` : ''}</span>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleDownload}
              disabled={loading}
              style={{
                flex: 1, padding: '12px 18px', borderRadius: 9, border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                background: loading ? '#86efac' : 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
                color: '#fff', fontSize: 13.5, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                boxShadow: loading ? 'none' : '0 4px 12px rgba(22,163,74,0.35)',
                transition: 'all 0.2s',
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    display: 'inline-block', width: 15, height: 15, border: '2px solid #fff',
                    borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                  }} />
                  Processing...
                </>
              ) : (
                <>📥 Download {MONTHS[selectedMonth]} {selectedYear}</>
              )}
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '12px 18px', borderRadius: 9, border: '1.5px solid #e5e7eb',
                background: '#fff', color: '#6b7280', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
