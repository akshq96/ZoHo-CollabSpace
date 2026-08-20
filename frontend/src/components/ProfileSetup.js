import React, { useState } from 'react';
import { API_BASE } from '../config';
import { Upload, ArrowRight, UserCheck } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function ProfileSetup({ user, onSetupSuccess }) {
  const [username, setUsername] = useState('');
  const [about, setAbout] = useState("Hey there! I'm using ZoHo Web.");
  const [profilePicture, setProfilePicture] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const avatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${username || 'default_seed'}`;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePicture(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreedToTerms) {
      setError('You must agree to the Terms to proceed.');
      return;
    }

    setLoading(true);
    setError('');

    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('username', username);
    formData.append('about', about);
    formData.append('agreedToTerms', 'true');
    if (profilePicture) {
      formData.append('profilePicture', profilePicture);
    }

    try {
      const res = await fetch(`${API_BASE}/auth/update-profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();

      if (data.status === 'success' && data.data) {
        onSetupSuccess(data.data);
      } else {
        setError(data.message || 'Profile setup failed.');
      }
    } catch (err) {
      console.error(err);
      setError('Network request error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08090b] grid-bg flex flex-col items-center justify-center p-6 relative font-sans select-none">
      
      {/* Editorial Card Box */}
      <div className="w-full max-w-[420px] bg-[#101216] border border-[#1f232b] rounded-2xl p-8 shadow-2xl relative z-10">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-5 mb-5 border-b border-[#1f232b]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <UserCheck className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm text-slate-100 tracking-tight">Setup Profile</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono-code text-[11px] text-slate-500">STEP 2 OF 2</span>
            <ThemeToggle />
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="relative group cursor-pointer w-24 h-24 rounded-full border border-[#2d333f] p-1 bg-[#08090b]">
              <img 
                src={previewUrl || avatarUrl} 
                alt="Avatar" 
                className="w-full h-full rounded-full object-cover"
              />
              <label className="absolute inset-0 bg-[#08090b]/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-[10px] font-mono-code text-slate-300 transition-opacity cursor-pointer rounded-full">
                <Upload className="w-4 h-4 mb-1 text-emerald-400" />
                Change
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
            <span className="text-[11px] font-mono-code text-slate-500">
              {profilePicture ? profilePicture.name : 'Generated from handle or click to upload'}
            </span>
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono-code uppercase tracking-wider text-slate-400">Display Handle</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              placeholder="e.g. alex_dev"
              maxLength={20}
              className="w-full px-3.5 py-2.5 bg-[#08090b] border border-[#1f232b] focus:border-emerald-500/60 rounded-xl text-slate-100 text-xs font-mono-code placeholder:text-slate-600 outline-none transition-colors"
            />
          </div>

          {/* About */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono-code uppercase tracking-wider text-slate-400">Status / About</label>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              rows={2}
              maxLength={100}
              placeholder="Short bio or status"
              className="w-full px-3.5 py-2.5 bg-[#08090b] border border-[#1f232b] focus:border-emerald-500/60 rounded-xl text-slate-100 text-xs placeholder:text-slate-600 outline-none transition-colors resize-none"
            />
          </div>

          {/* Terms */}
          <label className="flex items-start gap-2.5 cursor-pointer text-slate-400 hover:text-slate-300 transition-colors pt-1">
            <input 
              type="checkbox" 
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 accent-emerald-500 rounded border-[#1f232b] bg-[#08090b]"
            />
            <span className="text-xs text-slate-400 leading-normal">
              I agree to the Terms of Service & Privacy Policy for workspace communications.
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full active-press bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-xs"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                Complete Setup <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      </div>

      <p className="text-[11px] font-mono-code text-slate-600 mt-6 z-10">
        ZoHo Web Protocol &middot; Profile Identity
      </p>
    </div>
  );
}
