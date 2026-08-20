import React, { useState, useRef } from 'react';
import { API_BASE } from '../App';
import CustomCursor from './CustomCursor';
import ThemeToggle from './ThemeToggle';
import { 
  Shield, Mail, Phone, ArrowRight, ArrowLeft, 
  Lock, KeyRound, ChevronDown, ChevronUp, 
  Zap, UserCheck, ShieldCheck, Clock, Users, Database
} from 'lucide-react';

export default function AuthScreen({ onAuthSuccess }) {
  const [method, setMethod] = useState('email');
  const [email, setEmail] = useState('');
  const [phoneSuffix, setPhoneSuffix] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  
  // Accordion State
  const [expandedFaq, setExpandedFaq] = useState(null);

  // 3D Card Tilt State
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });

  const handleCardMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    
    // Max 3 degrees tilt
    const rotateX = -(y / (rect.height / 2)) * 3;
    const rotateY = (x / (rect.width / 2)) * 3;
    setTilt({ rotateX, rotateY });
  };

  const handleCardMouseLeave = () => {
    setTilt({ rotateX: 0, rotateY: 0 });
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfoMessage('');

    const body = method === 'email' 
      ? { email } 
      : { phoneNumber, phoneSuffix };

    try {
      const res = await fetch(`${API_BASE}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (data.status === 'success') {
        setInfoMessage(data.message || 'Verification code dispatched.');
        setStep(2);
      } else {
        setError(data.message || 'Failed to send OTP. Please check input.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error. Verify backend process.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const body = method === 'email'
      ? { email, otp }
      : { phoneNumber, phoneSuffix, otp };

    try {
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (data.status === 'success' && data.data) {
        onAuthSuccess(data.data.user, data.data.token);
      } else {
        setError(data.message || 'Invalid or expired code.');
      }
    } catch (err) {
      console.error(err);
      setError('Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const faqs = [
    {
      q: "What is passwordless authentication?",
      a: "Passwordless authentication allows you to sign in securely using a one-time verification code sent to your email or phone, removing the need to create, remember, or compromise traditional passwords."
    },
    {
      q: "Is my information secure?",
      a: "Yes. All authentication exchanges, token verifications, and active workspace sessions are protected using industry-standard encryption protocols."
    },
    {
      q: "Can I sign in using my phone?",
      a: "Yes. You can toggle between Email and Phone authentication seamlessly. Selecting Phone dispatches an SMS verification code to your number."
    },
    {
      q: "What happens after verification?",
      a: "Upon successful verification, your identity is authenticated and you are securely redirected straight into your active ZoHo Web workspace."
    },
    {
      q: "Can I access my workspace from different devices?",
      a: "Yes. Supported browsers and devices can be authenticated securely through the available verification process."
    }
  ];

  return (
    <div className="min-h-screen bg-[#080A0D] text-[#F5F7FA] font-sans select-none relative overflow-x-hidden grid-bg">
      
      {/* Custom Micro Cursor */}
      <CustomCursor />

      {/* 1. TOP NAVBAR */}
      <nav className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between z-30 relative border-b border-[#1f232b]/40">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="w-7 h-7 rounded-lg bg-[#101318] border border-[#1f232b] flex items-center justify-center text-emerald-400">
            <Shield className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-sm tracking-tight text-white">ZoHo Web</span>
        </div>

        {/* Minimal Navigation */}
        <div className="flex items-center gap-6 text-xs text-slate-400 font-medium">
          <button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors">Features</button>
          <button onClick={() => scrollToSection('workspace')} className="hover:text-white transition-colors">Workspace</button>
          <button onClick={() => scrollToSection('faq')} className="hover:text-white transition-colors">FAQ</button>
          <ThemeToggle />
        </div>
      </nav>

      {/* 2. HERO SECTION WITH CENTERED LOGIN CARD */}
      <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-4 py-12 relative z-20">
        
        {/* Perspective container for 3D Tilt */}
        <div className="w-full max-w-[400px] perspective-1000">
          <div 
            ref={cardRef}
            onMouseMove={handleCardMouseMove}
            onMouseLeave={handleCardMouseLeave}
            style={{
              transform: `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
              transition: tilt.rotateX === 0 ? 'transform 0.5s ease-out' : 'transform 0.05s ease-out'
            }}
            className="login-card bg-[#101318] border border-[#1f232b] rounded-2xl p-7 shadow-2xl relative transition-shadow duration-300 hover:border-[#2d333f]"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-5 mb-5 border-b border-[#1f232b]">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs text-slate-200">ZoHo Web</span>
              </div>
              <span className="font-mono-code text-[10px] text-slate-500 uppercase tracking-widest">SECURE AUTH</span>
            </div>

            {/* Title */}
            <div className="mb-5">
              <h1 className="text-base font-bold text-slate-100">Sign in to workspace</h1>
              <p className="text-xs text-slate-400 mt-1">Passwordless authentication via one-time verification token</p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
                {error}
              </div>
            )}

            {infoMessage && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                {infoMessage}
              </div>
            )}

            {step === 1 ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                
                {/* Method Switcher */}
                <div className="flex p-1 rounded-xl bg-[#080A0D] border border-[#1f232b]">
                  <button
                    type="button"
                    onClick={() => { setMethod('email'); setError(''); }}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${method === 'email' ? 'bg-[#1a1e27] text-slate-100 border border-[#2d333f]' : 'text-slate-500'}`}
                  >
                    <Mail className="w-3.5 h-3.5" /> Email
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMethod('phone'); setError(''); }}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${method === 'phone' ? 'bg-[#1a1e27] text-slate-100 border border-[#2d333f]' : 'text-slate-500'}`}
                  >
                    <Phone className="w-3.5 h-3.5" /> Phone
                  </button>
                </div>

                {method === 'email' ? (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono-code uppercase tracking-wider text-slate-400">Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full px-3.5 py-2.5 bg-[#080A0D] border border-[#1f232b] focus:border-emerald-500/60 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 outline-none transition-colors"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono-code uppercase tracking-wider text-slate-400">Phone Number</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={phoneSuffix}
                        onChange={(e) => setPhoneSuffix(e.target.value)}
                        className="w-14 py-2.5 text-center bg-[#080A0D] border border-[#1f232b] focus:border-emerald-500/60 rounded-xl text-xs text-slate-100 font-mono-code outline-none transition-colors"
                      />
                      <input
                        type="tel"
                        required
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="9876543210"
                        className="flex-1 px-3.5 py-2.5 bg-[#080A0D] border border-[#1f232b] focus:border-emerald-500/60 rounded-xl text-xs text-slate-100 font-mono-code placeholder:text-slate-600 outline-none transition-colors"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-continue w-full active-press bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold py-2.5 px-4 rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center justify-center gap-2 text-xs"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      Continue <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono-code uppercase tracking-wider text-slate-400">Enter Verification Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="000000"
                    className="w-full px-3.5 py-2.5 bg-[#080A0D] border border-[#1f232b] focus:border-emerald-500/60 rounded-xl text-slate-100 tracking-[0.5em] text-center font-mono-code text-base outline-none"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 border border-[#1f232b] hover:bg-[#1a1e27] text-slate-300 font-semibold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-[2] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      'Verify Code'
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Passkey Option */}
            <div className="pt-2">
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-[#1f232b]"></div>
                <span className="flex-shrink mx-3 text-[10px] font-mono-code text-slate-500">OR</span>
                <div className="flex-grow border-t border-[#1f232b]"></div>
              </div>

              <button
                type="button"
                onClick={() => alert("Passkey feature initialized. Use OTP authentication for current session.")}
                className="w-full py-2 px-3 bg-[#080A0D] border border-[#1f232b] hover:border-slate-700 rounded-xl flex items-center justify-between text-xs text-slate-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Sign in with Passkey</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-mono-code text-emerald-400 font-semibold">Recommended</span>
              </button>
            </div>

            <p className="text-[10px] text-slate-500 text-center flex items-center justify-center gap-1 pt-1">
              <Lock className="w-3 h-3 text-emerald-400" /> Your data is encrypted end-to-end
            </p>
          </div>
        </div>

        {/* Protocol Session Tag */}
        <p className="text-[11px] font-mono-code text-slate-500 mt-6">
          ZoHo Web Protocol &middot; Encrypted Session
        </p>

        {/* Scroll Indicator */}
        <button 
          onClick={() => scrollToSection('features')}
          className="flex items-center gap-1.5 mt-8 text-[10px] font-mono-code text-slate-500 hover:text-emerald-400 uppercase tracking-widest transition-colors cursor-pointer"
        >
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
          SCROLL TO EXPLORE ↓
        </button>
      </div>

      {/* 3. SECTION 1: FEATURES ("Built for secure access.") */}
      <section id="features" className="w-full max-w-4xl mx-auto px-6 py-20 border-t border-[#1f232b]/50">
        <div className="mb-10">
          <span className="font-mono-code text-emerald-400 text-[10px] font-bold uppercase tracking-widest">FEATURES</span>
          <h2 className="text-2xl font-bold text-white tracking-tight mt-1">Built for secure access.</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-md">Everything you need for a simple and secure workspace authentication experience.</p>
        </div>

        {/* 2x2 Clean Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-[#101318] border border-[#1f232b] hover:border-[#2d333f] transition-all space-y-2">
            <UserCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-xs font-bold text-white">Passwordless Authentication</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Sign in without remembering another password.</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#101318] border border-[#1f232b] hover:border-[#2d333f] transition-all space-y-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-xs font-bold text-white">Secure Verification</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Verify your identity using a secure one-time verification code.</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#101318] border border-[#1f232b] hover:border-[#2d333f] transition-all space-y-2">
            <Lock className="w-5 h-5 text-emerald-400" />
            <h3 className="text-xs font-bold text-white">Encrypted Sessions</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Keep authenticated sessions protected from unauthorized access.</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#101318] border border-[#1f232b] hover:border-[#2d333f] transition-all space-y-2">
            <Zap className="w-5 h-5 text-emerald-400" />
            <h3 className="text-xs font-bold text-white">Fast Access</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Get into your workspace quickly without unnecessary steps.</p>
          </div>
        </div>
      </section>

      {/* 4. SECTION 2: WORKSPACE CAPABILITIES ("Everything you need in one workspace.") */}
      <section id="workspace" className="w-full max-w-4xl mx-auto px-6 py-20 border-t border-[#1f232b]/50">
        <div className="mb-10">
          <span className="font-mono-code text-emerald-400 text-[10px] font-bold uppercase tracking-widest">WORKSPACE</span>
          <h2 className="text-2xl font-bold text-white tracking-tight mt-1">Everything you need in one workspace.</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-md">Once authenticated, access your workspace and tools through a secure, unified environment.</p>
        </div>

        {/* 4 Capabilities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-[#101318] border border-[#1f232b] hover:border-[#2d333f] transition-all space-y-2">
            <Database className="w-5 h-5 text-emerald-400" />
            <h3 className="text-xs font-bold text-white">Workspace Access</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Securely access your connected workspace.</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#101318] border border-[#1f232b] hover:border-[#2d333f] transition-all space-y-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h3 className="text-xs font-bold text-white">Team Collaboration</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Work with your team while keeping access controlled.</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#101318] border border-[#1f232b] hover:border-[#2d333f] transition-all space-y-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            <h3 className="text-xs font-bold text-white">Session Management</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Manage and monitor active workspace sessions.</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#101318] border border-[#1f232b] hover:border-[#2d333f] transition-all space-y-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h3 className="text-xs font-bold text-white">Protected Data</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Keep workspace information protected through secure authentication.</p>
          </div>
        </div>
      </section>

      {/* 5. SECTION 3: HOW IT WORKS */}
      <section className="w-full max-w-4xl mx-auto px-6 py-20 border-t border-[#1f232b]/50">
        <div className="mb-10">
          <span className="font-mono-code text-emerald-400 text-[10px] font-bold uppercase tracking-widest">TIMELINE</span>
          <h2 className="text-2xl font-bold text-white tracking-tight mt-1">How it works</h2>
        </div>

        {/* 3 Numbered Steps Timeline */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          <div className="p-5 rounded-2xl bg-[#101318] border border-[#1f232b] space-y-3">
            <span className="text-2xl font-extrabold font-mono-code text-emerald-400">01</span>
            <h3 className="text-xs font-bold text-white">Enter your email or phone</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Provide your registered contact handle to request a verification token.</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#101318] border border-[#1f232b] space-y-3">
            <span className="text-2xl font-extrabold font-mono-code text-emerald-400">02</span>
            <h3 className="text-xs font-bold text-white">Verify your identity</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Input the secure 6-digit one-time code sent directly to your device.</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#101318] border border-[#1f232b] space-y-3">
            <span className="text-2xl font-extrabold font-mono-code text-emerald-400">03</span>
            <h3 className="text-xs font-bold text-white">Access your workspace</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Instantly gain authenticated access to messaging, stories, and groups.</p>
          </div>
        </div>
      </section>

      {/* 6. SECTION 4: FAQ */}
      <section id="faq" className="w-full max-w-4xl mx-auto px-6 py-20 border-t border-[#1f232b]/50">
        <div className="mb-10">
          <span className="font-mono-code text-emerald-400 text-[10px] font-bold uppercase tracking-widest">FAQ</span>
          <h2 className="text-2xl font-bold text-white tracking-tight mt-1">Frequently asked questions</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = expandedFaq === idx;
            return (
              <div 
                key={idx} 
                className="rounded-2xl bg-[#101318] border border-[#1f232b] overflow-hidden transition-colors"
              >
                <button 
                  onClick={() => setExpandedFaq(isOpen ? null : idx)}
                  className="w-full p-4 text-left flex items-center justify-between font-bold text-xs text-slate-200 hover:text-emerald-400 transition-colors"
                >
                  <span>{faq.q}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-emerald-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 text-xs text-slate-400 leading-relaxed border-t border-[#1f232b]/50 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 7. SECTION 5: SMALL SECURITY STATUS */}
      <section className="w-full max-w-4xl mx-auto px-6 py-12 border-t border-[#1f232b]/50">
        <div className="p-4 rounded-2xl bg-[#101318] border border-[#1f232b] flex flex-wrap items-center justify-between gap-4">
          <span className="font-mono-code text-[10px] font-bold text-slate-400 uppercase tracking-widest">SECURE SESSION</span>
          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-300">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span> Connection protected</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span> Identity verified</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span> Workspace secure</span>
          </div>
        </div>
      </section>

      {/* 8. SECTION 6: MINIMAL FOOTER */}
      <footer className="w-full border-t border-[#1f232b] bg-[#080A0D] py-10 px-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            <span className="font-bold text-white">ZoHo Web</span>
            <p className="text-[11px] text-slate-500 mt-0.5">Secure workspace authentication.</p>
          </div>

          <div className="flex items-center gap-6 text-xs">
            <button onClick={() => alert("Privacy Policy: All authentication tokens and workspace sessions are encrypted.")} className="hover:text-white transition-colors">Privacy</button>
            <button onClick={() => alert("Security Architecture: Passwordless OTP verification with Socket session validation.")} className="hover:text-white transition-colors">Security</button>
            <button onClick={() => alert("Terms of Service: Workspace terms apply.")} className="hover:text-white transition-colors">Terms</button>
          </div>

          <span className="font-mono-code text-[11px] text-slate-600">
            &copy; 2026 ZoHo Web
          </span>
        </div>
      </footer>
    </div>
  );
}
