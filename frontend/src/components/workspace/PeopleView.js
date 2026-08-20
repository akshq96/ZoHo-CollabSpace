import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search, Users, MessageSquare, UserPlus, MoreVertical, UserMinus, User as UserIcon,
  X, Check, Clock, Ban, UserCheck
} from 'lucide-react';
import { resolveUrl } from '../../utils/media';
import { API_BASE } from '../../config';

function lastSeenLabel(user, isOnline) {
  if (isOnline) return 'Online';
  if (!user.lastSeen) return 'Offline';
  const diffMs = Date.now() - new Date(user.lastSeen).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Last seen just now';
  if (mins < 60) return `Last seen ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Last seen ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `Last seen ${days}d ago`;
}

function avatarFor(u) {
  return resolveUrl(u.profilePicture) || `https://api.dicebear.com/7.x/adventurer/svg?seed=${u.username}`;
}

export default function PeopleView({
  user, allUsers, fetchAllUsers, onlineUsers, onMessage,
  contacts = [], pendingRequests = [], relationships = {},
  sendConnectionRequest, acceptConnection, declineConnection, removeContact, blockUser,
  unblockUser, authHeaders
}) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [busyIds, setBusyIds] = useState(new Set());
  const [confirmRemove, setConfirmRemove] = useState(null); // { userId, username }
  const [confirmBlock, setConfirmBlock] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [viewProfile, setViewProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('contacts');
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchAllUsers()
      .catch(() => setError('Unable to load people.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBlockedUsers = useCallback(async () => {
    if (!authHeaders) return;
    try {
      const res = await fetch(`${API_BASE}/connections/blocked`, { headers: authHeaders });
      const data = await res.json();
      if (data.status === 'success') setBlockedUsers(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setBlockedLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { fetchBlockedUsers(); }, [fetchBlockedUsers]);

  const handleUnblock = async (userId) => {
    if (!unblockUser) return;
    setBusyIds(prev => new Set(prev).add(userId));
    await unblockUser(userId);
    await fetchBlockedUsers();
    setBusyIds(prev => { const next = new Set(prev); next.delete(userId); return next; });
  };

  const withBusy = async (userId, fn) => {
    setBusyIds(prev => new Set(prev).add(userId));
    await fn(userId);
    setBusyIds(prev => { const next = new Set(prev); next.delete(userId); return next; });
  };

  const myContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts
      .filter(c => c.user)
      .filter(c => !q || (c.user.username && c.user.username.toLowerCase().includes(q)) || (c.user.email && c.user.email.toLowerCase().includes(q)))
      .sort((a, b) => (a.user.username || '').localeCompare(b.user.username || ''));
  }, [contacts, query]);

  // Discover People: everyone that isn't already an accepted contact, isn't
  // a pending request in either direction, and isn't blocked either way —
  // those all get their own affordances elsewhere (My Contacts, Connection
  // Requests, or nowhere at all for a block).
  const discoverPeople = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allUsers
      .filter(u => u._id !== user._id)
      .filter(u => {
        const state = relationships[u._id]?.state || 'NONE';
        return state === 'NONE' || state === 'PENDING_SENT';
      })
      .filter(u => !q || (u.username && u.username.toLowerCase().includes(q)) || (u.email && u.email.toLowerCase().includes(q)));
  }, [allUsers, relationships, query, user._id]);

  const handleConnect = (userId) => withBusy(userId, sendConnectionRequest);
  const handleAccept = (userId) => withBusy(userId, acceptConnection);
  const handleDecline = (userId) => withBusy(userId, declineConnection);

  const handleConfirmRemove = async () => {
    if (!confirmRemove || !removeContact) return;
    setRemoving(true);
    await removeContact(confirmRemove.userId);
    setRemoving(false);
    setConfirmRemove(null);
  };

  const handleConfirmBlock = async () => {
    if (!confirmBlock || !blockUser) return;
    setRemoving(true);
    await blockUser(confirmBlock.userId);
    await fetchBlockedUsers();
    setRemoving(false);
    setConfirmBlock(null);
    setOpenMenuId(null);
  };

  const TABS = [
    { id: 'contacts', label: 'Contacts', count: myContacts.length },
    { id: 'requests', label: 'Requests', count: pendingRequests.length },
    { id: 'discover', label: 'Discover', count: discoverPeople.length },
    { id: 'blocked', label: 'Blocked', count: blockedUsers.length },
  ];

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 md:p-8">
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">People</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">Find people and connect with them.</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people..."
            className="w-full pl-9 pr-3 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-emerald-500/60 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 outline-none transition-colors"
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-[var(--border-subtle)]">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`relative flex items-center gap-1.5 px-3.5 py-2.5 text-[12.5px] font-semibold transition-colors duration-150 ${activeTab === t.id ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {t.label}
              {t.count > 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === t.id ? 'bg-emerald-500 text-slate-950' : 'bg-[var(--bg-surface-2)] text-slate-400'}`}>{t.count}</span>}
              {activeTab === t.id && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-400 rounded-full" />}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-xs text-slate-500 text-center py-10">Loading people...</p>
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-xs text-rose-400 mb-2">{error}</p>
            <button onClick={() => { setError(''); setLoading(true); fetchAllUsers().finally(() => setLoading(false)); }} className="text-[11px] text-emerald-400 hover:underline">Try again</button>
          </div>
        ) : (
          <>
            {/* My Contacts */}
            {activeTab === 'contacts' && (
            <div className="space-y-2">
              {myContacts.length === 0 ? (
                <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 text-center">
                  <p className="text-xs text-slate-400">No contacts yet.</p>
                  <p className="text-[11px] text-slate-600 mt-1">Discover people below and send a connection request.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myContacts.map(({ user: u, connectionId }) => {
                    const isOnline = onlineUsers.includes(u._id);
                    return (
                      <div key={connectionId} className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all relative">
                        <div className="relative shrink-0">
                          <img src={avatarFor(u)} alt={u.username} className="w-11 h-11 rounded-xl object-cover border border-[var(--border-subtle)]" />
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--bg-surface)] ${isOnline ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-100 truncate">{u.username || 'Unnamed user'}</p>
                          <p className="text-[11px] text-slate-500 truncate">{u.email || u.phoneNumber}</p>
                          <p className={`text-[10px] font-mono-code mt-0.5 ${isOnline ? 'text-emerald-400' : 'text-slate-600'}`}>{lastSeenLabel(u, isOnline)}</p>
                        </div>
                        <button
                          onClick={() => onMessage(u._id)}
                          className="active-press shrink-0 flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors"
                        >
                          <MessageSquare className="w-3 h-3" /> Message
                        </button>
                        <div className="relative shrink-0">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === connectionId ? null : connectionId)}
                            className="p-2 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                          {openMenuId === connectionId && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                              <div className="absolute top-full right-0 mt-1 w-44 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden z-20 py-1">
                                <button onClick={() => { setOpenMenuId(null); setViewProfile(u); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-[var(--bg-hover)] hover:text-slate-100">
                                  <UserIcon className="w-3.5 h-3.5" /> View profile
                                </button>
                                <div className="border-t border-[var(--border-subtle)] my-1"></div>
                                <button onClick={() => { setOpenMenuId(null); setConfirmRemove({ userId: u._id, username: u.username }); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10">
                                  <UserMinus className="w-3.5 h-3.5" /> Remove contact
                                </button>
                                <button onClick={() => { setOpenMenuId(null); setConfirmBlock({ userId: u._id, username: u.username }); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10">
                                  <Ban className="w-3.5 h-3.5" /> Block user
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}

            {/* Connection Requests */}
            {activeTab === 'requests' && (
            <div className="space-y-2">
              {pendingRequests.length === 0 ? (
                <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 text-center">
                  <p className="text-xs text-slate-400">No connection requests yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingRequests.map(({ user: u, connectionId }) => {
                    const isBusy = busyIds.has(u._id);
                    return (
                      <div key={connectionId} className="p-3 rounded-2xl bg-[var(--bg-surface)] border border-emerald-500/20">
                        <div className="flex items-center gap-3">
                          <img src={avatarFor(u)} alt={u.username} className="w-11 h-11 rounded-xl object-cover border border-[var(--border-subtle)] shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-100 truncate">{u.username || 'Unnamed user'}</p>
                            <p className="text-[11px] text-slate-500 truncate">{u.email || u.phoneNumber}</p>
                            <p className="text-[11px] text-emerald-400 mt-0.5">wants to connect with you</p>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleAccept(u._id)}
                            disabled={isBusy}
                            className="flex-1 active-press flex items-center justify-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 transition-colors"
                          >
                            <Check className="w-3 h-3" /> Accept
                          </button>
                          <button
                            onClick={() => handleDecline(u._id)}
                            disabled={isBusy}
                            className="flex-1 active-press flex items-center justify-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] disabled:opacity-50 text-slate-300 transition-colors"
                          >
                            <X className="w-3 h-3" /> Decline
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}

            {/* Discover People */}
            {activeTab === 'discover' && (
            <div className="space-y-2">
              {discoverPeople.length === 0 ? (
                <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-10 text-center">
                  <Users className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                  <p className="text-xs font-semibold text-slate-300">No one new to discover.</p>
                  <p className="text-[11px] text-slate-600 mt-1">Invite teammates to join ZoHo Web.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {discoverPeople.map((u) => {
                    const isOnline = onlineUsers.includes(u._id);
                    const state = relationships[u._id]?.state || 'NONE';
                    const isBusy = busyIds.has(u._id);
                    return (
                      <div key={u._id} className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all">
                        <div className="relative shrink-0">
                          <img src={avatarFor(u)} alt={u.username} className="w-11 h-11 rounded-xl object-cover border border-[var(--border-subtle)]" />
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--bg-surface)] ${isOnline ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-100 truncate">{u.username || 'Unnamed user'}</p>
                          <p className="text-[11px] text-slate-500 truncate">{u.email || u.phoneNumber}</p>
                          <p className={`text-[10px] font-mono-code mt-0.5 ${isOnline ? 'text-emerald-400' : 'text-slate-600'}`}>{lastSeenLabel(u, isOnline)}</p>
                        </div>
                        {state === 'PENDING_SENT' ? (
                          <span className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-slate-400">
                            <Clock className="w-3 h-3" /> Request Sent
                          </span>
                        ) : (
                          <button
                            onClick={() => handleConnect(u._id)}
                            disabled={isBusy}
                            className="active-press shrink-0 flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] disabled:opacity-50 text-slate-300 hover:text-slate-100 transition-colors"
                          >
                            <UserPlus className="w-3 h-3" /> {isBusy ? 'Sending...' : 'Connect'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}

            {/* Blocked Users */}
            {activeTab === 'blocked' && (
            <div className="space-y-2">
              {blockedLoading ? (
                <p className="text-xs text-slate-500 text-center py-10">Loading blocked users...</p>
              ) : blockedUsers.length === 0 ? (
                <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-10 text-center">
                  <Ban className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                  <p className="text-xs font-semibold text-slate-300">No blocked users.</p>
                  <p className="text-[11px] text-slate-600 mt-1">Anyone you block will show up here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {blockedUsers.map((u) => {
                    const isBusy = busyIds.has(u._id);
                    return (
                      <div key={u._id} className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                        <img src={avatarFor(u)} alt={u.username} className="w-10 h-10 rounded-xl object-cover border border-[var(--border-subtle)] shrink-0 grayscale opacity-70" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-300 truncate">{u.username || 'Unnamed user'}</p>
                          <p className="text-[11px] text-slate-600 truncate">{u.email || u.phoneNumber}</p>
                        </div>
                        <button
                          onClick={() => handleUnblock(u._id)}
                          disabled={isBusy}
                          className="active-press shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] disabled:opacity-50 text-slate-300 transition-colors"
                        >
                          {isBusy ? 'Unblocking...' : 'Unblock'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}
          </>
        )}
      </div>

      {/* Remove-contact confirmation */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setConfirmRemove(null)}>
          <div className="w-full max-w-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-100">Remove contact?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Remove <span className="text-slate-200 font-semibold">{confirmRemove.username}</span> from your contacts. Your chat history with them will be kept, but you'll need to reconnect before messaging again.
              </p>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setConfirmRemove(null)} className="flex-1 active-press border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] text-slate-300 font-semibold py-2 px-3 rounded-xl text-xs">Cancel</button>
                <button onClick={handleConfirmRemove} disabled={removing} className="flex-1 active-press bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-slate-950 font-bold py-2 px-3 rounded-xl text-xs">
                  {removing ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Block confirmation */}
      {confirmBlock && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setConfirmBlock(null)}>
          <div className="w-full max-w-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-100">Block {confirmBlock.username}?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                They won't be able to message you, send connection requests, or see your status. You can unblock them later from the Blocked tab here, or Settings &gt; Privacy.
              </p>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setConfirmBlock(null)} className="flex-1 active-press border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] text-slate-300 font-semibold py-2 px-3 rounded-xl text-xs">Cancel</button>
                <button onClick={handleConfirmBlock} disabled={removing} className="flex-1 active-press bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-slate-950 font-bold py-2 px-3 rounded-xl text-xs">
                  {removing ? 'Blocking...' : 'Block'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick profile viewer */}
      {viewProfile && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setViewProfile(null)}>
          <div className="w-full max-w-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
              <h3 className="font-semibold text-sm text-slate-100">Profile</h3>
              <button onClick={() => setViewProfile(null)} className="text-slate-500 hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 flex flex-col items-center text-center gap-2">
              <img src={avatarFor(viewProfile)} alt={viewProfile.username} className="w-20 h-20 rounded-full object-cover border border-[var(--border-strong)]" />
              <h2 className="text-sm font-bold text-slate-100">{viewProfile.username}</h2>
              <p className="text-xs text-slate-500">{viewProfile.email || viewProfile.phoneNumber}</p>
              {viewProfile.about && <p className="text-[11px] text-slate-400 italic mt-1">{viewProfile.about}</p>}
              <span className="flex items-center gap-1.5 text-[10px] font-mono-code text-emerald-400 mt-1"><UserCheck className="w-3 h-3" /> Connected</span>
              <button onClick={() => { setViewProfile(null); onMessage(viewProfile._id); }} className="mt-3 active-press flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950">
                <MessageSquare className="w-3.5 h-3.5" /> Message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
