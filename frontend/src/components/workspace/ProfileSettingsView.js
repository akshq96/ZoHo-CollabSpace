import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../config';
import { resolveUrl } from '../../utils/media';
import ThemeToggle from '../ThemeToggle';
import {
  Upload, Check, AlertCircle, User, Shield, Bell, Palette, AtSign, Ban,
  Lock, X, MessageSquare, Calendar, KeyRound
} from 'lucide-react';

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-200">{label}</p>
        {description && <p className="text-[10px] text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`shrink-0 relative w-9 h-5 rounded-full transition-colors duration-150 ${checked ? 'bg-emerald-500' : 'bg-[var(--bg-canvas)] border border-[var(--border-subtle)]'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-150 ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function PrivacySelect({ value, onChange }) {
  return (
    <div className="flex gap-1.5">
      {['everyone', 'contacts'].map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold capitalize transition-colors duration-150 ${value === opt ? 'bg-emerald-500 text-slate-950' : 'bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-slate-400 hover:text-slate-200'}`}
        >
          {opt === 'everyone' ? 'Everyone' : 'Accepted Connections'}
        </button>
      ))}
    </div>
  );
}

const SETTINGS_TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'account', label: 'Account', icon: AtSign },
  { id: 'privacy', label: 'Privacy', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'security', label: 'Security', icon: Lock },
];

export default function ProfileSettingsView({ user, onProfileUpdate, mode, authHeaders, contactsCount = 0, filesCount = 0, onlineUsers = [] }) {
  const [username, setUsername] = useState(user.username || '');
  const [about, setAbout] = useState(user.about || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [statusPrivacy, setStatusPrivacy] = useState(user.statusPrivacy || 'contacts');
  const [notifyMessages, setNotifyMessages] = useState(user.notifyMessages !== false);
  const [notifyStatus, setNotifyStatus] = useState(user.notifyStatus !== false);
  const [notifyFiles, setNotifyFiles] = useState(user.notifyFiles !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState(null);
  const [settingsTab, setSettingsTab] = useState('profile');
  const [editOpen, setEditOpen] = useState(false);
  const [passkeys, setPasskeys] = useState([]);
  const [passkeysLoading, setPasskeysLoading] = useState(true);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyError, setPasskeyError] = useState('');
  const [webauthnSupported] = useState(typeof window !== 'undefined' && !!window.PublicKeyCredential);
  const token = localStorage.getItem('token');

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

  const fetchPasskeys = useCallback(async () => {
    if (!authHeaders) return;
    try {
      const res = await fetch(`${API_BASE}/auth/passkeys`, { headers: authHeaders });
      const data = await res.json();
      if (data.status === 'success') setPasskeys(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setPasskeysLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { fetchPasskeys(); }, [fetchPasskeys]);

  const handleUnblock = async (userId) => {
    if (!authHeaders) return;
    setUnblockingId(userId);
    try {
      const res = await fetch(`${API_BASE}/connections/unblock/${userId}`, { method: 'POST', headers: authHeaders });
      const data = await res.json();
      if (data.status === 'success') fetchBlockedUsers();
    } catch (err) {
      console.error(err);
    } finally {
      setUnblockingId(null);
    }
  };

  const bufToBase64Url = (buf) => {
    const bytes = new Uint8Array(buf);
    let str = '';
    for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const base64UrlToBuf = (b64url) => {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    const str = atob(b64 + pad);
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
    return bytes.buffer;
  };

  const handleAddPasskey = async () => {
    if (!webauthnSupported) {
      setPasskeyError('This browser or device does not support passkeys (WebAuthn).');
      return;
    }
    setPasskeyBusy(true);
    setPasskeyError('');
    try {
      const optRes = await fetch(`${API_BASE}/auth/passkeys/register-options`, { method: 'POST', headers: authHeaders });
      const optData = await optRes.json();
      if (optData.status !== 'success') { setPasskeyError(optData.message || 'Unable to start passkey registration.'); return; }
      const options = optData.data;
      options.challenge = base64UrlToBuf(options.challenge);
      options.user.id = base64UrlToBuf(options.user.id);
      if (options.excludeCredentials) {
        options.excludeCredentials = options.excludeCredentials.map(c => ({ ...c, id: base64UrlToBuf(c.id) }));
      }

      const credential = await navigator.credentials.create({ publicKey: options });
      const attestationResponse = {
        id: credential.id,
        rawId: bufToBase64Url(credential.rawId),
        type: credential.type,
        response: {
          attestationObject: bufToBase64Url(credential.response.attestationObject),
          clientDataJSON: bufToBase64Url(credential.response.clientDataJSON),
        },
      };

      const label = window.prompt('Name this passkey (e.g. "MacBook"):', 'My device') || 'Passkey';
      const verifyRes = await fetch(`${API_BASE}/auth/passkeys/register-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ credential: attestationResponse, label })
      });
      const verifyData = await verifyRes.json();
      if (verifyData.status === 'success') {
        fetchPasskeys();
      } else {
        setPasskeyError(verifyData.message || 'Passkey registration failed.');
      }
    } catch (err) {
      console.error(err);
      if (err.name === 'NotAllowedError') setPasskeyError('Passkey registration was cancelled.');
      else setPasskeyError('Passkey registration failed on this device.');
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleRemovePasskey = async (id) => {
    setPasskeyBusy(true);
    try {
      const res = await fetch(`${API_BASE}/auth/passkeys/${id}`, { method: 'DELETE', headers: authHeaders });
      const data = await res.json();
      if (data.status === 'success') fetchPasskeys();
    } catch (err) {
      console.error(err);
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError('Avatar must be a JPG, PNG, or WEBP image.');
      return;
    }
    setError('');
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    const formData = new FormData();
    formData.append('username', username);
    formData.append('about', about);
    formData.append('statusPrivacy', statusPrivacy);
    formData.append('notifyMessages', notifyMessages);
    formData.append('notifyStatus', notifyStatus);
    formData.append('notifyFiles', notifyFiles);
    if (avatarFile) formData.append('profilePicture', avatarFile);

    try {
      const res = await fetch(`${API_BASE}/auth/update-profile`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.status === 'success') {
        // One source of truth: the backend's updated user record propagates
        // up through onProfileUpdate so every view (Profile, Settings,
        // People, Chats, Home, Status, header) re-renders with the same data.
        onProfileUpdate(data.data);
        setSuccess(true);
        setAvatarFile(null);
        setEditOpen(false);
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

  const avatarSrc = avatarPreview || resolveUrl(user.profilePicture) || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`;
  const isOnline = onlineUsers.includes(user._id);
  const joinedYear = user.createdAt ? new Date(user.createdAt).getFullYear() : new Date().getFullYear();

  // ============================= PROFILE MODE =============================
  // A real profile header + stats + about — not a settings form.
  if (mode === 'profile') {
    return (
      <div className="h-full overflow-y-auto custom-scrollbar p-6 md:p-8">
        <div className="max-w-md mx-auto">
          <div className="flex flex-col items-center text-center gap-1.5 pt-4">
            <img src={avatarSrc} alt={user.username} className="w-24 h-24 rounded-full object-cover border border-[var(--border-strong)]" />
            <h1 className="text-xl font-bold text-slate-100 mt-3">{user.username}</h1>
            <p className="text-xs text-slate-500">@{(user.username || '').toLowerCase()}</p>
            <span className={`flex items-center gap-1.5 text-[11px] font-medium mt-1 ${isOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}></span> {isOnline ? 'Online' : 'Offline'}
            </span>
            {user.about && <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">{user.about}</p>}
            <button onClick={() => setEditOpen(true)} className="active-press mt-4 text-xs font-semibold px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors">
              Edit Profile
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-7">
            <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-3.5 text-center">
              <p className="text-lg font-bold text-slate-100">{contactsCount}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Contacts</p>
            </div>
            <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-3.5 text-center">
              <p className="text-lg font-bold text-slate-100">{filesCount}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Files Shared</p>
            </div>
            <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-3.5 text-center">
              <p className="text-lg font-bold text-slate-100">{joinedYear}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Joined</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 space-y-3">
            <h3 className="text-[13px] font-bold text-slate-200">About</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-400"><AtSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> {user.email || 'No email set'}</div>
              {user.phoneSuffix && user.phoneNumber && (
                <div className="flex items-center gap-2 text-slate-400"><MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> {user.phoneSuffix} {user.phoneNumber}</div>
              )}
              <div className="flex items-center gap-2 text-slate-400"><Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Joined {joinedYear}</div>
            </div>
          </div>
        </div>

        {editOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setEditOpen(false)}>
            <form onSubmit={handleSave} className="w-full max-w-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
                <h3 className="font-semibold text-sm text-slate-100">Edit profile</h3>
                <button type="button" onClick={() => setEditOpen(false)} className="text-slate-500 hover:text-slate-200"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-4 space-y-4">
                {error && <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}</div>}
                <div className="flex justify-center">
                  <div className="relative group cursor-pointer w-20 h-20 rounded-full border border-[var(--border-strong)] p-1 bg-[var(--bg-canvas)]">
                    <img src={avatarSrc} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                    <label className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-[9px] text-slate-200 transition-opacity cursor-pointer rounded-full">
                      <Upload className="w-3.5 h-3.5 mb-0.5 text-emerald-400" /> Change
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} className="hidden" />
                    </label>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Username</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} maxLength={20} className="w-full px-3.5 py-2.5 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] focus:border-emerald-500/60 rounded-xl text-xs text-slate-100 outline-none transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Bio</label>
                  <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={3} maxLength={100} className="w-full px-3.5 py-2.5 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] focus:border-emerald-500/60 rounded-xl text-xs text-slate-100 outline-none resize-none transition-colors" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setEditOpen(false)} className="flex-1 active-press border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] text-slate-300 font-semibold py-2 px-3 rounded-xl text-xs">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 active-press bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold py-2 px-3 rounded-xl text-xs">{saving ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // ============================= SETTINGS MODE =============================
  // Left nav + right panel, instead of one long vertical form.
  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">Settings</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">Manage your workspace identity and preferences.</p>
        </div>

        {error && <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}</div>}
        {success && <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2"><Check className="w-3.5 h-3.5 shrink-0" /> Saved.</div>}

        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6">
          {/* Left nav */}
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {SETTINGS_TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSettingsTab(t.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12.5px] font-medium whitespace-nowrap transition-colors duration-150 ${settingsTab === t.id ? 'bg-[var(--bg-elevated)] text-slate-100' : 'text-slate-500 hover:text-slate-300 hover:bg-[var(--bg-hover)]'}`}
                >
                  <Icon className={`w-3.5 h-3.5 ${settingsTab === t.id ? 'text-emerald-400' : ''}`} /> {t.label}
                </button>
              );
            })}
          </nav>

          {/* Right panel */}
          <div className="min-w-0 space-y-5">
            {settingsTab === 'profile' && (
              <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 space-y-4">
                <div className="flex flex-col items-center gap-3 pb-2">
                  <div className="relative group cursor-pointer w-20 h-20 rounded-full border border-[var(--border-strong)] p-1 bg-[var(--bg-canvas)]">
                    <img src={avatarSrc} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                    <label className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-[9px] text-slate-200 transition-opacity cursor-pointer rounded-full">
                      <Upload className="w-3.5 h-3.5 mb-0.5 text-emerald-400" /> Change
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} className="hidden" />
                    </label>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Username</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} maxLength={20} className="w-full px-3.5 py-2.5 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] focus:border-emerald-500/60 rounded-xl text-xs text-slate-100 outline-none transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Bio / About</label>
                  <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={3} maxLength={100} className="w-full px-3.5 py-2.5 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] focus:border-emerald-500/60 rounded-xl text-xs text-slate-100 outline-none resize-none transition-colors" />
                </div>
              </div>
            )}

            {settingsTab === 'account' && (
              <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Email</label>
                  <p className="w-full px-3.5 py-2.5 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl text-xs text-slate-400">{user.email || 'Not set'}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Phone</label>
                  <p className="w-full px-3.5 py-2.5 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl text-xs text-slate-400">
                    {user.phoneSuffix && user.phoneNumber ? `${user.phoneSuffix} ${user.phoneNumber}` : 'Not set'}
                  </p>
                </div>
              </div>
            )}

            {settingsTab === 'privacy' && (
              <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 space-y-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-200">Who can see my status</p>
                  <PrivacySelect value={statusPrivacy} onChange={setStatusPrivacy} />
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Messaging always requires an accepted connection — someone must send you a connection request and you accept it before they can chat with you.
                </p>

                <div className="space-y-2 pt-1 border-t border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2">
                    <Ban className="w-3.5 h-3.5 text-slate-400" />
                    <p className="text-xs font-semibold text-slate-200">Blocked users</p>
                  </div>
                  {blockedLoading ? (
                    <p className="text-[11px] text-slate-500">Loading…</p>
                  ) : blockedUsers.length === 0 ? (
                    <p className="text-[11px] text-slate-500">No blocked users.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {blockedUsers.map((u) => (
                        <div key={u._id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={resolveUrl(u.profilePicture) || `https://api.dicebear.com/7.x/adventurer/svg?seed=${u.username}`}
                              alt={u.username}
                              className="w-6 h-6 rounded-full object-cover shrink-0"
                            />
                            <span className="text-xs text-slate-200 truncate">{u.username}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUnblock(u._id)}
                            disabled={unblockingId === u._id}
                            className="shrink-0 active-press text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] text-slate-300 hover:text-slate-100 disabled:opacity-50 transition-colors"
                          >
                            {unblockingId === u._id ? 'Unblocking…' : 'Unblock'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {settingsTab === 'notifications' && (
              <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 space-y-1">
                <ToggleRow label="Messages" description="New chat messages" checked={notifyMessages} onChange={setNotifyMessages} />
                <ToggleRow label="Status updates" description="New status posts from your workspace" checked={notifyStatus} onChange={setNotifyStatus} />
                <ToggleRow label="Files" description="Files shared with you" checked={notifyFiles} onChange={setNotifyFiles} />
              </div>
            )}

            {settingsTab === 'appearance' && (
              <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-200">Theme</p>
                  <ThemeToggle />
                </div>
              </div>
            )}

            {settingsTab === 'security' && (
              <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-200">Passkeys</p>
                    <p className="text-[10.5px] text-slate-500 mt-0.5">Use your device's biometric or security key to sign in without an OTP.</p>
                  </div>
                </div>

                {!webauthnSupported && (
                  <p className="text-[11px] text-amber-400">This browser doesn't support passkeys. Try a recent Chrome, Safari, or Edge on a device with biometrics or a security key.</p>
                )}
                {passkeyError && <p className="text-[11px] text-rose-400">{passkeyError}</p>}

                <button
                  type="button"
                  onClick={handleAddPasskey}
                  disabled={passkeyBusy || !webauthnSupported}
                  className="active-press text-[11.5px] font-semibold px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 transition-colors"
                >
                  {passkeyBusy ? 'Waiting for device…' : '+ Add Passkey'}
                </button>

                <div className="space-y-1.5 pt-1 border-t border-[var(--border-subtle)]">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold pt-2">Your passkeys</p>
                  {passkeysLoading ? (
                    <p className="text-[11px] text-slate-500">Loading…</p>
                  ) : passkeys.length === 0 ? (
                    <p className="text-[11px] text-slate-500">No passkeys added yet.</p>
                  ) : (
                    passkeys.map((pk) => (
                      <div key={pk._id} className="flex items-center justify-between gap-2 py-2 px-2.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
                        <div className="min-w-0">
                          <p className="text-xs text-slate-200 truncate">{pk.label || 'Passkey'}</p>
                          <p className="text-[10px] text-slate-500">Added {new Date(pk.createdAt).toLocaleDateString()}</p>
                        </div>
                        <button type="button" onClick={() => handleRemovePasskey(pk._id)} disabled={passkeyBusy} className="shrink-0 text-[11px] font-semibold text-rose-400 hover:text-rose-300 disabled:opacity-50">Remove</button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <button type="submit" disabled={saving} className="active-press bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold py-2.5 px-5 rounded-xl text-xs transition-colors">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
