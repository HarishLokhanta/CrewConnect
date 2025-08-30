'use client';

import React from 'react';
import AuthModal from './AuthModal';

export default function AuthButtons() {
  const [open, setOpen] = React.useState(false);
  const [initialMode, setInitialMode] = React.useState<'login' | 'signup'>('login');

  return (
    <>
      {/* replace your current Login/Sign Up links with these buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { setInitialMode('login'); setOpen(true); }}
          className="h-9 px-4 rounded-xl border border-white/15 text-white/90 hover:bg-white/5"
        >
          Login
        </button>
        <button
          onClick={() => { setInitialMode('signup'); setOpen(true); }}
          className="h-9 px-4 rounded-xl bg-gradient-to-b from-white to-white/80 text-black rounded-[12px] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)]"
        >
          Sign Up
        </button>
      </div>

      <AuthModal open={open} initialMode={initialMode} onClose={() => setOpen(false)} />
    </>
  );
}