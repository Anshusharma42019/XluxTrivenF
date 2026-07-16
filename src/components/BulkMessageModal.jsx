import { useState, useEffect } from 'react';
import Modal from './ui/Modal';
import { getInteraktTemplates, sendBulkMessage, getBulkMessageBatchStatus } from '../services/lead.service';

export default function BulkMessageModal({ isOpen, onClose, currentFilter, items, totalCount }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [understandRisk, setUnderstandRisk] = useState(false);
  
  const [batchId, setBatchId] = useState(null);
  const [batchStatus, setBatchStatus] = useState(null);
  const [progressError, setProgressError] = useState('');

  // Pre-calculate exclusions based on frontend data (rough estimate, actual is done on backend)
  // But we don't have all leads on frontend, just paginated ones. We will rely on backend for exact counts after trigger.
  const [submitResult, setSubmitResult] = useState(null);

  const systemTemplates = [
    { id: 'sys2', name: 'crm_bulk_pending_mh', language: 'en', display: 'Pending Template' },
    { id: 'sys3', name: 'crm_bulk_cnp_xd', language: 'en', display: 'CNP Template' },
    { id: 'sys4', name: 'crm_bulk_callagain_sz', language: 'en', display: 'Call Again Template' },
    { id: 'sys5', name: 'crm_bulk_not_interested', language: 'en', display: 'Not Interested Template' },
    { id: 'sys6', name: 'booking_', language: 'hi', display: 'Booking Template' }
  ];

  useEffect(() => {
    if (isOpen) {
      // Auto-fill template based on section
      const mapping = {
        'on_hold': 'crm_bulk_pending_mh',
        'cnp': 'crm_bulk_cnp_xd',
        'call_again': 'crm_bulk_callagain_sz',
        'closed_lost': 'crm_bulk_not_interested'
      };
      if (mapping[currentFilter]) {
        setSelectedTemplate(mapping[currentFilter]);
      } else {
        setSelectedTemplate('');
      }

      if (!batchId) {
        setLoading(true);
        getInteraktTemplates().then(res => {
          const apiTemplates = res || [];
          // Merge API templates with system templates (avoid duplicates)
          const merged = [...systemTemplates];
          apiTemplates.forEach(apiT => {
            if (!merged.find(m => m.name === apiT.name)) {
              merged.push({ ...apiT, display: apiT.name });
            }
          });
          setTemplates(merged);
        }).catch(err => {
          console.error(err);
          setTemplates(systemTemplates); // fallback to system templates on error
        }).finally(() => {
          setLoading(false);
        });
      }
    }
  }, [isOpen, batchId, currentFilter]);

  useEffect(() => {
    let interval;
    if (batchId && batchStatus?.status !== 'completed' && batchStatus?.status !== 'failed') {
      interval = setInterval(() => {
        getBulkMessageBatchStatus(batchId).then(res => {
          setBatchStatus(res);
          if (res.status === 'completed' || res.status === 'failed') {
            clearInterval(interval);
          }
        }).catch(err => {
          setProgressError('Failed to fetch progress');
        });
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [batchId, batchStatus]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (currentFilter === 'closed_lost' && !understandRisk) {
      alert("Please confirm that you understand the risk of messaging closed lost leads.");
      return;
    }
    setConfirming(true);
    setProgressError('');
    try {
      const res = await sendBulkMessage(currentFilter, selectedTemplate);
      setBatchId(res.batchId);
      setSubmitResult(res);
      setBatchStatus({
        status: res.status,
        total: res.totalMatched,
        sent_count: 0,
        failed_count: 0,
        excluded_count: res.excluded
      });
    } catch (err) {
      setProgressError(err.response?.data?.message || err.message || 'Failed to send bulk message');
    } finally {
      setConfirming(false);
    }
  };

  const activeTemplate = templates.find(t => t.name === selectedTemplate);

  const renderProgress = () => {
    if (!batchStatus) return null;
    const { total, sent_count, failed_count, excluded_count, status } = batchStatus;
    const processed = sent_count + failed_count + (submitResult?.excluded || excluded_count || 0);
    const target = submitResult?.totalMatched || total;
    const pct = target > 0 ? Math.round((processed / target) * 100) : 100;

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-800">Sending Bulk Messages</h3>
        
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">Total Leads Found:</span>
            <span className="font-bold">{submitResult?.totalMatched || target}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Excluded (24h limit, missing phone, etc.):</span>
            <span className="font-bold text-amber-600">{submitResult?.excluded || excluded_count}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Successfully Sent:</span>
            <span className="font-bold text-green-600">{sent_count}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Failed:</span>
            <span className="font-bold text-red-600">{failed_count}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold text-gray-500">
            <span>{status === 'completed' ? 'Done' : 'Processing...'}</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className={`h-2.5 rounded-full transition-all duration-500 ${status === 'completed' ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${pct}%` }}></div>
          </div>
        </div>

        {status === 'completed' && (
          <button onClick={onClose} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold mt-4">Close</button>
        )}
      </div>
    );
  };

  return (
    <Modal onClose={() => { if (batchStatus?.status === 'completed' || !batchId) onClose(); }} hideHeader>
      <div className="p-6 max-w-md w-full mx-auto">
        
        {!batchId ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Bulk WhatsApp Message</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">×</button>
            </div>

            <div className="bg-blue-50 text-blue-800 p-4 rounded-xl mb-6 text-sm">
              You are about to send a message to all leads in the <strong className="uppercase">{currentFilter.replace('_', ' ')}</strong> section.
              <br/>Estimated Total: <strong className="text-lg">{totalCount || items.length}</strong>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select Template</label>
                <select
                  value={selectedTemplate}
                  onChange={e => setSelectedTemplate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:ring-2 focus:ring-green-400 focus:outline-none transition mb-2"
                >
                  <option value="">-- Choose a WhatsApp Template --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.name}>{t.display || t.name} ({t.language})</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400">
                  The template for the current section is auto-selected.
                </p>
              </div>

              {activeTemplate && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative mt-3">
                  <div className="absolute top-0 right-0 px-2 py-1 bg-green-100 text-green-800 text-[10px] font-bold rounded-bl-xl rounded-tr-xl">PREVIEW</div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap mt-2 font-mono">
                    {activeTemplate.components?.find(c => c.type === 'BODY')?.text || 'No preview available'}
                  </p>
                  <div className="mt-2 text-xs text-gray-400 italic">
                    Variables like {"{{1}}"} will be replaced by Lead Name, Agent Name, etc.
                  </div>
                </div>
              )}

              {currentFilter === 'closed_lost' && (
                <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 flex gap-3 items-start mt-4">
                  <input 
                    type="checkbox" 
                    id="risk-confirm" 
                    checked={understandRisk} 
                    onChange={e => setUnderstandRisk(e.target.checked)}
                    className="mt-1"
                  />
                  <label htmlFor="risk-confirm" className="text-sm text-rose-800 cursor-pointer">
                    <strong>Warning:</strong> These leads have been marked as Not Interested (Closed Lost). Messaging them may result in reports/spam blocks on Interakt. I understand the risk.
                  </label>
                </div>
              )}
            </div>

            {progressError && (
              <div className="text-red-500 text-sm mb-4 font-medium p-3 bg-red-50 rounded-lg">{progressError}</div>
            )}

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition">
                Cancel
              </button>
              <button 
                onClick={handleSend} 
                disabled={!selectedTemplate || confirming || (currentFilter === 'closed_lost' && !understandRisk)}
                className="flex-1 py-3 text-sm font-bold text-white bg-green-500 rounded-xl hover:bg-green-600 transition disabled:opacity-50 shadow-md shadow-green-100"
              >
                {confirming ? 'Queuing...' : 'Send to All Now'}
              </button>
            </div>
          </>
        ) : (
          renderProgress()
        )}
      </div>
    </Modal>
  );
}
