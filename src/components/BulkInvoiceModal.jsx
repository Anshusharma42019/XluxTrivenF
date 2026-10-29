import { useState } from 'react';
import { createPortal } from 'react-dom';
import { saveInvoiceHistory } from '../services/opsDashboard.service';
import { amountInWordsINR } from './InvoiceModal';
import * as smxSvc from '../services/shipmaxx.service';

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
    const itemPrice = Number(item.selling_price) || 0;
    if (itemPrice > 0) {
      itemTotalInclusive = itemPrice * qty;
    } else if (computedItemsTotal === 0) {
      itemTotalInclusive = totalUnits > 0 ? (subTotal * qty) / totalUnits : 0;
    } else {
      const itemOrigTotal = itemPrice * qty;
      itemTotalInclusive = (itemOrigTotal / computedItemsTotal) * (subTotal || itemOrigTotal);
    }
    const itemTax = Number(item.tax);
    const taxPct = (!isNaN(itemTax) && itemTax > 0) ? itemTax : Number(gstRate);

    return {
      description: item.name || 'Product',
      hsn: item.hsn || '30049011',
      qty,
      taxPct,
      rate: Number(item.selling_price) || 0,
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

  const doctorFeeNum = Number(doctorFee) || Number(shipment.doctor_fee) || 0;
  const rawProductTotal = initialItems.reduce((s, li) => s + li.totalInclusive, 0);
  const deductionRatio = (rawProductTotal > 0 && doctorFeeNum > 0) ? (rawProductTotal - doctorFeeNum) / rawProductTotal : 1;

  const doctorConsultation = doctorFeeNum > 0 ? {
    description: shipment.doctor_fee_name || 'Doctor Consultation Charges',
    hsn: shipment.doctor_fee_hsn ? (shipment.doctor_fee_hsn.includes('SAC') ? shipment.doctor_fee_hsn : `${shipment.doctor_fee_hsn} (SAC)`) : '999312 (SAC)',
    qty: 1,
    rate: doctorFeeNum,
    amount: doctorFeeNum,
    gstRate: 'Exempt (0%)',
    taxPct: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    total: doctorFeeNum,
    isDoctor: true
  } : null;

  const isExclusive = false;

  const productLines = initialItems.map((li) => {
    const qty = li.qty;
    const taxPct = li.taxPct;

    let amount = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let rate = 0;
    let lineTotal = 0;

    if (isExclusive) {
      rate = li.rate || (qty > 0 ? Math.round((li.totalInclusive / qty) * 100) / 100 : li.totalInclusive);
      amount = Math.round((rate * qty) * 100) / 100;
      if (taxPct > 0) {
        const gstAmount = Math.round((amount * (taxPct / 100)) * 100) / 100;
        if (isIntraState) {
          cgst = Math.round((gstAmount / 2) * 100) / 100;
          sgst = Math.round((gstAmount - cgst) * 100) / 100;
        } else {
          igst = gstAmount;
        }
      }
      lineTotal = Math.round((amount + cgst + sgst + igst) * 100) / 100;
    } else {
      const totalInclusive = Math.round((li.totalInclusive * deductionRatio) * 100) / 100;
      if (taxPct > 0) {
        const gstAmount = Math.round((totalInclusive * (taxPct / 100)) * 100) / 100;
        amount = Math.round((totalInclusive - gstAmount) * 100) / 100;

        if (isIntraState) {
          cgst = Math.round((gstAmount / 2) * 100) / 100;
          sgst = Math.round((gstAmount - cgst) * 100) / 100;
        } else {
          igst = gstAmount;
        }
      } else {
        amount = totalInclusive;
      }
      rate = qty > 0 ? Math.round((amount / qty) * 100) / 100 : 0;
      lineTotal = Math.round((amount + cgst + sgst + igst) * 100) / 100;
    }

    return {
      description: li.description,
      hsn: li.hsn,
      qty,
      rate,
      amount,
      gstRate: taxPct > 0 ? `${taxPct}%` : 'Exempt (0%)',
      taxPct,
      cgst,
      sgst,
      igst,
      total: lineTotal,
      isDoctor: false
    };
  });

  const allLines = [
    ...(doctorConsultation ? [doctorConsultation] : []),
    ...productLines
  ].map((item, idx) => ({
    ...item,
    sno: idx + 1
  }));

  const totalTaxableValue = Math.round(((doctorConsultation ? doctorConsultation.amount : 0) + productLines.reduce((s, li) => s + li.amount, 0)) * 100) / 100;
  const totalCGST = Math.round(productLines.reduce((s, li) => s + li.cgst, 0) * 100) / 100;
  const totalSGST = Math.round(productLines.reduce((s, li) => s + li.sgst, 0) * 100) / 100;
  const totalIGST = Math.round(productLines.reduce((s, li) => s + li.igst, 0) * 100) / 100;
  const totalGST = Math.round((totalCGST + totalSGST + totalIGST) * 100) / 100;
  const grandTotal = Math.round((totalTaxableValue + totalGST) * 100) / 100;

  // Determine active GST percentage labels
  const taxRates = Array.from(new Set(
    allLines
      .map(li => Number(li.taxPct) || 0)
      .filter(r => r > 0)
  ));
  const primaryTaxPct = taxRates.length > 0 ? taxRates[0] : 0;
  const rateStr = taxRates.length > 1 ? `${taxRates.join('%, ')}%` : (primaryTaxPct > 0 ? `${primaryTaxPct}%` : '');
  const halfRateStr = taxRates.length > 1 ? `${taxRates.map(r => r / 2).join('%, ')}%` : (primaryTaxPct > 0 ? `${primaryTaxPct / 2}%` : '');

  const cgstLabel = (totalCGST > 0 || (isIntraState && rateStr)) ? `Total CGST (${halfRateStr})` : 'Total CGST';
  const sgstLabel = (totalSGST > 0 || (isIntraState && rateStr)) ? `Total SGST/UTGST (${halfRateStr})` : 'Total SGST/UTGST';
  const igstLabel = (totalIGST > 0 || (!isIntraState && rateStr)) ? `Total IGST (${rateStr})` : 'Total IGST';
  const totalGstLabel = rateStr ? `Total GST Amount (${rateStr})` : 'Total GST Amount';

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
    isIntraState,
    cgstLabel,
    sgstLabel,
    igstLabel,
    totalGstLabel,
    rateStr,
    halfRateStr
  };
}

/* ─── Main BulkInvoiceModal Component ───────────────────────────────────── */
export default function BulkInvoiceModal({ isOpen, onClose, selectedOrders = [], from = '', to = '' }) {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [doctorFee, setDoctorFee] = useState(0);
  const [gstSelect, setGstSelect] = useState('12'); // '0', '5', '12', '18', '28', 'custom'
  const [customGst, setCustomGst] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('info');
  const [count, setCount] = useState(null);

  if (!isOpen) return null;

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  const effectiveGstRate = gstSelect === 'custom' ? (Number(customGst) || 0) : Number(gstSelect);

  const handleDownload = async () => {
    // Open print window synchronously during user click to bypass browser popup blockers
    let win = null;
    try {
      win = window.open('', '_blank');
      if (win) {
        win.document.write(`
          <!DOCTYPE html>
          <html>
          <head><title>Generating Bulk Invoices...</title></head>
          <body style="font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0fdf4; color: #166534;">
            <div style="width: 48px; height: 48px; border: 4px solid #bbf7d0; border-top-color: #16a34a; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 16px;"></div>
            <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
            <h2 style="margin: 0 0 8px 0; font-weight: 800;">Generating Bulk Tax Invoices...</h2>
            <p style="margin: 0; color: #15803d; font-size: 14px;">Fetching delivered shipments from server. Please wait...</p>
          </body>
          </html>
        `);
      }
    } catch (e) {
      console.warn('Failed to pre-open window:', e);
    }

    setLoading(true);
    setStatus('Fetching delivered shipments...');
    setStatusType('info');
    setCount(null);
    try {
      let allShipments = [];

      if (selectedOrders && selectedOrders.length > 0) {
        allShipments = selectedOrders;
      } else {
        let fetchFrom = from;
        let fetchTo = to;

        if (!fetchFrom || !fetchTo) {
          const fromDate = new Date(selectedYear, selectedMonth, 1);
          const toDate = new Date(selectedYear, selectedMonth + 1, 0);
          const fmtLocalDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          fetchFrom = fmtLocalDate(fromDate);
          fetchTo = fmtLocalDate(toDate);
        }

        const res = await smxSvc.getDeliveredOrders({
          page: 1,
          per_page: 'all',
          from: fetchFrom,
          to: fetchTo,
        });
        const d = res.data?.data || {};
        allShipments = Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : [];
      }

      setCount(allShipments.length);

      if (allShipments.length === 0) {
        if (win && !win.closed) win.close();
        setStatus('No delivered shipments found for this month.');
        setStatusType('error');
        setLoading(false);
        return;
      }

      setStatus(`Building ${allShipments.length} invoices...`);
      setStatusType('info');

      const invoicesData = allShipments.map((s, i) => computeInvoiceData(s, i + 1, doctorFee, effectiveGstRate));
      
      Promise.all(invoicesData.map(data => {
        const { allLines, isIntraState, ...payload } = data;
        return saveInvoiceHistory(payload);
      })).catch(err => console.error('Failed to save bulk invoice history:', err));

      const invoicesHTML = allShipments.map((s, i) => {
        const data = invoicesData[i];
        const thStyle = 'padding:8px 6px;font-size:11.5px;font-weight:700;color:#000;background:#f8fafc;border-top:1.5px solid #000;border-right:1px solid #000;border-bottom:1.5px solid #000;vertical-align:middle;box-sizing:border-box;';
        const tdStyle = 'padding:6px 6px;font-size:11.5px;color:#000;border-right:1px solid #000;border-bottom:1px solid #000;vertical-align:middle;box-sizing:border-box;';

        const rows = data.allLines.map(li => `<tr>
          <td style="${tdStyle}text-align:center;">${li.sno}</td>
          <td style="${tdStyle}font-weight:600;">${li.description}</td>
          <td style="${tdStyle}text-align:center;font-size:10.5px;">${li.hsn}</td>
          <td style="${tdStyle}text-align:center;">${li.qty}</td>
          <td style="${tdStyle}text-align:right;">${fmtCurrency(li.rate)}</td>
          <td style="${tdStyle}text-align:right;">${fmtCurrency(li.amount)}</td>
          <td style="${tdStyle}text-align:center;font-size:10.5px;">${li.gstRate}</td>
          <td style="${tdStyle}text-align:right;">${fmtCurrency(li.cgst)}</td>
          <td style="${tdStyle}text-align:right;">${fmtCurrency(li.sgst)}</td>
          <td style="${tdStyle}text-align:right;">${li.igst > 0 ? fmtCurrency(li.igst) : '-'}</td>
          <td style="${tdStyle}text-align:right;font-weight:700;border-right:none;">${fmtCurrency(li.total)}</td>
        </tr>`).join('');

        const addr = COMPANY.address.replace(/\n/g, '<br/>');
        const custAddr = [
          s.billing_address,
          [s.billing_city, s.billing_state].filter(Boolean).join(', '),
          s.billing_pincode ? `- ${s.billing_pincode}` : '',
          'India',
        ].filter(Boolean).join('<br/>');

        const invoiceDateStr = formatDate(data.invoiceDate);
        const grandTotalWords = amountInWordsINR(data.grandTotal);
        const totalItemsCount = data.allLines.reduce((acc, li) => acc + (Number(li.qty) || 0), 0);

        return `<div class="invoice-page" style="font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:12px;color:#000;padding:0;box-sizing:border-box;page-break-after:always;">
        <div class="invoice-outer-box" style="border:2px solid #000;background:#fff;box-sizing:border-box;width:100%;min-height:282mm;height:282mm;display:flex;flex-direction:column;justify-content:space-between;page-break-inside:avoid;">
          <!-- 1. Header -->
          <div style="border-bottom:1.5px solid #000;padding:12px 16px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div>
                <div style="font-size:18px;font-weight:900;letter-spacing:0.5px;">${COMPANY.name}</div>
                <div style="font-size:11px;color:#111;margin-top:2px;">GSTIN: <strong>${COMPANY.gstin}</strong></div>
                <div style="font-size:10.5px;color:#222;margin-top:2px;line-height:1.35;">${addr}</div>
                <div style="font-size:10.5px;color:#222;margin-top:2px;">State: <strong>Uttar Pradesh</strong> (Code: 09)</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:15px;font-weight:900;letter-spacing:0.5px;">TAX INVOICE / BILL</div>
                <div style="font-size:11px;color:#111;margin-top:5px;line-height:1.45;">
                  Bill No.: <strong>${data.billNumber}</strong><br/>
                  Date: <strong>${invoiceDateStr}</strong><br/>
                  AWB: <strong>${s.awb_code || '—'}</strong><br/>
                  Place of Supply: <strong>${s.billing_state || 'Uttar Pradesh'}</strong>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. FROM / TO -->
          <div style="display:flex;border-top:1.5px solid #000;border-bottom:1.5px solid #000;">
            <div style="flex:1;padding:9px 14px;border-right:1px solid #000;background:#fafbfc;">
              <div style="font-size:10px;font-weight:800;text-transform:uppercase;margin-bottom:3px;letter-spacing:0.5px;">DETAILS OF SENDER / CONSIGNOR</div>
              <div style="font-size:12px;font-weight:800;">${COMPANY.name}</div>
              <div style="font-size:10.5px;color:#222;margin-top:2px;line-height:1.4;">
                GSTIN: <strong>${COMPANY.gstin}</strong><br/>
                ${addr}<br/>
                State: <strong>Uttar Pradesh</strong> (Code: 09)
              </div>
            </div>
            <div style="flex:1;padding:9px 14px;background:#fff;">
              <div style="font-size:10px;font-weight:800;text-transform:uppercase;margin-bottom:3px;letter-spacing:0.5px;">DETAILS OF RECEIVER / BUYER (BILLED TO)</div>
              <div style="font-size:12px;font-weight:800;">${s.billing_customer_name || 'Direct Customer'}</div>
              <div style="font-size:10.5px;color:#222;margin-top:2px;line-height:1.4;">
                ${(s.billing_gstin || s.customer_gstin || s.raw_response?.customer_gstin || s.raw_response?.billing_gstin) ? 'GSTIN / UIN: <strong>' + (s.billing_gstin || s.customer_gstin || s.raw_response?.customer_gstin || s.raw_response?.billing_gstin) + '</strong><br/>' : ''}
                ${custAddr}<br/>
                ${s.billing_phone ? 'Phone: <strong>' + s.billing_phone + '</strong><br/>' : ''}
                State: <strong>${s.billing_state || 'Uttar Pradesh'}</strong>
              </div>
            </div>
          </div>

          <!-- 3. Table -->
          <div style="flex:1 1 auto;display:flex;flex-direction:column;width:100%;height:100%;border-top:1.5px solid #000;border-bottom:1.5px solid #000;">
          <table style="width:100%;height:100%;flex:1 1 auto;border-collapse:collapse;border:none;margin:0;">
            <thead>
              <tr>
                <th rowspan="2" style="${thStyle}text-align:center;width:36px;">Sl.</th>
                <th rowspan="2" style="${thStyle}text-align:left;min-width:150px;">Description of Goods / Services</th>
                <th rowspan="2" style="${thStyle}text-align:center;width:85px;">SAC / HSN Code</th>
                <th rowspan="2" style="${thStyle}text-align:center;width:42px;">Qty</th>
                <th rowspan="2" style="${thStyle}text-align:right;width:75px;">Rate (₹)</th>
                <th rowspan="2" style="${thStyle}text-align:right;width:80px;">Amount (₹)</th>
                <th rowspan="2" style="${thStyle}text-align:center;width:68px;">GST Rate</th>
                <th colspan="3" style="${thStyle}text-align:center;">GST Amount (₹)</th>
                <th rowspan="2" style="${thStyle}text-align:right;width:88px;border-right:none;">Total (₹)</th>
              </tr>
              <tr>
                <th style="${thStyle}text-align:right;width:55px;font-size:10px;">CGST${data.isIntraState && data.halfRateStr ? ` (${data.halfRateStr})` : ''}</th>
                <th style="${thStyle}text-align:right;width:65px;font-size:10px;">SGST/UTGST${data.isIntraState && data.halfRateStr ? ` (${data.halfRateStr})` : ''}</th>
                <th style="${thStyle}text-align:right;width:50px;font-size:10px;">IGST${!data.isIntraState && data.rateStr ? ` (${data.rateStr})` : ''}</th>
              </tr>
            </thead>
            <tbody>${rows}
              <tr style="height:100%;">
                <td style="${tdStyle}border-bottom:1.5px solid #000;">&nbsp;</td>
                <td style="${tdStyle}border-bottom:1.5px solid #000;">&nbsp;</td>
                <td style="${tdStyle}border-bottom:1.5px solid #000;">&nbsp;</td>
                <td style="${tdStyle}border-bottom:1.5px solid #000;">&nbsp;</td>
                <td style="${tdStyle}border-bottom:1.5px solid #000;">&nbsp;</td>
                <td style="${tdStyle}border-bottom:1.5px solid #000;">&nbsp;</td>
                <td style="${tdStyle}border-bottom:1.5px solid #000;">&nbsp;</td>
                <td style="${tdStyle}border-bottom:1.5px solid #000;">&nbsp;</td>
                <td style="${tdStyle}border-bottom:1.5px solid #000;">&nbsp;</td>
                <td style="${tdStyle}border-bottom:1.5px solid #000;">&nbsp;</td>
                <td style="${tdStyle}border-bottom:1.5px solid #000;border-right:none;">&nbsp;</td>
              </tr>
            </tbody>
          </table>
          </div>

          <!-- 4. Summary & Words -->
          <div style="display:flex;border-top:1.5px solid #000;border-bottom:1.5px solid #000;background:#fff;">
            <div style="flex:1;padding:10px 14px;border-right:1px solid #000;display:flex;flex-direction:column;justify-content:space-between;background:#fafbfc;">
              <div>
                <div style="font-size:9.5px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">Amount Chargeable (in words):</div>
                <div style="font-size:12px;font-weight:800;color:#000;margin-top:3px;line-height:1.4;">${grandTotalWords}</div>
              </div>
              <div style="margin-top:10px;padding-top:6px;border-top:1px dashed #cbd5e1;font-size:9px;color:#64748b;font-style:italic;">Declaration: We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</div>
            </div>
            <div style="width:330px;background:#fff;">
              <table style="width:100%;border-collapse:collapse;margin:0;">
                <tbody>
                  <tr><td style="${tdStyle}font-weight:600;padding:5px 12px;">Total Taxable Value</td><td style="${tdStyle}text-align:right;font-weight:600;border-right:none;padding:5px 12px;">${fmtCurrency(data.totalTaxableValue)}</td></tr>
                  <tr><td style="${tdStyle}padding:5px 12px;">${data.cgstLabel}</td><td style="${tdStyle}text-align:right;border-right:none;padding:5px 12px;">${fmtCurrency(data.totalCGST)}</td></tr>
                  <tr><td style="${tdStyle}padding:5px 12px;">${data.sgstLabel}</td><td style="${tdStyle}text-align:right;border-right:none;padding:5px 12px;">${fmtCurrency(data.totalSGST)}</td></tr>
                  <tr><td style="${tdStyle}padding:5px 12px;">${data.igstLabel}</td><td style="${tdStyle}text-align:right;border-right:none;padding:5px 12px;">${data.totalIGST > 0 ? fmtCurrency(data.totalIGST) : '—'}</td></tr>
                  <tr><td style="${tdStyle}padding:5px 12px;">${data.totalGstLabel}</td><td style="${tdStyle}text-align:right;border-right:none;padding:5px 12px;">${fmtCurrency(data.totalGST)}</td></tr>
                  <tr><td style="${tdStyle}font-weight:900;font-size:13px;padding:7px 12px;border-bottom:none;background:#f8fafc;">Grand Total (₹)</td><td style="${tdStyle}text-align:right;font-weight:900;font-size:13px;border-right:none;border-bottom:none;padding:7px 12px;background:#f8fafc;">${fmtCurrency(data.grandTotal)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 5. Terms & Signature -->
          <div style="display:flex;border-top:1.5px solid #000;background:#fff;">
            <div style="flex:1;padding:9px 14px;border-right:1px solid #000;font-size:9.5px;color:#334155;line-height:1.45;">
              <div style="font-weight:800;color:#0f172a;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.5px;">Terms & Conditions:</div>
              <ol style="margin:0;padding-left:16px;">
                <li>Goods once sold will only be replaced or returned as per company refund policy.</li>
                <li>All disputes are subject to Kanpur, Uttar Pradesh jurisdiction.</li>
                <li>This is a computer generated invoice issued by Triven Wellness.</li>
              </ol>
            </div>
            <div style="width:330px;padding:9px 14px;text-align:center;display:flex;flex-direction:column;justify-content:space-between;min-height:85px;">
              <div style="font-size:11px;font-weight:800;color:#000;">For ${COMPANY.name}</div>
              <div style="border-top:1px solid #000;padding-top:5px;font-size:10.5px;font-weight:700;color:#1e293b;">Authorised Signatory</div>
            </div>
          </div>
        </div>
      </div>`;
      }).join('');
      const monthLabel = `${MONTHS[selectedMonth]} ${selectedYear}`;

      const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Bulk Tax Invoices - ${monthLabel}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#fff;font-family:'Inter','Segoe UI',Arial,sans-serif;}
.invoice-page{page-break-after:always;padding:8mm 6mm;box-sizing:border-box;}
.invoice-page:last-child{page-break-after:avoid;}
@page{margin:6mm 6mm;size:A4 portrait;}
@media print{.no-print{display:none!important;page-break-after:avoid!important;height:0!important;margin:0!important;padding:0!important;}-webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; .invoice-page:not(.no-print){page-break-after:always;padding:8mm 6mm;box-sizing:border-box;}}
</style>
</head>
<body>
<div class="invoice-page no-print" style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f0fdf4;padding:60px;text-align:center;">
  <div style="width:64px;height:64px;border-radius:16px;background:#dcfce7;color:#16a34a;display:flex;align-items:center;justify-content:center;margin-bottom:16px;">
    <svg width="36" height="36" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/></svg>
  </div>
  <div style="font-size:28px;font-weight:900;color:#15803d;margin-bottom:6px;">${COMPANY.name}</div>
  <div style="font-size:18px;color:#374151;font-weight:700;margin-bottom:4px;">Bulk Tax Invoices</div>
  <div style="font-size:15px;color:#6b7280;">${monthLabel}</div>
  <div style="margin-top:16px;font-size:13px;color:#9ca3af;">Total Invoices: ${allShipments.length}</div>
  <div style="margin-top:4px;font-size:12px;color:#9ca3af;">GST Mode: Auto-detected (CGST+SGST for Uttar Pradesh, IGST for other states)</div>
  <div style="margin-top:8px;font-size:12px;color:#9ca3af;">Doctor Fee: ₹${doctorFee} (deducted from medicines)</div>
  <div style="margin-top:4px;font-size:12px;color:#9ca3af;">Medicine GST: ${effectiveGstRate}%</div>
  <div style="margin-top:36px;display:flex;gap:14px;justify-content:center;">
    <button onclick="window.print()" style="padding:14px 32px;border-radius:8px;border:none;background:#15803d;color:#fff;font-size:15px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:8px;">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
      Print / Save as PDF
    </button>
    <button onclick="window.close()" style="padding:14px 28px;border-radius:8px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:15px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:8px;">
      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      Close
    </button>
  </div>
</div>
${invoicesHTML}
<script>setTimeout(()=>window.print(),900);<\/script>
</body>
</html>`;

      if (win && !win.closed) {
        win.document.open();
        win.document.write(fullHTML);
        win.document.close();
      } else {
        const blob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const newWin = window.open(url, '_blank');
        if (!newWin) {
          alert('Pop-up blocked! Please allow pop-ups for this site and try again.');
        }
      }

      setStatus(`${allShipments.length} invoices opened in new tab — use Print → Save as PDF.`);
      setStatusType('success');
    } catch (err) {
      if (win && !win.closed) win.close();
      console.error('Bulk invoice error:', err);
      setStatus('Error fetching shipments. Please try again.');
      setStatusType('error');
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
              <svg width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
              <span>Bulk Invoice Download</span>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.78)', marginTop: 3 }}>
              Month-wise delivered shipment invoices
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 8, color: '#fff',
            width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '26px 26px 22px' }}>

          {/* Month + Year */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>Select Month</span>
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
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>Doctor Consultation Fee (Per Invoice)</span>
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
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <span>Medicine GST Rate</span>
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
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
              <span>GST Mode</span>
            </div>
            <div style={{
              background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 9, padding: '10px 14px',
              fontSize: 12.5, color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8
            }}>
              <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ flexShrink: 0, color: '#059669' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span><strong>Automatic Detection:</strong> CGST + SGST for Uttar Pradesh customers; IGST for all other states.</span>
            </div>
          </div>

          {/* Info */}
          <div style={{
            background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 9,
            padding: '11px 14px', marginBottom: 20, fontSize: 11.5, color: '#0369a1', lineHeight: 1.65,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <svg width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <strong>How it works:</strong>
            </div>
            1. Fetches all <strong>delivered</strong> shipments for the chosen month<br />
            2. Generates one tax invoice per shipment (same format as individual invoice)<br />
            3. Opens a combined page in a <strong>new tab</strong><br />
            4. Click <strong>"Print / Save as PDF"</strong> to save
          </div>

          {/* Status */}
          {status && (
            <div style={{
              background: statusType === 'error' ? '#fef2f2' : statusType === 'success' ? '#f0fdf4' : '#f8fafc',
              border: `1px solid ${statusType === 'error' ? '#fecaca' : statusType === 'success' ? '#86efac' : '#e2e8f0'}`,
              borderRadius: 8, padding: '9px 13px', marginBottom: 14,
              fontSize: 12.5, fontWeight: 600,
              color: statusType === 'error' ? '#dc2626' : statusType === 'success' ? '#15803d' : '#475569',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {loading ? (
                <span style={{
                  display: 'inline-block', width: 13, height: 13, border: '2px solid currentColor',
                  borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0,
                }} />
              ) : statusType === 'error' ? (
                <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : statusType === 'success' ? (
                <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : null}
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download {MONTHS[selectedMonth]} {selectedYear}</span>
                </span>
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
