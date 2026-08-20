import React, { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../App';
import { Plus, X, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';

export default function StatusTray({ currentUser }) {
  const [statuses, setStatuses] = useState([]);
  const [activeUserStatus, setActiveUserStatus] = useState(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const timerRef = useRef(null);

  const fetchStatuses = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setStatuses(data.data);
      }
    } catch (err) {
      console.error("Error fetching statuses:", err);
    }
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  useEffect(() => {
    if (!activeUserStatus) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    if (isPlaying) {
      timerRef.current = setTimeout(() => {
        handleNextStory();
      }, 4000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserStatus, storyIndex, isPlaying]);

  const handleNextStory = () => {
    if (!activeUserStatus) return;
    if (storyIndex < activeUserStatus.stories.length - 1) {
      setStoryIndex(storyIndex + 1);
    } else {
      handleCloseOverlay();
    }
  };

  const handlePrevStory = () => {
    if (!activeUserStatus) return;
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1);
    }
  };

  const handleCloseOverlay = () => {
    setActiveUserStatus(null);
    setStoryIndex(0);
    setIsPlaying(true);
  };

  const handleUploadStatus = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('media', file);
    formData.append('mediaType', file.type.startsWith('video/') ? 'video' : 'image');
    formData.append('caption', '');

    try {
      const res = await fetch(`${API_BASE}/status`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchStatuses();
      }
    } catch (err) {
      console.error("Status upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="py-3 px-3 border-b border-[#1f232b] bg-[#0c0e11] select-none">
      
      <div className="flex gap-3 items-center overflow-x-auto pr-2 scrollbar-none">
        
        {/* Add Story Button */}
        <div className="flex flex-col items-center gap-1 cursor-pointer shrink-0">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-11 h-11 rounded-lg border border-dashed border-[#2d333f] bg-[#08090b] hover:bg-[#1a1e27] flex items-center justify-center text-slate-400 hover:text-slate-100 transition-colors"
          >
            {uploading ? (
              <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*,video/*"
              onChange={handleUploadStatus}
              className="hidden"
            />
          </div>
          <span className="text-[9px] font-mono-code text-slate-500 uppercase">Status</span>
        </div>

        {/* Stories list */}
        {statuses.map((status) => {
          return (
            <div 
              key={status._id} 
              onClick={() => {
                setActiveUserStatus(status);
                setStoryIndex(0);
              }}
              className="flex flex-col items-center gap-1 cursor-pointer shrink-0"
            >
              <div className="w-11 h-11 rounded-lg p-[1px] border border-emerald-500 bg-[#08090b] flex items-center justify-center">
                <img
                  src={status.user.profilePicture || `https://api.dicebear.com/7.x/adventurer/svg?seed=${status.user.username}`}
                  alt={status.user.username}
                  className="w-full h-full rounded-md object-cover"
                />
              </div>
              <span className="text-[9px] font-mono-code text-slate-400 max-w-[48px] truncate">{status.user.username}</span>
            </div>
          );
        })}
      </div>

      {/* Story Overlay Screen */}
      {activeUserStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 select-none p-4">
          <div className="relative w-full max-w-sm h-full max-h-[75vh] flex flex-col justify-between overflow-hidden rounded-2xl bg-[#101216] border border-[#1f232b] shadow-2xl">
            
            {/* Header */}
            <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-20 space-y-2">
              <div className="flex gap-1">
                {activeUserStatus.stories.map((story, idx) => (
                  <div key={idx} className="h-1 flex-1 rounded-full overflow-hidden bg-slate-800">
                    <div className={`h-full ${idx < storyIndex ? 'bg-emerald-400' : idx === storyIndex && isPlaying ? 'bg-emerald-400 animate-[progress_4s_linear]' : 'bg-slate-700'}`}></div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src={activeUserStatus.user.profilePicture || `https://api.dicebear.com/7.x/adventurer/svg?seed=${activeUserStatus.user.username}`}
                    alt={activeUserStatus.user.username}
                    className="w-8 h-8 rounded-lg object-cover border border-[#2d333f]"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-slate-100">{activeUserStatus.user.username}</h4>
                    <span className="text-[9px] font-mono-code text-slate-400">
                      {new Date(activeUserStatus.stories[storyIndex].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button onClick={() => setIsPlaying(!isPlaying)} className="text-slate-400 hover:text-white p-1">
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={handleCloseOverlay} className="text-slate-400 hover:text-white p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Media Content */}
            <div className="flex-1 flex items-center justify-center relative bg-black">
              <button 
                onClick={handlePrevStory} 
                disabled={storyIndex === 0}
                className="absolute left-2 z-10 p-1.5 rounded-lg bg-black/50 text-white disabled:opacity-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={handleNextStory}
                className="absolute right-2 z-10 p-1.5 rounded-lg bg-black/50 text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {activeUserStatus.stories[storyIndex].mediaType === 'video' ? (
                <video src={activeUserStatus.stories[storyIndex].mediaUrl} autoPlay playsInline className="w-full h-full object-contain" />
              ) : (
                <img src={activeUserStatus.stories[storyIndex].mediaUrl} alt="Story" className="w-full h-full object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
