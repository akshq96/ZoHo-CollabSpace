import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { API_BASE } from '../../config';
import { resolveUrl } from '../../utils/media';
import {
  Home, MessageSquare, Users, Circle, Folder, Settings, User, LogOut,
  Search, Bell, Menu, X, Shield, FileText, ChevronDown
} from 'lucide-react';
import ThemeToggle from '../ThemeToggle';
import HomeView from './HomeView';
import ChatsView from './ChatsView';
import PeopleView from './PeopleView';
import StatusView from './StatusView';
import FilesView from './FilesView';
import ProfileSettingsView from './ProfileSettingsView';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'chats', label: 'Chats', icon: MessageSquare },
  { id: 'people', label: 'People', icon: Users },
  { id: 'status', label: 'Status', icon: Circle },
  { id: 'files', label: 'Files', icon: Folder },
];

export default function WorkspaceShell({ user, socket, onlineUsers, onLogout, onProfileUpdate }) {
  const [activeTab, setActiveTab] = useState('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'newChat' | 'upload' | 'postStatus'

  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [conversationsError, setConversationsError] = useState('');
  const [activeChat, setActiveChat] = useState(null);

  const [files, setFiles] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]); // requests received, awaiting my accept/decline
  const [relationships, setRelationships] = useState({}); // { [userId]: { state, connectionId } }

  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ people: [], conversations: [], messages: [], files: [] });
  const [lastSeenStatusAt, setLastSeenStatusAt] = useState(() => {
    try { return localStorage.getItem('zoho_last_seen_status') || new Date(0).toISOString(); } catch { return new Date(0).toISOString(); }
  });
  const [dismissedNotifIds, setDismissedNotifIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('zoho_dismissed_notifs') || '[]'); } catch { return []; }
  });

  const searchDebounceRef = useRef(null);
  const notifRef = useRef(null);
  const searchRef = useRef(null);
  const avatarRef = useRef(null);

  const token = localStorage.getItem('token');
  const authHeaders = useMemo(() => ({ 'Authorization': `Bearer ${token}` }), [token]);

  const fetchConversations = useCallback(async () => {
    try {
      setConversationsError('');
      const res = await fetch(`${API_BASE}/conversations`, { headers: authHeaders });
      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();
      if (data.status === 'success') {
        setConversations(data.data);
      } else {
        setConversationsError(data.message || 'Unable to load conversations.');
      }
    } catch (err) {
      console.error(err);
      setConversationsError('Unable to load your conversations.');
    } finally {
      setConversationsLoading(false);
    }
  }, [authHeaders]);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/files`, { headers: authHeaders });
      const data = await res.json();
      if (data.status === 'success') setFiles(data.data);
    } catch (err) {
      console.error(err);
    }
  }, [authHeaders]);

  const fetchStatuses = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/status`, { headers: authHeaders });
      const data = await res.json();
      if (data.status === 'success') setStatuses(data.data);
    } catch (err) {
      console.error(err);
    }
  }, [authHeaders]);

  const fetchAllUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/users`, { headers: authHeaders });
      const data = await res.json();
      if (data.status === 'success') setAllUsers(data.data);
    } catch (err) {
      console.error(err);
    }
  }, [authHeaders]);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/connections`, { headers: authHeaders });
      const data = await res.json();
      if (data.status === 'success') setContacts(data.data);
    } catch (err) {
      console.error(err);
    }
  }, [authHeaders]);

  const fetchPendingRequests = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/connections/requests`, { headers: authHeaders });
      const data = await res.json();
      if (data.status === 'success') setPendingRequests(data.data);
    } catch (err) {
      console.error(err);
    }
  }, [authHeaders]);

  const fetchRelationships = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/connections/status`, { headers: authHeaders });
      const data = await res.json();
      if (data.status === 'success') setRelationships(data.data);
    } catch (err) {
      console.error(err);
    }
  }, [authHeaders]);

  const refreshConnections = useCallback(() => {
    fetchContacts();
    fetchPendingRequests();
    fetchRelationships();
  }, [fetchContacts, fetchPendingRequests, fetchRelationships]);

  // Being registered on ZoHo does NOT mean you can message someone — every
  // one of these calls the real /api/connections endpoints (never a fake
  // frontend array), and the backend is the actual source of truth/
  // enforcement for all of them (see connectionController.js).
  const sendConnectionRequest = useCallback(async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/connections/request/${userId}`, { method: 'POST', headers: authHeaders });
      const data = await res.json();
      if (data.status === 'success') { refreshConnections(); return { ok: true }; }
      return { ok: false, message: data.message };
    } catch (err) {
      console.error(err);
      return { ok: false, message: 'Network error.' };
    }
  }, [authHeaders, refreshConnections]);

  const acceptConnection = useCallback(async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/connections/accept/${userId}`, { method: 'POST', headers: authHeaders });
      const data = await res.json();
      if (data.status === 'success') { refreshConnections(); return { ok: true }; }
      return { ok: false, message: data.message };
    } catch (err) {
      console.error(err);
      return { ok: false, message: 'Network error.' };
    }
  }, [authHeaders, refreshConnections]);

  const declineConnection = useCallback(async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/connections/decline/${userId}`, { method: 'POST', headers: authHeaders });
      const data = await res.json();
      if (data.status === 'success') { refreshConnections(); return { ok: true }; }
      return { ok: false, message: data.message };
    } catch (err) {
      console.error(err);
      return { ok: false, message: 'Network error.' };
    }
  }, [authHeaders, refreshConnections]);

  const removeContact = useCallback(async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/connections/${userId}`, { method: 'DELETE', headers: authHeaders });
      const data = await res.json();
      if (data.status === 'success') { refreshConnections(); return true; }
      return false;
    } catch (err) {
      console.error(err);
      return false;
    }
  }, [authHeaders, refreshConnections]);

  const blockUser = useCallback(async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/connections/block/${userId}`, { method: 'POST', headers: authHeaders });
      const data = await res.json();
      if (data.status === 'success') { refreshConnections(); return { ok: true }; }
      return { ok: false, message: data.message };
    } catch (err) {
      console.error(err);
      return { ok: false, message: 'Network error.' };
    }
  }, [authHeaders, refreshConnections]);

  const unblockUser = useCallback(async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/connections/unblock/${userId}`, { method: 'POST', headers: authHeaders });
      const data = await res.json();
      if (data.status === 'success') { refreshConnections(); return { ok: true }; }
      return { ok: false, message: data.message };
    } catch (err) {
      console.error(err);
      return { ok: false, message: 'Network error.' };
    }
  }, [authHeaders, refreshConnections]);

  useEffect(() => {
    fetchConversations();
    fetchFiles();
    fetchStatuses();
    fetchAllUsers();
    fetchContacts();
    fetchPendingRequests();
    fetchRelationships();
  }, [fetchConversations, fetchFiles, fetchStatuses, fetchAllUsers, fetchContacts, fetchPendingRequests, fetchRelationships]);

  // Keep conversation list (and therefore notifications/badges) live.
  useEffect(() => {
    if (!socket) return;
    const onNewMessage = () => fetchConversations();
    const onSeen = () => fetchConversations();
    socket.on('newMessage', onNewMessage);
    socket.on('messagesSeen', onSeen);
    return () => {
      socket.off('newMessage', onNewMessage);
      socket.off('messagesSeen', onSeen);
    };
  }, [socket, fetchConversations]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearch(false);
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setShowAvatarMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Cmd/Ctrl+K opens global search; Escape closes it.
  const searchInputRef = useRef(null);
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      } else if (e.key === 'Escape') {
        setShowSearch(false);
        setShowNotifications(false);
        setShowAvatarMenu(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  // Subtle ambient cursor glow — a soft radial highlight that follows the
  // pointer. rAF-throttled so it never adds jank; purely decorative
  // (pointer-events: none on the glow layer), no state re-renders.
  useEffect(() => {
    let raf = null;
    let pending = null;
    const apply = () => {
      raf = null;
      if (!pending) return;
      document.documentElement.style.setProperty('--cursor-x', `${pending.x}px`);
      document.documentElement.style.setProperty('--cursor-y', `${pending.y}px`);
      pending = null;
    };
    const handleMove = (e) => {
      pending = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener('mousemove', handleMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const startChatWithUser = useCallback(async (receiverId) => {
    try {
      const res = await fetch(`${API_BASE}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ receiverId })
      });
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        setActiveChat(data.data);
        setActiveTab('chats');
        fetchConversations();
        setMobileMenuOpen(false);
        return { ok: true };
      }
      return { ok: false, message: data.message };
    } catch (err) {
      console.error(err);
      return { ok: false, message: 'Network error.' };
    }
  }, [authHeaders, fetchConversations]);

  // ---- Global search across people / contacts / conversations / files / messages ----
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults({ people: [], conversations: [], messages: [], files: [] });
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const [peopleRes, messagesRes] = await Promise.all([
          fetch(`${API_BASE}/users/search?q=${encodeURIComponent(q)}`, { headers: authHeaders }),
          fetch(`${API_BASE}/messages/search?q=${encodeURIComponent(q)}`, { headers: authHeaders }),
        ]);
        const peopleData = await peopleRes.json();
        const messagesData = await messagesRes.json();
        const people = peopleData.status === 'success' ? peopleData.data : [];
        const messages = messagesData.status === 'success' ? messagesData.data : [];

        const lowerQ = q.toLowerCase();
        const matchedConversations = conversations.filter((c) => {
          const name = c.isGroup ? c.groupName : (c.participants.find(p => p._id !== user._id)?.username || '');
          return name.toLowerCase().includes(lowerQ);
        });
        const matchedFiles = files.filter((f) => f.filename.toLowerCase().includes(lowerQ));

        setSearchResults({ people, conversations: matchedConversations, messages, files: matchedFiles });
      } catch (err) {
        console.error(err);
      }
    }, 350);
    return () => clearTimeout(searchDebounceRef.current);
  }, [searchQuery, conversations, files, authHeaders, user._id]);

  // ---- Notifications derived from real data ----
  const notifications = useMemo(() => {
    const items = [];

    conversations.forEach((c) => {
      if (c.unreadcount > 0 && c.lastMessage) {
        const from = c.isGroup ? c.groupName : (c.participants.find(p => p._id !== user._id)?.username || 'Someone');
        items.push({
          id: `msg-${c._id}-${c.lastMessage._id || c.lastMessage}`,
          type: 'message',
          text: `${from} sent you a message`,
          time: c.updatedAt,
          onClick: () => { setActiveChat(c); setActiveTab('chats'); }
        });
      }
    });

    files.forEach((f) => {
      const isSharedWithMe = Array.isArray(f.sharedWith) && f.sharedWith.some(u => (u._id || u) === user._id);
      if (isSharedWithMe && f.owner && f.owner._id !== user._id) {
        items.push({
          id: `file-${f._id}`,
          type: 'file',
          text: `${f.owner.username || 'Someone'} shared a file: ${f.filename}`,
          time: f.createdAt,
          onClick: () => setActiveTab('files')
        });
      }
    });

    statuses.forEach((s) => {
      if (s.user && s.user._id !== user._id && new Date(s.updatedAt) > new Date(lastSeenStatusAt)) {
        items.push({
          id: `status-${s._id}`,
          type: 'status',
          text: `${s.user.username || 'Someone'} posted a new status`,
          time: s.updatedAt,
          onClick: () => setActiveTab('status')
        });
      }
    });

    pendingRequests.forEach((r) => {
      items.push({
        id: `connreq-${r.connectionId}`,
        type: 'connection',
        text: `${r.user?.username || 'Someone'} wants to connect with you`,
        time: r.requestedAt,
        onClick: () => setActiveTab('people')
      });
    });

    return items
      .filter((n) => !dismissedNotifIds.includes(n.id))
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 20);
  }, [conversations, files, statuses, pendingRequests, user._id, lastSeenStatusAt, dismissedNotifIds]);

  const handleOpenNotifications = () => {
    setShowNotifications((v) => !v);
  };

  const dismissAllNotifications = () => {
    const ids = notifications.map(n => n.id);
    const merged = Array.from(new Set([...dismissedNotifIds, ...ids]));
    setDismissedNotifIds(merged);
    try { localStorage.setItem('zoho_dismissed_notifs', JSON.stringify(merged)); } catch { /* noop */ }
  };

  const goToTab = (tabId, action = null) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
    setPendingAction(action);
    if (tabId === 'status') {
      const now = new Date().toISOString();
      setLastSeenStatusAt(now);
      try { localStorage.setItem('zoho_last_seen_status', now); } catch { /* noop */ }
    }
  };

  const totalUnreadConversations = conversations.filter(c => c.unreadcount > 0).length;
  const totalUnreadMessages = conversations.reduce((sum, c) => sum + (c.unreadcount || 0), 0);

  const hasSearchResults = searchResults.people.length || searchResults.conversations.length || searchResults.files.length || searchResults.messages.length;

  return (
    <div className="flex h-screen bg-[var(--bg-canvas)] text-slate-100 font-sans antialiased overflow-hidden select-none">
      <div className="cursor-glow" aria-hidden="true" />

      {/* ===== Desktop / Tablet Sidebar ===== */}
      <aside className={`hidden md:flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'w-[76px]' : 'w-60'}`}>
        <div className="flex items-center gap-2.5 p-4 border-b border-[var(--border-subtle)]">
          <div className="w-7 h-7 rounded-lg bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] flex items-center justify-center text-emerald-400 shrink-0">
            <Shield className="w-3.5 h-3.5" />
          </div>
          {!sidebarCollapsed && <span className="font-bold text-sm tracking-tight text-white truncate">ZoHo Web</span>}
          <button
            onClick={() => setSidebarCollapsed(v => !v)}
            className="ml-auto p-1 rounded-lg hover:bg-[var(--bg-hover)] text-slate-500 hover:text-slate-200 transition-colors"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Menu className="w-3.5 h-3.5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const badge = item.id === 'chats' && totalUnreadConversations > 0
              ? totalUnreadConversations
              : item.id === 'people' && pendingRequests.length > 0
                ? pendingRequests.length
                : null;
            return (
              <button
                key={item.id}
                onClick={() => goToTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative w-full flex items-center gap-3 pl-3.5 pr-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 ${isActive ? 'bg-[var(--bg-elevated)] text-white' : 'text-[var(--text-secondary)] hover:text-slate-100 hover:bg-[var(--bg-hover)]'}`}
              >
                {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-emerald-400" />}
                <Icon className={`w-[17px] h-[17px] shrink-0 transition-transform duration-150 ${isActive ? 'text-emerald-400' : 'group-hover:translate-x-0.5'}`} />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                {!sidebarCollapsed && badge && (
                  <span className="ml-auto bg-emerald-500 text-slate-950 font-bold text-[9px] px-1.5 py-0.5 rounded-full">{badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 space-y-1 border-t border-[var(--border-subtle)]">
          <button
            onClick={() => goToTab('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all hover:translate-x-0.5 ${activeTab === 'settings' ? 'bg-[var(--bg-hover)] text-white border border-[var(--border-strong)]' : 'text-slate-400 hover:text-slate-100 border border-transparent'}`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Settings</span>}
          </button>
          <button
            onClick={() => goToTab('profile')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all hover:translate-x-0.5 ${activeTab === 'profile' ? 'bg-[var(--bg-hover)] text-white border border-[var(--border-strong)]' : 'text-slate-400 hover:text-slate-100 border border-transparent'}`}
          >
            <User className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Profile</span>}
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent transition-all"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ===== Main column ===== */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="flex items-center gap-3 px-4 md:px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0 z-20">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-1.5 rounded-lg border border-[var(--border-subtle)] text-slate-400"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Global Search */}
          <div className="relative flex-1 max-w-md" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true); }}
              onFocus={() => setShowSearch(true)}
              placeholder="Search people, chats, files..."
              aria-label="Global search"
              className="w-full pl-9 pr-14 py-2 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 outline-none transition-all duration-150"
            />
            {!searchQuery && (
              <kbd className="hidden md:flex absolute right-2.5 top-1/2 -translate-y-1/2 items-center gap-0.5 px-1.5 py-0.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] text-[10px] font-mono-code text-slate-500 pointer-events-none">
                {navigator.platform?.toUpperCase().includes('MAC') ? '⌘' : 'Ctrl'}K
              </kbd>
            )}

            {showSearch && searchQuery.trim() && (
              <div className="absolute top-full left-0 mt-2 w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden z-30 animate-[fadeIn_0.15s_ease-out]">
                <div className="max-h-96 overflow-y-auto custom-scrollbar">
                  {!hasSearchResults ? (
                    <p className="text-slate-600 text-xs text-center py-6">No results for &quot;{searchQuery}&quot;</p>
                  ) : (
                    <>
                      {searchResults.people.length > 0 && (
                        <div className="p-2">
                          <p className="px-2 py-1 font-mono-code text-[9px] text-slate-500 uppercase tracking-wider">People</p>
                          {searchResults.people.map((p) => {
                            const relState = relationships[p._id]?.state || 'NONE';
                            const handleClick = () => {
                              if (relState === 'ACCEPTED') { startChatWithUser(p._id); }
                              else if (relState === 'NONE') { sendConnectionRequest(p._id); }
                              setSearchQuery('');
                              setShowSearch(false);
                            };
                            return (
                              <div
                                key={p._id}
                                onClick={handleClick}
                                className="flex items-center justify-between gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-[var(--bg-hover)]"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <img src={resolveUrl(p.profilePicture) || `https://api.dicebear.com/7.x/adventurer/svg?seed=${p.username}`} alt={p.username} className="w-7 h-7 rounded-lg object-cover shrink-0" />
                                  <span className="text-xs text-slate-200 font-medium truncate">{p.username || p.email}</span>
                                </div>
                                <span className="text-[9px] font-mono-code text-slate-500 shrink-0">
                                  {relState === 'ACCEPTED' ? 'Message' : relState === 'PENDING_SENT' ? 'Requested' : relState === 'PENDING_RECEIVED' ? 'Respond in People' : relState.startsWith('BLOCKED') ? '' : 'Connect'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {searchResults.conversations.length > 0 && (
                        <div className="p-2 border-t border-[var(--border-subtle)]">
                          <p className="px-2 py-1 font-mono-code text-[9px] text-slate-500 uppercase tracking-wider">Chats</p>
                          {searchResults.conversations.map((c) => (
                            <div
                              key={c._id}
                              onClick={() => { setActiveChat(c); setActiveTab('chats'); setSearchQuery(''); setShowSearch(false); }}
                              className="flex items-center gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-[var(--bg-hover)]"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-xs text-slate-200 font-medium">{c.isGroup ? c.groupName : c.participants.find(p => p._id !== user._id)?.username}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {searchResults.files.length > 0 && (
                        <div className="p-2 border-t border-[var(--border-subtle)]">
                          <p className="px-2 py-1 font-mono-code text-[9px] text-slate-500 uppercase tracking-wider">Files</p>
                          {searchResults.files.map((f) => (
                            <div
                              key={f._id}
                              onClick={() => { setActiveTab('files'); setSearchQuery(''); setShowSearch(false); }}
                              className="flex items-center gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-[var(--bg-hover)]"
                            >
                              <FileText className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-xs text-slate-200 font-medium truncate">{f.filename}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {searchResults.messages.length > 0 && (
                        <div className="p-2 border-t border-[var(--border-subtle)]">
                          <p className="px-2 py-1 font-mono-code text-[9px] text-slate-500 uppercase tracking-wider">Messages</p>
                          {searchResults.messages.map((m) => (
                            <div
                              key={m._id}
                              onClick={() => {
                                const conv = conversations.find(c => c._id === (m.conversation?._id || m.conversation));
                                if (conv) setActiveChat(conv);
                                setActiveTab('chats');
                                setSearchQuery('');
                                setShowSearch(false);
                              }}
                              className="flex flex-col gap-0.5 p-2 rounded-lg cursor-pointer hover:bg-[var(--bg-hover)]"
                            >
                              <span className="text-[10px] text-emerald-400 font-mono-code">{m.sender?.username}</span>
                              <span className="text-xs text-slate-300 truncate">&quot;{m.content}&quot;</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={handleOpenNotifications}
                className="relative p-2 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] text-slate-400 hover:text-slate-200 transition-colors"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-emerald-500 text-slate-950 text-[9px] font-bold rounded-full flex items-center justify-center animate-[fadeIn_0.2s_ease-out]">
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden z-30 animate-[fadeIn_0.15s_ease-out]">
                  <div className="flex items-center justify-between p-3 border-b border-[var(--border-subtle)]">
                    <span className="text-xs font-bold text-slate-100">Notifications</span>
                    {notifications.length > 0 && (
                      <button onClick={dismissAllNotifications} className="text-[10px] text-emerald-400 hover:text-emerald-300 font-mono-code">Clear all</button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 ? (
                      <p className="text-slate-600 text-xs text-center py-8">You&apos;re all caught up.</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => { n.onClick(); setShowNotifications(false); }}
                          className="flex items-start gap-2.5 p-3 cursor-pointer hover:bg-[var(--bg-hover)] border-b border-[var(--border-subtle)]/50 last:border-0"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0"></span>
                          <div className="min-w-0">
                            <p className="text-xs text-slate-200 leading-snug">{n.text}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 font-mono-code">{new Date(n.time).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Avatar dropdown */}
            <div className="relative" ref={avatarRef}>
              <button onClick={() => setShowAvatarMenu(v => !v)} className="flex items-center gap-1 group">
                <img
                  src={resolveUrl(user.profilePicture) || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`}
                  alt={user.username}
                  className="w-8 h-8 rounded-lg object-cover border border-[var(--border-strong)] group-hover:border-emerald-500/60 transition-colors"
                />
                <ChevronDown className="w-3 h-3 text-slate-500 hidden md:block" />
              </button>
              {showAvatarMenu && (
                <div className="absolute top-full right-0 mt-2 w-44 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden z-30 animate-[fadeIn_0.15s_ease-out] py-1">
                  <button onClick={() => { goToTab('profile'); setShowAvatarMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-[var(--bg-hover)] hover:text-slate-100">
                    <User className="w-3.5 h-3.5" /> Profile
                  </button>
                  <button onClick={() => { goToTab('settings'); setShowAvatarMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-[var(--bg-hover)] hover:text-slate-100">
                    <Settings className="w-3.5 h-3.5" /> Settings
                  </button>
                  <div className="border-t border-[var(--border-subtle)] my-1"></div>
                  <button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:bg-rose-500/10 hover:text-rose-400">
                    <LogOut className="w-3.5 h-3.5" /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Active view */}
        <main className="flex-1 min-h-0 overflow-hidden pb-14 md:pb-0">
        <div key={activeTab} className="h-full min-h-0 animate-page-in">
          {activeTab === 'home' && (
            <HomeView
              user={user}
              conversations={conversations}
              conversationsLoading={conversationsLoading}
              conversationsError={conversationsError}
              files={files}
              contacts={contacts}
              statuses={statuses}
              unreadMessages={totalUnreadMessages}
              onlineUsers={onlineUsers}
              onGoToTab={goToTab}
              onOpenChat={(c) => { setActiveChat(c); goToTab('chats'); }}
              onOpenPerson={(userId) => startChatWithUser(userId)}
            />
          )}
          {activeTab === 'chats' && (
            <ChatsView
              user={user}
              socket={socket}
              onlineUsers={onlineUsers}
              conversations={conversations}
              conversationsLoading={conversationsLoading}
              conversationsError={conversationsError}
              fetchConversations={fetchConversations}
              activeChat={activeChat}
              setActiveChat={setActiveChat}
              onOpenPeople={() => goToTab('people')}
              contacts={contacts}
              relationships={relationships}
              startChatWithUser={startChatWithUser}
              sendConnectionRequest={sendConnectionRequest}
              removeContact={removeContact}
              blockUser={blockUser}
              unblockUser={unblockUser}
              autoOpenNewChat={pendingAction === 'newChat'}
              onAutoTriggerHandled={() => setPendingAction(null)}
            />
          )}
          {activeTab === 'people' && (
            <PeopleView
              user={user}
              allUsers={allUsers}
              fetchAllUsers={fetchAllUsers}
              contacts={contacts}
              pendingRequests={pendingRequests}
              relationships={relationships}
              onlineUsers={onlineUsers}
              onMessage={startChatWithUser}
              sendConnectionRequest={sendConnectionRequest}
              acceptConnection={acceptConnection}
              declineConnection={declineConnection}
              removeContact={removeContact}
              blockUser={blockUser}
              unblockUser={unblockUser}
              authHeaders={authHeaders}
            />
          )}
          {activeTab === 'status' && (
            <StatusView
              user={user}
              statuses={statuses}
              fetchStatuses={fetchStatuses}
              autoOpenCreate={pendingAction === 'postStatus'}
              onAutoTriggerHandled={() => setPendingAction(null)}
              onGoToSettings={() => goToTab('settings')}
            />
          )}
          {activeTab === 'files' && (
            <FilesView
              user={user}
              files={files}
              fetchFiles={fetchFiles}
              allUsers={allUsers}
              autoOpenUpload={pendingAction === 'upload'}
              onAutoTriggerHandled={() => setPendingAction(null)}
            />
          )}
          {(activeTab === 'settings' || activeTab === 'profile') && (
            <ProfileSettingsView
              user={user}
              onProfileUpdate={onProfileUpdate}
              mode={activeTab}
              authHeaders={authHeaders}
              contactsCount={contacts.length}
              filesCount={files.filter(f => f.owner?._id === user._id).length}
              onlineUsers={onlineUsers}
            />
          )}
        </div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 h-14 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] flex items-center justify-around z-20">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const badge = item.id === 'chats' && totalUnreadConversations > 0
              ? totalUnreadConversations
              : item.id === 'people' && pendingRequests.length > 0
                ? pendingRequests.length
                : null;
            return (
              <button
                key={item.id}
                onClick={() => goToTab(item.id)}
                className="relative flex flex-col items-center gap-0.5 flex-1 py-1.5"
              >
                <Icon className={`${isActive ? 'text-emerald-400' : 'text-slate-500'}`} style={{ width: 18, height: 18 }} />
                <span className={`text-[9px] font-medium ${isActive ? 'text-emerald-400' : 'text-slate-500'}`}>{item.label}</span>
                {badge && <span className="absolute top-0 right-1/4 w-3.5 h-3.5 bg-emerald-500 text-slate-950 text-[8px] font-bold rounded-full flex items-center justify-center">{badge}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Mobile slide-in menu (Settings / Profile / Logout) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] p-4 flex flex-col animate-[slideIn_0.2s_ease-out]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs text-slate-100">ZoHo Web</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="text-slate-500"><X className="w-4 h-4" /></button>
            </div>
            <button onClick={() => goToTab('settings')} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-[var(--bg-hover)]">
              <Settings className="w-4 h-4" /> Settings
            </button>
            <button onClick={() => goToTab('profile')} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-[var(--bg-hover)]">
              <User className="w-4 h-4" /> Profile
            </button>
            <button onClick={onLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 mt-auto">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
