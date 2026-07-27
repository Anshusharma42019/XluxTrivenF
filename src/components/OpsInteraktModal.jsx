import { useState, useEffect } from 'react';
import { fetchInteraktTemplates, sendInteraktMessages } from '../services/opsDashboard.service';

export default function OpsInteraktModal({ isOpen, onClose, targetShipment, filters, totalCount }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const defaultTemplates = [
    { id: 'def_0', name: 'undeliveredattempt_ts', language: 'en', display: 'Undelivered Attempt (Default)', body: 'Dear {{1}}, we attempted delivery of your shipment today but it could not be delivered. Please respond so we can schedule a re-attempt.' },
    { id: 'def_1', name: 'ndr_undelivered_followup', language: 'en', display: 'NDR Undelivered Follow-up (English)', body: 'Hi {{1}}, your shipment {{2}} via {{3}} (Amount: {{4}}) was marked {{5}}. Please let us know if you would like us to reattempt delivery.' },
    { id: 'def_2', name: 'order_reattempt_confirmation', language: 'hi', display: 'Reattempt Delivery (Hindi)', body: 'नमस्ते {{1}} जी, आपका ऑर्डर {{2}} (₹{{4}}) किसी कारण से डिलीवर नहीं हो पाया। कृपया हमें बताएं ताकि हम {{3}} द्वारा दोबारा डिलीवरी करवा सकें।' },
    { id: 'def_3', name: 'crm_bulk_pending_mh', language: 'en', display: 'General Pending Followup', body: 'Dear {{1}}, we noticed your order is currently pending/undelivered. Please contact Support for instant assistance.' },
    { id: 'def_4', name: 'crm_bulk_callagain_sz', language: 'en', display: 'Call Again Request', body: 'Hi {{1}}, our delivery agent attempted to call you regarding your order. Please respond to confirm delivery.' },
  ];

  useEffect(() => {
    if (isOpen) {
      setResult(null);
      setError('');
      setSelectedTemplate('undeliveredattempt_ts');
      setLoading(true);
      fetchInteraktTemplates().then(res => {
        const apiTemplates = res || [];
        const merged = [...defaultTemplates];
        apiTemplates.forEach(apiT => {
          if (!merged.find(m => m.name === apiT.name)) {
            const bodyComponent = apiT.components?.find(c => c.type === 'BODY')?.text || 'Custom Interakt Template';
            merged.push({ ...apiT, id: apiT.id || apiT.name, display: `${apiT.name}`, body: bodyComponent });
          }
        });
        setTemplates(merged);
      }).catch(err => {
        console.error('Failed to fetch API templates, using default NDR templates:', err);
        setTemplates(defaultTemplates);
      }).finally(() => {
        setLoading(false);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!selectedTemplate) {
      setError('Please select a WhatsApp template first.');
      return;
    }
    setSending(true);
    setError('');
    setResult(null);

    try {
      const activeT = templates.find(t => t.name === selectedTemplate);
      const languageCode = activeT?.language || 'en';
      
      const payload = {
        templateName: selectedTemplate,
        languageCode,
        useFilters: !targetShipment,
        items: targetShipment ? [targetShipment] : undefined
      };

      const res = await sendInteraktMessages(payload, targetShipment ? {} : filters);
      setResult(res?.data || res || { sent_count: 1, failed_count: 0, excluded_count: 0 });
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to send Interakt template message');
    } finally {
      setSending(false);
    }
  };

  const activeTemplate = templates.find(t => t.name === selectedTemplate) || defaultTemplates[0];
  const isSingle = !!targetShipment;
  const targetPhone = targetShipment ? (targetShipment.billing_phone || targetShipment.phone || 'N/A') : 'All matching customers';
  const targetName = targetShipment ? (targetShipment.billing_customer_name || 'Customer') : 'Data-wise dynamic customer name';
  const targetAwb = targetShipment ? (targetShipment.awb_code || 'N/A') : 'Data-wise dynamic AWB';
  const targetAmount = targetShipment ? `₹${(targetShipment.sub_total || 0).toLocaleString('en-IN')}` : 'Data-wise order amount';
  const targetCourier = targetShipment ? (targetShipment.courier_name || 'Courier') : 'Data-wise courier partner';
  const targetStatus = targetShipment ? (targetShipment.status || 'Undelivered') : (filters?.status || 'Undelivered');

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 16
    }}>
      <div style={{
        background: '#ffffff', borderRadius: 20, maxWidth: 540, width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', border: '1px solid #e2e8f0'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0f766e 0%, #15803d 100%)', padding: '20px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#ffffff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22
            }}>
              💬
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-0.3px' }}>
                {isSingle ? 'Send Interakt WhatsApp Message' : 'Bulk Undelivered WhatsApp Message'}
              </h2>
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                {isSingle ? `To: ${targetName} (${targetPhone})` : `Sending Data-Wise to ${totalCount || 'matching'} Shipments`}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: '#fff', fontSize: 26,
            cursor: 'pointer', padding: 0, lineHeight: 1, opacity: 0.8
          }}>×</button>
        </div>

        <div style={{ padding: '24px', maxHeight: 'calc(85vh - 140px)', overflowY: 'auto' }}>
          {result ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', color: '#16a34a',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 16px'
              }}>
                ✓
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
                Interakt Messaging Complete!
              </h3>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>
                {result.message || 'WhatsApp template messages have been queued and dispatched.'}
              </p>
              
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, background: '#f8fafc',
                padding: 16, borderRadius: 14, border: '1px solid #e2e8f0', marginBottom: 24
              }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>{result.sent_count ?? 0}</div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Sent</div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626' }}>{result.failed_count ?? 0}</div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Failed</div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b' }}>{result.excluded_count ?? 0}</div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Excluded</div>
                </div>
              </div>

              {result.errors && result.errors.length > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 12, borderRadius: 10, textAlign: 'left', marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', marginBottom: 6 }}>Recent Errors:</div>
                  {result.errors.map((e, idx) => (
                    <div key={idx} style={{ fontSize: 11, color: '#b91c1c', fontFamily: 'monospace' }}>• {e}</div>
                  ))}
                </div>
              )}

              <button onClick={onClose} style={{
                width: '100%', padding: '12px', background: '#0f172a', color: '#fff',
                border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer'
              }}>
                Close & Return
              </button>
            </div>
          ) : (
            <>
              {/* Info Box */}
              <div style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: 14, marginBottom: 20,
                display: 'flex', gap: 12, alignItems: 'flex-start'
              }}>
                <span style={{ fontSize: 20 }}>📦</span>
                <div style={{ fontSize: 13, color: '#166534' }}>
                  <strong>Data-Wise Variable Auto-Mapping:</strong><br />
                  We automatically pass customer & shipment values into your Interakt variables:
                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11, fontWeight: 600 }}>
                    <span style={{ background: '#dcfce7', padding: '2px 8px', borderRadius: 6 }}>{'{{1}} = Customer Name'}</span>
                    <span style={{ background: '#dcfce7', padding: '2px 8px', borderRadius: 6 }}>{'{{2}} = AWB / Order'}</span>
                    <span style={{ background: '#dcfce7', padding: '2px 8px', borderRadius: 6 }}>{'{{3}} = Courier'}</span>
                    <span style={{ background: '#dcfce7', padding: '2px 8px', borderRadius: 6 }}>{'{{4}} = Amount'}</span>
                    <span style={{ background: '#dcfce7', padding: '2px 8px', borderRadius: 6 }}>{'{{5}} = Status'}</span>
                  </div>
                </div>
              </div>

              {/* Template Select */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
                  Select Interakt Template ({loading ? 'Loading...' : `${templates.length} available`})
                </label>
                <select
                  value={selectedTemplate}
                  onChange={e => setSelectedTemplate(e.target.value)}
                  disabled={loading || sending}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1',
                    fontSize: 14, color: '#0f172a', background: '#f8fafc', outline: 'none', cursor: 'pointer'
                  }}
                >
                  <option value="">-- Select Template --</option>
                  {templates.map((t, index) => (
                    <option key={t.id || index} value={t.name}>
                      {t.display || t.name} ({t.language || 'en'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Preview Box */}
              <div style={{
                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, marginBottom: 20, position: 'relative'
              }}>
                <div style={{
                  position: 'absolute', top: 12, right: 12, background: '#dcfce7', color: '#15803d',
                  fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase'
                }}>
                  Live Message Preview
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>
                  Template Content:
                </div>
                <div style={{
                  background: '#ffffff', padding: 14, borderRadius: 10, border: '1px solid #f1f5f9',
                  fontSize: 13, color: '#334155', lineHeight: 1.5, fontFamily: 'sans-serif', whiteSpace: 'pre-wrap'
                }}>
                  {activeTemplate ? (
                    activeTemplate.body
                      ?.replace(/{{1}}/g, `[${targetName}]`)
                      ?.replace(/{{2}}/g, `[${targetAwb}]`)
                      ?.replace(/{{3}}/g, `[${targetCourier}]`)
                      ?.replace(/{{4}}/g, `[${targetAmount}]`)
                      ?.replace(/{{5}}/g, `[${targetStatus}]`) || 'Template preview not available from server'
                  ) : 'Select a template to view content'}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, fontStyle: 'italic' }}>
                  {isSingle ? `Will be sent instantly to ${targetPhone}` : `Will be dynamically substituted for each of the ${totalCount || 'selected'} undelivered shipments`}
                </div>
              </div>

              {error && (
                <div style={{
                  background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
                  padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 20
                }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={onClose} disabled={sending} style={{
                  flex: 1, padding: '12px', borderRadius: 12, border: '1px solid #cbd5e1',
                  background: '#ffffff', color: '#475569', fontSize: 14, fontWeight: 700, cursor: 'pointer'
                }}>
                  Cancel
                </button>
                <button onClick={handleSend} disabled={sending || !selectedTemplate} style={{
                  flex: 2, padding: '12px', borderRadius: 12, border: 'none',
                  background: sending ? '#93c5fd' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                  color: '#ffffff', fontSize: 14, fontWeight: 700, cursor: sending ? 'wait' : 'pointer',
                  boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
                }}>
                  {sending ? 'Sending via Interakt...' : (isSingle ? 'Send WhatsApp Message Now' : `Send to All (${totalCount || 'Selected'}) Now`)}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
