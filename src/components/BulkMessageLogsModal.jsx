import { useState, useEffect } from 'react';
import Modal from './ui/Modal';
import { getBulkMessageLogs, retryBulkMessageBatch, getBulkMessageBatchDetails } from '../services/lead.service';

export default function BulkMessageLogsModal({ isOpen, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchDetails, setBatchDetails] = useState(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen]);

  const loadLogs = () => {
    setLoading(true);
    getBulkMessageLogs().then(res => {
      setLogs(res || []);
    }).catch(err => console.error(err)).finally(() => setLoading(false));
  };

  const loadDetails = (batchId) => {
    setBatchDetails(null);
    getBulkMessageBatchDetails(batchId).then(res => {
      setBatchDetails(res);
    }).catch(err => console.error(err));
  };

  const handleRetry = async (batchId) => {
    setRetrying(true);
    try {
      await retryBulkMessageBatch(batchId);
      loadDetails(batchId);
      loadLogs();
    } catch (err) {
      alert('Retry failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setRetrying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal onClose={onClose} hideHeader>
      <div className="p-6 w-full max-w-4xl mx-auto h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <h2 className="text-xl font-bold text-gray-800">Bulk Message Logs</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="flex gap-6 flex-1 min-h-0">
          {/* Logs List */}
          <div className="w-1/3 flex flex-col border border-gray-200 rounded-2xl overflow-hidden bg-white">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-widest shrink-0">Past Batches</div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="p-4 text-center text-sm text-gray-400">Loading...</div>
              ) : logs.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-400">No logs found.</div>
              ) : (
                logs.map(log => (
                  <div 
                    key={log._id} 
                    onClick={() => { setSelectedBatch(log._id); loadDetails(log._id); }}
                    className={`p-4 border-b border-gray-50 cursor-pointer transition-colors ${selectedBatch === log._id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-bold capitalize text-gray-800">{log.section.replace('_', ' ')}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        log.status === 'completed' ? 'bg-green-100 text-green-700' :
                        log.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>{log.status}</span>
                    </div>
                    <div className="text-xs text-gray-500 mb-2 truncate">Tpl: {log.template}</div>
                    <div className="flex gap-2 text-[10px] font-bold">
                      <span className="text-green-600">S: {log.sent_count}</span>
                      <span className="text-red-500">F: {log.failed_count}</span>
                      <span className="text-amber-500">E: {log.excluded_count}</span>
                      <span className="text-gray-400">T: {log.total}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-2">
                      {new Date(log.createdAt).toLocaleString()} • {log.sent_by?.name || 'Unknown User'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Details View */}
          <div className="flex-1 flex flex-col border border-gray-200 rounded-2xl overflow-hidden bg-white">
            {!selectedBatch ? (
              <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
                Select a batch from the left to view details
              </div>
            ) : !batchDetails ? (
              <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
                Loading details...
              </div>
            ) : (
              <>
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 shrink-0 flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">Batch Details</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Template: {batchDetails.batch.template}</p>
                  </div>
                  {batchDetails.batch.failed_count > 0 && (
                    <button 
                      onClick={() => handleRetry(batchDetails.batch._id)}
                      disabled={retrying}
                      className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition shadow-sm"
                    >
                      {retrying ? 'Retrying...' : `Retry ${batchDetails.batch.failed_count} Failed`}
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white sticky top-0 border-b border-gray-100 shadow-sm">
                      <tr>
                        <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lead Name</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Reason / Sent At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-sm">
                      {batchDetails.recipients.map(r => (
                        <tr key={r._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3 font-medium text-gray-800">{r.lead_id?.name || 'Unknown'}</td>
                          <td className="px-6 py-3 text-gray-500">{r.lead_id?.phone || 'N/A'}</td>
                          <td className="px-6 py-3">
                            <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-md ${
                              r.status === 'sent' || r.status === 'delivered' ? 'bg-green-50 text-green-600' :
                              r.status === 'failed' ? 'bg-red-50 text-red-600' :
                              'bg-amber-50 text-amber-600'
                            }`}>
                              {r.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-xs text-gray-500">
                            {r.error_reason ? (
                              <span className="text-red-500 truncate max-w-xs block" title={r.error_reason}>{r.error_reason}</span>
                            ) : r.sent_at ? (
                              new Date(r.sent_at).toLocaleString()
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
