import React, { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../config';
import { resolveUrl } from '../../utils/media';
import GroupModal from '../GroupModal';
import {
  Search, Send, Paperclip, MessageSquare, Users, CheckCheck, FileText,
  Check, X, ArrowLeft, AlertCircle, Image as ImageIcon, Plus, MoreVertical,
  UserPlus, UserMinus, Ban
} from 'lucide-react';

function avatarFor(url, seed) {
  return resolveUrl(url) || `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`;
}

// Only ever lists accepted contacts — per the connection-request model,
// "New Chat" must never surface random registered users. If someone isn't
// connected yet, they go through People > Discover > Connect first.
function NewChatModal({ isOpen, onClose, contacts, onPick, onOpenPeople }) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (isOpen) setQuery('');
  }, [isOpen]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();
  const list = contacts
    .filter(c => c.user)
    .filter(c => !q || (c.user.username || '').toLowerCase().includes(q))
    .map(c => c.user);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div className="w-full max-w-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <h3 className="font-semibold text-sm text-slate-100">New conversation</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search contacts..."
              className="w-full pl-9 pr-3 py-2 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] focus:border-emerald-500/60 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 outline-none"
            />
          </div>
          <p className="font-mono-code text-[9px] text-slate-500 uppercase tracking-wider px-1">My Contacts</p>
          <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-1 pr-1">
            {list.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-slate-500 text-xs">No contacts yet.</p>
                <button onClick={onOpenPeople} className="text-emerald-400 text-[11px] hover:underline mt-1">Discover people to connect</button>
              </div>
            ) : (
              list.map(u => (
                <div key={u._id} onClick={() => onPick(u._id)} className="flex items-center gap-2.5 p-2 rounded-xl cursor-pointer hover:bg-[var(--bg-hover)]">
                  <img src={avatarFor(u.profilePicture, u.username)} alt={u.username} className="w-8 h-8 rounded-lg object-cover" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-100 truncate">{u.username}</p>
                    <p className="text-[10px] text-slate-500 truncate">{u.about || 'No status'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatsView({
  user, socket, onlineUsers, conversations, conversationsLoading, conversationsError,
  fetchConversations, activeChat, setActiveChat, onOpenPeople,
  contacts = [], relationships = {}, startChatWithUser,
  sendConnectionRequest, removeContact, blockUser, unblockUser,
  autoOpenNewChat = false, onAutoTriggerHandled
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
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [contactActionBusy, setContactActionBusy] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const headerMenuRef = useRef(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (autoOpenNewChat) {
      setIsNewChatOpen(true);
      onAutoTriggerHandled && onAutoTriggerHandled();
    }
  }, [autoOpenNewChat, onAutoTriggerHandled]);

  useEffect(() => {
    const handleClick = (e) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) setShowHeaderMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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

  const openChatWith = async (receiverId) => {
    const result = await startChatWithUser(receiverId);
    if (!result?.ok) setMessagesError(result?.message || 'Unable to start this chat.');
    setSearchQuery('');
    setSearchResults([]);
    setIsNewChatOpen(false);
  };

  // Search results outside your contacts can't be messaged directly — being
  // registered on ZoHo isn't enough. Clicking sends a connection request
  // instead of silently failing on a 403 from the backend.
  const handleSearchResultClick = async (r) => {
    const state = relationships[r._id]?.state || 'NONE';
    if (state === 'ACCEPTED') { openChatWith(r._id); return; }
    if (state === 'NONE' && sendConnectionRequest) {
      await sendConnectionRequest(r._id);
      setMessagesError(`Connection request sent to ${r.username}. You can message once they accept.`);
    }
    setSearchQuery('');
    setSearchResults([]);
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

  const activePartner = activeChat && !activeChat.isGroup ? activeChat.participants.find(p => p._id !== user._id) : null;
  const activePartnerState = activePartner ? (relationships[activePartner._id]?.state || 'NONE') : 'NONE';

  const handlePrimaryContactAction = async () => {
    if (!activePartner || contactActionBusy) return;
    setContactActionBusy(true);
    if (activePartnerState === 'ACCEPTED') {
      if (removeContact) await removeContact(activePartner._id);
    } else if (activePartnerState === 'BLOCKED') {
      if (unblockUser) await unblockUser(activePartner._id);
    } else {
      // Covers a legacy conversation with no formal connection yet
      // (NONE/DECLINED) and BLOCKED_BY_THEM (harmless no-op attempt).
      if (sendConnectionRequest) await sendConnectionRequest(activePartner._id);
    }
    setContactActionBusy(false);
    setShowHeaderMenu(false);
  };

  const handleBlock = async () => {
    if (!activePartner || contactActionBusy) return;
    setContactActionBusy(true);
    if (blockUser) await blockUser(activePartner._id);
    setContactActionBusy(false);
    setShowHeaderMenu(false);
  };

  return (
    <div className="flex h-full">
      {/* Conversation list */}
      <div className={`w-full md:w-80 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0 ${mobileShowChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex items-center justify-between p-3 border-b border-[var(--border-subtle)]">
          <h2 className="text-xs font-bold text-slate-200 px-1">Chats</h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsNewChatOpen(true)}
              className="p-1.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] text-slate-400 hover:text-slate-200 transition-colors"
              title="New Chat"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsGroupModalOpen(true)}
              className="p-1.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] text-slate-400 hover:text-slate-200 transition-colors"
              title="Create Group"
            >
              <Users className="w-3.5 h-3.5" />
            </button>
          </div>
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
              searchResults.map(r => {
                const state = relationships[r._id]?.state || 'NONE';
                return (
                  <div key={r._id} onClick={() => handleSearchResultClick(r)} className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-[var(--bg-hover)] border border-transparent hover:border-[var(--border-strong)] transition-all">
                    <img src={avatarFor(r.profilePicture, r.username)} alt={r.username} className="w-8 h-8 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-100 truncate">{r.username}</p>
                      <p className="text-[10px] text-slate-500 truncate">{r.about || 'No status'}</p>
                    </div>
                    <span className="text-[9px] font-mono-code text-slate-500 shrink-0">
                      {state === 'ACCEPTED' ? 'Message' : state === 'PENDING_SENT' ? 'Requested' : state === 'PENDING_RECEIVED' ? 'Accept in People' : state.startsWith('BLOCKED') ? '' : 'Connect'}
                    </span>
                  </div>
                );
              })
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
                const chatAvatar = avatarFor(isGroup ? chat.groupAvatar : partner?.profilePicture, chatName);
                const isPartnerOnline = isGroup ? false : onlineUsers.includes(partner?._id);
                const isSelected = activeChat && activeChat._id === chat._id;

                return (
                  <div key={chat._id} onClick={() => setActiveChat(chat)} className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors duration-150 ${isSelected ? 'bg-[var(--bg-elevated)]' : 'hover:bg-[var(--bg-surface-2)]'}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <img src={chatAvatar} alt={chatName} className="w-10 h-10 rounded-full object-cover" />
                        {isPartnerOnline && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[var(--bg-surface)] rounded-full"></div>}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-[13px] truncate ${chat.unreadcount > 0 && !isSelected ? 'font-bold text-slate-50' : 'font-semibold text-slate-100'}`}>{chatName}</p>
                        <p className="text-[11.5px] text-[var(--text-secondary)] truncate mt-0.5 max-w-[150px]">{chat.lastMessage ? (chat.lastMessage.content || 'Sent an attachment') : 'No messages'}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-[10px] text-slate-500">{chat.lastMessage ? new Date(chat.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      {chat.unreadcount > 0 && !isSelected && <span className="bg-emerald-500 text-slate-950 font-bold text-[9px] min-w-[16px] px-1 py-0.5 rounded-full text-center">{chat.unreadcount}</span>}
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
                src={avatarFor(activeChat.isGroup ? activeChat.groupAvatar : activePartner?.profilePicture, activeChat.isGroup ? activeChat.groupName : activePartner?.username)}
                alt="Avatar"
                className="w-9 h-9 rounded-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-xs text-slate-100 truncate">{activeChat.isGroup ? activeChat.groupName : activePartner?.username}</h4>
                <span className="font-mono-code text-[10px] text-slate-500">
                  {otherParticipantTyping ? <span className="text-emerald-400">typing...</span>
                    : activeChat.isGroup ? `${activeChat.participants.length} members`
                    : onlineUsers.includes(activePartner?._id) ? <span className="text-emerald-400">● ONLINE</span> : 'OFFLINE'}
                </span>
              </div>
              {!activeChat.isGroup && activePartner && (
                <div className="relative shrink-0" ref={headerMenuRef}>
                  <button onClick={() => setShowHeaderMenu(v => !v)} className="p-2 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] text-slate-400 hover:text-slate-200">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {showHeaderMenu && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden z-30 py-1">
                      <div className="px-3 py-2 text-[10px] font-mono-code text-slate-500 uppercase tracking-wider truncate">{activePartner.username}</div>
                      {activePartnerState !== 'BLOCKED' && (
                        <button
                          onClick={handlePrimaryContactAction}
                          disabled={contactActionBusy}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-xs disabled:opacity-50 ${activePartnerState === 'ACCEPTED' ? 'text-slate-300 hover:bg-[var(--bg-hover)]' : 'text-emerald-400 hover:bg-emerald-500/10'}`}
                        >
                          {activePartnerState === 'ACCEPTED'
                            ? <><UserMinus className="w-3.5 h-3.5" /> {contactActionBusy ? 'Removing...' : 'Remove contact'}</>
                            : activePartnerState === 'PENDING_SENT'
                              ? <><UserPlus className="w-3.5 h-3.5" /> Request sent</>
                              : <><UserPlus className="w-3.5 h-3.5" /> {contactActionBusy ? 'Sending...' : 'Connect'}</>}
                        </button>
                      )}
                      <button
                        onClick={activePartnerState === 'BLOCKED' ? handlePrimaryContactAction : handleBlock}
                        disabled={contactActionBusy}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
                      >
                        <Ban className="w-3.5 h-3.5" /> {activePartnerState === 'BLOCKED' ? (contactActionBusy ? 'Unblocking...' : 'Unblock user') : (contactActionBusy ? 'Blocking...' : 'Block user')}
                      </button>
                    </div>
                  )}
                </div>
              )}
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
                const attachmentUrl = resolveUrl(msg.imageOrFileUrl);
                return (
                  <div key={msg._id} className={`flex flex-col animate-message-in ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-end gap-2 max-w-[80%] md:max-w-[55%]">
                      {!isMe && <img src={avatarFor(msg.sender.profilePicture, msg.sender.username)} alt="avatar" className="w-6 h-6 rounded-full object-cover mb-1 shrink-0" />}
                      <div className={`px-3.5 py-2.5 shadow-sm ${isMe ? 'bg-[#13231e] text-slate-100 rounded-2xl rounded-br-md' : 'bg-[var(--bg-elevated)] text-slate-200 rounded-2xl rounded-bl-md'}`}>
                        {activeChat.isGroup && !isMe && <p className="text-[10px] font-semibold text-emerald-400 mb-1">{msg.sender.username}</p>}
                        {attachmentUrl && (
                          <div className="mb-2 rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-black/40">
                            {msg.messageType === 'image' && <img src={attachmentUrl} alt="attachment" className="max-h-64 object-cover cursor-pointer" onClick={() => setLightboxUrl(attachmentUrl)} />}
                            {msg.messageType === 'video' && <video src={attachmentUrl} controls className="max-h-64" />}
                            {msg.messageType === 'file' && (
                              <a href={attachmentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2.5 text-xs text-emerald-400 font-mono-code">
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
              <div className="flex items-center gap-2 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] focus-within:border-emerald-500/60 rounded-2xl pl-1.5 pr-1.5 py-1.5 transition-colors duration-150">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full hover:bg-[var(--bg-hover)] text-slate-400 hover:text-slate-200 transition-colors shrink-0" title="Attach a file">
                  <Paperclip className="w-4 h-4" />
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" />
                </button>
                <input type="text" value={inputText} onChange={handleInputChange} placeholder="Write a message..." className="flex-1 min-w-0 px-1 py-1.5 bg-transparent text-xs text-slate-100 placeholder:text-slate-600 outline-none" />
                <button type="submit" disabled={uploadingMedia || (!inputText.trim() && !attachment)} className="active-press bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold p-2.5 rounded-full transition-colors shrink-0">
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
            <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">Select a conversation from the sidebar, or start a <button onClick={() => setIsNewChatOpen(true)} className="text-emerald-400 hover:underline">New Chat</button>.</p>
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

      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        contacts={contacts}
        onPick={openChatWith}
        onOpenPeople={() => { setIsNewChatOpen(false); onOpenPeople(); }}
      />
    </div>
  );
}
