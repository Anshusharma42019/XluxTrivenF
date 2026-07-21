import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';

export default function UniversalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced Search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!query || query.trim().length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await API.get('/search', { params: { q: query } });
        setResults(res.data?.data || []);
        setIsOpen(true);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  const handleResultClick = (link) => {
    setIsOpen(false);
    navigate(link);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    
    if (isToday) {
      return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    const isYesterday = new Date(today.setDate(today.getDate() - 1)).getDate() === date.getDate();
    if (isYesterday) {
      return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    return `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="relative z-[100] w-full max-w-2xl" ref={containerRef}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <svg className={`h-5 w-5 ${loading ? 'animate-pulse text-green-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          className="block w-full pl-11 pr-10 py-2.5 bg-gray-100/80 border border-gray-200 dark:bg-gray-800/80 dark:border-gray-700 rounded-full text-sm placeholder-gray-500 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white dark:focus:bg-gray-800 transition-all shadow-inner"
          placeholder="Search phone, name, lead ID, order ID, or AWB..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen && e.target.value.trim().length >= 2) setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim().length >= 2) setIsOpen(true);
          }}
        />
        {/* Loading Spinner */}
        {loading && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
             <div className="h-4 w-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        {/* Clear Button */}
        {!loading && query && (
           <button 
             onClick={() => { setQuery(''); setResults([]); setIsOpen(false); }}
             className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
           >
             <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
             </svg>
           </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden max-h-[80vh] overflow-y-auto ring-1 ring-black/5">
          {results.length === 0 && !loading ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 mb-3">
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
              </div>
              <p className="text-base font-medium">No customers found</p>
              <p className="text-xs mt-1">Try a different phone number or ID</p>
            </div>
          ) : (
            <div className="p-2 space-y-3">
              {results.map((customerGroup, idx) => {
                const kitNum = customerGroup.latestStatus.kit_number || 1;

                return (
                <div key={idx} className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-3 border border-gray-100 dark:border-gray-800 transition-all hover:border-green-200 dark:hover:border-green-900/50">
                  {/* LATEST STATUS BLOCK */}
                  <div 
                    onClick={() => handleResultClick(customerGroup.latestStatus.link)}
                    className="group relative bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-green-200 dark:border-green-900/60 cursor-pointer hover:shadow-md hover:border-green-400 dark:hover:border-green-500 transition-all"
                  >
                    <div className="absolute -top-2.5 -left-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                       <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                       LATEST STATUS
                    </div>
                    
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg font-bold text-gray-900 dark:text-white capitalize truncate">{customerGroup.customerName}</span>
                          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-md font-mono shrink-0">{customerGroup.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-2">
                           <span className="w-20 font-medium text-gray-500 text-[11px] uppercase shrink-0">Found In:</span> 
                           <span className="font-semibold text-gray-800 dark:text-gray-200">{customerGroup.latestStatus.module}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
                           <span className="w-20 font-medium text-gray-500 text-[11px] uppercase shrink-0">Status:</span> 
                           <div className="flex items-center gap-2">
                             <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 capitalize border border-green-200 dark:border-green-800/50">
                               {customerGroup.latestStatus.status.replace(/_/g, ' ')}
                             </span>
                             {kitNum >= 1 && ['order', 'shipmaxx'].includes(customerGroup.latestStatus.type) && customerGroup.latestStatus.status?.toUpperCase() === 'DELIVERED' && (
                               <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 uppercase tracking-wide">
                                 Kit {kitNum} {customerGroup.latestStatus.courier_name && `- ${customerGroup.latestStatus.courier_name}`}
                               </span>
                             )}
                           </div>
                        </div>
                      </div>
                      
                      <div className="text-sm">
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                           <span className="w-20 font-medium text-gray-500 text-[11px] uppercase shrink-0">Added:</span> 
                           <span className="text-xs font-medium">{formatDate(customerGroup.latestStatus.createdAt || customerGroup.latestStatus.updatedAt)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mt-1">
                           <span className="w-20 font-medium text-gray-500 text-[11px] uppercase shrink-0">Updated:</span> 
                           <span className="text-xs font-medium">{formatDate(customerGroup.latestStatus.updatedAt)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mt-1">
                           <span className="w-20 font-medium text-gray-500 text-[11px] uppercase shrink-0">Assigned:</span> 
                           <span className="text-xs">{customerGroup.latestStatus.assignedTo || 'Unassigned'}</span>
                        </div>
                        {customerGroup.latestStatus.department && (
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mt-1">
                             <span className="w-20 font-medium text-gray-500 text-[11px] uppercase shrink-0">Dept:</span> 
                             <span className="text-xs capitalize">{customerGroup.latestStatus.department}</span>
                          </div>
                        )}
                        {customerGroup.latestStatus.problem && (
                          <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400 mt-1">
                             <span className="w-20 font-medium text-gray-500 text-[11px] uppercase mt-0.5 shrink-0">Problem:</span> 
                             <span className="text-xs leading-tight">{customerGroup.latestStatus.problem}</span>
                          </div>
                        )}
                        {(customerGroup.latestStatus.address || customerGroup.latestStatus.city) && (
                          <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400 mt-1">
                             <span className="w-20 font-medium text-gray-500 text-[11px] uppercase mt-0.5 shrink-0">Location:</span> 
                             <span className="text-xs leading-tight">
                               {[customerGroup.latestStatus.address, customerGroup.latestStatus.city, customerGroup.latestStatus.state, customerGroup.latestStatus.pincode].filter(Boolean).join(', ')}
                             </span>
                          </div>
                        )}
                        {customerGroup.latestStatus.awb_code && (
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mt-1">
                             <span className="w-20 font-medium text-gray-500 text-[11px] uppercase shrink-0">AWB:</span> 
                             <span className="text-[11px] font-mono font-bold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-300">{customerGroup.latestStatus.awb_code}</span>
                             {customerGroup.latestStatus.courier_name && <span className="text-[10px] text-gray-400 ml-1">({customerGroup.latestStatus.courier_name})</span>}
                          </div>
                        )}
                        {customerGroup.latestStatus.sub_total > 0 && (
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mt-1">
                             <span className="w-20 font-medium text-gray-500 text-[11px] uppercase shrink-0">Amount:</span> 
                             <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                               ₹{customerGroup.latestStatus.sub_total} 
                               {customerGroup.latestStatus.payment_method && <span className="text-[10px] ml-1 font-normal text-gray-500 uppercase">({customerGroup.latestStatus.payment_method})</span>}
                             </span>
                          </div>
                        )}
                        {customerGroup.latestStatus.note && (
                          <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400 mt-2 bg-gray-50 dark:bg-gray-900/50 p-2 rounded-md border border-gray-100 dark:border-gray-700">
                             <span className="font-medium text-gray-500 text-[10px] uppercase mt-0.5 shrink-0">Note:</span> 
                             <span className="text-[11px] line-clamp-2 italic leading-tight">"{customerGroup.latestStatus.note}"</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <div className="w-8 h-8 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                       </div>
                    </div>
                  </div>

                  {/* STATUS HISTORY */}
                  {customerGroup.history.length > 1 && (
                    <div className="mt-4 px-2 mb-1">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                         Status History
                         <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
                      </div>
                      <div className="space-y-1 pl-3 border-l-2 border-gray-200 dark:border-gray-700 ml-1">
                        {customerGroup.history.slice(1).map((hist, hIdx) => (
                          <div 
                            key={hIdx} 
                            onClick={() => handleResultClick(hist.link)}
                            className="relative flex items-center justify-between p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer group text-sm transition-colors"
                          >
                            <div className="absolute -left-[19px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-white dark:border-gray-800 group-hover:bg-green-400 group-hover:border-green-100"></div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 flex-1 ml-2">
                              <span className="font-medium text-gray-700 dark:text-gray-300 capitalize text-xs">{hist.status.replace(/_/g, ' ')}</span>
                              <span className="text-[10px] font-semibold text-gray-500 bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">{hist.module}</span>
                              {['order', 'shipmaxx'].includes(hist.type) && hist.kit_number >= 1 && hist.status?.toUpperCase() === 'DELIVERED' ? (
                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800/50 uppercase tracking-wide">
                                  Kit {hist.kit_number} {hist.courier_name && `- ${hist.courier_name}`}
                                </span>
                              ) : hist.courier_name ? (
                                <span className="text-[10px] text-gray-400 font-medium">({hist.courier_name})</span>
                              ) : null}
                            </div>
                            <div className="text-[11px] text-gray-500 whitespace-nowrap">
                              {formatDate(hist.updatedAt)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
