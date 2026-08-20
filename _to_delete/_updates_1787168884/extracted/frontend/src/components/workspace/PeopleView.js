import React, { useState, useMemo, useEffect } from 'react';
import { Search, Users, MessageSquare } from 'lucide-react';

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

export default function PeopleView({ user, allUsers, fetchAllUsers, onlineUsers, onMessage }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchAllUsers()
      .catch(() => setError('Unable to load people.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allUsers;
    return allUsers.filter(u =>
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  }, [allUsers, query]);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 md:p-8">
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">People</h1>
          <p className="text-xs text-slate-500 mt-1">Discover and message registered ZoHo Web users.</p>
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

        {loading ? (
          <p className="text-xs text-slate-500 text-center py-10">Loading people...</p>
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-xs text-rose-400 mb-2">{error}</p>
            <button onClick={() => { setError(''); setLoading(true); fetchAllUsers().finally(() => setLoading(false)); }} className="text-[11px] text-emerald-400 hover:underline">Try again</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-10 text-center">
            <Users className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-xs font-semibold text-slate-300">No other users found.</p>
            <p className="text-[11px] text-slate-600 mt-1">Invite teammates to join ZoHo Web.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((u) => {
              const isOnline = onlineUsers.includes(u._id);
              return (
                <div key={u._id} className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all">
                  <div className="relative shrink-0">
                    <img
                      src={u.profilePicture || `https://api.dicebear.com/7.x/adventurer/svg?seed=${u.username}`}
                      alt={u.username}
                      className="w-11 h-11 rounded-xl object-cover border border-[var(--border-subtle)]"
                    />
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--bg-surface)] ${isOnline ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-100 truncate">{u.username || 'Unnamed user'}</p>
                    <p className="text-[11px] text-slate-500 truncate">{u.email || u.phoneNumber}</p>
                    <p className={`text-[10px] font-mono-code mt-0.5 ${isOnline ? 'text-emerald-400' : 'text-slate-600'}`}>{lastSeenLabel(u, isOnline)}</p>
                    {u.about && <p className="text-[10px] text-slate-500 mt-0.5 truncate italic">{u.about}</p>}
                  </div>
                  <button
                    onClick={() => onMessage(u._id)}
                    className="active-press shrink-0 flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors"
                  >
                    <MessageSquare className="w-3 h-3" /> Message
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
