"use client"
import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, Chrome, X } from 'lucide-react';

type Props = {
  open: boolean;
  initialMode?: 'login' | 'signup';
  onClose: () => void;
};

export default function AuthModal({ open, initialMode = 'login', onClose }: Props) {
  const router = useRouter();
  const [mode, setMode] = React.useState<'login' | 'signup'>(initialMode);
  const [showPw, setShowPw] = React.useState(false);

  React.useEffect(() => setMode(initialMode), [initialMode]);

  if (!open) return null;

  const onSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    onClose();
    router.push('/ai'); // hook real auth here later
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-[2px] flex items-center justify-center px-4">
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0f1420] text-white p-6 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)]">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 h-8 w-8 grid place-items-center rounded-full hover:bg-white/5 text-white/70"
        >
          <X size={18} />
        </button>

        {/* Brand + role */}
        <div className="flex items-center gap-3 justify-center mb-5">
          <Image src="/crewconnect.jpg" alt="CrewConnect" width={28} height={28} className="rounded-full" />
          <div className="text-sm px-3 py-1 rounded-full bg-white/[0.06] border border-white/10">Customer</div>
        </div>

        <h1 className="text-xl font-semibold text-center">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          {/* Email */}
          <label className="block">
            <span className="text-sm text-white/80">Email</span>
            <div className="mt-1 flex items-center gap-2 h-10 rounded-lg bg-black/30 border border-white/10 px-3 focus-within:border-white/20">
              <Mail size={16} className="text-white/60" />
              <input
                type="email"
                required
                className="flex-1 h-full bg-transparent outline-none"
                placeholder="Enter your email"
              />
            </div>
          </label>

          {/* Password */}
          <label className="block">
            <span className="text-sm text-white/80">Password</span>
            <div className="mt-1 flex items-center gap-2 h-10 rounded-lg bg-black/30 border border-white/10 px-3 focus-within:border-white/20">
              <Lock size={16} className="text-white/60" />
              <input
                type={showPw ? 'text' : 'password'}
                required
                className="flex-1 h-full bg-transparent outline-none"
                placeholder="Enter your password"
              />
              <button type="button" onClick={() => setShowPw(v => !v)} className="text-white/60">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            className="w-full h-10 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 font-medium"
          >
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <button
          onClick={() => { onClose(); router.push('/ai'); }}
          className="mt-3 w-full h-10 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 font-medium flex items-center justify-center gap-2"
        >
          <Chrome size={16} /> Continue with Google
        </button>

        <div className="text-sm text-white/70 text-center mt-4">
          {mode === 'login' ? (
            <>New here?{' '}
              <button onClick={() => setMode('signup')} className="text-white hover:underline">Sign up</button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button onClick={() => setMode('login')} className="text-white hover:underline">Log in</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}