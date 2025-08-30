"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";

/* ---------------- types ---------------- */
type Msg = { role: "user" | "assistant" | "status"; text: string; options?: string[] };
type ConvState = {
  job_description?: string;
  address?: string;
  time_window?: string;
  budget_band?: string;
  tasks?: any[];
  crew_options?: any[];
};

/* -------------- helpers --------------- */
function isAddressQuestion(t: string | undefined) {
  if (!t) return false;
  const s = t.toLowerCase();
  return /where('| i)s the job|what('| i)s the address|address|location/.test(s);
}

/** Simple client-side suggestion mapping (so chips sit directly under the AI message) */
function suggestOptionsFor(promptText: string | undefined): string[] {
  if (!promptText) return [];
  const t = promptText.toLowerCase();

  if (/what exactly needs doing|what kind of job/.test(t)) return ["Retile shower", "Replace vanity", "New power point", "Other"];
  if (/type of property/.test(t)) return ["House", "Apartment"];
  if (/where's the job|address|where is the job|what's the address/.test(t)) return [];
  if (/when works|when would you like this done|time window/.test(t)) return ["Weekday", "Weekend", "Specific dates"];
  if (/access constraints|any access/.test(t)) return ["Lift", "Stairs", "Parking", "None"];
  if (/have materials/.test(t)) return ["I have materials", "I need materials", "Not sure yet"];
  if (/budget/.test(t)) return ["<$3k", "$3–5k", "$5–8k", ">$8k", "Skip"];
  return [];
}

function formatTimeNow() {
  try {
    return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

/* --------------- page ----------------- */
export default function CrewConnectPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [state, setState] = useState<ConvState>({
    job_description: "",
    address: "",
    time_window: "",
    budget_band: "",
    tasks: [],
    crew_options: [],
  });

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // location modal state
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [locationWorking, setLocationWorking] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const locationPromptOnce = useRef(false); // avoid popping repeatedly

  // scrolling
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  // Auto-kickoff: ask first question if user hasn't typed
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (messages.length > 0) return;
      setSending(true);
      try {
        const r = await fetch("/api/predict-ui", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [], state }),
        });
        const data = await r.json();
        if (cancel) return;
        if (r.ok) {
          setMessages([
            { role: "assistant", text: data.assistant_reply, options: suggestOptionsFor(data.assistant_reply) },
          ]);
          if (data.state) setState(data.state);
          if (data.done) afterDoneAnimations();
        } else {
          setMessages([{ role: "assistant", text: data.error || "Something went wrong." }]);
        }
      } catch {
        if (!cancel) setMessages([{ role: "assistant", text: "Network error. Try again?" }]);
      } finally {
        if (!cancel) setSending(false);
      }
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If assistant asks for address, offer location modal (once per session)
  useEffect(() => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (!locationPromptOnce.current && last && isAddressQuestion(last.text) && !state.address) {
      locationPromptOnce.current = true;
      setShowLocationPrompt(true);
    }
  }, [messages, state.address]);

  // Unified sender (text or chip)
  const sendMessage = async (text: string) => {
    if (!text.trim() || sending) return;
    const userMsg: Msg = { role: "user", text: text.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSending(true);

    try {
      const r = await fetch("/api/predict-ui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role === "status" ? "assistant" : m.role, content: m.text })),
          state,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setMessages((m) => [...m, { role: "assistant", text: data.error || "Prediction failed." }]);
        return;
      }
      setMessages((m) => [
        ...m,
        { role: "assistant", text: data.assistant_reply, options: suggestOptionsFor(data.assistant_reply) },
      ]);
      if (data?.state) setState(data.state);
      if (data?.done) afterDoneAnimations();
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Network error. Try again?" }]);
    } finally {
      setSending(false);
    }
  };

  // After "done", show scoping progress
  const afterDoneAnimations = () => {
    setMessages((m) => [...m, { role: "status", text: "⚡  Starting project scoping…" }]);
    setTimeout(() => setMessages((m) => [...m, { role: "status", text: "⚡  Finding the perfect crew for your project…" }]), 900);
    setTimeout(() => setMessages((m) => [...m, { role: "status", text: "✅ Found matching crew! Here's your proposal:" }]), 1900);
  };

  const showHero = useMemo(() => messages.length === 0, [messages.length]);

  // --- geolocation flow ---
  const handleUseMyLocation = async () => {
    setLocationWorking(true);
    setLocationError(null);

    if (!("geolocation" in navigator)) {
      setLocationWorking(false);
      setLocationError("Your browser doesn’t support location.");
      return;
    }

    const getPosition = () =>
      new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }),
      );

    try {
      const pos = await getPosition();
      const { latitude, longitude } = pos.coords;

      // Reverse geocode via Nominatim (OpenStreetMap)
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;
      const resp = await fetch(url, {
        headers: {
          // Nominatim asks for an identifying UA; keep it generic but present.
          "Accept": "application/json",
        },
      });
      const data = await resp.json();

      const address =
        data?.display_name ||
        [data?.address?.house_number, data?.address?.road, data?.address?.suburb, data?.address?.city || data?.address?.town, data?.address?.state, data?.address?.postcode]
          .filter(Boolean)
          .join(", ");

      if (!address) throw new Error("Couldn’t resolve address.");

      // send address back into chat
      setShowLocationPrompt(false);
      await sendMessage(address);
    } catch (err: any) {
      setLocationError(err?.message || "Couldn’t get your location.");
    } finally {
      setLocationWorking(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-white text-black grid grid-cols-[280px_1fr]">
      {/* LEFT SIDEBAR */}
      <aside className="border-r border-gray-200 bg-white flex flex-col">
        <div className="px-4 py-3 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full border border-gray-300 grid place-items-center">○</div>
          <div className="font-semibold">Crew Connect</div>
        </div>

        <div className="px-4">
          <button
            className="w-full h-10 rounded-xl bg-black text-white font-medium flex items-center justify-center gap-2"
            onClick={() => {
              setMessages([]);
              setState({ job_description: "", address: "", time_window: "", budget_band: "", tasks: [], crew_options: [] });
              setTimeout(() => setMessages([]), 0);
              locationPromptOnce.current = false;
            }}
          >
            + New Project
          </button>
        </div>

        <div className="px-3 pt-4 space-y-4 overflow-auto">
          <ProjectItem title="Bathroom Retile" meta="2 days ago" dot="gray" />
          <ProjectItem title="Kitchen Backsplash" meta="1 week ago" dot="black" />
          <ProjectItem title="Power Point Install" meta="2 weeks ago" dot="green" />
        </div>
      </aside>

      {/* RIGHT MAIN */}
      <main className="flex flex-col">
        {/* Top bar */}
        <div className="h-12 border-b border-gray-200 flex items-center justify-between px-4 bg-white">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">New Project</span>
            <span className="text-xs rounded-full border px-2 py-[2px] text-gray-600">Draft</span>
          </div>
          <div className="text-sm text-gray-600">⚙️ Project Summary</div>
        </div>

        {/* Conversation area (keeps exact size with scrollbar) */}
        <div className="flex-1 grid grid-rows-[1fr_auto]">
          <div className="overflow-auto bg-white overscroll-contain">
            {showHero ? (
              <Hero onPick={(t) => sendMessage(t)} />
            ) : (
              <div className="max-w-3xl mx-auto w-full px-4 py-8 space-y-8 pb-32">
                {messages.map((m, i) => (
                  <MessageBubble
                    key={i}
                    role={m.role}
                    text={m.text}
                    options={m.options}
                    onPick={(t) => sendMessage(t)}
                  />
                ))}
                {sending && <TypingIndicator />}
                <div ref={bottomAnchorRef} />
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-gray-200 bg-white">
            <div className="max-w-3xl mx-auto w-full px-4 py-3">
              <div className="relative flex items-center gap-2 rounded-2xl border border-gray-300 bg-white px-4">
                <input
                  className="flex-1 h-12 outline-none text-[15px] placeholder:text-gray-400"
                  placeholder="Describe what you need… (Press / to focus)"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(input);
                    }
                  }}
                />
                <button
                  aria-label="Send"
                  onClick={() => sendMessage(input)}
                  className="h-8 w-8 rounded-full bg-black text-white grid place-items-center"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <div className="text-[12px] text-gray-500 mt-2">
                Press <kbd className="px-1 py-0.5 border rounded">Enter</kbd> to send,&nbsp;
                <kbd className="px-1 py-0.5 border rounded">Shift</kbd> + <kbd className="px-1 py-0.5 border rounded">Enter</kbd> for new line,&nbsp;
                <kbd className="px-1 py-0.5 border rounded">/</kbd> to focus
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Location modal (overlay, does not change layout size) */}
      {showLocationPrompt && (
        <LocationModal
          busy={locationWorking}
          error={locationError}
          onClose={() => setShowLocationPrompt(false)}
          onUseLocation={handleUseMyLocation}
        />
      )}
    </div>
  );
}

/* -------- UI bits -------- */

function ProjectItem({ title, meta, dot }: { title: string; meta: string; dot: "gray" | "black" | "green" }) {
  const color = dot === "green" ? "bg-green-500" : dot === "black" ? "bg-black" : "bg-gray-400";
  return (
    <button className="w-full text-left">
      <div className="text-[13px] font-semibold">{title}</div>
      <div className="text-[11px] text-gray-500">{meta}</div>
      <div className={`mt-1 w-2 h-2 rounded-full ${color}`} />
    </button>
  );
}

function Hero({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="h-full w-full grid place-items-center bg-white">
      <div className="max-w-xl w-full text-center">
        <div className="mx-auto w-28 h-28 rounded-full bg-gray-100 grid place-items-center">
          <div className="text-3xl">🧰</div>
        </div>
        <h2 className="mt-6 text-[22px] font-semibold">Tell me what you need, and I’ll draft the plan.</h2>
        <p className="text-gray-500 mt-1">Start by describing your project in a few words</p>

        <div className="mt-6 space-y-3">
          <StarterInput label="Retile shower" icon="📄" onClick={() => onPick("Retile shower")} />
          <StarterInput label="Replace vanity" icon="🪛" onClick={() => onPick("Replace vanity")} />
          <StarterInput label="Add power point" icon="⚡️" onClick={() => onPick("Add power point")} />
        </div>
      </div>
    </div>
  );
}

function StarterInput({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full h-12 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 flex items-center gap-3 px-4 text-left"
    >
      <span className="w-5 text-center">{icon}</span>
      <span className="text-[15px]">{label}</span>
    </button>
  );
}

function MessageBubble({
  role,
  text,
  options = [],
  onPick,
}: {
  role: "user" | "assistant" | "status";
  text: string;
  options?: string[];
  onPick: (t: string) => void;
}) {
  if (role === "status") {
    return (
      <div className="flex justify-start">
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-[14px] text-gray-700">{text}</div>
      </div>
    );
  }

  const isUser = role === "user";
  const timeLabel = React.useMemo(() => formatTimeNow(), []);

  return (
    <div className={["max-w-[720px]", "w-full", "space-y-2", isUser ? "ml-auto" : ""].join(" ")}>
      {/* bubble */}
      <div className={["rounded-2xl", "px-4", "py-3", isUser ? "bg-black text-white rounded-br-md" : "bg-white border border-gray-200 text-black rounded-bl-md"].join(" ")}>
        <div className="text-[15px] whitespace-pre-wrap">{text}</div>
      </div>

      {/* options BELOW the bubble for assistant only */}
      {!isUser && options.length > 0 && (
        <div className="flex flex-col items-start gap-1">
          <div className="flex flex-wrap gap-2">
            {options.map((opt, i) => (
              <button
                key={`${opt}-${i}`}
                onClick={() => onPick(opt)}
                className="rounded-full border border-gray-300 bg-white hover:bg-gray-50 px-3 py-1 text-[13px]"
              >
                {opt}
              </button>
            ))}
          </div>
          <div className="text-[12px] text-gray-500">{timeLabel}</div>
        </div>
      )}

      {/* timestamp for user messages (under their bubble) */}
      {isUser && <div className="text-[12px] text-gray-500 text-right">{timeLabel}</div>}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-black">
        <div className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-200ms]" />
          <span className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-bounce" />
          <span className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:200ms]" />
        </div>
      </div>
    </div>
  );
}

/* ---------- modal to request location permission ---------- */
function LocationModal({
  busy,
  error,
  onClose,
  onUseLocation,
}: {
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onUseLocation: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
      <div className="w-[460px] max-w-[92vw] bg-white rounded-2xl border border-gray-200 shadow-xl p-5">
        <div className="text-[18px] font-semibold">Use your current location?</div>
        <p className="text-sm text-gray-600 mt-1">
          We’ll use your device’s location once to fill in the job address. You can also type it manually.
        </p>

        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
            disabled={busy}
          >
            Not now
          </button>
          <button
            onClick={onUseLocation}
            className="px-3 py-2 rounded-lg bg-black text-white text-sm disabled:opacity-60"
            disabled={busy}
          >
            {busy ? "Getting location…" : "Use my location"}
          </button>
        </div>
      </div>
    </div>
  );
}