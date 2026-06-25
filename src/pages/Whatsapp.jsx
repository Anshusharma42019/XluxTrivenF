import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getLeads, getLead, sendLeadWhatsApp } from '../services/lead.service';
import { useAuth } from '../context/AuthContext';

// mock function since we haven't imported the shared one
const initials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
};

const PIN_COLORS = [
  'bg-emerald-500', 'bg-blue-500', 'bg-indigo-500', 
  'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500',
  'bg-pink-500', 'bg-rose-500', 'bg-orange-500',
  'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'
];

const SectionHead = ({ label }) => (
  <h4 className="text-[10px] uppercase tracking-wider font-extrabold text-[#8696a0] mt-5 mb-2 px-1">{label}</h4>
);

const DetailRow = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between py-2 px-1 border-b border-[#e9edef] hover:bg-[#e9edef]/50 transition-colors rounded-lg">
      <span className="text-xs font-medium text-[#8696a0] shrink-0">{label}</span>
      <span className="text-sm font-bold text-right ml-4 break-words text-[#111b21]">
        {value}
      </span>
    </div>
  );
};

export default function Whatsapp({ onClose, initialLeadId }) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  
  const [chatLeads, setChatLeads] = useState([]);
  const [chatLeadSearch, setChatLeadSearch] = useState('');
  const [selectedChatLead, setSelectedChatLead] = useState(null);
  const [chatLeadsLoading, setChatLeadsLoading] = useState(false);
  const [chatNotes, setChatNotes] = useState([]);
  
  const chatEndRef = useRef(null);
  const [chatMsg, setChatMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const loadChatLeads = useCallback(async (silent = false) => {
    if (!silent) setChatLeadsLoading(true);
    try {
      const res = await getLeads({ page: 1, limit: 1500, search: chatLeadSearch, whatsappOnly: true });
      setChatLeads(res?.leads || []);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setChatLeadsLoading(false);
    }
  }, [chatLeadSearch]);

  const loadActiveChat = useCallback(async () => {
    if (!selectedChatLead) return;
    try {
      const full = await getLead(selectedChatLead._id);
      setChatNotes(full.notes || []);
    } catch (err) {
      console.error(err);
    }
  }, [selectedChatLead]);

  useEffect(() => { loadChatLeads(); }, [loadChatLeads]);

  useEffect(() => {
    const leadId = initialLeadId || searchParams.get('leadId');
    if (leadId && !selectedChatLead) {
      getLead(leadId).then(full => {
        setSelectedChatLead(full);
      }).catch(console.error);
    }
  }, [searchParams, selectedChatLead]);

  useEffect(() => {
    if (selectedChatLead) {
      loadActiveChat();
    }
  }, [selectedChatLead, loadActiveChat]);

  // Polling for new chats and messages every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadChatLeads(true);
      if (selectedChatLead) loadActiveChat();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadChatLeads, loadActiveChat, selectedChatLead]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatNotes]);

  // Sidebar Icons (Mock)
  const SidebarIcons = () => (
    <div className="hidden md:flex w-[60px] bg-[#202c33] flex-col items-center py-4 justify-between h-full shrink-0">
      <div className="flex flex-col gap-6 w-full items-center">
        <button className="text-white/60 hover:text-white transition-colors relative group w-full flex justify-center">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7"><path d="M12 2C6.477 2 2 6.14 2 11.25c0 2.016.732 3.882 1.996 5.385-.297 1.543-1.077 3.013-1.127 3.107-.107.195-.083.432.062.602.144.168.369.227.57.147 1.77-.698 3.208-1.503 4.103-2.14.93.25 1.916.386 2.946.386 5.523 0 10-4.14 10-9.25S17.523 2 12 2zm0 16c-1.012 0-1.98-.147-2.887-.419-.24-.07-.5-.041-.715.086-.714.42-1.748.977-3.037 1.488.423-.837.76-1.714.982-2.585.067-.26-.008-.535-.195-.733-1.096-1.157-1.758-2.698-1.758-4.387 0-4.225 3.86-7.65 8.61-7.65s8.61 3.425 8.61 7.65-3.86 7.65-8.61 7.65z"/><path d="M8 10.5h8v1.5H8zm0 3h5v1.5H8z"/></svg>
        </button>
        {onClose && (
          <button onClick={onClose} className="text-red-400 hover:text-red-300 transition-colors bg-white/5 p-2 rounded-xl mt-2" title="Close WhatsApp">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
          </button>
        )}
      </div>
      <div className="flex flex-col gap-6 w-full items-center">
        <button className="text-white/60 hover:text-white transition-colors">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M19.1 12.9c.1-.3.1-.6.1-.9s0-.6-.1-.9l2.1-1.6c.2-.1.2-.4.1-.6l-2-3.5c-.1-.2-.4-.3-.6-.2l-2.5 1c-.5-.4-1.1-.7-1.7-1l-.4-2.6c0-.2-.2-.4-.5-.4h-4c-.2 0-.4.2-.5.4l-.4 2.6c-.6.3-1.2.6-1.7 1l-2.5-1c-.2-.1-.5 0-.6.2l-2 3.5c-.1.2-.1.5.1.6l2.1 1.6c-.1.3-.1.6-.1.9s0 .6.1.9l-2.1 1.6c-.2.1-.2.4-.1.6l2 3.5c.1.2.4.3.6.2l2.5-1c.5.4 1.1.7 1.7 1l.4 2.6c0 .2.2.4.5.4h4c.2 0 .4-.2.5-.4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1c.2.1.5 0 .6-.2l2-3.5c.1-.2.1-.5-.1-.6l-2.1-1.6zM12 15.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/></svg>
        </button>
        <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-white text-xs font-bold overflow-hidden mb-2">
          {user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover"/> : initials(user?.name)}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex w-full h-[100dvh] bg-[#f0f2f5] overflow-hidden fixed inset-0 z-50">
      <SidebarIcons />

      {/* Contact List */}
      <div className={`${selectedChatLead ? 'hidden lg:flex' : 'flex'} w-full lg:w-[400px] xl:w-[450px] flex-col bg-white border-r border-gray-200 shrink-0 h-full`}>
        <div className="px-5 py-4 bg-[#f0f2f5] flex items-center justify-between shrink-0 h-[60px]">
          <div className="flex items-center gap-3">
            {onClose && (
              <button onClick={onClose} className="md:hidden p-1 -ml-2 text-[#54656f] hover:text-[#111b21] transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
            )}
            <h1 className="text-[#111b21] font-bold text-xl">Chats</h1>
          </div>
          <div className="flex gap-4 text-[#54656f]">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M19.005 3.175H4.674C3.642 3.175 3 3.789 3 4.821V21.02l3.544-3.514h12.461c1.033 0 2.064-1.06 2.064-2.093V4.821c-.001-1.032-1.032-1.646-2.064-1.646zm-4.989 9.869H7.041V11.1h6.975v1.944zm3-4H7.041V7.1h9.975v1.944z"/></svg>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 15z"/></svg>
          </div>
        </div>
        
        <div className="px-3 py-2 bg-white shrink-0 border-b border-gray-100">
          <div className="bg-[#f0f2f5] rounded-lg flex items-center px-4 h-9">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#54656f] mr-3"><path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 0 0 1.256-3.386 5.207 5.207 0 1 0-5.207 5.208 5.183 5.183 0 0 0 3.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.007zm-4.808 0a3.605 3.605 0 1 1 0-7.21 3.605 3.605 0 0 1 0 7.21z"/></svg>
            <input 
              type="text" 
              placeholder="Search or start a new chat" 
              className="bg-transparent border-none outline-none text-sm w-full text-[#111b21] placeholder:text-[#54656f]"
              value={chatLeadSearch}
              onChange={e => setChatLeadSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
          {chatLeadsLoading ? (
            <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-[#00a884] border-t-transparent rounded-full animate-spin" /></div>
          ) : chatLeads.length === 0 ? (
            <p className="text-center text-[#54656f] text-sm py-10">No chats found</p>
          ) : (
            <div className="flex flex-col">
              {chatLeads.map((lead, i) => {
                const color = PIN_COLORS[i % PIN_COLORS.length];
                const isActive = selectedChatLead?._id === lead._id;
                const lastMessage = lead.problem || 'Tap to start conversation';
                const time = new Date(lead.updatedAt || lead.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
                
                return (
                  <div key={lead._id} onClick={() => setSelectedChatLead(lead)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-gray-50 last:border-0
                      ${isActive ? 'bg-[#f0f2f5]' : 'bg-white hover:bg-[#f5f6f6]'}`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0 ${color}`}>
                      {initials(lead.name)}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-2 truncate">
                          <p className={`text-[16px] ${isActive ? 'font-bold' : 'font-medium'} text-[#111b21] truncate`}>{lead.name || 'Unknown'}</p>
                          {lead.phone && <p className="text-[12px] font-bold text-[#667781] shrink-0">{lead.phone}</p>}
                        </div>
                        <span className={`text-[11px] ${isActive ? 'text-[#111b21] font-bold' : 'text-[#667781] font-medium'} shrink-0 ml-2`}>{time}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] text-[#667781] truncate leading-snug flex-1 mr-2">
                          <span className="text-[#53bdeb] mr-1 text-[11px]">✓✓</span>
                          {lastMessage}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      {selectedChatLead ? (
        <>
        <div className="flex flex-col flex-1 bg-[#efeae2] h-full relative overflow-hidden">
          {/* Background image overlay */}
          <div className="absolute inset-0 opacity-[0.4] pointer-events-none" style={{ backgroundImage: 'url("https://w0.peakpx.com/wallpaper/818/148/HD-wallpaper-whatsapp-background-cool-dark-green-light-pattern-patterns-wpp-thumbnail.jpg")', backgroundSize: '400px' }}></div>
          
          <div className="px-5 py-2.5 flex items-center justify-between shrink-0 bg-[#f0f2f5] z-10 h-[60px] border-l border-[#d1d7db]">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedChatLead(null)} className="lg:hidden -ml-2 p-2 text-[#54656f]">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold bg-[#00a884]`}>
                {initials(selectedChatLead.name)}
              </div>
              <div>
                <h2 className="font-medium text-[#111b21] text-[16px] leading-tight">{selectedChatLead.name}</h2>
                <p className="text-[#667781] text-[13px]">{selectedChatLead.phone}</p>
              </div>
            </div>
            <div className="flex gap-4 text-[#54656f]">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M15.9 14.3H15l-.3-.3c1-1.1 1.6-2.7 1.6-4.3 0-3.7-3-6.7-6.7-6.7S3 6 3 9.7s3 6.7 6.7 6.7c1.6 0 3.2-.6 4.3-1.6l.3.3v.8l5.1 5.1 1.5-1.5-5-5zm-6.2 0c-2.6 0-4.6-2.1-4.6-4.6s2.1-4.6 4.6-4.6 4.6 2.1 4.6 4.6-2 4.6-4.6 4.6z"/></svg>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 15z"/></svg>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-16 py-4 custom-scrollbar z-10 flex flex-col gap-1">
            <div className="flex justify-center mb-4">
              <span className="bg-white/90 text-[#54656f] text-xs px-3 py-1.5 rounded-lg shadow-sm font-medium">Today</span>
            </div>
            {chatNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="bg-[#ffeecd] text-[#54656f] text-[12.5px] px-4 py-2 rounded-xl shadow-sm text-center max-w-sm font-medium">
                  <svg className="w-4 h-4 inline-block mr-1.5 mb-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.969-1.406A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18c-1.637 0-3.18-.415-4.523-1.15l-.324-.19-3.216.91.928-3.12-.208-.33A7.95 7.95 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"/></svg>
                  Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.
                </div>
              </div>
            ) : (
              (() => {
                const displayNotes = [...chatNotes];
                if (selectedChatLead.problem && !displayNotes.some(n => n.text === selectedChatLead.problem)) {
                  displayNotes.push({
                    text: selectedChatLead.problem,
                    direction: 'inbound',
                    createdAt: selectedChatLead.createdAt,
                    isSyntheticProblem: true
                  });
                }
                displayNotes.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

                return displayNotes.map((note, i) => {
                  const isOutbound = note.direction === 'outbound';
                  const isInterakt = (!isOutbound && note.text?.includes('[Interakt Message]')) || note.isSyntheticProblem;
                  const displayText = note.text?.replace(/^\[Interakt Message\]\s*/, '') || note.text || '';
                  const time = note.createdAt ? new Date(note.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
                  
                  return (
                    <div key={note._id || i} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-1`}>
                      <div className={`max-w-[75%] rounded-lg px-2.5 py-1.5 shadow-sm relative text-[14.5px] leading-relaxed
                        ${isOutbound ? 'bg-[#d9fdd3] rounded-tr-none text-[#111b21]' : 'bg-white rounded-tl-none text-[#111b21]'}`}>
                        
                        {isInterakt && !isOutbound && (
                          <div className="flex items-center gap-1.5 mb-1 opacity-80">
                            <span className="text-[11px] font-bold text-emerald-600">~ WhatsApp Lead</span>
                          </div>
                        )}
                        
                        <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                          <p className="whitespace-pre-wrap break-words">{displayText}</p>
                          <div className="flex items-center gap-1 ml-auto shrink-0 mt-1 opacity-70">
                            <span className="text-[10px] text-[#667781] font-medium">{time}</span>
                            {isOutbound && (
                              <svg className="w-4 h-4 text-[#53bdeb]" viewBox="0 0 16 11" fill="currentColor">
                                <path d="M11.071.653a.75.75 0 0 1 .025 1.06l-6.5 7a.75.75 0 0 1-1.086 0l-3-3.228a.75.75 0 1 1 1.086-1.034l2.457 2.643L10.01.678a.75.75 0 0 1 1.06-.025z"/>
                                <path d="M14.571.653a.75.75 0 0 1 .025 1.06l-6.5 7a.75.75 0 0 1-1.086 0 .75.75 0 0 1 0-1.034l6-6.5a.75.75 0 0 1 1.061-.026l.5.5z" opacity=".8"/>
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()
            )}
            <div ref={chatEndRef} className="h-4" />
          </div>

          <div className="shrink-0 px-4 py-3 bg-[#f0f2f5] relative z-10 border-t border-[#d1d7db]">
            <div className="flex items-end gap-3">
              <button className="p-2 text-[#54656f] hover:text-[#111b21]">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 15z"/></svg>
              </button>
              <button className="p-2 text-[#54656f] hover:text-[#111b21]">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M1.816 15.556v.002c0 1.502.584 2.912 1.646 3.972s2.472 1.647 3.974 1.647a5.58 5.58 0 0 0 3.972-1.645l9.547-9.548c.769-.768 1.147-1.767 1.058-2.817-.079-.968-.548-1.927-1.319-2.698-1.594-1.592-4.068-1.711-5.517-.262l-7.916 7.915c-.881.881-.792 2.25.214 3.261.959.958 2.423 1.053 3.263.215l5.511-5.512c.28-.28.267-.722.053-.936l-.244-.244c-.191-.191-.567-.349-.957.04l-5.506 5.506c-.18.18-.635.127-.976-.214-.098-.097-.576-.613-.213-.973l7.915-7.917c.818-.817 2.267-.699 3.23.262.5.501.802 1.1.849 1.685.051.573-.156 1.077-.546 1.465l-9.541 9.541c-.832.833-1.969 1.288-3.14 1.286-1.17-.002-2.31-.453-3.142-1.284s-1.282-1.973-1.284-3.143c-.002-1.171.453-2.311 1.286-3.141l7.17-7.17c.28-.28.267-.722.053-.936l-.244-.244c-.191-.191-.567-.349-.957.04l-7.17 7.17c-1.063 1.06-1.647 2.47-1.647 3.972z"/></svg>
              </button>
              <div className="flex-1 bg-white rounded-lg flex items-end relative h-10 px-3 border border-gray-100">
                <input 
                  type="text" 
                  placeholder="Type a message" 
                  value={chatMsg}
                  onChange={e => setChatMsg(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (!chatMsg.trim() || sending) return;
                      setSending(true); setSendError('');
                      const msgToSend = chatMsg;
                      setChatNotes(prev => [...prev, { text: msgToSend, direction: 'outbound', createdAt: new Date().toISOString() }]);
                      setChatMsg('');
                      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                      try {
                        await sendLeadWhatsApp(selectedChatLead._id, msgToSend);
                      } catch (err) {
                        console.error(err);
                        setSendError('Failed to send message');
                      } finally { setSending(false); }
                    }
                  }}
                  className="w-full h-full bg-transparent border-none outline-none text-[15px] text-[#111b21] placeholder-[#8696a0]"
                />
              </div>
              {chatMsg.trim() ? (
                <button 
                  disabled={sending}
                  onClick={async () => {
                    if (!chatMsg.trim() || sending) return;
                    setSending(true); setSendError('');
                    const msgToSend = chatMsg;
                    setChatNotes(prev => [...prev, { text: msgToSend, direction: 'outbound', createdAt: new Date().toISOString() }]);
                    setChatMsg('');
                    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                    try {
                      await sendLeadWhatsApp(selectedChatLead._id, msgToSend);
                    } catch (err) {
                      console.error(err);
                      setSendError('Failed to send message');
                    } finally { setSending(false); }
                  }}
                  className={`p-2 transition-colors ${sending ? 'text-gray-300' : 'text-[#54656f] hover:text-[#111b21]'}`}>
                  {sending ? (
                    <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"/></svg>
                  )}
                </button>
              ) : (
                <button className="p-2 text-[#54656f] hover:text-[#111b21]">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M11.999 14.942c2.001 0 3.531-1.53 3.531-3.531V4.35c0-2.001-1.53-3.531-3.531-3.531S8.469 2.35 8.469 4.35v7.061c0 2.001 1.53 3.531 3.53 3.531zm6.238-3.53c0 3.531-2.942 6.002-6.237 6.002s-6.237-2.471-6.237-6.002H3.761c0 4.001 3.178 7.297 7.061 7.885v3.884h2.354v-3.884c3.884-.588 7.061-3.884 7.061-7.885h-2.002z"/></svg>
                </button>
              )}
            </div>
            {sendError && <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs px-3 py-1 rounded shadow">{sendError}</div>}
          </div>
        </div>

        {/* ── RIGHT DETAILS PANE ── */}
        <div className="hidden xl:flex flex-col w-[320px] bg-white border-l border-[#d1d7db] shrink-0 h-full overflow-y-auto custom-scrollbar">
          <div className="flex flex-col items-center justify-center py-8 bg-[#f0f2f5] border-b border-[#d1d7db]">
            <div className="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg mb-4">
              {initials(selectedChatLead.name || selectedChatLead.phone || '?')}
            </div>
            <h2 className="text-xl font-bold text-[#111b21]">{selectedChatLead.name || 'Unknown'}</h2>
            <p className="text-[#54656f] text-sm font-medium mt-1">{selectedChatLead.phone}</p>
          </div>
          
          <div className="px-5 py-4 pb-10">
            <SectionHead label="Contact & Lead" />
            <div className="grid grid-cols-1 gap-1">
              <DetailRow label="Name" value={selectedChatLead.name} />
              <DetailRow label="Phone" value={selectedChatLead.phone} />
              <DetailRow label="Created On" value={new Date(selectedChatLead.createdAt).toLocaleDateString()} />
            </div>

            <SectionHead label="Problem & Details" />
            <div className="grid grid-cols-1 gap-1">
              <DetailRow label="Problem" value={selectedChatLead.problem} />
              <DetailRow label="Vitals" value={selectedChatLead.age || selectedChatLead.weight || selectedChatLead.height ? `${selectedChatLead.age ? selectedChatLead.age+'y ' : ''}${selectedChatLead.weight ? selectedChatLead.weight+'kg ' : ''}${selectedChatLead.height ? selectedChatLead.height+'ft' : ''}` : null} />
              <DetailRow label="Other Problems" value={selectedChatLead.otherProblems} />
              <DetailRow label="Price" value={selectedChatLead.price ? `₹${selectedChatLead.price}` : null} />
              <DetailRow label="Description" value={selectedChatLead.description} />
            </div>

            <SectionHead label="Address" />
            <div className="grid grid-cols-1 gap-1">
              <DetailRow label="House No" value={selectedChatLead.houseNo} />
              <DetailRow label="City/Village" value={selectedChatLead.cityVillage} />
              <DetailRow label="District" value={selectedChatLead.district} />
              <DetailRow label="Pincode" value={selectedChatLead.pincode} />
            </div>
          </div>
        </div>
        </>
      ) : (
        <div className="flex-1 hidden lg:flex flex-col items-center justify-center bg-[#222e35] relative overflow-hidden h-full">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("https://w0.peakpx.com/wallpaper/818/148/HD-wallpaper-whatsapp-background-cool-dark-green-light-pattern-patterns-wpp-thumbnail.jpg")', backgroundSize: 'cover', mixBlendMode: 'overlay' }}></div>
          <div className="text-center z-10 max-w-sm">
            <div className="w-24 h-24 mx-auto mb-8 opacity-20 text-white flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.558 4.12 1.532 5.845L.057 23.941l6.26-1.643A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.034-1.383l-.36-.214-3.732.979.998-3.642-.235-.374A9.818 9.818 0 1 1 12 21.818z"/></svg>
            </div>
            <h2 className="text-3xl font-light text-[#e9edef] mb-4">WhatsApp for Windows</h2>
            <p className="text-[#8696a0] text-sm leading-relaxed mb-8">Send and receive messages without keeping your phone online.<br/>Use WhatsApp on up to 4 linked devices and 1 phone.</p>
            <div className="flex items-center justify-center gap-2 text-[#8696a0] text-xs font-medium">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>
              Your personal messages are end-to-end encrypted
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
