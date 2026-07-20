import React, { useState, useEffect } from 'react';
import { getOrder as fetchShipmaxxOrder, sendToVerification as smSendToVerification } from '../services/shipmaxx.service';
import { getOrder as fetchShiprocketOrder, sendToVerification as srSendToVerification } from '../services/shiprocket.service';
import { submitRtoVerification } from '../services/opsDashboard.service';
import { useToast } from '../context/ToastContext';

export default function RtoVerificationModal({ isOpen, onClose, shipment, onSuccess }) {
  const { success, error } = useToast();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && shipment) {
      loadDetails();
    }
  }, [isOpen, shipment]);

  const loadDetails = async () => {
    setLoading(true);
    setDetails(null);
    try {
      let data;
      if (shipment.platform === 'shipmaxx') {
        const res = await fetchShipmaxxOrder(shipment.order_id);
        data = res.data?.data || res.data;
      } else {
        const res = await fetchShiprocketOrder(shipment.order_id);
        data = res.data?.data || res.data;
      }
      setDetails(data);
    } catch (err) {
      console.error(err);
      error('Failed to load full shipment details');
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (action) => {
    setSubmitting(true);
    try {
      await submitRtoVerification({
        order_id: shipment.order_id,
        platform: shipment.platform,
        action,
      });
      success(action === 'wants_again' ? 'Marked as Wants Again' : 'Marked as No Need');
      if (onSuccess) onSuccess(shipment.order_id, action);
      onClose();
    } catch (err) {
      console.error(err);
      error('Failed to submit verification');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendToVerification = async () => {
    setSubmitting(true);
    try {
      if (shipment.platform === 'shipmaxx') {
        await smSendToVerification(shipment._id, { source: 'rto' });
      } else {
        await srSendToVerification(shipment._id, { source: 'rto' });
      }
      success('Order moved back to Verification list');
      if (onSuccess) onSuccess(shipment.order_id, 'send_to_verification');
      onClose();
    } catch (err) {
      console.error(err);
      error('Failed to move to verification');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const dataToDisplay = details || shipment;
  const customer = dataToDisplay.billing_customer_name || '—';
  const phone = dataToDisplay.billing_phone || '—';

  // Use local shipment data for internal fields, and fallback to dataToDisplay (which might be external API data)
  const ver = shipment.verification_id || {};
  const task = shipment.comments?.length ? shipment.comments[shipment.comments.length - 1]?.text : 
               (shipment.notes || shipment.follow_ups?.[shipment.follow_ups.length - 1]?.note || '—');
  const problem = ver.problem || shipment.problem || dataToDisplay.problem || dataToDisplay.order_items?.[0]?.name || '—';
  const address = dataToDisplay.billing_address || '—';
  const city = dataToDisplay.billing_city || '—';
  const state = dataToDisplay.billing_state || '—';
  const pincode = dataToDisplay.billing_pincode || '—';
  const price = dataToDisplay.sub_total || dataToDisplay.price || 0;
  const awb = dataToDisplay.awb_code || '—';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500,
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>RTO Verification</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, lineHeight: 1, cursor: 'pointer', color: '#94a3b8' }}>×</button>
        </div>

        <div style={{ padding: 24, maxHeight: '70vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>Loading details...</div>
          ) : (
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr' }}>
              <Field label="AWB" value={awb} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Customer" value={customer} />
                <Field label="Phone" value={phone} />
              </div>
              <Field label="Address" value={address} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Field label="City" value={city} />
                <Field label="State" value={state} />
                <Field label="Pincode" value={pincode} />
              </div>
              <Field label="Price" value={`₹${price.toLocaleString('en-IN')}`} />
              <Field label="Problem" value={problem} />
              {/* Health Info from Verification (always visible) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Field label="Age" value={ver.age ? `${ver.age} Yrs` : '—'} />
                <Field label="Weight" value={ver.weight ? `${ver.weight} kg` : '—'} />
                <Field label="Height" value={ver.height ? `${ver.height} ft` : '—'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Problem Duration" value={ver.problemDuration || '—'} />
                <Field label="Other Problems" value={ver.otherProblems || '—'} />
              </div>

              <Field label="Task / Note" value={task} />
            </div>
          )}
        </div>

        <div style={{
          padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 12, justifyContent: 'flex-end', background: '#f8fafc'
        }}>
          <button 
            disabled={submitting || loading}
            onClick={() => handleVerification('no_need')}
            style={{
              padding: '8px 12px', fontSize: '13px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fee2e2',
              color: '#dc2626', fontWeight: 600, cursor: 'pointer', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
              opacity: submitting ? 0.6 : 1
            }}
          >
            ❌ No Need (Cancel)
          </button>
          <button 
            disabled={submitting || loading}
            onClick={() => handleVerification('wants_again')}
            style={{
              padding: '8px 12px', fontSize: '13px', borderRadius: 8, border: 'none', background: '#16a34a',
              color: '#fff', fontWeight: 600, cursor: 'pointer', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
              opacity: submitting ? 0.6 : 1
            }}
          >
            ✅ Wants Again (Re-attempt)
          </button>
          <button 
            disabled={submitting || loading}
            onClick={handleSendToVerification}
            style={{
              padding: '8px 16px', fontSize: '12px', borderRadius: 24, border: 'none', background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
              color: '#fff', fontWeight: 700, cursor: 'pointer', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6,
              boxShadow: '0 4px 12px rgba(234, 88, 12, 0.4)', textTransform: 'uppercase', letterSpacing: '0.5px',
              opacity: submitting ? 0.6 : 1
            }}
          >
            🔄 Send to Verification
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 14, color: '#0f172a', fontWeight: 500 }}>{value}</span>
    </div>
  );
}
