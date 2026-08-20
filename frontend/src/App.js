import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import AuthScreen from './components/AuthScreen';
import ProfileSetup from './components/ProfileSetup';
import WorkspaceShell from './components/workspace/WorkspaceShell';
import { API_BASE, SOCKET_URL } from './config';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);

  // Check auth state on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setLoading(false);
          return;
        }

        const res = await fetch(`${API_BASE}/auth/check-auth`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();

        if (data.status === 'success' && data.data) {
          setUser(data.data);
        } else {
          localStorage.removeItem('token');
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Initialize Socket connection when user logs in
  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // Was hardcoded to http://localhost:8000 — same class of bug as
    // API_BASE (see config.js): in production this silently tried to open a
    // websocket to the visitor's own machine, so online-presence/typing/
    // real-time messages would look "broken" even if the REST API worked.
    const newSocket = io(SOCKET_URL, {
      query: { userId: user._id }
    });

    newSocket.on('connect', () => {
      console.log('Connected to socket server:', newSocket.id);
    });

    newSocket.on('getOnlineUsers', (users) => {
      setOnlineUsers(users);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setOnlineUsers([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <div className="relative w-16 h-16">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-emerald-500/20 rounded-full"></div>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-emerald-400 font-medium tracking-wide">Loading ZoHo Web...</p>
      </div>
    );
  }

  // Auth routing
  if (!user) {
    return <AuthScreen onAuthSuccess={(userData, token) => {
      localStorage.setItem('token', token);
      setUser(userData);
    }} />;
  }

  // If user is verified but hasn't completed profile setup (no username)
  if (!user.username) {
    return <ProfileSetup user={user} onSetupSuccess={(updatedUser) => {
      setUser(updatedUser);
    }} />;
  }

  return (
    <WorkspaceShell
      user={user}
      socket={socket}
      onlineUsers={onlineUsers}
      onLogout={handleLogout}
      onProfileUpdate={(updatedUser) => setUser(updatedUser)}
    />
  );
}

export default App;
export { API_BASE };
