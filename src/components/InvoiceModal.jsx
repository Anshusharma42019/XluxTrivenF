import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { saveInvoiceHistory } from '../services/opsDashboard.service';

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

const getYearMonthPrefix = (order) => {
  const dateStr = order.delivered_at || order.status_updated_at || order.createdAt || new Date();
  const date = new Date(dateStr);
  const yy = date.getFullYear().toString().slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${yy}${mm}`;
};

const generateBillNumber = (order) => {
  const prefix = getYearMonthPrefix(order);
  const idPart = (order.order_id || order._id || '000').toString();
  return `TW-${prefix}-${idPart}`;
};

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/* ─── Print Styles ───────────────────────────────────────────────────────── */
const PRINT_STYLES = `
  .invoice-print-only { display: none !important; }
  @media print {
    /* Hide the entire React app */
    #root { display: none !important; }
    
    /* Hide other body elements except the portal container */
    body > *:not(.invoice-portal-container) { display: none !important; }
    
    /* Force portal container to be a simple block */
    .invoice-portal-container {
      display: block !important;
      position: static !important;
      width: 100% !important;
      background: #fff !important;
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
      height: auto !important;
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
    }
    
    .invoice-print-area {
      padding: 0 !important;
      margin: 0 !important;
      width: 100% !important;
    }

    .invoice-no-print { display: none !important; }
    .invoice-print-only { display: inline-block !important; }
    
    @page {
      margin: 12mm 10mm;
      size: A4;
    }
  }
`;

/* ─── Shared cell style ──────────────────────────────────────────────────── */
const cellBase = {
  padding: '8px 6px',
  fontSize: 12,
  color: '#000',
  borderRight: '1px solid #000',
  borderBottom: '1px solid #000',
  verticalAlign: 'middle',
};

/* ─── Component ──────────────────────────────────────────────────────────── */
export default function InvoiceModal({ isOpen, onClose, shipment, deliveryIndex = 1, doctorFee = 0, onDoctorFeeChange, taxMode = 'inter', onTaxModeChange }) {
  const printRef = useRef(null);
  const [lineItemsState, setLineItemsState] = useState([]);

  // Initialize state based on shipment data
  useEffect(() => {
    if (shipment) {
      // Only auto-set tax mode if user hasn't manually changed it yet
      // (parent owns the state, so we leave it as-is)

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

        return {
          id: idx,
          description: item.name || 'Product',
          hsn: item.hsn || autoHsn,
          qty,
          taxPct,
          totalInclusive: itemTotalInclusive,
        };
      });

      if (initialItems.length === 0) {
        initialItems.push({
          id: 0,
          description: 'Order',
          hsn: autoHsn,
          qty: 1,
          taxPct: 0,
          totalInclusive: Number(shipment.sub_total) || 0,
        });
      }

      setLineItemsState(initialItems);
    }
  }, [shipment, deliveryIndex]);

  if (!isOpen || !shipment) return null;

  const billNumber = generateBillNumber(shipment);
  const isIntraState = taxMode === 'intra';

  const updateItem = (id, field, value) => {
    setLineItemsState((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // ── Build line items and perform calculations ──
  // Doctor fee is entered by user; deducted from medicine totals proportionally
  const doctorFeeNum = Number(doctorFee) || 0;
  const rawProductTotal = lineItemsState.reduce((s, li) => s + li.totalInclusive, 0);
  const deductionRatio = rawProductTotal > 0 ? (rawProductTotal - doctorFeeNum) / rawProductTotal : 1;

  const doctorConsultation = {
    description: 'Doctor Consultation Charges',
    hsn: '999312\n(SAC)',
    qty: 1,
    rate: doctorFeeNum,
    amount: doctorFeeNum,
    gstRate: 'Exempt\n(0%)',
    cgst: 0,
    sgst: 0,
    igst: 0,
    total: doctorFeeNum,
    isDoctor: true,
  };

  const productLineItems = lineItemsState.map((li) => {
    // Adjust totalInclusive by subtracting doctor fee proportionally
    const adjustedTotal = li.totalInclusive * deductionRatio;
    const qty = li.qty;
    const taxPct = li.taxPct;
    const totalInclusive = adjustedTotal;

    const amount = totalInclusive / (1 + (taxPct / 100));
    const rate = qty > 0 ? amount / qty : 0;
    const gstAmount = totalInclusive - amount;

    const cgst = isIntraState ? gstAmount / 2 : 0;
    const sgst = isIntraState ? gstAmount / 2 : 0;
    const igst = isIntraState ? 0 : gstAmount;

    return {
      id: li.id,
      description: li.description,
      hsn: li.hsn,
      qty,
      rate: Math.round(rate * 100) / 100,
      amount: Math.round(amount * 100) / 100,
      gstRate: taxPct > 0 ? `${taxPct}%` : 'Exempt\n(0%)',
      taxPct,
      cgst: Math.round(cgst * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      igst: Math.round(igst * 100) / 100,
      total: Math.round(totalInclusive * 100) / 100,
      isDoctor: false,
    };
  });

  const finalLineItems = [
    doctorConsultation,
    ...productLineItems
  ].map((item, idx) => ({
    ...item,
    sno: idx + 1
  }));

  // Calculations for totals — include doctor fee in taxable value and grand total
  const totalTaxableValue = productLineItems.reduce((s, li) => s + li.amount, 0) + doctorFeeNum;
  const totalCGST = productLineItems.reduce((s, li) => s + li.cgst, 0);
  const totalSGST = productLineItems.reduce((s, li) => s + li.sgst, 0);
  const totalIGST = productLineItems.reduce((s, li) => s + li.igst, 0);
  const totalGST = totalCGST + totalSGST + totalIGST;
  const grandTotal = totalTaxableValue + totalGST;

  const handlePrint = () => {
    const payload = {
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
    window.print();
  };

  // ── Styles ──
  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    padding: 20, overflowY: 'auto',
  };

  const modal = {
    background: '#fff', borderRadius: 8, maxWidth: 960, width: '100%',
    maxHeight: '95vh', overflowY: 'auto', position: 'relative',
    boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
  };

  const invoiceBody = {
    padding: '32px 40px', fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif", color: '#000',
    fontSize: 13, lineHeight: 1.5,
  };

  // Render via portal directly to document.body
  return createPortal(
    <div className="invoice-portal-container">
      <style>{PRINT_STYLES}</style>
      <div className="invoice-overlay" style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="invoice-modal-box" style={modal}>
          {/* ── Action Bar (no-print) ── */}
          <div className="invoice-no-print" style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 24px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb',
            flexWrap: 'wrap', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🧾</span>
              <div>
                <div style={{ fontWeight: 700, color: '#111', fontSize: 15 }}>Tax Invoice / Bill</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{billNumber}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              {/* Doctor Fee Input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>🩺 Doctor Fee ₹:</span>
                <input
                  type="number"
                  min="0"
                  value={doctorFee}
                  onChange={(e) => onDoctorFeeChange && onDoctorFeeChange(e.target.value)}
                  style={{
                    width: 90, padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db',
                    fontSize: 12, fontWeight: 600, background: '#fff', color: '#374151',
                    textAlign: 'right',
                  }}
                  placeholder="0"
                />
                <span style={{ fontSize: 11, color: '#6b7280' }}>(deducted from medicine)</span>
              </div>
              {/* Interactive GST Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>GST Mode:</span>
                <select 
                  value={taxMode} 
                  onChange={(e) => onTaxModeChange && onTaxModeChange(e.target.value)}
                  style={{
                    padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db',
                    fontSize: 12, fontWeight: 600, background: '#fff', color: '#374151', cursor: 'pointer',
                  }}
                >
                  <option value="intra">CGST + SGST (Same State / Intra-state)</option>
                  <option value="inter">IGST (Other State / Inter-state)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handlePrint} style={{
                  padding: '8px 20px', borderRadius: 6, border: 'none',
                  background: '#111', color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  Print / Save PDF
                </button>
                <button onClick={onClose} style={{
                  padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db',
                  background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                  ✕ Close
                </button>
              </div>
            </div>
          </div>

          {/* ── Invoice Content (printable area) ── */}
          <div ref={printRef} className="invoice-print-area" style={invoiceBody}>

            {/* ═══════ HEADER ═══════ */}
            <div style={{ border: '1px solid #000', padding: '16px 20px', marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.5, color: '#000' }}>
                    {COMPANY.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#333', marginTop: 4 }}>
                    GSTIN: {COMPANY.gstin}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#444', marginTop: 2, whiteSpace: 'pre-line', lineHeight: 1.4 }}>
                    {COMPANY.address}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#000' }}>TAX INVOICE / BILL</div>
                  <div style={{ fontSize: 12, color: '#333', marginTop: 8 }}>
                    <div>Bill No.: <strong>{billNumber}</strong></div>
                    <div>Date: <strong>{formatDate(shipment.delivered_at || shipment.status_updated_at || new Date())}</strong></div>
                  </div>
                </div>
              </div>
            </div>

            {/* ═══════ FROM / TO ═══════ */}
            <div style={{ display: 'flex', border: '1px solid #000', borderTop: 'none' }}>
              {/* FROM */}
              <div style={{ flex: 1, padding: '14px 16px', borderRight: '1px solid #000' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#000', marginBottom: 6, textTransform: 'uppercase' }}>FROM</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#000' }}>{COMPANY.name}</div>
                <div style={{ fontSize: 11.5, color: '#333', marginTop: 4, lineHeight: 1.5 }}>
                  GSTIN: {COMPANY.gstin}<br />
                  {COMPANY.address.split('\n').map((line, i) => (
                    <span key={i}>{line}<br /></span>
                  ))}
                </div>
              </div>
              {/* TO */}
              <div style={{ flex: 1, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#000', marginBottom: 6, textTransform: 'uppercase' }}>TO</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#000' }}>
                  {shipment.billing_customer_name || 'Customer'}
                </div>
                <div style={{ fontSize: 11.5, color: '#333', marginTop: 4, lineHeight: 1.5 }}>
                  {shipment.billing_address && <>{shipment.billing_address}<br /></>}
                  {[shipment.billing_city, shipment.billing_state].filter(Boolean).join(', ')}
                  {shipment.billing_pincode ? ` - ${shipment.billing_pincode}` : ''}<br />
                  India<br />
                  {shipment.billing_phone && <>Phone: {shipment.billing_phone}<br /></>}
                </div>
              </div>
            </div>

            {/* ═══════ ITEMS TABLE ═══════ */}
            <div style={{ marginTop: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
                <thead>
                  {/* Double header row */}
                  <tr>
                    <th rowSpan={2} style={{ ...cellBase, fontWeight: 700, background: '#f5f5f5', textAlign: 'center', width: 40, borderLeft: 'none', borderTop: 'none' }}>Sl. No.</th>
                    <th rowSpan={2} style={{ ...cellBase, fontWeight: 700, background: '#f5f5f5', textAlign: 'left', minWidth: 160, borderTop: 'none' }}>Description of Goods / Services</th>
                    <th rowSpan={2} style={{ ...cellBase, fontWeight: 700, background: '#f5f5f5', textAlign: 'center', width: 85, borderTop: 'none' }}>SAC / HSN Code</th>
                    <th rowSpan={2} style={{ ...cellBase, fontWeight: 700, background: '#f5f5f5', textAlign: 'center', width: 50, borderTop: 'none' }}>Qty</th>
                    <th rowSpan={2} style={{ ...cellBase, fontWeight: 700, background: '#f5f5f5', textAlign: 'center', width: 75, borderTop: 'none' }}>Rate<br />(₹)</th>
                    <th rowSpan={2} style={{ ...cellBase, fontWeight: 700, background: '#f5f5f5', textAlign: 'center', width: 75, borderTop: 'none' }}>Amount<br />(₹)</th>
                    <th rowSpan={2} style={{ ...cellBase, fontWeight: 700, background: '#f5f5f5', textAlign: 'center', width: 80, borderTop: 'none' }}>GST<br />Rate</th>
                    <th colSpan={3} style={{ ...cellBase, fontWeight: 700, background: '#f5f5f5', textAlign: 'center', borderTop: 'none' }}>GST Amount (₹)</th>
                    <th rowSpan={2} style={{ ...cellBase, fontWeight: 700, background: '#f5f5f5', textAlign: 'center', width: 85, borderRight: 'none', borderTop: 'none' }}>Total<br />(₹)</th>
                  </tr>
                  <tr>
                    <th style={{ ...cellBase, fontWeight: 700, background: '#f5f5f5', textAlign: 'center', width: 60, fontSize: 11 }}>CGST</th>
                    <th style={{ ...cellBase, fontWeight: 700, background: '#f5f5f5', textAlign: 'center', width: 70, fontSize: 11 }}>SGST/UTGST</th>
                    <th style={{ ...cellBase, fontWeight: 700, background: '#f5f5f5', textAlign: 'center', width: 55, fontSize: 11 }}>IGST</th>
                  </tr>
                </thead>
                <tbody>
                  {finalLineItems.map((li) => (
                    <tr key={li.sno}>
                      {/* Sl No */}
                      <td style={{ ...cellBase, textAlign: 'center', borderLeft: 'none' }}>{li.sno}</td>

                      {/* Description */}
                      <td style={{ ...cellBase, fontWeight: 600 }}>
                        {li.isDoctor ? (
                          li.description
                        ) : (
                          <>
                            <span className="invoice-print-only">{li.description}</span>
                            <input 
                              type="text" 
                              className="invoice-no-print" 
                              value={li.description}
                              onChange={(e) => updateItem(li.id, 'description', e.target.value)}
                              style={{ width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }}
                            />
                          </>
                        )}
                      </td>

                      {/* HSN/SAC */}
                      <td style={{ ...cellBase, textAlign: 'center', fontSize: 11 }}>
                        {li.isDoctor ? (
                          <span style={{ whiteSpace: 'pre-line' }}>{li.hsn}</span>
                        ) : (
                          <>
                            <span className="invoice-print-only" style={{ whiteSpace: 'pre-line' }}>
                              {li.hsn ? `${li.hsn}\n(HSN)` : '—'}
                            </span>
                            <input 
                              type="text" 
                              className="invoice-no-print" 
                              placeholder="HSN Code"
                              value={li.hsn}
                              onChange={(e) => updateItem(li.id, 'hsn', e.target.value)}
                              style={{ width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box', textAlign: 'center' }}
                            />
                          </>
                        )}
                      </td>

                      {/* Qty */}
                      <td style={{ ...cellBase, textAlign: 'center' }}>
                        {li.isDoctor ? (
                          li.qty
                        ) : (
                          <>
                            <span className="invoice-print-only">{li.qty}</span>
                            <input 
                              type="number" 
                              className="invoice-no-print" 
                              value={li.qty}
                              onChange={(e) => updateItem(li.id, 'qty', Number(e.target.value))}
                              style={{ width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box', textAlign: 'center' }}
                            />
                          </>
                        )}
                      </td>

                      {/* Rate */}
                      <td style={{ ...cellBase, textAlign: 'right' }}>
                        {li.isDoctor ? (
                          <>
                            <span className="invoice-print-only">{fmtCurrency(li.rate)}</span>
                            <input
                              type="number"
                              min="0"
                              className="invoice-no-print"
                              value={doctorFee}
                              onChange={(e) => onDoctorFeeChange && onDoctorFeeChange(e.target.value)}
                              style={{ width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box', textAlign: 'right' }}
                            />
                          </>
                        ) : (
                          fmtCurrency(li.rate)
                        )}
                      </td>

                      {/* Amount */}
                      <td style={{ ...cellBase, textAlign: 'right' }}>{fmtCurrency(li.amount)}</td>

                      {/* GST Rate */}
                      <td style={{ ...cellBase, textAlign: 'center', fontSize: 11 }}>
                        {li.isDoctor ? (
                          <span style={{ whiteSpace: 'pre-line' }}>{li.gstRate}</span>
                        ) : (
                          <>
                            <span className="invoice-print-only" style={{ whiteSpace: 'pre-line' }}>{li.gstRate}</span>
                            <select 
                              className="invoice-no-print"
                              value={li.taxPct} 
                              onChange={(e) => updateItem(li.id, 'taxPct', Number(e.target.value))}
                              style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }}
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
                      <td style={{ ...cellBase, textAlign: 'right' }}>{fmtCurrency(li.cgst)}</td>

                      {/* SGST */}
                      <td style={{ ...cellBase, textAlign: 'right' }}>{fmtCurrency(li.sgst)}</td>

                      {/* IGST */}
                      <td style={{ ...cellBase, textAlign: 'right' }}>{li.igst > 0 ? fmtCurrency(li.igst) : '-'}</td>

                      {/* Total */}
                      <td style={{ ...cellBase, textAlign: 'right', fontWeight: 700, borderRight: 'none' }}>
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
                              style={{ width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box', textAlign: 'right', fontWeight: 700 }}
                            />
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ═══════ TOTALS SUMMARY ═══════ */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <table style={{ borderCollapse: 'collapse', border: '1px solid #000', minWidth: 360 }}>
                <tbody>
                  <tr>
                    <td style={{ ...cellBase, fontWeight: 600, borderLeft: 'none', padding: '8px 14px' }}>Total Taxable Value</td>
                    <td style={{ ...cellBase, textAlign: 'right', fontWeight: 600, borderRight: 'none', padding: '8px 14px', minWidth: 100 }}>{fmtCurrency(totalTaxableValue)}</td>
                  </tr>
                  <tr>
                    <td style={{ ...cellBase, borderLeft: 'none', padding: '8px 14px' }}>Total CGST</td>
                    <td style={{ ...cellBase, textAlign: 'right', borderRight: 'none', padding: '8px 14px' }}>{fmtCurrency(totalCGST)}</td>
                  </tr>
                  <tr>
                    <td style={{ ...cellBase, borderLeft: 'none', padding: '8px 14px' }}>Total SGST/UTGST</td>
                    <td style={{ ...cellBase, textAlign: 'right', borderRight: 'none', padding: '8px 14px' }}>{fmtCurrency(totalSGST)}</td>
                  </tr>
                  <tr>
                    <td style={{ ...cellBase, borderLeft: 'none', padding: '8px 14px' }}>Total IGST</td>
                    <td style={{ ...cellBase, textAlign: 'right', borderRight: 'none', padding: '8px 14px' }}>{totalIGST > 0 ? fmtCurrency(totalIGST) : '-'}</td>
                  </tr>
                  <tr>
                    <td style={{ ...cellBase, borderLeft: 'none', padding: '8px 14px' }}>Total GST Amount</td>
                    <td style={{ ...cellBase, textAlign: 'right', borderRight: 'none', padding: '8px 14px' }}>{fmtCurrency(totalGST)}</td>
                  </tr>
                  <tr>
                    <td style={{ ...cellBase, fontWeight: 800, fontSize: 14, borderLeft: 'none', padding: '10px 14px' }}>Grand Total</td>
                    <td style={{ ...cellBase, textAlign: 'right', fontWeight: 800, fontSize: 14, borderRight: 'none', padding: '10px 14px' }}>{fmtCurrency(grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ═══════ FOOTER ═══════ */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 50 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#000', marginBottom: 40 }}>
                  For {COMPANY.name}
                </div>
                <div style={{ borderTop: '1px solid #000', paddingTop: 8, fontSize: 12, color: '#333', minWidth: 200 }}>
                  Authorised Signatory
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
