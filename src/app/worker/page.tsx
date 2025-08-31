'use client';

import React from 'react';
import {
  Sun,
  Settings,
  MapPin,
  Clock3,
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  Upload,
  Star,
  CalendarDays,
  DollarSign,
} from 'lucide-react';

/* --------------------------------- TYPES --------------------------------- */

type TabKey = 'offers' | 'jobs' | 'profile';

type Offer = {
  id: string;
  title: string;
  isNew?: boolean;
  suburb: string;
  km: number;
  time: string;
  rate: number; // $/hr
  etaMin: number;
  badges: string[];
  countdown: string; // e.g. "14:32"
};

/* ------------------------------- SAMPLE DATA ------------------------------ */

const OFFERS: Offer[] = [
  {
    id: '1',
    title: 'Licensed Electrician',
    isNew: true,
    suburb: 'Surry Hills',
    km: 3.2,
    time: '2:00–6:00 PM',
    rate: 82,
    etaMin: 11,
    badges: ['Licensed', 'Can arrive 15min early'],
    countdown: '14:32',
  },
  {
    id: '2',
    title: 'Bathroom Tiler',
    suburb: 'Paddington',
    km: 5.1,
    time: '6:00–10:00 AM',
    rate: 75,
    etaMin: 18,
    badges: ['Can arrive 15min early'],
    countdown: '7:32',
  },
];

/* ------------------------------- UI PRIMITIVES ---------------------------- */

function PillTab({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'h-8 w-full max-w-[220px] rounded-full border text-sm transition',
        active
          ? 'bg-[#2b61ff] text-white border-[#2b61ff]'
          : 'bg-transparent text-white/80 border-white/10 hover:border-white/20',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function SectionCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        'rounded-2xl border border-white/10 bg-[#0e131c] p-5 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.7)] ' +
        className
      }
    >
      {children}
    </div>
  );
}

/* -------------------------------- OFFERS UI ------------------------------- */

function OfferCard({ offer }: { offer: Offer }) {
  return (
    <section className="rounded-[16px] border border-white/8 bg-[#0e131c] shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
      <div className="p-5">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] font-semibold">{offer.title}</h3>
            {offer.isNew && (
              <span className="text-[11px] px-2 py-[2px] rounded-full border border-white/10 text-white/70">
                New
              </span>
            )}
          </div>
          <div className="text-[12px] text-white/50 flex items-center gap-1">
            <Clock3 size={14} className="opacity-60" />
            {offer.countdown}
          </div>
        </div>

        {/* Meta */}
        <div className="mt-4 flex flex-wrap items-center gap-6 text-[13px]">
          <div className="flex items-center gap-2 text-white/70">
            <MapPin size={14} className="opacity-60" />
            <span>{offer.suburb}</span>
            <span className="mx-1 text-white/20">•</span>
            <span>{offer.km.toFixed(1)} km</span>
          </div>
          <div className="flex items-center gap-2 text-white/70">
            <Clock3 size={14} className="opacity-60" />
            <span>{offer.time}</span>
          </div>
        </div>

        {/* Rate / ETA */}
        <div className="mt-3 flex items-center gap-3">
          <div className="text-[#15d36a] font-semibold text-[15px]">
            ${offer.rate}/hr
          </div>
          <div className="text-white/50 text-[12px]">· ETA {offer.etaMin} min</div>
        </div>

        {/* Badges */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {offer.badges.map((b, i) => (
            <span
              key={i}
              className="text-[11px] px-2 py-[4px] rounded-full border border-white/10 text-white/70 inline-flex items-center gap-1"
            >
              {b === 'Licensed' && <BadgeCheck size={12} className="text-white/60" />}
              {b}
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-5 flex items-center gap-3">
          <button className="h-9 flex-1 rounded-full bg-[#2b61ff] hover:brightness-110 transition text-sm font-medium">
            Accept
          </button>
          <button className="h-9 flex-1 rounded-full border border-white/10 text-sm text-white/80 hover:border-white/20 transition">
            Decline
          </button>
        </div>

        {/* Why matched */}
        <div className="mt-4 text-[12px] text-white/45 inline-flex items-center gap-1 cursor-pointer select-none">
          Why matched?
          <ChevronDown size={14} className="opacity-60" />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ MY JOBS (UI) ------------------------------ */

function JobsList() {
  return (
    <div className="space-y-8">
      {/* TODAY */}
      <div>
        <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-white/45">Today</div>
        <div className="space-y-3">
          <SectionCard className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[15px]">Leak Detection & Fix</div>
                <div className="text-[12px] text-white/50">Surry Hills</div>
              </div>
              <div className="flex items-center gap-4 text-[12px] text-white/60">
                <span>4 hours · $88/hr</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/70">in-progress</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>
          </SectionCard>

          <SectionCard className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[15px]">Switchboard Upgrade</div>
                <div className="text-[12px] text-white/50">Darlinghurst</div>
              </div>
              <div className="flex items-center gap-4 text-[12px] text-white/60">
                <span>5 hours · $86/hr</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/70">assigned</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* UPCOMING */}
      <div>
        <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-white/45">Upcoming</div>
        <SectionCard className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[15px]">Roof Inspection</div>
              <div className="text-[12px] text-white/50">Newtown</div>
            </div>
            <div className="flex items-center gap-4 text-[12px] text-white/60">
              <span>3 hours · $74/hr</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/70">assigned</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </SectionCard>
      </div>

      {/* HELD (RSVP) */}
      <div>
        <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-white/45">Held (RSVP)</div>
        <SectionCard className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[15px]">Deck Repairs</div>
              <div className="text-[12px] text-white/50">Alexandria</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[12px] text-white/70">
                Tentative — confirm by Tue 7:00 pm
              </span>
              <button className="h-8 rounded-full bg-[#2b61ff] px-4 text-[12px]">Confirm</button>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

/* ------------------------------ PROFILE (UI) ------------------------------ */

function ProfilePanel() {
  return (
    <div className="space-y-8">
      {/* Basics */}
      <SectionCard>
        <div className="text-[15px] font-medium mb-4">Basics</div>
        <div className="grid grid-cols-2 gap-6 text-[13px]">
          <div>
            <div className="text-white/50">Name</div>
            <div>Jordan Davis</div>
          </div>
          <div>
            <div className="text-white/50">Suburb</div>
            <div>Surry Hills</div>
          </div>
        </div>
      </SectionCard>

      {/* Skills & Licences */}
      <SectionCard>
        <div className="text-[15px] font-medium mb-4">Skills &amp; Licences</div>

        <div className="mb-4 text-[13px] text-white/60">Skills</div>
        <div className="flex flex-wrap gap-2">
          {[
            'Plumber',
            'Electrician',
            'Tiler',
            'Carpenter',
            'Painter',
            'Roofer',
            'HVAC',
            'Handyman',
            'Landscaper',
            'Glazier',
          ].map((s, i) => (
            <span
              key={s}
              className={
                'rounded-full border px-3 py-1 text-[12px] ' +
                (i < 3 ? 'bg-[#2b61ff] border-transparent' : 'bg-white/[0.02] border-white/10 text-white/80')
              }
            >
              {s}
            </span>
          ))}
        </div>

        <div className="mt-6 text-[13px] text-white/60">Licences</div>
        {[
          { name: 'Electrical Licence', status: 'Verified' },
          { name: 'Contractor Licence', status: 'Verified' },
          { name: 'Working at Heights', status: '' },
          { name: 'White Card (OH&S)', status: 'On file' },
        ].map((l) => (
          <div
            key={l.name}
            className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <input type="checkbox" defaultChecked={!!l.status} className="accent-[#2b61ff]" />
              <span className="text-[13px]">{l.name}</span>
              {l.status && (
                <span
                  className={
                    'ml-1 rounded-full px-2 py-0.5 text-[11px] ' +
                    (l.status === 'Verified' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/70')
                  }
                >
                  {l.status}
                </span>
              )}
            </div>
            <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12px]">
              <Upload className="h-3.5 w-3.5" /> Upload
            </button>
          </div>
        ))}
      </SectionCard>

      {/* Rate & Radius */}
      <SectionCard>
        <div className="text-[15px] font-medium mb-4">Rate &amp; Radius</div>
        <div className="grid gap-6 text-[13px]">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 opacity-70" />
            <span className="text-white">88</span>
            <span className="text-white/50">/ hr</span>
          </div>
          <div>
            <div className="text-white/60 mb-1">Travel Radius: 8 km</div>
            <input type="range" defaultValue={35} className="w-56 accent-[#2b61ff]" />
          </div>
          <div>
            <div className="text-white/60 mb-1">Transport</div>
            <div className="flex items-center gap-2">
              {['Walk', 'PT', 'Car'].map((t, i) => (
                <button
                  key={t}
                  className={
                    'rounded-full px-3 py-1 text-[12px] ' +
                    (i === 2
                      ? 'bg-[#2b61ff] text-white'
                      : 'bg-white/[0.08] text-white border border-white/10')
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Availability */}
      <SectionCard>
        <div className="text-[15px] font-medium mb-4">Availability</div>
        <div className="mb-3 text-[13px] text-white/60">Quick Set Today</div>
        <div className="flex items-center gap-2">
          {['2–6 pm', '6–10 pm', 'All day'].map((t, i) => (
            <button
              key={t}
              className={
                'rounded-full border px-3 py-1 text-[12px] ' +
                (i === 0 ? 'bg-[#2b61ff] border-transparent' : 'bg-white/[0.02] border-white/10 text-white/80')
              }
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-6 text-[13px] text-white/60">Weekly Schedule</div>
        <div className="mt-2 space-y-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
            <div
              key={d}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2"
            >
              <div className="flex items-center gap-3">
                <input type="checkbox" defaultChecked={i < 6} className="accent-[#2b61ff]" />
                <span className="text-[13px] w-10">{d}</span>
              </div>
              <div className="text-[13px] text-white/70">09:00 AM to 05:00 PM</div>
            </div>
          ))}
        </div>

        <button className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12px]">
          <CalendarDays className="h-3.5 w-3.5" />
          Sync Calendar
        </button>
      </SectionCard>

      {/* Reliability */}
      <SectionCard>
        <div className="text-[15px] font-medium mb-3">Reliability</div>
        <div className="flex items-center gap-2 text-[13px]">
          <Star className="h-4 w-4 text-yellow-300" />
          <span>4.8</span>
          <span className="text-white/50">/ 5.0</span>
          <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-300">
            Excellent
          </span>
        </div>
        <div className="mt-3 text-[12px] text-white/60">
          Based on punctuality, completion rate, and client feedback
        </div>
      </SectionCard>

      {/* Settings */}
      <SectionCard>
        <div className="text-[15px] font-medium mb-3">Settings</div>
        <div className="space-y-5 text-[13px]">
          <div>
            <div className="mb-1">Push Notifications</div>
            <div className="text-white/60">Get notified of new offers</div>
          </div>
          <div>
            <div className="mb-1">Auto-accept</div>
            <div className="text-white/60">Auto-accept within 8 km above $80/hr</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 text-[12px]">
          <button className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left">
            Bank/Payout Settings
          </button>
          <button className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left">
            Verification Status (KYC)
          </button>
          <button className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left col-span-2">
            Portfolio Auto-build
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

/* ---------------------------------- PAGE ---------------------------------- */

export default function WorkerPage() {
  const [tab, setTab] = React.useState<TabKey>('offers');

  return (
    <div className="min-h-screen bg-[#0b0f17] text-white">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 h-12 border-b border-white/5 bg-[#0b0f17]/90 backdrop-blur">
        <div className="mx-auto h-full max-w-[1100px] px-4 flex items-center justify-between">
          {/* Left brand */}
          <div className="text-[14px] font-semibold tracking-tight">CrewConnect</div>

          {/* Center strip */}
          <div className="hidden md:block text-[11px] uppercase tracking-[0.18em] text-white/45">
            Instant offers. First to accept wins. No bids.
          </div>

          {/* Right metrics + icons */}
          <div className="flex items-center gap-3 text-[12px] text-white/60">
            <span>
              Wins today <span className="text-white">3</span>
            </span>
            <span className="text-white/30">·</span>
            <span>
              km saved <span className="text-white">12.4</span>
            </span>
            <span className="text-white/30">·</span>
            <span>
              reliability <span className="text-white">4.8</span>
            </span>
            <Sun className="w-4 h-4 opacity-70" />
            <Settings className="w-4 h-4 opacity-70" />
            <div
              className="w-7 h-7 rounded-full overflow-hidden border border-white/10 bg-[url('/crewconnect.jpg')] bg-cover bg-center"
              aria-hidden
            />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="mx-auto max-w-[1100px] px-4 pt-8">
        <div className="mx-auto flex w-full max-w-[720px] items-center justify-between gap-3">
          <PillTab active={tab === 'offers'} onClick={() => setTab('offers')}>
            Offers
          </PillTab>
          <PillTab active={tab === 'jobs'} onClick={() => setTab('jobs')}>
            My Jobs
          </PillTab>
          <PillTab active={tab === 'profile'} onClick={() => setTab('profile')}>
            Profile
          </PillTab>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-[1100px] px-4 py-8">
        {tab === 'offers' && (
          <div className="space-y-6">
            {OFFERS.map((o) => (
              <OfferCard key={o.id} offer={o} />
            ))}
          </div>
        )}

        {tab === 'jobs' && <JobsList />}

        {tab === 'profile' && <ProfilePanel />}
      </main>
    </div>
  );
}