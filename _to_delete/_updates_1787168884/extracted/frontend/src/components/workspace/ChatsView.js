import React, { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../App';
import GroupModal from '../GroupModal';
import {
  Search, Send, Paperclip, MessageSquare, Users, CheckCheck, FileText,
  Check, X, ArrowLeft, AlertCircle, Image as ImageIcon
} from 'lucide-react';

export default function ChatsView({
  user, socket, onlineUsers, conversations, conversationsLoading, conversationsError,
  fetchConversations, activeChat, setActiveChat, onOpenPeople
}) {
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState('');
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [otherParticipantTyping, setOtherParticipantTyping] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const token = localStorage.getItem('token');

  const fetchMessages = async (conversationId) => {
    setMessagesLoading(true);
    setMessagesError('');
    try {
      const res = await fetch(`${API_BASE}/messages/${conversationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      if (data.status === 'success') {
        setMessages(data.data);
        markAsSeen(conversationId);
      } else {
        setMessagesError(data.message || 'Unable to load messages.');
      }
    } catch (err) {
      console.error(err);
      setMessagesError('Unable to load this conversation.');
    } finally {
      setMessagesLoading(false);
    }
  };

  useEffect(() => {
    if (!activeChat) return;
    fetchMessages(activeChat._id);
    setOtherParticipantTyping(false);
    setMobileShowChat(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?._id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, otherParticipantTyping]);

  useEffect(() => {
    if (!socket) return;

    const onNewMessage = (message) => {
      if (activeChat && message.conversation.toString() === activeChat._id.toString()) {
        setMessages(prev => [...prev, message]);
        markAsSeen(activeChat._id);
      }
    };
    const onTyping = ({ senderId }) => {
      if (activeChat && !activeChat.isGroup) {
        const partner = activeChat.participants.find(p => p._id !== user._id);
        if (partner && partner._id === senderId) setOtherParticipantTyping(true);
      }
    };
    const onStopTyping = ({ senderId }) => {
      if (activeChat && !activeChat.isGroup) {
        const partner = activeChat.participants.find(p => p._id !== user._id);
        if (partner && partner._id === senderId) setOtherParticipantTyping(false);
      }
    };
    const onSeen = ({ conversationId }) => {
      if (activeChat && conversationId.toString() === activeChat._id.toString()) {
        setMessages(prev => prev.map(msg =>
          msg.sender._id !== user._id ? msg : { ...msg, messageStatus: 'seen' }
        ));
      }
    };

    socket.on('newMessage', onNewMessage);
    socket.on('typing', onTyping);
    socket.on('stop_typing', onStopTyping);
    socket.on('messagesSeen', onSeen);

    return () => {
      socket.off('newMessage', onNewMessage);
      socket.off('typing', onTyping);
      socket.off('stop_typing', onStopTyping);
      socket.off('messagesSeen', onSeen);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, activeChat?._id, user._id]);

  const markAsSeen = async (conversationId) => {
    try {
      await fetch(`${API_BASE}/messages/seen/${conversationId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchConversations();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!query.trim()) { setSearchResults([]); return; }
    try {
      const res = await fetch(`${API_BASE}/users/search?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') setSearchResults(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartChat = async (receiverId) => {
    try {
      const res = await fetch(`${API_BASE}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ receiverId })
      });
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        setActiveChat(data.data);
        setSearchQuery('');
        setSearchResults([]);
        fetchConversations();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (!socket || !activeChat) return;

    if (!isTyping) {
      setIsTyping(true);
      const partner = activeChat.isGroup ? null : activeChat.participants.find(p => p._id !== user._id);
      if (partner) socket.emit('typing', { receiverId: partner._id });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      const partner = activeChat.isGroup ? null : activeChat.participants.find(p => p._id !== user._id);
      if (partner) socket.emit('stop_typing', { receiverId: partner._id });
    }, 1500);
  };

  const ALLOWED_TYPES = /^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm)|application\/(pdf|msword|vnd\.openxmlformats-officedocument.*|vnd\.ms-excel)|text\/(plain|csv))$/;
  const MAX_SIZE = 25 * 1024 * 1024;

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_SIZE) {
      setMessagesError('File is larger than the 25MB limit.');
      return;
    }
    if (!ALLOWED_TYPES.test(file.type)) {
      setMessagesError('Unsupported file format.');
      return;
    }
    setMessagesError('');
    setAttachment(file);
    setAttachmentPreview(URL.createObjectURL(file));
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() && !attachment) return;
    if (!activeChat) return;

    setUploadingMedia(true);
    const formData = new FormData();
    formData.append('conversationId', activeChat._id);
    formData.append('content', inputText);
    if (attachment) {
      formData.append('file', attachment);
      formData.append('messageType', attachment.type.startsWith('image/') ? 'image' : attachment.type.startsWith('video/') ? 'video' : 'file');
    }

    try {
      const res = await fetch(`${API_BASE}/messages/send`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.status === 'success') {
        setMessages(prev => [...prev, data.data]);
        setInputText('');
        setAttachment(null);
        setAttachmentPreview('');
        fetchConversations();
      } else {
        setMessagesError(data.message || 'Failed to send message.');
      }
    } catch (err) {
      console.error(err);
      setMessagesError('Message failed to send. Check your connection.');
    } finally {
      setUploadingMedia(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Conversation list */}
      <div className={`w-full md:w-80 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0 ${mobileShowChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex items-center justify-between p-3 border-b border-[var(--border-subtle)]">
          <h2 className="text-xs font-bold text-slate-200 px-1">Chats</h2>
          <button
            onClick={() => setIsGroupModalOpen(true)}
            className="p-1.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] text-slate-400 hover:text-slate-200 transition-colors"
            title="Create Group"
          >
            <Users className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-3 border-b border-[var(--border-subtle)]/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search user or email..."
              className="w-full pl-9 pr-3 py-2 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] focus:border-emerald-500/60 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 outline-none transition-colors"
            />
          </div>
        </div>

        {searchQuery.trim() ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 space-y-1">
            <p className="font-mono-code text-[10px] text-slate-500 uppercase tracking-wider mb-2">Search Results</p>
            {searchResults.length === 0 ? (
              <p className="text-slate-600 text-xs text-center py-4">No matching users</p>
            ) : (
              searchResults.map(r => (
                <div key={r._id} onClick={() => handleStartChat(r._id)} className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-[var(--bg-hover)] border border-transparent hover:border-[var(--border-strong)] transition-all">
                  <img src={r.profilePicture || `https://api.dicebear.com/7.x/adventurer/svg?seed=${r.username}`} alt={r.username} className="w-8 h-8 rounded-lg object-cover" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-100 truncate">{r.username}</p>
                    <p className="text-[10px] text-slate-500 truncate">{r.about || 'No status'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : conversationsLoading ? (
          <p className="text-xs text-slate-500 text-center py-10">Loading conversations...</p>
        ) : conversationsError ? (
          <div className="text-center py-10 px-4">
            <p className="text-xs text-rose-400 mb-2">{conversationsError}</p>
            <button onClick={fetchConversations} className="text-[11px] text-emerald-400 hover:underline">Try again</button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 custom-scrollbar">
            {conversations.length === 0 ? (
              <div className="py-12 text-center px-4">
                <MessageSquare className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">No conversations yet.</p>
                <p className="text-[10px] text-slate-600 mt-0.5">Find someone in <button onClick={onOpenPeople} className="text-emerald-400 hover:underline">People</button> to start chatting.</p>
              </div>
            ) : (
              conversations.map((chat) => {
                const isGroup = chat.isGroup;
                const partner = isGroup ? null : chat.participants.find(p => p._id !== user._id);
                const chatName = isGroup ? chat.groupName : (partner?.username || 'User');
                const chatAvatar = isGroup ? chat.groupAvatar : (partner?.profilePicture || `https://api.dicebear.com/7.x/adventurer/svg?seed=${partner?.username}`);
                const isPartnerOnline = isGroup ? false : onlineUsers.includes(partner?._id);
                const isSelected = activeChat && activeChat._id === chat._id;

                return (
                  <div key={chat._id} onClick={() => setActiveChat(chat)} className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer border transition-all ${isSelected ? 'bg-[var(--bg-hover)] border-[var(--border-strong)] text-slate-100' : 'bg-transparent hover:bg-[var(--bg-surface-2)] border-transparent'}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <img src={chatAvatar} alt={chatName} className="w-9 h-9 rounded-lg object-cover border border-[var(--border-subtle)]" />
                        {isPartnerOnline && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[var(--bg-surface)] rounded-full"></div>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-100 truncate">{chatName}</p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5 max-w-[130px]">{chat.lastMessage ? (chat.lastMessage.content || 'Sent an attachment') : 'No messages'}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="font-mono-code text-[9px] text-slate-500">{chat.lastMessage ? new Date(chat.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      {chat.unreadcount > 0 && !isSelected && <span className="bg-emerald-500 text-slate-950 font-bold text-[9px] px-1.5 py-0.5 rounded-full">{chat.unreadcount}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Chat pane */}
      <div className={`flex-1 flex-col bg-[var(--bg-canvas)] relative ${mobileShowChat ? 'flex' : 'hidden md:flex'}`}>
        {activeChat ? (
          <>
            <div className="flex items-center gap-3 p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] z-10">
              <button onClick={() => setMobileShowChat(false)} className="md:hidden text-slate-400"><ArrowLeft className="w-4 h-4" /></button>
              <img
                src={activeChat.isGroup ? activeChat.groupAvatar : activeChat.participants.find(p => p._id !== user._id)?.profilePicture || `https://api.dicebear.com/7.x/adventurer/svg?seed=${activeChat.participants.find(p => p._id !== user._id)?.username}`}
                alt="Avatar"
                className="w-9 h-9 rounded-lg object-cover border border-[var(--border-strong)]"
              />
              <div>
                <h4 className="font-bold text-xs text-slate-100">{activeChat.isGroup ? activeChat.groupName : activeChat.participants.find(p => p._id !== user._id)?.username}</h4>
                <span className="font-mono-code text-[10px] text-slate-500">
                  {otherParticipantTyping ? <span className="text-emerald-400">typing...</span>
                    : activeChat.isGroup ? `${activeChat.participants.length} members`
                    : onlineUsers.includes(activeChat.participants.find(p => p._id !== user._id)?._id) ? <span className="text-emerald-400">● ONLINE</span> : 'OFFLINE'}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
              {messagesLoading ? (
                <p className="text-xs text-slate-500 text-center py-10">Loading conversation...</p>
              ) : messagesError ? (
                <div className="text-center py-10">
                  <p className="text-xs text-rose-400 mb-2">{messagesError}</p>
                  <button onClick={() => fetchMessages(activeChat._id)} className="text-[11px] text-emerald-400 hover:underline">Try again</button>
                </div>
              ) : messages.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-10">No messages yet. Say hello!</p>
              ) : messages.map((msg) => {
                const isMe = msg.sender._id === user._id;
                return (
                  <div key={msg._id} className={`flex flex-col animate-message-in ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-end gap-2 max-w-[85%] md:max-w-[65%]">
                      {!isMe && <img src={msg.sender.profilePicture || `https://api.dicebear.com/7.x/adventurer/svg?seed=${msg.sender.username}`} alt="avatar" className="w-6 h-6 rounded-md object-cover border border-[var(--border-subtle)] mb-1" />}
                      <div className={`p-3.5 rounded-xl border ${isMe ? 'bg-[#13231e] border-[#1b3d32] text-slate-100' : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-200'}`}>
                        {activeChat.isGroup && !isMe && <p className="font-mono-code text-[10px] text-emerald-400 mb-1">{msg.sender.username}</p>}
                        {msg.imageOrFileUrl && (
                          <div className="mb-2 rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-black/40">
                            {msg.messageType === 'image' && <img src={msg.imageOrFileUrl} alt="attachment" className="max-h-64 object-cover cursor-pointer" onClick={() => setLightboxUrl(msg.imageOrFileUrl)} />}
                            {msg.messageType === 'video' && <video src={msg.imageOrFileUrl} controls className="max-h-64" />}
                            {msg.messageType === 'file' && (
                              <a href={msg.imageOrFileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2.5 text-xs text-emerald-400 font-mono-code">
                                <FileText className="w-4 h-4 shrink-0" /> View File Attachment
                              </a>
                            )}
                          </div>
                        )}
                        {msg.content && <p className="text-xs leading-relaxed break-words">{msg.content}</p>}
                        <div className="flex items-center justify-end gap-1 mt-1 text-[9px] font-mono-code text-slate-500">
                          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isMe && (msg.messageStatus === 'seen' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Check className="w-3.5 h-3.5 text-slate-500" />)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {otherParticipantTyping && (
                <div className="flex items-center gap-2 text-slate-500 text-xs font-mono-code">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span> typing...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              {messagesError && !messagesLoading && (
                <div className="mb-2 flex items-center gap-1.5 text-[11px] text-rose-400"><AlertCircle className="w-3 h-3" /> {messagesError}</div>
              )}
              {attachmentPreview && (
                <div className="mb-2 p-2 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-lg flex items-center justify-between max-w-xs text-xs">
                  <span className="truncate text-slate-300 font-mono-code flex items-center gap-1.5"><Paperclip className="w-3 h-3" />{attachment.name} &middot; {(attachment.size / 1024 / 1024).toFixed(1)} MB</span>
                  <button type="button" onClick={() => { setAttachment(null); setAttachmentPreview(''); }} className="text-slate-500 hover:text-slate-300 ml-2 shrink-0"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-hover)] text-slate-400 hover:text-slate-200 transition-colors">
                  <Paperclip className="w-4 h-4" />
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" />
                </button>
                <input type="text" value={inputText} onChange={handleInputChange} placeholder="Write a message..." className="flex-1 px-3.5 py-2.5 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] focus:border-emerald-500/60 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 outline-none transition-colors" />
                <button type="submit" disabled={uploadingMedia || (!inputText.trim() && !attachment)} className="active-press bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold p-2.5 rounded-xl transition-colors">
                  {uploadingMedia ? <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
            <div className="w-12 h-12 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-slate-500 mb-4">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h2 className="text-base font-semibold text-slate-200 tracking-tight">No Conversation Selected</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">Select a conversation from the sidebar or search users to start messaging.</p>
          </div>
        )}
      </div>

      {lightboxUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6" onClick={() => setLightboxUrl(null)}>
          <button onClick={() => setLightboxUrl(null)} className="absolute top-5 right-5 text-white/70 hover:text-white"><X className="w-6 h-6" /></button>
          <a href={lightboxUrl} download onClick={(e) => e.stopPropagation()} className="absolute top-5 right-16 text-white/70 hover:text-white text-xs font-mono-code flex items-center gap-1"><ImageIcon className="w-4 h-4" /> Download</a>
          <img src={lightboxUrl} alt="Full view" className="max-w-full max-h-full rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <GroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        onCreateGroup={(newGroup) => { fetchConversations(); setActiveChat(newGroup); }}
        currentUser={user}
      />
    </div>
  );
}
