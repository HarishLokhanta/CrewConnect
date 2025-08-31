"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, Chrome, X } from 'lucide-react';

export type AuthMode = 'login' | 'signup';

interface AuthModalProps {
  open: boolean;                         // controls visibility
  initialMode?: AuthMode;                // optional: default 'login'
  onClose: () => void;                   // called when modal is dismissed
}

export default function AuthModal({ open, initialMode = 'login', onClose }: AuthModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [showPw, setShowPw] = useState(false);
  const [userType, setUserType] = useState<'client' | 'worker'>('client');

  // keep mode in sync if parent changes initialMode
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // If not open, render nothing (keeps page.tsx visible)
  if (!open) return null;

  const handleClose = () => {
    onClose();
    router.push('/'); // go back to the homepage (page.tsx in /app)
  };

  const onSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    // TODO: replace with real auth
    onClose();
    if (userType === 'worker') {
      router.push('/worker');
    } else {
      router.push('/ai');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0f1420]/90 p-6 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)]">
        {/* Close button */}
        <button
          onClick={handleClose}
          aria-label="Close"
          className="absolute right-3 top-3 h-8 w-8 grid place-items-center rounded-full hover:bg-white/5 text-white/70"
        >
          <X size={18} />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-5">
          <img src="/crewconnect.jpg" alt="CrewConnect" className="w-8 h-8 rounded-full" />
          <span className="text-[22px]">CrewConnect</span>
        </div>

        {/* Heading */}
        <h1 className="text-xl font-semibold text-center">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>

        {/* User Type Selection */}
        <div className="flex justify-center gap-4 my-6">
          <button
            type="button"
            className={`px-4 py-2 rounded-lg border font-medium ${
              userType === 'client'
                ? 'bg-white/20 border-white/20 text-white'
                : 'bg-white/5 border-white/10 text-white/70'
            }`}
            onClick={() => setUserType('client')}
          >
            Client
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-lg border font-medium ${
              userType === 'worker'
                ? 'bg-white/20 border-white/20 text-white'
                : 'bg-white/5 border-white/10 text-white/70'
            }`}
            onClick={() => setUserType('worker')}
          >
            Worker
          </button>
        </div>

        {/* Form */}
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
              <button type="button" onClick={() => setShowPw((v) => !v)} className="text-white/60">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          {/* Submit */}
          <button
            type="submit"
            className="w-full h-10 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 font-medium"
          >
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Google */}
        <button
          onClick={() => {
            onClose();
            router.push('/ai');
          }}
          className="mt-3 w-full h-10 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 font-medium flex items-center justify-center gap-2"
        >
          <Chrome size={16} /> Continue with Google
        </button>

        {/* Switch Login / Signup */}
        <div className="text-sm text-white/70 text-center mt-4">
          {mode === 'login' ? (
            <>New here?{' '}
              <button onClick={() => setMode('signup')} className="text-white hover:underline">
                Sign up
              </button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button onClick={() => setMode('login')} className="text-white hover:underline">
                Log in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}