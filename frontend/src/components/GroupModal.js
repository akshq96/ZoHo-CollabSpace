import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import { X, Search, Check, Users } from 'lucide-react';
import { resolveUrl } from '../utils/media';

export default function GroupModal({ isOpen, onClose, onCreateGroup, currentUser }) {
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === 'success') {
          setUsers(data.data);
        }
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };

    fetchUsers();
    setGroupName('');
    setSelectedUsers([]);
    setSearchQuery('');
    setError('');
  }, [isOpen]);

  const toggleSelectUser = (userId) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }
    if (selectedUsers.length === 0) {
      setError('Select at least one participant');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/conversations/group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          groupName,
          participants: selectedUsers
        })
      });
      const data = await res.json();

      if (data.status === 'success' && data.data) {
        onCreateGroup(data.data);
        onClose();
      } else {
        setError(data.message || 'Failed to create group');
      }
    } catch (err) {
      console.error(err);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredUsers = users.filter(u => 
    u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 select-none">
      <div className="w-full max-w-[420px] bg-[#101216] border border-[#1f232b] rounded-2xl overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1f232b]">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-sm text-slate-100">Create Group Chat</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium rounded-xl">
              {error}
            </div>
          )}

          {/* Group Name */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono-code uppercase tracking-wider text-slate-400">Group Name</label>
            <input
              type="text"
              required
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Engineering Team"
              className="w-full px-3 py-2 bg-[#08090b] border border-[#1f232b] focus:border-emerald-500/60 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 outline-none"
            />
          </div>

          {/* Members */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono-code uppercase tracking-wider text-slate-400">Select Members</label>
            
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#08090b] border border-[#1f232b] focus:border-emerald-500/60 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 outline-none"
              />
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar pr-1">
              {filteredUsers.length === 0 ? (
                <p className="text-slate-600 text-xs text-center py-3">No users found</p>
              ) : (
                filteredUsers.map(user => {
                  const isSelected = selectedUsers.includes(user._id);
                  return (
                    <div
                      key={user._id}
                      onClick={() => toggleSelectUser(user._id)}
                      className={`flex items-center justify-between p-2 rounded-xl cursor-pointer border transition-colors ${isSelected ? 'bg-[#1a1e27] border-[#2d333f]' : 'bg-[#08090b] border-[#1f232b] hover:border-slate-700'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={resolveUrl(user.profilePicture) || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`}
                          alt={user.username}
                          className="w-7 h-7 rounded-md object-cover"
                        />
                        <span className="text-xs font-semibold text-slate-100">{user.username}</span>
                      </div>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'border-slate-700 bg-transparent'}`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 active-press border border-[#1f232b] hover:bg-[#1a1e27] text-slate-300 font-semibold py-2 px-3 rounded-xl transition-colors text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] active-press bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold py-2 px-3 rounded-xl transition-colors text-xs flex items-center justify-center gap-1"
            >
              {loading ? (
                <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Create Group'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
