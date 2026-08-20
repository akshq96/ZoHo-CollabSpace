import React, { useState, useRef, useEffect } from 'react';
import { API_BASE } from '../../App';
import { Plus, X, ChevronLeft, ChevronRight, Play, Pause, Circle, Trash2, Image as ImageIcon, Video as VideoIcon, Type } from 'lucide-react';

function timeAgo(date) {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function StatusView({ user, statuses, fetchStatuses }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [myStatus, setMyStatus] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createMode, setCreateMode] = useState(null); // 'text' | 'image' | 'video'
  const [textValue, setTextValue] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [posting, setPosting] = useState(false);
  const [viewer, setViewer] = useState(null); // { list: [...], userIndex }
  const [storyIndex, setStoryIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const fileInputRef = useRef(null);
  const timerRef = useRef(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    setLoading(true);
    fetchStatuses().catch(() => setError('Unable to load status updates.')).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // "myStatus" is derived separately since the /status endpoint only
    // returns OTHER users' active statuses (see getStatuses on the backend).
    const fetchMine = async () => {
      try {
        const res = await fetch(`${API_BASE}/status/mine`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 404) { setMyStatus(null); return; }
        const data = await res.json();
        if (data.status === 'success') setMyStatus(data.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchMine();
  }, [statuses, token]);

  const otherStatuses = statuses.filter(s => s.user && s.user._id !== user._id);

  const activeStory = viewer ? viewer.list[viewer.userIndex] : null;

  useEffect(() => {
    if (!activeStory) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isPlaying) {
      timerRef.current = setTimeout(() => handleNextStory(), 4000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStory, storyIndex, isPlaying]);

  const openViewer = (list, userIndex) => {
    setViewer({ list, userIndex });
    setStoryIndex(0);
    setIsPlaying(true);
  };

  const closeViewer = () => { setViewer(null); setStoryIndex(0); };

  const handleNextStory = () => {
    if (!viewer) return;
    const currentUserStories = viewer.list[viewer.userIndex].stories;
    if (storyIndex < currentUserStories.length - 1) {
      setStoryIndex(storyIndex + 1);
    } else if (viewer.userIndex < viewer.list.length - 1) {
      setViewer({ ...viewer, userIndex: viewer.userIndex + 1 });
      setStoryIndex(0);
    } else {
      closeViewer();
    }
  };

  const handlePrevStory = () => {
    if (!viewer) return;
    if (storyIndex > 0) { setStoryIndex(storyIndex - 1); return; }
    if (viewer.userIndex > 0) {
      const prevUser = viewer.list[viewer.userIndex - 1];
      setViewer({ ...viewer, userIndex: viewer.userIndex - 1 });
      setStoryIndex(prevUser.stories.length - 1);
    }
  };

  const handleMediaSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const resetCreateModal = () => {
    setShowCreateModal(false);
    setCreateMode(null);
    setTextValue('');
    setMediaFile(null);
    setMediaPreview('');
  };

  const handlePost = async () => {
    setPosting(true);
    setError('');
    try {
      const formData = new FormData();
      if (createMode === 'text') {
        // Text-only statuses are rendered as a caption over a generated card image
        const blob = await textToImageBlob(textValue);
        formData.append('media', blob, 'status-text.png');
        formData.append('mediaType', 'image');
        formData.append('caption', textValue);
      } else {
        if (!mediaFile) { setPosting(false); return; }
        formData.append('media', mediaFile);
        formData.append('mediaType', createMode);
        formData.append('caption', '');
      }

      const res = await fetch(`${API_BASE}/status`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.status === 'success') {
        setMyStatus(data.data);
        fetchStatuses();
        resetCreateModal();
      } else {
        setError(data.message || 'Failed to post status.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to post status.');
    } finally {
      setPosting(false);
    }
  };

  const textToImageBlob = (text) => new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 480; canvas.height = 480;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#101216';
    ctx.fillRect(0, 0, 480, 480);
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const words = (text || 'ZoHo Web').split(' ');
    let lines = []; let current = '';
    words.forEach(w => {
      const test = current ? `${current} ${w}` : w;
      if (ctx.measureText(test).width > 380) { lines.push(current); current = w; } else { current = test; }
    });
    lines.push(current);
    lines.slice(0, 6).forEach((line, i) => {
      ctx.fillText(line, 240, 240 - (lines.length - 1) * 18 + i * 36);
    });
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">Status</h1>
          <p className="text-xs text-slate-500 mt-1">Share updates that disappear after 24 hours.</p>
        </div>

        {/* Your status */}
        <div>
          <p className="font-mono-code text-[10px] text-slate-500 uppercase tracking-wider mb-2 px-1">Your status</p>
          {myStatus && myStatus.stories?.length > 0 ? (
            <div
              onClick={() => openViewer([myStatus], 0)}
              className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] cursor-pointer transition-all"
            >
              <div className="w-12 h-12 rounded-xl p-[2px] border-2 border-emerald-500 shrink-0">
                <img src={myStatus.stories[myStatus.stories.length - 1].mediaUrl} alt="Your status" className="w-full h-full rounded-lg object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-100">{myStatus.stories.length} update{myStatus.stories.length > 1 ? 's' : ''}</p>
                <p className="text-[11px] text-slate-500">{timeAgo(myStatus.stories[myStatus.stories.length - 1].createdAt)}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setShowCreateModal(true); }} className="p-2 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] text-emerald-400 shrink-0">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[var(--bg-surface)] border border-dashed border-[var(--border-strong)] hover:bg-[var(--bg-hover)] transition-all"
            >
              <div className="w-12 h-12 rounded-xl border border-dashed border-[var(--border-strong)] flex items-center justify-center text-emerald-400 shrink-0">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-slate-300">Add Status</span>
            </button>
          )}
        </div>

        {/* Recent updates */}
        <div>
          <p className="font-mono-code text-[10px] text-slate-500 uppercase tracking-wider mb-2 px-1">Recent updates</p>
          {loading ? (
            <p className="text-xs text-slate-500 text-center py-8">Loading statuses...</p>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-xs text-rose-400 mb-2">{error}</p>
              <button onClick={() => { setError(''); setLoading(true); fetchStatuses().finally(() => setLoading(false)); }} className="text-[11px] text-emerald-400 hover:underline">Try again</button>
            </div>
          ) : otherStatuses.length === 0 ? (
            <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-8 text-center">
              <Circle className="w-6 h-6 text-slate-700 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-300">No updates yet.</p>
              <p className="text-[11px] text-slate-600 mt-1">Share something with your workspace.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {otherStatuses.map((s, idx) => (
                <div
                  key={s._id}
                  onClick={() => openViewer(otherStatuses, idx)}
                  className="flex items-center gap-3 p-2.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] cursor-pointer transition-all"
                >
                  <div className="w-11 h-11 rounded-xl p-[2px] border-2 border-emerald-500 shrink-0">
                    <img src={s.user.profilePicture || `https://api.dicebear.com/7.x/adventurer/svg?seed=${s.user.username}`} alt={s.user.username} className="w-full h-full rounded-lg object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-100">{s.user.username}</p>
                    <p className="text-[11px] text-emerald-400">{timeAgo(s.stories[s.stories.length - 1].createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Status Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
              <h3 className="font-semibold text-sm text-slate-100">Create Status</h3>
              <button onClick={resetCreateModal} className="text-slate-500 hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-4 space-y-3">
              {error && <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">{error}</div>}

              {!createMode && (
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setCreateMode('text')} className="flex flex-col items-center gap-1.5 p-4 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-emerald-500/50 text-slate-300">
                    <Type className="w-5 h-5 text-emerald-400" /> <span className="text-[10px] font-semibold">Text</span>
                  </button>
                  <button onClick={() => { setCreateMode('image'); fileInputRef.current?.click(); }} className="flex flex-col items-center gap-1.5 p-4 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-emerald-500/50 text-slate-300">
                    <ImageIcon className="w-5 h-5 text-emerald-400" /> <span className="text-[10px] font-semibold">Image</span>
                  </button>
                  <button onClick={() => { setCreateMode('video'); fileInputRef.current?.click(); }} className="flex flex-col items-center gap-1.5 p-4 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-emerald-500/50 text-slate-300">
                    <VideoIcon className="w-5 h-5 text-emerald-400" /> <span className="text-[10px] font-semibold">Video</span>
                  </button>
                  <input type="file" ref={fileInputRef} accept="image/*,video/*" onChange={handleMediaSelect} className="hidden" />
                </div>
              )}

              {createMode === 'text' && (
                <textarea
                  autoFocus
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  placeholder="What's on your mind?"
                  rows={4}
                  maxLength={150}
                  className="w-full px-3 py-2.5 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] focus:border-emerald-500/60 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 outline-none resize-none"
                />
              )}

              {(createMode === 'image' || createMode === 'video') && mediaPreview && (
                <div className="rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-black/40 max-h-56 flex items-center justify-center">
                  {createMode === 'image'
                    ? <img src={mediaPreview} alt="preview" className="max-h-56 object-contain" />
                    : <video src={mediaPreview} controls className="max-h-56" />}
                </div>
              )}

              {createMode && (
                <div className="flex gap-2 pt-1">
                  <button onClick={resetCreateModal} className="flex-1 active-press border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] text-slate-300 font-semibold py-2 px-3 rounded-xl text-xs">Cancel</button>
                  <button
                    onClick={handlePost}
                    disabled={posting || (createMode === 'text' ? !textValue.trim() : !mediaFile)}
                    className="flex-[2] active-press bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1"
                  >
                    {posting ? <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div> : 'Post'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full-screen viewer */}
      {activeStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4">
          <div className="relative w-full max-w-sm h-full max-h-[80vh] flex flex-col justify-between overflow-hidden rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl">
            <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-20 space-y-2">
              <div className="flex gap-1">
                {activeStory.stories.map((story, idx) => (
                  <div key={idx} className="h-1 flex-1 rounded-full overflow-hidden bg-slate-800">
                    <div className={`h-full ${idx < storyIndex ? 'bg-emerald-400' : idx === storyIndex && isPlaying ? 'bg-emerald-400 animate-[progress_4s_linear]' : 'bg-slate-700'}`}></div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img src={activeStory.user.profilePicture || `https://api.dicebear.com/7.x/adventurer/svg?seed=${activeStory.user.username}`} alt={activeStory.user.username} className="w-8 h-8 rounded-lg object-cover border border-[var(--border-strong)]" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-100">{activeStory.user.username}{activeStory.user._id === user._id ? ' (You)' : ''}</h4>
                    <span className="text-[9px] font-mono-code text-slate-400">{timeAgo(activeStory.stories[storyIndex].createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setIsPlaying(!isPlaying)} className="text-slate-400 hover:text-white p-1">{isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}</button>
                  {activeStory.user._id === user._id && (
                    <button onClick={async () => { closeViewer(); await fetch(`${API_BASE}/status`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); fetchStatuses(); }} className="text-slate-400 hover:text-rose-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                  <button onClick={closeViewer} className="text-slate-400 hover:text-white p-1"><X className="w-4 h-4" /></button>
                </div>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center relative bg-black">
              <button onClick={handlePrevStory} className="absolute left-2 z-10 p-1.5 rounded-lg bg-black/50 text-white"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={handleNextStory} className="absolute right-2 z-10 p-1.5 rounded-lg bg-black/50 text-white"><ChevronRight className="w-4 h-4" /></button>
              {activeStory.stories[storyIndex].mediaType === 'video'
                ? <video src={activeStory.stories[storyIndex].mediaUrl} autoPlay playsInline className="w-full h-full object-contain" />
                : <img src={activeStory.stories[storyIndex].mediaUrl} alt="Story" className="w-full h-full object-contain" />}
              {activeStory.stories[storyIndex].caption && (
                <p className="absolute bottom-4 inset-x-4 text-center text-xs text-white/90 bg-black/40 rounded-lg p-2">{activeStory.stories[storyIndex].caption}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
