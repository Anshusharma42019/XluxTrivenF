import { useState } from 'react';

const GST_PRESETS = [
  { value: '0', label: 'Exempt (0%)' },
  { value: '5', label: '5%' },
  { value: '12', label: '12% (Ayurvedic Medicine)' },
  { value: '18', label: '18%' },
  { value: '28', label: '28%' },
  { value: 'custom', label: 'Custom...' },
];

export default function CsvExportModal({ isOpen, onClose, onExport, totalOrders }) {
  const [doctorFee, setDoctorFee] = useState(0);
  const [gstSelect, setGstSelect] = useState('12');
  const [customGst, setCustomGst] = useState('');
  const [exporting, setExporting] = useState(false);

  if (!isOpen) return null;

  const effectiveGstRate = gstSelect === 'custom' ? Number(customGst) || 0 : Number(gstSelect);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setExporting(true);
    try {
      await onExport({ doctorFee: Number(doctorFee) || 0, gstRate: effectiveGstRate });
      onClose();
    } catch (err) {
      console.error('[CsvExportModal] Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && !exporting && onClose()}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-950 p-6 text-white relative">
          <button
            onClick={onClose}
            disabled={exporting}
            className="absolute right-5 top-5 w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 font-bold transition disabled:opacity-50"
          >
            ✕
          </button>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold mb-2">
            📊 Detailed GST Invoice Export
          </div>
          <h3 className="text-xl font-extrabold tracking-tight">Export CSV Settings</h3>
          <p className="text-emerald-200/80 text-xs mt-1">
            Choose GST % and Doctor Consultation Fee before generating your CSV export for {totalOrders} delivered shipment(s).
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Doctor Consultation Fee */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              🩺 Doctor Consultation Fee (Per Invoice)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-bold text-base">₹</span>
              <input
                type="number"
                min="0"
                value={doctorFee}
                onChange={(e) => setDoctorFee(Math.max(0, Number(e.target.value) || 0))}
                placeholder="0"
                className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 bg-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              If set &gt; ₹0, adds a Doctor Consultation row and deducts the fee from medicine totals proportionally.
            </p>
          </div>

          {/* Medicine GST Rate */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              📦 Medicine GST Rate (%)
            </label>
            <div className="flex items-center gap-2">
              <select
                value={gstSelect}
                onChange={(e) => setGstSelect(e.target.value)}
                className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 bg-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                {GST_PRESETS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {gstSelect === 'custom' && (
                <div className="flex items-center gap-1.5 flex-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={customGst}
                    onChange={(e) => setCustomGst(e.target.value)}
                    placeholder="Enter GST %"
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 bg-white focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-xs font-bold text-gray-500">%</span>
                </div>
              )}
            </div>
          </div>

          {/* Included Columns Notice */}
          <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-100 text-[11.5px] text-teal-900 leading-relaxed space-y-1">
            <div className="font-bold flex items-center gap-1 text-teal-950">
              <span>📋 Included CSV Columns:</span>
            </div>
            <p className="text-teal-800">
              Bill Number, Sl No, Description, SAC/HSN Code, <strong>Doctor Fee (Rs)</strong>, <strong>Medicine Taxable Value (Rs)</strong>, GST Rate (%), CGST, SGST/UTGST, IGST, <strong>Medicine Charge (Rs)</strong>, GST Amount, Total Amount, <strong>Delivered Date</strong>.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={exporting}
              className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={exporting}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <svg className={`w-4 h-4 ${exporting ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {exporting ? 'Generating CSV...' : '📥 Generate & Download CSV'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
