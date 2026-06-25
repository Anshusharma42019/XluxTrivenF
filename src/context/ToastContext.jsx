import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.map(t => t.id === id ? { ...t, removing: true } : t));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const toast = useCallback((message, type = 'info', title = '', action = null) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { id, message, type, title: title || type.charAt(0).toUpperCase() + type.slice(1), action };
    setToasts((prev) => [...prev, newToast]);
    
    if (type !== 'persistent') {
      const duration = type === 'success' || type === 'info' ? 10000 : 4000;
      setTimeout(() => remove(id), duration);
    }
    return id;
  }, [remove]);

  const success = (msg, title, action) => toast(msg, 'success', title, action);
  const error = (msg, title, action) => toast(msg, 'error', title, action);
  const info = (msg, title, action) => toast(msg, 'info', title, action);
  const warning = (msg, title, action) => toast(msg, 'warning', title, action);

  useEffect(() => {
    const handleApiError = (e) => {
      const { message, title } = e.detail;
      const isCheckIn = message.toLowerCase().includes('check in');
      const isTarget = message.toLowerCase().includes('target');
      
      let action = null;
      if (isCheckIn) {
        action = { label: 'Clock In Now', onClick: () => window.location.href = '/attendance' };
      } else if (isTarget) {
        action = { label: 'Set Target Now', onClick: () => window.location.href = '/' };
      }

      toast(
        message, 
        'error', 
        title,
        action
      );
    };
    window.addEventListener('api-error', handleApiError);
    return () => window.removeEventListener('api-error', handleApiError);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info, warning, remove }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={remove} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
}

function ToastContainer({ toasts, onRemove }) {
  // Only render if we are in a browser environment
  if (typeof document === 'undefined') return null;

  return ReactDOM.createPortal(
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type} ${t.removing ? 'removing' : ''}`}>
          <div className="toast-icon">
            {t.type === 'success' && <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>}
            {t.type === 'error' && <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>}
            {t.type === 'warning' && <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>}
            {t.type === 'info' && <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
          </div>
          <div className="toast-content">
            <p className="toast-title">{t.title}</p>
            <p className="toast-message">{t.message}</p>
            {t.action && (
              <button 
                onClick={(e) => { e.stopPropagation(); t.action.onClick(); onRemove(t.id); }}
                className="mt-2 px-3 py-1.5 bg-gray-900 text-white text-[10px] font-bold rounded-lg hover:bg-black transition-colors"
              >
                {t.action.label}
              </button>
            )}
          </div>
          <button onClick={() => onRemove(t.id)} className="toast-close">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}
