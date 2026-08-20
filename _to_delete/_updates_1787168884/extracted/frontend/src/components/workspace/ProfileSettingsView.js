import React, { useState } from 'react';
import { API_BASE } from '../../App';
import { Upload, Check, AlertCircle } from 'lucide-react';

export default function ProfileSettingsView({ user, onProfileUpdate, mode }) {
  const [username, setUsername] = useState(user.username || '');
  const [about, setAbout] = useState(user.about || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const token = localStorage.getItem('token');

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    const formData = new FormData();
    formData.append('username', username);
    formData.append('about', about);
    if (avatarFile) formData.append('profilePicture', avatarFile);

    try {
      const res = await fetch(`${API_BASE}/auth/update-profile`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.status === 'success') {
        onProfileUpdate(data.data);
        setSuccess(true);
        setAvatarFile(null);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.message || 'Failed to update profile.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error while saving your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 md:p-8">
      <div className="max-w-md mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">{mode === 'settings' ? 'Settings' : 'Profile'}</h1>
          <p className="text-xs text-slate-500 mt-1">Manage your workspace identity.</p>
        </div>

        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6">
          <div className="flex flex-col items-center gap-3 pb-6 mb-6 border-b border-[var(--border-subtle)]">
            <div className="relative group cursor-pointer w-24 h-24 rounded-full border border-[var(--border-strong)] p-1 bg-[var(--bg-canvas)]">
              <img
                src={avatarPreview || user.profilePicture || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`}
                alt="Avatar"
                className="w-full h-full rounded-full object-cover"
              />
              <label className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-[10px] font-mono-code text-slate-200 transition-opacity cursor-pointer rounded-full">
                <Upload className="w-4 h-4 mb-1 text-emerald-400" /> Change
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </label>
            </div>
            <h2 className="text-sm font-bold text-slate-100">{user.username}</h2>
            <p className="text-xs text-slate-500">{user.email || user.phoneNumber}</p>
            <span className="flex items-center gap-1.5 text-[11px] font-mono-code text-emerald-400"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span> Online</span>
          </div>

          {error && <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}</div>}
          {success && <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2"><Check className="w-3.5 h-3.5 shrink-0" /> Profile updated successfully.</div>}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono-code uppercase tracking-wider text-slate-400">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                maxLength={20}
                className="w-full px-3.5 py-2.5 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] focus:border-emerald-500/60 rounded-xl text-xs text-slate-100 font-mono-code outline-none transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono-code uppercase tracking-wider text-slate-400">Bio / About</label>
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                rows={3}
                maxLength={100}
                className="w-full px-3.5 py-2.5 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] focus:border-emerald-500/60 rounded-xl text-xs text-slate-100 outline-none resize-none transition-colors"
              />
            </div>

            <button type="submit" disabled={saving} className="w-full active-press bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
