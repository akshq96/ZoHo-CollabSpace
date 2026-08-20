import React from 'react';
import { MessageSquare, Folder, Bell, Users, FileText, Image as ImageIcon, Video as VideoIcon, AlertCircle } from 'lucide-react';

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

export default function HomeView({ user, conversations, conversationsLoading, conversationsError, files, onlineUsers, onGoToTab, onOpenChat }) {
  const activeConversations = conversations.length;
  const sharedFilesCount = files.length;
  const updatesCount = conversations.filter(c => c.unreadcount > 0).length;

  const recentConversations = [...conversations]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 4);

  const recentFiles = [...files]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 4);

  const isEmpty = !conversationsLoading && conversations.length === 0 && files.length === 0;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">

        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-100 tracking-tight">{greeting()}, {user.username}</h1>
          <p className="text-xs text-slate-500 mt-1">Your workspace at a glance.</p>
        </div>

        {conversationsError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {conversationsError}
          </div>
        )}

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
          <>
            {/* Stat row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 hover:border-[var(--border-strong)] transition-colors">
                <MessageSquare className="w-4 h-4 text-emerald-400 mb-2" />
                <p className="text-lg font-bold text-slate-100">{activeConversations}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide font-mono-code">Active chats</p>
              </div>
              <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 hover:border-[var(--border-strong)] transition-colors">
                <Folder className="w-4 h-4 text-emerald-400 mb-2" />
                <p className="text-lg font-bold text-slate-100">{sharedFilesCount}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide font-mono-code">Shared files</p>
              </div>
              <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 hover:border-[var(--border-strong)] transition-colors">
                <Bell className="w-4 h-4 text-emerald-400 mb-2" />
                <p className="text-lg font-bold text-slate-100">{updatesCount}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide font-mono-code">New updates</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono-code">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span> Online &middot; {onlineUsers.length} active in workspace
            </div>

            {/* Recent conversations */}
            <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
                <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5 text-emerald-400" /> Recent conversations</h3>
                <button onClick={() => onGoToTab('chats')} className="text-[10px] text-emerald-400 hover:text-emerald-300 font-mono-code">View all</button>
              </div>
              {recentConversations.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">No conversations yet.</p>
              ) : (
                recentConversations.map((c) => {
                  const partner = c.isGroup ? null : c.participants.find(p => p._id !== user._id);
                  const name = c.isGroup ? c.groupName : (partner?.username || 'User');
                  const avatar = c.isGroup ? c.groupAvatar : (partner?.profilePicture || `https://api.dicebear.com/7.x/adventurer/svg?seed=${name}`);
                  return (
                    <div key={c._id} onClick={() => onOpenChat(c)} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--bg-hover)] border-b border-[var(--border-subtle)]/50 last:border-0 transition-colors">
                      <img src={avatar} alt={name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-100 truncate">{name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{c.lastMessage ? c.lastMessage.content || 'Sent an attachment' : 'No messages yet'}</p>
                      </div>
                      {c.unreadcount > 0 && <span className="ml-auto bg-emerald-500 text-slate-950 font-bold text-[9px] px-1.5 py-0.5 rounded-full shrink-0">{c.unreadcount}</span>}
                    </div>
                  );
                })
              )}
            </div>

            {/* Recent files */}
            <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
                <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2"><Folder className="w-3.5 h-3.5 text-emerald-400" /> Recent files</h3>
                <button onClick={() => onGoToTab('files')} className="text-[10px] text-emerald-400 hover:text-emerald-300 font-mono-code">View all</button>
              </div>
              {recentFiles.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">No files yet.</p>
              ) : (
                recentFiles.map((f) => {
                  const Icon = fileIcon(f.fileType);
                  return (
                    <div key={f._id} onClick={() => onGoToTab('files')} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--bg-hover)] border-b border-[var(--border-subtle)]/50 last:border-0 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] flex items-center justify-center text-emerald-400 shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-100 truncate">{f.filename}</p>
                        <p className="text-[11px] text-slate-500 truncate">{(f.fileSize / 1024 / 1024).toFixed(1)} MB &middot; {f.owner?._id === user._id ? 'Uploaded by you' : `Shared by ${f.owner?.username || 'someone'}`}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 flex items-center gap-3">
              <Users className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-xs text-slate-400">Discover more teammates in <button onClick={() => onGoToTab('people')} className="text-emerald-400 font-semibold hover:underline">People</button>.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
