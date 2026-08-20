import React, { useState, useRef, useEffect, useCallback } from 'react';
import { API_BASE } from '../../config';
import { resolveUrl } from '../../utils/media';
import {
  Folder, Image as ImageIcon, Video as VideoIcon, FileText, File as FileIcon,
  UploadCloud, Download, Trash2, Share2, X, AlertCircle
} from 'lucide-react';

function avatarFor(url, seed) {
  return resolveUrl(url) || `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`;
}

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'images', label: 'Images' },
  { id: 'videos', label: 'Videos' },
  { id: 'documents', label: 'Documents' },
  { id: 'shared', label: 'Shared with me' },
  { id: 'mine', label: 'My uploads' },
];

const ALLOWED_TYPES = /^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm)|application\/(pdf|msword|vnd\.openxmlformats-officedocument.*|vnd\.ms-excel)|text\/(plain|csv))$/;
const MAX_SIZE = 25 * 1024 * 1024;

function fileIconFor(type) {
  if (type === 'image') return ImageIcon;
  if (type === 'video') return VideoIcon;
  if (type === 'document') return FileText;
  return FileIcon;
}

function formatSize(bytes) {
  if (!bytes) return '0 MB';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function FilesView({ user, files, fetchFiles, allUsers, autoOpenUpload = false, onAutoTriggerHandled }) {
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploads, setUploads] = useState([]); // { id, name, progress, status: 'uploading'|'done'|'error', message }
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);
  const fileInputRef = useRef(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    setLoading(true);
    fetchFiles().catch(() => setError('Unable to load files.')).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoOpenUpload) {
      fileInputRef.current?.click();
      onAutoTriggerHandled && onAutoTriggerHandled();
    }
  }, [autoOpenUpload, onAutoTriggerHandled]);

  const uploadOne = useCallback((file) => {
    const uploadId = `${Date.now()}-${Math.random()}`;

    if (file.size > MAX_SIZE) {
      setUploads(prev => [...prev, { id: uploadId, name: file.name, progress: 0, status: 'error', message: 'File exceeds 25MB limit' }]);
      return;
    }
    if (!ALLOWED_TYPES.test(file.type)) {
      setUploads(prev => [...prev, { id: uploadId, name: file.name, progress: 0, status: 'error', message: 'Unsupported file format' }]);
      return;
    }
    const duplicate = files.some(f => f.filename === file.name && f.owner?._id === user._id);
    if (duplicate) {
      setUploads(prev => [...prev, { id: uploadId, name: file.name, progress: 0, status: 'error', message: 'A file with this name already exists' }]);
      return;
    }

    setUploads(prev => [...prev, { id: uploadId, name: file.name, progress: 0, status: 'uploading' }]);

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/files/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 100);
      setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, progress: pct } : u));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.status === 'success') {
          setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, progress: 100, status: 'done' } : u));
          fetchFiles();
          setTimeout(() => setUploads(prev => prev.filter(u => u.id !== uploadId)), 3000);
        } else {
          setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, status: 'error', message: data.message || 'Upload failed' } : u));
        }
      } catch (err) {
        setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, status: 'error', message: 'Upload failed' } : u));
      }
    };
    xhr.onerror = () => {
      setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, status: 'error', message: 'Network error — upload interrupted' } : u));
    };
    xhr.send(formData);
  }, [files, user._id, token, fetchFiles]);

  const handleFilesSelected = (fileList) => {
    Array.from(fileList).forEach(uploadOne);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) handleFilesSelected(e.dataTransfer.files);
  };

  const handleDelete = async (fileId) => {
    try {
      const res = await fetch(`${API_BASE}/files/${fileId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.status === 'success') {
        fetchFiles();
        setPreviewFile(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleShare = async (fileId, userIds) => {
    try {
      const res = await fetch(`${API_BASE}/files/${fileId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userIds })
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchFiles();
        setShareTarget(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredFiles = files.filter((f) => {
    if (activeTab === 'images') return f.fileType === 'image';
    if (activeTab === 'videos') return f.fileType === 'video';
    if (activeTab === 'documents') return f.fileType === 'document';
    if (activeTab === 'mine') return f.owner?._id === user._id;
    if (activeTab === 'shared') return Array.isArray(f.sharedWith) && f.sharedWith.some(u => (u._id || u) === user._id);
    return true;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div
      className="h-full overflow-y-auto custom-scrollbar p-6 md:p-8 relative"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">Files</h1>
            <p className="text-xs text-slate-500 mt-1">Upload, preview, and share files across your workspace.</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="active-press flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950"
          >
            <UploadCloud className="w-3.5 h-3.5" /> Upload
          </button>
          <input type="file" multiple ref={fileInputRef} className="hidden" onChange={(e) => { handleFilesSelected(e.target.files); e.target.value = ''; }} />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${activeTab === t.id ? 'bg-emerald-500 text-slate-950' : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-slate-400 hover:text-slate-200'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Upload progress list */}
        {uploads.length > 0 && (
          <div className="space-y-2">
            {uploads.map(u => (
              <div key={u.id} className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-3">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium truncate">{u.status === 'done' ? '✓ Upload complete' : u.status === 'error' ? u.message : `Uploading... ${u.name}`}</span>
                  {u.status === 'uploading' && <span className="text-slate-500 font-mono-code shrink-0 ml-2">{u.progress}%</span>}
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-canvas)] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-200 ${u.status === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`}
                    style={{ width: `${u.status === 'error' ? 100 : u.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-xs text-slate-500 text-center py-10">Loading files...</p>
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-xs text-rose-400 mb-2 flex items-center justify-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {error}</p>
            <button onClick={() => { setError(''); setLoading(true); fetchFiles().finally(() => setLoading(false)); }} className="text-[11px] text-emerald-400 hover:underline">Try again</button>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-10 text-center">
            <Folder className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-xs font-semibold text-slate-300">No files yet.</p>
            <p className="text-[11px] text-slate-600 mt-1">Upload your first file or receive one from a conversation.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden">
            {filteredFiles.map((f) => {
              const Icon = fileIconFor(f.fileType);
              const isMine = f.owner?._id === user._id;
              return (
                <div key={f._id} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)]/50 last:border-0 hover:bg-[var(--bg-hover)] hover:translate-x-0.5 transition-all">
                  <div onClick={() => setPreviewFile(f)} className="w-10 h-10 rounded-lg bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] flex items-center justify-center text-emerald-400 shrink-0 cursor-pointer overflow-hidden">
                    {f.fileType === 'image' ? <img src={resolveUrl(f.fileUrl)} alt={f.filename} className="w-full h-full object-cover" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <div onClick={() => setPreviewFile(f)} className="min-w-0 flex-1 cursor-pointer">
                    <p className="text-xs font-semibold text-slate-100 truncate">{f.filename}</p>
                    <p className="text-[11px] text-slate-500 truncate">{f.fileType.toUpperCase()} &middot; {formatSize(f.fileSize)} &middot; {isMine ? 'Uploaded by you' : `Shared by ${f.owner?.username || 'someone'}`}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isMine && (
                      <button onClick={() => setShareTarget(f)} title="Share" className="p-1.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] text-slate-400 hover:text-slate-200"><Share2 className="w-3.5 h-3.5" /></button>
                    )}
                    <a href={resolveUrl(f.fileUrl)} download={f.filename} title="Download" className="p-1.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] text-slate-400 hover:text-slate-200"><Download className="w-3.5 h-3.5" /></a>
                    {isMine && (
                      <button onClick={() => handleDelete(f._id)} title="Delete" className="p-1.5 rounded-lg border border-[var(--border-subtle)] hover:bg-rose-500/10 text-slate-400 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isDragging && (
        <div className="absolute inset-0 z-40 bg-emerald-500/5 border-2 border-dashed border-emerald-500/50 flex items-center justify-center pointer-events-none">
          <div className="bg-[var(--bg-surface)] border border-emerald-500/40 rounded-2xl px-6 py-4 flex items-center gap-3">
            <UploadCloud className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-semibold text-slate-100">Drop files to upload</span>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6" onClick={() => setPreviewFile(null)}>
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewFile(null)} className="absolute -top-10 right-0 text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
            {previewFile.fileType === 'image' && <img src={resolveUrl(previewFile.fileUrl)} alt={previewFile.filename} className="max-h-[75vh] w-auto mx-auto rounded-xl" />}
            {previewFile.fileType === 'video' && <video src={resolveUrl(previewFile.fileUrl)} controls autoPlay className="max-h-[75vh] w-full mx-auto rounded-xl" />}
            {(previewFile.fileType === 'document' || previewFile.fileType === 'other') && (
              <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-8 text-center">
                <FileText className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-100">{previewFile.filename}</p>
                <p className="text-xs text-slate-500 mt-1">{formatSize(previewFile.fileSize)}</p>
                <a href={resolveUrl(previewFile.fileUrl)} download={previewFile.filename} className="inline-flex items-center gap-1.5 mt-4 text-xs font-semibold px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950"><Download className="w-3.5 h-3.5" /> Download</a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share modal */}
      {shareTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setShareTarget(null)}>
          <div className="w-full max-w-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
              <h3 className="font-semibold text-sm text-slate-100">Share file</h3>
              <button onClick={() => setShareTarget(null)} className="text-slate-500 hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>
            <div className="max-h-64 overflow-y-auto custom-scrollbar p-2">
              {allUsers.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No other users to share with.</p>
              ) : allUsers.map(u => (
                <div key={u._id} onClick={() => handleShare(shareTarget._id, [u._id])} className="flex items-center gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-[var(--bg-hover)]">
                  <img src={avatarFor(u.profilePicture, u.username)} alt={u.username} className="w-7 h-7 rounded-lg object-cover" />
                  <span className="text-xs text-slate-200 font-medium">{u.username}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
