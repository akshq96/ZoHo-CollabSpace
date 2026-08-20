import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';

export default function CustomCursor() {
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [trailingPos, setTrailingPos] = useState({ x: -100, y: -100 });
  const [hoverType, setHoverType] = useState(null); // null | 'card' | 'input' | 'button' | 'link'
  const [isClicked, setIsClicked] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Disable custom cursor on mobile / touch screen devices
    const checkMobile = () => {
      const isTouch = window.matchMedia('(hover: none)').matches || window.innerWidth < 768;
      setIsMobile(isTouch);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    let animId;

    const handleMouseMove = (e) => {
      setPosition({ x: e.clientX, y: e.clientY });

      const target = e.target;
      if (target.closest('button[type="submit"], .btn-continue')) {
        setHoverType('button');
      } else if (target.closest('input, textarea')) {
        setHoverType('input');
      } else if (target.closest('a, button, .clickable')) {
        setHoverType('link');
      } else if (target.closest('.login-card')) {
        setHoverType('card');
      } else {
        setHoverType(null);
      }
    };

    const handleMouseDown = () => setIsClicked(true);
    const handleMouseUp = () => setIsClicked(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    // Smooth trailing physics loop (lerp)
    const animateTrailing = () => {
      setTrailingPos(prev => ({
        x: prev.x + (position.x - prev.x) * 0.18,
        y: prev.y + (position.y - prev.y) * 0.18
      }));
      animId = requestAnimationFrame(animateTrailing);
    };
    animId = requestAnimationFrame(animateTrailing);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      cancelAnimationFrame(animId);
    };
  }, [position.x, position.y]);

  if (isMobile) return null;

  return (
    <>
      {/* Center crisp dot */}
      <div 
        className="fixed top-0 left-0 w-1.5 h-1.5 bg-emerald-400 rounded-full pointer-events-none z-50 transition-transform duration-75 ease-out shadow-[0_0_8px_#10b981]"
        style={{
          transform: `translate3d(${position.x - 3}px, ${position.y - 3}px, 0) scale(${isClicked ? 0.6 : hoverType ? 1.2 : 1})`
        }}
      />

      {/* Trailing ring physics */}
      <div 
        className={`fixed top-0 left-0 rounded-full pointer-events-none z-40 border border-emerald-500/30 transition-all duration-200 flex items-center justify-center ${
          hoverType === 'button'
            ? 'w-9 h-9 bg-emerald-400/20 border-emerald-400 text-slate-950 scale-110'
            : hoverType === 'input'
            ? 'w-6 h-6 border-emerald-400/60 bg-emerald-500/10'
            : hoverType === 'link'
            ? 'w-7 h-7 border-emerald-400/50'
            : hoverType === 'card'
            ? 'w-8 h-8 border-slate-700 bg-slate-900/30'
            : 'w-6 h-6 opacity-60'
        }`}
        style={{
          transform: `translate3d(${trailingPos.x - (hoverType === 'button' ? 18 : hoverType === 'card' ? 16 : 12)}px, ${trailingPos.y - (hoverType === 'button' ? 18 : hoverType === 'card' ? 16 : 12)}px, 0) scale(${isClicked ? 0.8 : 1})`
        }}
      >
        {hoverType === 'button' && <ArrowRight className="w-3 h-3 text-emerald-400" />}
      </div>
    </>
  );
}
