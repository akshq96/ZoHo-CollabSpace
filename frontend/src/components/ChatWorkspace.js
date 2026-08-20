import React, { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../App';
import StatusTray from './StatusTray';
import GroupModal from './GroupModal';
import { 
  LogOut, Search, Send, Paperclip, MessageSquare, 
  Users, CheckCheck, FileText, Check, X, Settings
} from 'lucide-react';

export default function ChatWorkspace({ user, socket, onlineUsers, onLogout, onProfileUpdate }) {
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [otherParticipantTyping, setOtherParticipantTyping] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Settings profile updates
  const [newUsername, setNewUsername] = useState(user.username);
  const [newAbout, setNewAbout] = useState(user.about);
  const [newAvatar, setNewAvatar] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Fetch active conversations
  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setConversations(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // Fetch messages when active chat changes
  useEffect(() => {
    if (!activeChat) return;

    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/messages/${activeChat._id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === 'success') {
          setMessages(data.data);
          await markAsSeen(activeChat._id);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchMessages();
    setOtherParticipantTyping(false);
  }, [activeChat]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, otherParticipantTyping]);

  // Socket event registrations
  useEffect(() => {
    if (!socket) return;

    socket.on('newMessage', (message) => {
      if (activeChat && message.conversation.toString() === activeChat._id.toString()) {
        setMessages(prev => [...prev, message]);
        markAsSeen(activeChat._id);
      }
      fetchConversations();
    });

    socket.on('typing', ({ senderId }) => {
      if (activeChat && !activeChat.isGroup) {
        const activePartner = activeChat.participants.find(p => p._id !== user._id);
        if (activePartner && activePartner._id === senderId) {
          setOtherParticipantTyping(true);
        }
      }
    });

    socket.on('stop_typing', ({ senderId }) => {
      if (activeChat && !activeChat.isGroup) {
        const activePartner = activeChat.participants.find(p => p._id !== user._id);
        if (activePartner && activePartner._id === senderId) {
          setOtherParticipantTyping(false);
        }
      }
    });

    socket.on('messagesSeen', ({ conversationId }) => {
      if (activeChat && conversationId.toString() === activeChat._id.toString()) {
        setMessages(prev => prev.map(msg => 
          msg.sender._id !== user._id ? msg : { ...msg, messageStatus: 'seen' }
        ));
      }
      fetchConversations();
    });

    return () => {
      socket.off('newMessage');
      socket.off('typing');
      socket.off('stop_typing');
      socket.off('messagesSeen');
    };
  }, [socket, activeChat]);

  const markAsSeen = async (conversationId) => {
    try {
      const token = localStorage.getItem('token');
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
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/users/search?q=${query}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSearchResults(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartChat = async (receiverId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
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
      const activePartner = activeChat.isGroup 
        ? null 
        : activeChat.participants.find(p => p._id !== user._id);
      if (activePartner) {
        socket.emit('typing', { receiverId: activePartner._id });
      }
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      const activePartner = activeChat.isGroup 
        ? null 
        : activeChat.participants.find(p => p._id !== user._id);
      if (activePartner) {
        socket.emit('stop_typing', { receiverId: activePartner._id });
      }
    }, 1500);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAttachment(file);
      setAttachmentPreview(URL.createObjectURL(file));
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() && !attachment) return;

    setUploadingMedia(true);
    const token = localStorage.getItem('token');
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
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('username', newUsername);
    formData.append('about', newAbout);
    if (newAvatar) {
      formData.append('profilePicture', newAvatar);
    }

    try {
      const res = await fetch(`${API_BASE}/auth/update-profile`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.status === 'success') {
        onProfileUpdate(data.data);
        setShowSettings(false);
        setNewAvatar(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex h-screen bg-[#08090b] text-slate-100 font-sans antialiased overflow-hidden select-none">
      
      {/* Sidebar Panel */}
      <div className="w-80 flex flex-col border-r border-[#1f232b] bg-[#101216] shrink-0">
        
        {/* User Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1f232b] bg-[#0c0e11]">
          <div className="flex items-center gap-3">
            <img
              src={user.profilePicture || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`}
              alt={user.username}
              className="w-9 h-9 rounded-lg object-cover border border-[#2d333f]"
            />
            <div className="min-w-0">
              <h3 className="font-semibold text-xs text-slate-100 truncate">{user.username}</h3>
              <span className="font-mono-code text-[10px] text-emerald-400">● ONLINE</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsGroupModalOpen(true)}
              className="p-1.5 rounded-lg border border-[#1f232b] hover:bg-[#1a1e27] text-slate-400 hover:text-slate-200 transition-colors"
              title="Create Group"
            >
              <Users className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-1.5 rounded-lg border border-[#1f232b] hover:bg-[#1a1e27] text-slate-400 hover:text-slate-200 transition-colors"
              title="Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={onLogout}
              className="p-1.5 rounded-lg border border-[#1f232b] hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Stories Tray */}
        <StatusTray currentUser={user} />

        {/* Search Bar */}
        <div className="p-3 border-b border-[#1f232b]/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search user or email..."
              className="w-full pl-9 pr-3 py-2 bg-[#08090b] border border-[#1f232b] focus:border-emerald-500/60 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Search Results */}
        {searchQuery.trim() && (
          <div className="flex-1 overflow-y-auto bg-[#08090b] px-3 py-2 space-y-1 border-t border-[#1f232b]">
            <p className="font-mono-code text-[10px] text-slate-500 uppercase tracking-wider mb-2">Search Results</p>
            {searchResults.length === 0 ? (
              <p className="text-slate-600 text-xs text-center py-4">No matching users</p>
            ) : (
              searchResults.map(result => (
                <div
                  key={result._id}
                  onClick={() => handleStartChat(result._id)}
                  className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-[#1a1e27] border border-transparent hover:border-[#2d333f] transition-all"
                >
                  <img
                    src={result.profilePicture || `https://api.dicebear.com/7.x/adventurer/svg?seed=${result.username}`}
                    alt={result.username}
                    className="w-8 h-8 rounded-lg object-cover"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-100 truncate">{result.username}</p>
                    <p className="text-[10px] text-slate-500 truncate">{result.about || 'No status'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Conversations List */}
        {!searchQuery.trim() && (
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 custom-scrollbar">
            <p className="px-2 py-1 font-mono-code text-[10px] text-slate-500 uppercase tracking-wider">Conversations</p>
            
            {conversations.length === 0 ? (
              <div className="py-12 text-center px-4">
                <MessageSquare className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">No active chats</p>
                <p className="text-[10px] text-slate-600 mt-0.5">Use search above to find users</p>
              </div>
            ) : (
              conversations.map((chat) => {
                const isGroup = chat.isGroup;
                const activePartner = isGroup 
                  ? null 
                  : chat.participants.find(p => p._id !== user._id);
                const chatName = isGroup ? chat.groupName : (activePartner?.username || 'User');
                const chatAvatar = isGroup ? chat.groupAvatar : (activePartner?.profilePicture || `https://api.dicebear.com/7.x/adventurer/svg?seed=${activePartner?.username}`);
                const isPartnerOnline = isGroup ? false : onlineUsers.includes(activePartner?._id);
                const isSelected = activeChat && activeChat._id === chat._id;
                
                return (
                  <div
                    key={chat._id}
                    onClick={() => setActiveChat(chat)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer border transition-all ${isSelected ? 'bg-[#1a1e27] border-[#2d333f] text-slate-100' : 'bg-transparent hover:bg-[#14171d] border-transparent'}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={chatAvatar}
                          alt={chatName}
                          className="w-9 h-9 rounded-lg object-cover border border-[#1f232b]"
                        />
                        {isPartnerOnline && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#101216] rounded-full"></div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-100 truncate">{chatName}</p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5 max-w-[130px]">
                          {chat.lastMessage ? chat.lastMessage.content : 'No messages'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="font-mono-code text-[9px] text-slate-500">
                        {chat.lastMessage ? new Date(chat.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                      {chat.unreadcount > 0 && !isSelected && (
                        <span className="bg-emerald-500 text-slate-950 font-bold text-[9px] px-1.5 py-0.5 rounded-full">
                          {chat.unreadcount}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col bg-[#08090b] relative">
        {activeChat ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#1f232b] bg-[#101216] z-10">
              <div className="flex items-center gap-3">
                <img
                  src={activeChat.isGroup ? activeChat.groupAvatar : activeChat.participants.find(p => p._id !== user._id)?.profilePicture || `https://api.dicebear.com/7.x/adventurer/svg?seed=${activeChat.participants.find(p => p._id !== user._id)?.username}`}
                  alt="Avatar"
                  className="w-9 h-9 rounded-lg object-cover border border-[#2d333f]"
                />
                <div>
                  <h4 className="font-bold text-xs text-slate-100">
                    {activeChat.isGroup ? activeChat.groupName : activeChat.participants.find(p => p._id !== user._id)?.username}
                  </h4>
                  <span className="font-mono-code text-[10px] text-slate-500">
                    {otherParticipantTyping ? (
                      <span className="text-emerald-400">typing...</span>
                    ) : activeChat.isGroup ? (
                      `${activeChat.participants.length} members`
                    ) : onlineUsers.includes(activeChat.participants.find(p => p._id !== user._id)?._id) ? (
                      <span className="text-emerald-400">● ONLINE</span>
                    ) : (
                      'OFFLINE'
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Message Log */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar bg-[#08090b]">
              {messages.map((msg) => {
                const isMe = msg.sender._id === user._id;
                return (
                  <div
                    key={msg._id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-end gap-2 max-w-[65%]">
                      {!isMe && (
                        <img
                          src={msg.sender.profilePicture || `https://api.dicebear.com/7.x/adventurer/svg?seed=${msg.sender.username}`}
                          alt="avatar"
                          className="w-6 h-6 rounded-md object-cover border border-[#1f232b] mb-1"
                        />
                      )}
                      
                      <div className={`p-3.5 rounded-xl border ${isMe ? 'bg-[#13231e] border-[#1b3d32] text-slate-100' : 'bg-[#101216] border-[#1f232b] text-slate-200'}`}>
                        {activeChat.isGroup && !isMe && (
                          <p className="font-mono-code text-[10px] text-emerald-400 mb-1">{msg.sender.username}</p>
                        )}
                        
                        {msg.imageOrFileUrl && (
                          <div className="mb-2 rounded-lg overflow-hidden border border-[#1f232b] bg-black/40">
                            {msg.messageType === 'image' && (
                              <img src={msg.imageOrFileUrl} alt="attachment" className="max-h-48 object-cover cursor-pointer" onClick={() => window.open(msg.imageOrFileUrl, '_blank')} />
                            )}
                            {msg.messageType === 'video' && (
                              <video src={msg.imageOrFileUrl} controls className="max-h-48" />
                            )}
                            {msg.messageType === 'file' && (
                              <a href={msg.imageOrFileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2.5 text-xs text-emerald-400 font-mono-code">
                                <FileText className="w-4 h-4 shrink-0" />
                                View File Attachment
                              </a>
                            )}
                          </div>
                        )}
                        
                        <p className="text-xs leading-relaxed break-words">{msg.content}</p>
                        
                        <div className="flex items-center justify-end gap-1 mt-1 text-[9px] font-mono-code text-slate-500">
                          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isMe && (
                            msg.messageStatus === 'seen' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-slate-500" />
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {otherParticipantTyping && (
                <div className="flex items-center gap-2 text-slate-500 text-xs font-mono-code">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                  typing...
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-[#1f232b] bg-[#101216]">
              {attachmentPreview && (
                <div className="mb-2 p-2 bg-[#08090b] border border-[#1f232b] rounded-lg flex items-center justify-between max-w-xs text-xs">
                  <span className="truncate text-slate-300 font-mono-code">{attachment.name}</span>
                  <button type="button" onClick={() => { setAttachment(null); setAttachmentPreview(''); }} className="text-slate-500 hover:text-slate-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-lg border border-[#1f232b] bg-[#08090b] hover:bg-[#1a1e27] text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <Paperclip className="w-4 h-4" />
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={handleInputChange}
                  placeholder="Write a message..."
                  className="flex-1 px-3.5 py-2.5 bg-[#08090b] border border-[#1f232b] focus:border-emerald-500/60 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 outline-none transition-colors"
                />

                <button
                  type="submit"
                  disabled={uploadingMedia || (!inputText.trim() && !attachment)}
                  className="active-press bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold p-2.5 rounded-xl transition-colors"
                >
                  {uploadingMedia ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          /* Empty Workspace Welcome State */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
            <div className="w-12 h-12 rounded-xl bg-[#101216] border border-[#1f232b] flex items-center justify-center text-slate-500 mb-4">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h2 className="text-base font-semibold text-slate-200 tracking-tight">No Conversation Selected</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
              Select a conversation from the sidebar or search users to start messaging.
            </p>
          </div>
        )}
      </div>

      {/* Settings Drawer */}
      {showSettings && (
        <div className="fixed inset-y-0 right-0 z-40 w-80 bg-[#101216] border-l border-[#1f232b] p-6 shadow-2xl flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#1f232b]">
              <h3 className="font-bold text-sm text-slate-100">Settings</h3>
              <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono-code uppercase tracking-wider text-slate-400">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  className="w-full px-3 py-2 bg-[#08090b] border border-[#1f232b] focus:border-emerald-500/60 rounded-xl text-xs text-slate-100 font-mono-code outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono-code uppercase tracking-wider text-slate-400">About</label>
                <textarea
                  value={newAbout}
                  onChange={(e) => setNewAbout(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-[#08090b] border border-[#1f232b] focus:border-emerald-500/60 rounded-xl text-xs text-slate-100 outline-none resize-none"
                />
              </div>

              <button type="submit" className="w-full active-press bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 px-4 rounded-xl text-xs transition-colors">
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Group Modal */}
      <GroupModal 
        isOpen={isGroupModalOpen} 
        onClose={() => setIsGroupModalOpen(false)}
        onCreateGroup={(newGroup) => {
          setConversations(prev => [newGroup, ...prev]);
          setActiveChat(newGroup);
        }}
        currentUser={user}
      />
    </div>
  );
}
