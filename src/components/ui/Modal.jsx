export default function Modal({ title, onClose, children, hideHeader, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full sm:max-w-2xl overflow-hidden flex flex-col"
        style={{ border: '1px solid rgba(0,0,0,0.06)', maxHeight: '90dvh' }}>
        {!hideHeader && (
          <div className="relative flex items-center justify-center px-6 py-4 border-b border-gray-100 shrink-0">
            <h3 className="text-base font-bold text-gray-800 tracking-tight">{title}</h3>
            <button onClick={onClose}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition text-xl leading-none">
              ×
            </button>
          </div>
        )}
        <div className="px-4 sm:px-6 py-4 overflow-y-auto modal-scroll-container flex-1">{children}</div>
        {footer && (
          <div className="px-4 sm:px-6 pb-5 pt-3 border-t border-gray-100 shrink-0 bg-white">{footer}</div>
        )}
      </div>
    </div>
  );
}

//next
