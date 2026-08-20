import React from 'react';

// Prevents a single crashing component from taking down the whole app to a
// blank white screen. Instead shows a small recoverable error state that
// matches the dark/green ZoHo Web visual language.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ZoHo Web crashed:', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#08090b] grid-bg flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="w-full max-w-sm bg-[#101216] border border-[#1f232b] rounded-2xl p-7 shadow-2xl">
            <p className="font-mono-code text-[10px] text-rose-400 uppercase tracking-widest mb-2">Something went wrong</p>
            <h1 className="text-base font-bold text-slate-100 mb-2">This screen hit an error</h1>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Your session is still safe. Try reloading the workspace — if the problem continues, sign out and back in.
            </p>
            <button
              onClick={this.handleReload}
              className="w-full active-press bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
