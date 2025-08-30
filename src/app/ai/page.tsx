"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Send, Sun, Moon } from "lucide-react";

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
function deriveField<T = string>(fallback: T, ...candidates: (T | undefined | null)[]): T {
    for (const c of candidates) if (c !== undefined && c !== null && String(c).trim() !== "") return c as T;
    return fallback;
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
  type ChatItem = { id: string; title: string; meta: string; dot: "gray" | "black" | "green" };
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  const [dark, setDark] = useState(false);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // location modal state
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [locationWorking, setLocationWorking] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const locationPromptOnce = useRef(false); // avoid popping repeatedly
  const [showSummary, setShowSummary] = useState(false);


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

  // Helper to create a new chat
  const newChat = () => {
    const id = String(Date.now());
    const item: ChatItem = { id, title: "New Chat", meta: "Just now", dot: "gray" };
    setChats((c) => [item, ...c]);
    setCurrentChatId(id);
    setMessages([]);
    setState({ job_description: "", address: "", time_window: "", budget_band: "", tasks: [], crew_options: [] });
    locationPromptOnce.current = false;
  };

  // Unified sender (text or chip)
  const sendMessage = async (text: string) => {
    if (!text.trim() || sending) return;
    const userMsg: Msg = { role: "user", text: text.trim() };
    if (!currentChatId) {
      // If user somehow sends without clicking New Project, create a chat first
      newChat();
    }
    setChats((c) =>
      c.map((it) =>
        it.id === (currentChatId ?? (c[0]?.id || ""))
          ? { ...it, title: it.title === "New Chat" ? userMsg.text : it.title, meta: "Just now" }
          : it,
      ),
    );
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

  // Memoized chat title based on first user message
  const chatTitle = useMemo(() => {
    const firstUser = messages.find((m) => m.role === "user");
    return firstUser?.text || "New Chat";
  }, [messages]);

  return (
    <div className={`h-screen w-screen overflow-hidden grid grid-cols-[280px_1fr] ${dark ? "bg-black text-white" : "bg-white text-black"}`}>
      {/* LEFT SIDEBAR */}
      <aside className={`flex flex-col border-r ${dark ? "border-gray-700 bg-black" : "border-gray-200 bg-white"}`}>
        <div className="h-[108px] px-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full grid place-items-center border border-blue-200 ring-2 ring-blue-300" aria-hidden>
            <span className="text-blue-400">◌</span>
          </div>
          <div className="flex flex-col">
            <div className="text-[17px] font-semibold">Crew Connect</div>
            <div className="text-[12px] text-gray-500 -mt-0.5">Projects</div>
          </div>
        </div>

        <div className="border-t border-gray-200" />

        <div className="px-4 mt-[30px]">
          <button
            className="w-[220px] h-10 rounded-xl bg-black text-white font-medium flex items-center justify-center gap-2"
            onClick={() => newChat()}
          >
            + New Project
          </button>
        </div>

        <div
          className="pr-3 pl-[25px] mt-[20px] space-y-6 overflow-auto"
          style={{ fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' }}
        >
          {chats.map((it) => (
            <ProjectItem
              key={it.id}
              title={it.title}
              meta={it.meta}
              dot={it.dot}
              onClick={() => setCurrentChatId(it.id)}
              selected={it.id === currentChatId}
            />
          ))}
        </div>
      </aside>

      {/* RIGHT MAIN */}
      <main className="flex flex-col min-h-0">
        {/* Top bar */}
        <div className={`h-[98px] flex items-center justify-between px-4 ${dark ? "border-b border-gray-700 bg-black" : "border-b border-gray-200 bg-white"}`}>
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold">{chatTitle}</span>
            <span
              className="text-[12px] rounded-full border px-2.5 py-[3px]"
              style={{
                color: "#2563eb",
                borderColor: "#bfdbfe",
                backgroundColor: "#eff6ff",
                fontWeight: 500,
                fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
              }}
            >
              Proposed
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              aria-label="Toggle theme"
              onClick={() => setDark((v) => !v)}
              className={`${dark ? "p-2 rounded-lg border border-gray-700 hover:bg-gray-800" : "p-2 rounded-lg border border-gray-200 hover:bg-gray-50"}`}
            >
              {dark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setShowSummary(true)}
              className="ml-[20px] text-sm underline-offset-4 hover:underline"
              style={{ fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' }}
            >
              Project Summary
            </button>
          </div>

        </div>


        {/* Conversation area (keeps exact size with scrollbar) */}
        <div className="flex-1 grid grid-rows-[1fr_auto] min-h-0">
          <div className={`overflow-auto overscroll-contain h-full min-h-0 ${dark ? "bg-black" : "bg-white"}`}>
            {showHero ? (
              <Hero dark={dark} onPick={(t) => sendMessage(t)} />
            ) : (
              <div className="max-w-3xl mx-auto w-full px-4 py-8 space-y-8 pb-32">
                {messages.map((m, i) => (
                  <MessageBubble
                    key={i}
                    role={m.role}
                    text={m.text}
                    options={m.options}
                    onPick={(t) => sendMessage(t)}
                    dark={dark}
                  />
                ))}
                {sending && <TypingIndicator />}
                <div ref={bottomAnchorRef} />
              </div>
            )}
          </div>

          {/* Composer */}
          <div className={`mt-[-30px]  ${dark ? "border-t border-gray-700 bg-black" : "border-t border-gray-200 bg-white"}`}>
            <div className="max-w-3xl mx-auto w-full px-4 py-3">
              <div className={`relative flex items-center gap-2 rounded-2xl border px-4 ${dark ? "border-gray-700 bg-black" : "border-gray-300 bg-white"}`}>
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
      {showSummary && (
        <ProjectSummaryPanel
          dark={dark}
          state={state}
          messages={messages}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  );
}

/* -------- UI bits -------- */

function ProjectItem({ title, meta, dot, onClick, selected }: { title: string; meta: string; dot: "gray" | "black" | "green"; onClick?: () => void; selected?: boolean }) {
  const color = dot === "green" ? "#22c55e" : dot === "black" ? "#111827" : "#9ca3af";
  return (
    <button
      onClick={onClick}
      className={["w-full text-left rounded-lg", selected ? "bg-gray-50" : "hover:bg-gray-50"].join(" ")}
      style={{ fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' }}
    >
      <div className="flex items-center justify-between px-2 py-2">
        <div>
          <div className="text-[14px] font-semibold truncate max-w-[180px]">{title}</div>
          <div className="text-[12px] text-gray-500 mt-1">{meta}</div>
        </div>
        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      </div>
    </button>
  );
}

function Hero({ onPick, dark }: { onPick: (t: string) => void; dark: boolean }) {
  return (
    <div className={`h-full w-full grid place-items-center ${dark ? "bg-black" : "bg-white"}`}>
      <div className="max-w-xl w-full text-center">
        <div className={`mx-auto w-28 h-28 rounded-full ${dark ? "bg-gray-800" : "bg-gray-100"} grid place-items-center`}>
          <div className="text-3xl">🧰</div>
        </div>
        <h2 className="mt-6 text-[22px] font-semibold">Tell me what you need, and I’ll draft the plan.</h2>
        <p className="text-gray-500 mt-1">Start by describing your project in a few words</p>

        <div className="mt-6 space-y-3">
          <StarterInput label="Describe a project" icon="🏗️" onClick={() => onPick("Describe a project")} dark={dark} />
          <StarterInput label="Get installation help" icon="🔧" onClick={() => onPick("Get installation help")} dark={dark} />
          <StarterInput label="Something else" icon="✨" onClick={() => onPick("Something else")} dark={dark} />
        </div>
      </div>
    </div>
  );
}

function StarterInput({ label, icon, onClick, dark }: { label: string; icon: string; onClick: () => void; dark: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-[calc(100%-70px)] mx-auto h-12 rounded-xl border flex items-center gap-3 px-4 text-left ${dark ? "border-gray-700 bg-black hover:bg-gray-800" : "border-gray-300 bg-white hover:bg-gray-50"}`}
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
  dark,
}: {
  role: "user" | "assistant" | "status";
  text: string;
  options?: string[];
  onPick: (t: string) => void;
  dark: boolean;
}) {
  if (role === "status") {
    return (
      <div className="w-full flex justify-start">
        <div className={`rounded-2xl px-4 py-2 text-[14px] inline-block max-w-[720px] ${dark ? "border border-gray-700 bg-black text-gray-200" : "border border-gray-200 bg-white text-gray-700"}`}>
          {text}
        </div>
      </div>
    );
  }

  const isUser = role === "user";
  const timeLabel = React.useMemo(() => formatTimeNow(), []);

  return (
    <div className={["w-full", "flex", isUser ? "justify-end" : "justify-start"].join(" ")}>
      <div className={["inline-flex", "flex-col", isUser ? "items-end" : "items-start", "gap-2", "max-w-[720px]"].join(" ")}>
        {/* bubble that sizes to content */}
        <div className={[
          "inline-block",
          "rounded-2xl",
          "px-4",
          "py-3",
          "break-words",
          "whitespace-pre-wrap",
          isUser
            ? "bg-black text-white rounded-br-md"
            : (dark
                ? "bg-black border border-gray-700 text-white rounded-bl-md"
                : "bg-white border border-gray-200 text-black rounded-bl-md"),
        ].join(" ")}
        >
          <div className="text-[15px]">{text}</div>
        </div>

        {/* options BELOW for assistant only */}
        {!isUser && options.length > 0 && (
          <div className="flex flex-col items-start gap-1 w-auto">
            <div className="flex flex-wrap gap-2">
              {options.map((opt, i) => (
                <button
                  key={`${opt}-${i}`}
                  onClick={() => onPick(opt)}
                  className={`${dark ? "border border-gray-700 bg-black hover:bg-gray-800 text-white" : "border border-gray-300 bg-white hover:bg-gray-50"} rounded-full px-3 py-1 text-[13px]`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <div className="text-[12px] text-gray-500">{timeLabel}</div>
          </div>
        )}

        {/* timestamp for user messages (under their bubble) */}
        {isUser && <div className="text-[12px] text-gray-500">{timeLabel}</div>}
      </div>
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
function ProjectSummaryPanel({ dark, state, messages, onClose }: { dark: boolean; state: any; messages: Msg[]; onClose: () => void }) {
  const address = deriveField("—", state.address);
  const timeWindow = deriveField("—", state.time_window);
  const budget = deriveField("—", state.budget_band);
  const scope = deriveField("—", state.job_description || (state.tasks && state.tasks[0]?.title));
  const propertyType = (messages.find(m => m.role === 'user' && /^(house|apartment)$/i.test(m.text))?.text) || "—";
  const firstSaid = messages.find(m => m.role === 'user')?.text;
  const notes = [firstSaid, state?.notes].filter(Boolean).join("\n");

  const chips: string[] = [];
  if (budget && budget !== '—') chips.push(`Budget ${budget}`);
  if (propertyType && propertyType !== '—') chips.push(propertyType);
  if (timeWindow && timeWindow !== '—') chips.push(timeWindow);
  if (firstSaid) chips.push(firstSaid.length > 24 ? firstSaid.slice(0, 24) + '…' : firstSaid);

  const exportPDF = () => {
    const win = window.open("", "_blank", "noopener,noreferrer,width=720,height=900");
    if (!win) return;
    const style = `body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:24px;color:#111}
      h1{font-size:20px;margin:0 0 12px} h2{font-size:14px;margin:16px 0 6px}
      .box{border:1px solid #e5e7eb;border-radius:12px;padding:10px;margin:6px 0}
      .row{display:flex;justify-content:space-between;margin:6px 0}`;
    const html = `<!doctype html><html><head><meta charset='utf-8'><title>Project Summary</title><style>${style}</style></head><body>
      <h1>Project Summary</h1>
      <h2>Address</h2><div class='box'>${address || ""}</div>
      <h2>Time Window</h2><div class='box'>${timeWindow || ""}</div>
      <h2>Budget</h2><div class='box'>${budget || ""}</div>
      <h2>Scope</h2><div class='box'>${scope || ""}</div>
      <h2>Notes</h2><div class='box'>${(notes || "").replace(/</g,'&lt;')}</div>
      <h2>Project Status</h2>
      <div class='box'>
        <div class='row'><div>Current Phase:</div><div>Proposed</div></div>
        <div class='row'><div>Time to Proposal:</div><div>2.3s</div></div>
        <div class='row'><div>Travel Optimized:</div><div>4.2km saved</div></div>
        <div class='row'><div>CO₂ Avoided:</div><div>12kg CO₂e</div></div>
      </div>
    </body></html>`;
    win.document.write(html); win.document.close(); win.focus(); win.print();
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[250px]">
      <div className={`h-full w-full ${dark ? 'bg-black text-white border-l border-gray-700' : 'bg-white text-black border-l border-gray-200'} overflow-y-auto`}
           style={{ fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' }}>
        <div className={`sticky top-0 ${dark ? 'bg-black' : 'bg-white'} border-b ${dark ? 'border-gray-700' : 'border-gray-200'} px-4 py-3 flex items-center justify-between`}>
          <div className="font-semibold text-[20px]">Project Summary</div>
          <button onClick={onClose} className={`h-7 w-7 rounded-full grid place-items-center ${dark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>×</button>
        </div>

        <div className="px-3 py-3 space-y-5 text-[14px]">
          <div><div className="font-semibold">Address</div>
            <div className={`mt-2 rounded-xl ${dark ? 'border border-gray-700 bg-black' : 'border border-gray-200 bg-white'} px-3 py-2`}>{address || '—'}</div></div>

          <div><div className="font-semibold">Time Window</div>
            <div className={`mt-2 rounded-xl ${dark ? 'border border-gray-700 bg-black' : 'border border-gray-200 bg-white'} px-3 py-2`}>{timeWindow || '—'}</div></div>

          <div><div className="font-semibold">Budget</div>
            <div className={`mt-2 rounded-xl ${dark ? 'border border-gray-700 bg-black' : 'border border-gray-200 bg-white'} px-3 py-2`}>{budget || '—'}</div></div>

          <div><div className="font-semibold">Scope</div>
            <div className={`mt-2 rounded-xl ${dark ? 'border border-gray-700 bg-black' : 'border border-gray-200 bg-white'} px-3 py-2`}>{scope || '—'}</div></div>

          <div><div className="font-semibold">Notes</div>
            <div className={`mt-2 rounded-xl ${dark ? 'border border-gray-700 bg-black' : 'border border-gray-200 bg-white'} px-3 py-2 whitespace-pre-wrap`}>{notes || '—'}</div></div>

          <div>
            <div className="font-semibold">Project Status</div>
            <div className={`mt-2 rounded-xl ${dark ? 'border border-gray-700' : 'border border-gray-200'} border px-3 py-2 space-y-2`}>
              <div className="flex items-center justify-between">
                <span>Current Phase:</span>
                <span className="text-[12px] rounded-full border px-2 py-[2px]"
                      style={{ color: '#2563eb', borderColor: '#bfdbfe', backgroundColor: '#eff6ff', fontWeight: 500 }}>Proposed</span>
              </div>
              <div className="flex items-center justify-between"><span>Time to Proposal:</span><span>2.3s</span></div>
              <div className="flex items-center justify-between"><span>Travel Optimized:</span><span>4.2km saved</span></div>
              <div className="flex items-center justify-between"><span>CO₂ Avoided:</span><span>12kg CO₂e</span></div>
            </div>
          </div>

          <div>
            <div className="font-semibold">Quick Actions</div>
            <div className="mt-2 space-y-2">
              <button onClick={exportPDF} className={`w-full h-9 rounded-xl text-left px-3 ${dark ? 'bg-black border border-gray-700 hover:bg-gray-800' : 'bg-white border border-gray-200 hover:bg-gray-50'}`}>⬇️  Export Project Summary</button>
              <button className={`w-full h-9 rounded-xl text-left px-3 ${dark ? 'bg-black border border-gray-700 hover:bg-gray-800' : 'bg-white border border-gray-200 hover:bg-gray-50'}`}>🗓️  Schedule Follow-up Call</button>
              <button className={`w-full h-9 rounded-xl text-left px-3 ${dark ? 'bg-black border border-gray-700 hover:bg-gray-800' : 'bg-white border border-gray-200 hover:bg-gray-50'}`}>📄  View Full Proposal</button>
            </div>
          </div>

          <div>
            <div className="font-semibold">Summary Chips</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {chips.map((c, i) => (<span key={i} className={`text-[12px] rounded-full px-2 py-[3px] ${dark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-100 border border-gray-200'}`}>{c}</span>))}
            </div>
          </div>
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