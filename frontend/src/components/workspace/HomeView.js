import React from 'react';
import { MessageSquare, Bell, FileText, Image as ImageIcon, Video as VideoIcon, AlertCircle, UserPlus, UploadCloud, Circle } from 'lucide-react';
import { resolveUrl } from '../../utils/media';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function fileIcon(type) {
  if (type === 'image') return ImageIcon;
  if (type === 'video') return VideoIcon;
  return FileText;
}

function avatarFor(nameOrUser, seed) {
  return resolveUrl(nameOrUser) || `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Real, derived-from-your-data activity chart — no mock numbers. Buckets
// file uploads and last-message timestamps (both already in props) into the
// last 7 calendar days. Renders as a small bar strip on Home so the page
// has more than static cards on it.
function weeklyActivity(files, conversations) {
  const days = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days.map((day) => {
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const fileCount = files.filter((f) => {
      const t = f.createdAt ? new Date(f.createdAt) : null;
      return t && t >= day && t < next;
    }).length;
    const msgCount = conversations.filter((c) => {
      const t = c.lastMessage?.createdAt ? new Date(c.lastMessage.createdAt) : null;
      return t && t >= day && t < next;
    }).length;
    return { label: DAY_LABELS[day.getDay()], date: day, count: fileCount + msgCount };
  });
}

const QUICK_ACTIONS = [
  { id: 'newChat', tab: 'chats', label: 'New Chat', icon: MessageSquare },
  { id: 'upload', tab: 'files', label: 'Upload File', icon: UploadCloud },
  { id: 'addContact', tab: 'people', label: 'Add Contact', icon: UserPlus },
  { id: 'postStatus', tab: 'status', label: 'Post Status', icon: Circle },
];

export default function HomeView({ user, conversations, conversationsLoading, conversationsError, files, contacts = [], statuses = [], unreadMessages = 0, onlineUsers, onGoToTab, onOpenChat, onOpenPerson }) {
  const activeConversations = conversations.length;

  const onlineContacts = contacts.filter(c => c.user && onlineUsers.includes(c.user._id)).slice(0, 5);
  const statusAuthors = statuses.filter(s => s.user).slice(0, 6);

  const recentConversations = [...conversations]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 4);

  const recentFiles = [...files]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 4);

  // Real recent-activity feed: merge recent conversations + recent files
  // into one reverse-chronological list instead of two separate blocks.
  const recentActivity = [
    ...conversations.map(c => ({
      kind: 'message',
      id: `conv-${c._id}`,
      time: c.lastMessage?.createdAt || c.updatedAt,
      data: c,
    })).filter(a => a.data.lastMessage),
    ...files.map(f => ({
      kind: 'file',
      id: `file-${f._id}`,
      time: f.createdAt,
      data: f,
    })),
  ]
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 6);

  const isEmpty = !conversationsLoading && conversations.length === 0 && files.length === 0 && contacts.length === 0;
  const weekActivity = weeklyActivity(files, conversations);
  const weekMax = Math.max(1, ...weekActivity.map((d) => d.count));
  const filesThisWeek = files.filter(f => Date.now() - new Date(f.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000).length;
  const onlineContactsCount = contacts.filter(c => c.user && onlineUsers.includes(c.user._id)).length;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">

        {conversationsError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {conversationsError}
          </div>
        )}

        {/* Hero — greeting + at-a-glance summary + quick actions in one composed panel,
            not a grid of cards. Faint radial glow gives depth without a 3D centerpiece. */}
        <div
          className="relative rounded-2xl border border-[var(--border-subtle)] overflow-hidden animate-page-in"
          style={{ background: 'radial-gradient(120% 140% at 8% 0%, rgba(16,185,129,0.09), transparent 55%), var(--bg-surface)' }}
        >
          <div className="relative p-6 md:p-7">
            <h1 className="text-2xl md:text-[28px] font-bold text-slate-100 tracking-tight leading-tight">{greeting()}, {user.username}</h1>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1.5">Your workspace at a glance.</p>

            {!isEmpty && (
              <p className="text-xs text-slate-400 mt-4 leading-relaxed max-w-lg">
                {activeConversations > 0 ? <span className="text-slate-200 font-semibold">{activeConversations} conversation{activeConversations !== 1 ? 's' : ''}</span> : 'No conversations'}
                {unreadMessages > 0 && <> &middot; <span className="text-emerald-400 font-semibold">{unreadMessages} unread</span></>}
                {filesThisWeek > 0 && <> &middot; <span className="text-slate-200 font-semibold">{filesThisWeek} new file{filesThisWeek !== 1 ? 's' : ''}</span> this week</>}
                {onlineContactsCount > 0 && <> &middot; <span className="text-slate-200 font-semibold">{onlineContactsCount} contact{onlineContactsCount !== 1 ? 's' : ''}</span> online</>}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-5">
              <button onClick={() => onGoToTab('chats')} className="active-press text-xs font-semibold px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors">Open Chats</button>
              <button onClick={() => onGoToTab('people')} className="active-press text-xs font-semibold px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-slate-300 hover:bg-[var(--bg-hover)] transition-colors">View Activity</button>

              <div className="hidden md:block w-px h-5 bg-[var(--border-subtle)] mx-1" />

              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => onGoToTab(action.tab, action.id)}
                    className="active-press flex items-center gap-1.5 text-[11.5px] font-semibold px-3 py-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5 text-emerald-400/80" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {isEmpty ? (
          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-10 text-center">
            <div className="w-12 h-12 rounded-xl bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] flex items-center justify-center text-emerald-400 mx-auto mb-4">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h2 className="text-sm font-semibold text-slate-200">Your workspace is ready.</h2>
            <p className="text-xs text-slate-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
              Find people, start a conversation, or upload your first file.
            </p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button onClick={() => onGoToTab('people')} className="active-press text-xs font-semibold px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950">Find people</button>
              <button onClick={() => onGoToTab('files')} className="active-press text-xs font-semibold px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-slate-300 hover:bg-[var(--bg-hover)]">Upload a file</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">

            {/* Left column — the primary, denser content: activity feed + conversations */}
            <div className="space-y-6 min-w-0">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[15px] font-bold text-slate-100">Recent activity</h2>
                </div>
                <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden">
                  {recentActivity.length === 0 ? (
                    <div className="py-10 text-center">
                      <Bell className="w-5 h-5 text-slate-600 mx-auto mb-2" />
                      <p className="text-xs text-slate-500">You&apos;re all caught up.</p>
                      <p className="text-[11px] text-slate-600 mt-1">Start a chat or share a file to see it here.</p>
                    </div>
                  ) : (
                    recentActivity.map((a, idx) => {
                      if (a.kind === 'message') {
                        const c = a.data;
                        const partner = c.isGroup ? null : c.participants.find(p => p._id !== user._id);
                        const name = c.isGroup ? c.groupName : (partner?.username || 'User');
                        const avatar = avatarFor(c.isGroup ? c.groupAvatar : partner?.profilePicture, name);
                        return (
                          <div key={a.id} style={{ '--i': idx }} onClick={() => onOpenChat(c)} className="stagger-item flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--bg-hover)] border-b border-[var(--border-subtle)]/50 last:border-0 transition-colors duration-150">
                            <img src={avatar} alt={name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-semibold text-slate-100 truncate">{name}</p>
                              <p className="text-[11.5px] text-[var(--text-secondary)] truncate">{c.lastMessage ? (c.lastMessage.content || 'Sent an attachment') : 'No messages yet'}</p>
                            </div>
                            {c.unreadcount > 0 && <span className="ml-auto bg-emerald-500 text-slate-950 font-bold text-[9px] px-1.5 py-0.5 rounded-full shrink-0">{c.unreadcount}</span>}
                          </div>
                        );
                      }
                      const f = a.data;
                      const Icon = fileIcon(f.fileType);
                      return (
                        <div key={a.id} style={{ '--i': idx }} onClick={() => onGoToTab('files')} className="stagger-item flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--bg-hover)] border-b border-[var(--border-subtle)]/50 last:border-0 transition-colors duration-150">
                          <div className="w-9 h-9 rounded-lg bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] flex items-center justify-center text-emerald-400 shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-slate-100 truncate">{f.filename}</p>
                            <p className="text-[11.5px] text-[var(--text-secondary)] truncate">{(f.fileSize / 1024 / 1024).toFixed(1)} MB &middot; {f.owner?._id === user._id ? 'Uploaded by you' : `Shared by ${f.owner?.username || 'someone'}`}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[15px] font-bold text-slate-100">Conversations</h2>
                  <button onClick={() => onGoToTab('chats')} className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium">View all</button>
                </div>
                {recentConversations.length === 0 ? (
                  <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-8 text-center">
                    <p className="text-xs text-slate-400 font-medium">No conversations yet</p>
                    <p className="text-[11px] text-slate-600 mt-1 mb-4">Find people you know and start a conversation.</p>
                    <button onClick={() => onGoToTab('people')} className="active-press text-[11px] font-semibold px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950">Find People</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {recentConversations.map((c, idx) => {
                      const partner = c.isGroup ? null : c.participants.find(p => p._id !== user._id);
                      const name = c.isGroup ? c.groupName : (partner?.username || 'User');
                      const avatar = avatarFor(c.isGroup ? c.groupAvatar : partner?.profilePicture, name);
                      const isOnline = partner && onlineUsers.includes(partner._id);
                      return (
                        <div key={c._id} style={{ '--i': idx }} onClick={() => onOpenChat(c)} className="stagger-item hover-lift flex items-center gap-2.5 p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors duration-150">
                          <div className="relative shrink-0">
                            <img src={avatar} alt={name} className="w-9 h-9 rounded-full object-cover" />
                            {isOnline && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[var(--bg-surface)]" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-100 truncate">{name}</p>
                            <p className="text-[10.5px] text-[var(--text-secondary)] truncate">{c.lastMessage ? c.lastMessage.content || 'Sent an attachment' : 'No messages yet'}</p>
                          </div>
                          {c.unreadcount > 0 && <span className="bg-emerald-500 text-slate-950 font-bold text-[9px] px-1.5 py-0.5 rounded-full shrink-0">{c.unreadcount}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right column — narrower, glanceable widgets */}
            <div className="space-y-5">
              {!isEmpty && weekActivity.some((d) => d.count > 0) && (
                <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4">
                  <h3 className="text-[13px] font-bold text-slate-200 mb-3">Activity this week</h3>
                  <div className="flex items-end justify-between gap-1.5 h-16">
                    {weekActivity.map((d, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1.5" title={`${d.count} update${d.count === 1 ? '' : 's'}`}>
                        <div className="w-full rounded-md bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] overflow-hidden flex items-end h-11">
                          <div
                            className="w-full rounded-md bg-emerald-500/70 hover-lift"
                            style={{
                              height: `${Math.max(8, (d.count / weekMax) * 100)}%`,
                              transition: 'height 500ms var(--ease-out)',
                              transitionDelay: `${idx * 40}ms`,
                            }}
                          />
                        </div>
                        <span className="text-[9px] text-slate-600 font-mono-code">{d.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-bold text-slate-200">Status</h3>
                  <button onClick={() => onGoToTab('status')} className="text-[10.5px] text-emerald-400 hover:text-emerald-300 font-medium">View all</button>
                </div>
                <div className="flex items-center gap-3 overflow-x-auto scrollbar-none pb-0.5">
                  <button onClick={() => onGoToTab('status', 'postStatus')} className="flex flex-col items-center gap-1 shrink-0">
                    <div className="w-10 h-10 rounded-full border border-dashed border-[var(--border-strong)] flex items-center justify-center text-emerald-400 hover:border-emerald-500/60 transition-colors">
                      <UserPlus className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[9px] text-slate-500">You</span>
                  </button>
                  {statusAuthors.length === 0 ? (
                    <p className="text-[11px] text-slate-500 ml-1">No updates yet.</p>
                  ) : (
                    statusAuthors.map((s) => (
                      <button key={s._id} onClick={() => onGoToTab('status')} className="flex flex-col items-center gap-1 shrink-0">
                        <div className="w-10 h-10 rounded-full p-[1.5px] border-2 border-emerald-500">
                          <img src={avatarFor(s.user.profilePicture, s.user.username)} alt={s.user.username} className="w-full h-full rounded-full object-cover" />
                        </div>
                        <span className="text-[9px] text-slate-500 truncate max-w-[42px]">{s.user.username}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-bold text-slate-200">People online</h3>
                  <button onClick={() => onGoToTab('people')} className="text-[10.5px] text-emerald-400 hover:text-emerald-300 font-medium">View all</button>
                </div>
                {onlineContacts.length === 0 ? (
                  <p className="text-[11px] text-slate-500">No contacts online right now.</p>
                ) : (
                  <div className="space-y-1.5">
                    {onlineContacts.map(({ user: u, connectionId }) => (
                      <button key={connectionId} onClick={() => onOpenPerson && onOpenPerson(u._id)} className="w-full flex items-center gap-2 hover:bg-[var(--bg-hover)] rounded-lg px-1.5 py-1.5 -mx-1.5 transition-colors duration-150">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full shrink-0"></span>
                        <span className="text-[11.5px] text-slate-300 truncate">{u.username}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-bold text-slate-200">Recent files</h3>
                  <button onClick={() => onGoToTab('files')} className="text-[10.5px] text-emerald-400 hover:text-emerald-300 font-medium">View all</button>
                </div>
                <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden">
                  {recentFiles.length === 0 ? (
                    <p className="text-[11px] text-slate-500 text-center py-6">No files yet.</p>
                  ) : (
                    recentFiles.map((f) => {
                      const Icon = fileIcon(f.fileType);
                      return (
                        <div key={f._id} onClick={() => onGoToTab('files')} className="flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer hover:bg-[var(--bg-hover)] border-b border-[var(--border-subtle)]/50 last:border-0 transition-colors duration-150">
                          <div className="w-7 h-7 rounded-lg bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] flex items-center justify-center text-emerald-400 shrink-0">
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11.5px] font-semibold text-slate-100 truncate">{f.filename}</p>
                            <p className="text-[10px] text-slate-500 truncate">{(f.fileSize / 1024 / 1024).toFixed(1)} MB</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
