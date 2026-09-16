import React, { useState, useEffect } from 'react';
import { getOrder as fetchShipmaxxOrder, sendToVerification as smSendToVerification } from '../services/shipmaxx.service';
import { getOrder as fetchShiprocketOrder, sendToVerification as srSendToVerification } from '../services/shiprocket.service';
import { submitRtoVerification } from '../services/opsDashboard.service';
import { useToast } from '../context/ToastContext';
import { MessageSquare, User, Edit3, Save, XCircle, CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react';

export default function RtoVerificationModal({ isOpen, onClose, shipment, onSuccess }) {
  const { success, error, warning } = useToast();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentsList, setCommentsList] = useState([]);

  useEffect(() => {
    if (isOpen && shipment) {
      setCommentText('');
      const initialComments = shipment.comments || [];
      setCommentsList(initialComments);
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
      if (data?.comments?.length) {
        setCommentsList(data.comments);
      }
    } catch (err) {
      console.error(err);
      error('Failed to load full shipment details');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCommentOnly = async () => {
    if (!commentText.trim()) {
      warning('Please enter a comment before saving');
      return;
    }
    setSavingComment(true);
    try {
      const updatedOrder = await submitRtoVerification({
        order_id: shipment.order_id || shipment._id,
        platform: shipment.platform,
        comment: commentText.trim(),
      });
      success('Comment saved successfully');
      setCommentText('');
      if (updatedOrder?.comments) {
        setCommentsList(updatedOrder.comments);
      }
      if (onSuccess) onSuccess(shipment.order_id, shipment.rto_verification_action, updatedOrder);
    } catch (err) {
      console.error(err);
      error('Failed to save comment');
    } finally {
      setSavingComment(false);
    }
  };

  const handleVerification = async (action) => {
    setSubmitting(true);
    try {
      const updatedOrder = await submitRtoVerification({
        order_id: shipment.order_id || shipment._id,
        platform: shipment.platform,
        action,
        comment: commentText.trim() ? commentText.trim() : undefined,
      });
      success(action === 'wants_again' ? 'Marked as Wants Again' : 'Marked as No Need');
      setCommentText('');
      if (onSuccess) onSuccess(shipment.order_id, action, updatedOrder);
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
      if (commentText.trim()) {
        await submitRtoVerification({
          order_id: shipment.order_id || shipment._id,
          platform: shipment.platform,
          comment: commentText.trim(),
        });
        setCommentText('');
      }
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

  const ver = shipment.verification_id || {};
  const legacyNote = shipment.notes || shipment.follow_ups?.[shipment.follow_ups.length - 1]?.note || '—';
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
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 540,
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        maxHeight: '90vh'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={20} style={{ color: '#16a34a' }} />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>RTO Verification</h2>
            {shipment.rto_verification_action && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                background: shipment.rto_verification_action === 'wants_again' ? '#dcfce7' : '#fee2e2',
                color: shipment.rto_verification_action === 'wants_again' ? '#16a34a' : '#dc2626',
                display: 'inline-flex', alignItems: 'center', gap: 4
              }}>
                {shipment.rto_verification_action === 'wants_again' ? (
                  <><CheckCircle2 size={12} /> Verified (Wants Again)</>
                ) : (
                  <><XCircle size={12} /> No Need</>
                )}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, lineHeight: 1, cursor: 'pointer', color: '#94a3b8' }}>×</button>
        </div>

        {/* Content Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
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
              
              {/* Health Info from Verification */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Field label="Age" value={ver.age ? `${ver.age} Yrs` : '—'} />
                <Field label="Weight" value={ver.weight ? `${ver.weight} kg` : '—'} />
                <Field label="Height" value={ver.height ? `${ver.height} ft` : '—'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Problem Duration" value={ver.problemDuration || '—'} />
                <Field label="Other Problems" value={ver.otherProblems || '—'} />
              </div>

              {/* Comments & Notes History (Only showing comments added from RTO Verification) */}
              {(() => {
                const userComments = commentsList.filter(c => c && c.text && (c.section === 'rto_verification' || c.section === 'rto'));
                return (
                  <div style={{
                    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14,
                    display: 'flex', flexDirection: 'column', gap: 10
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <MessageSquare size={13} style={{ color: '#64748b' }} /> RTO Comments ({userComments.length})
                      </span>
                      {legacyNote && legacyNote !== '—' && (
                        <span style={{ fontSize: 11, color: '#64748b' }}>Note: {legacyNote}</span>
                      )}
                    </div>

                    <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                      {userComments.length > 0 ? (
                        userComments.map((c, i) => (
                          <div key={i} style={{
                            background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 12px',
                            fontSize: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <span style={{ fontWeight: 700, color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <User size={12} style={{ color: '#64748b' }} /> {c.createdBy?.name || 'Staff'} {c.createdBy?.role ? `(${c.createdBy.role})` : ''}
                              </span>
                              <span style={{ fontSize: 10, color: '#94a3b8' }}>
                                {c.createdAt ? new Date(c.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                              </span>
                            </div>
                            <div style={{ color: '#334155', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{c.text}</div>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                          No RTO verification comments recorded yet. Add one below!
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Add Comment Input Box */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Edit3 size={12} style={{ color: '#64748b' }} /> Add New Comment / Note
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <textarea
                    rows={2}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Type operational comment or customer response note..."
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1',
                      fontSize: 13, color: '#0f172a', resize: 'vertical', fontFamily: 'inherit',
                      outline: 'none', transition: 'border-color 0.15s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#16a34a'}
                    onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                  />
                  <button
                    type="button"
                    disabled={savingComment || submitting || !commentText.trim()}
                    onClick={handleSaveCommentOnly}
                    style={{
                      padding: '8px 14px', borderRadius: 8, border: '1px solid #16a34a',
                      background: commentText.trim() ? '#16a34a' : '#f1f5f9',
                      color: commentText.trim() ? '#fff' : '#94a3b8',
                      fontSize: 12, fontWeight: 700, cursor: commentText.trim() ? 'pointer' : 'not-allowed',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                      whiteSpace: 'nowrap', minWidth: 90, transition: 'all 0.15s'
                    }}
                  >
                    <Save size={14} />
                    <span>Save Note</span>
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10, justifyContent: 'flex-end', background: '#f8fafc'
        }}>
          <button 
            disabled={submitting || loading || savingComment}
            onClick={() => handleVerification('no_need')}
            style={{
              padding: '9px 12px', fontSize: '12px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fee2e2',
              color: '#dc2626', fontWeight: 700, cursor: 'pointer', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6,
              opacity: (submitting || savingComment) ? 0.6 : 1
            }}
          >
            <XCircle size={15} /> No Need (Cancel)
          </button>
          <button 
            disabled={submitting || loading || savingComment}
            onClick={() => handleVerification('wants_again')}
            style={{
              padding: '9px 12px', fontSize: '12px', borderRadius: 8, border: 'none', background: '#16a34a',
              color: '#fff', fontWeight: 700, cursor: 'pointer', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6,
              boxShadow: '0 2px 6px rgba(22, 163, 74, 0.2)',
              opacity: (submitting || savingComment) ? 0.6 : 1
            }}
          >
            <CheckCircle2 size={15} /> Wants Again (Re-attempt)
          </button>
          <button 
            disabled={submitting || loading || savingComment}
            onClick={handleSendToVerification}
            style={{
              padding: '9px 14px', fontSize: '11px', borderRadius: 24, border: 'none', background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
              color: '#fff', fontWeight: 800, cursor: 'pointer', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5,
              boxShadow: '0 4px 12px rgba(234, 88, 12, 0.35)', textTransform: 'uppercase', letterSpacing: '0.3px',
              opacity: (submitting || savingComment) ? 0.6 : 1
            }}
          >
            <RefreshCw size={14} /> Send to Verification
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
