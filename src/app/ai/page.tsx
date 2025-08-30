"use client";
import React, { useEffect, useState, useRef, useMemo } from "react";
import { toast } from "react-toastify";
import { Send, Loader2, Plus, Mic, Paperclip, Scissors } from "lucide-react";
import { supabase } from "../../lib/supabaseClient"; // single client

/**
 * AI Preview Modal
 */
export default function AiPreviewModal({
  open = true,
  onClose,
  html = "",
  onApply,
}: {
  open?: boolean;
  onClose?: () => void;
  html?: string;
  onApply?: (html: string) => void;
}) {
  const [previewHtml, setPreviewHtml] = useState(html);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const [uiPrompt, setUiPrompt] = useState("");
  const [generatedUIs, setGeneratedUIs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // ----------------- Minimal Supabase-backed chat -----------------
  type UiMsg = { role: "user" | "assistant"; text: string };
  const [chats, setChats] = useState<{ id: string; title: string; messages: UiMsg[] }[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const currentChat = useMemo(
    () => chats.find((c) => c.id === currentChatId) ?? { id: "", title: "InterfaceGenie", messages: [] as UiMsg[] },
    [chats, currentChatId]
  );

  function getUserKey(): string {
    if (typeof window === "undefined") return "demo";
    let k = localStorage.getItem("demo_user_key");
    if (!k) {
      k = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
      localStorage.setItem("demo_user_key", k);
    }
    return k;
  }

  async function saveTranscript(chatId: string, messages: UiMsg[]) {
    await supabase.from("simple_chats").update({ transcript: messages }).eq("id", chatId);
  }
  // ---------------------------------------------------------------

  /* keep preview in-sync with prop */
  useEffect(() => setPreviewHtml(html), [html]);

  /* listen for insertElement messages */
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "insertElement" && e.data.data) {
        setPreviewHtml((prev) => {
          const doc = new DOMParser().parseFromString(prev, "text/html");
          const container = (doc.getElementById("ai-content") as HTMLElement) || doc.body;
          container.insertAdjacentHTML("beforeend", e.data.data);
          return "<!DOCTYPE html>" + doc.documentElement.outerHTML;
        });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Create a new chat row on mount
  useEffect(() => {
    (async () => {
      try {
        const user_key = getUserKey();
        const { data, error } = await supabase
          .from("simple_chats")
          .insert({ user_key, title: "InterfaceGenie", transcript: [] })
          .select()
          .single();
        if (error) throw error;
        setChats([{ id: data.id, title: data.title ?? "InterfaceGenie", messages: [] }]);
        setCurrentChatId(data.id);
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to start chat");
      }
    })();
  }, []);

  // Send: append user message, call Claude via /api/predict-ui, persist transcript
  const handlePredictUI = async () => {
    if (!uiPrompt.trim() || !currentChatId) return;
    setLoading(true);

    const userMsg: UiMsg = { role: "user", text: uiPrompt };

    setChats((prev) =>
      prev.map((c) => (c.id === currentChatId ? { ...c, messages: [...c.messages, userMsg] } : c))
    );

    try {
      const prevChat = chats.find((c) => c.id === currentChatId);
      const baseMessages = (prevChat?.messages ?? []).concat([userMsg]);
      await saveTranscript(currentChatId, baseMessages);

      // 👇 NEW: send state + messages to CrewConnect
      const resp = await fetch("/api/predict-ui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: baseMessages.map((m) => ({ role: m.role, content: m.text })),
          state: {} // TODO: persist state in frontend if you want continuity
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Prediction failed");
      }

      const data = await resp.json();

      // 👇 instead of generatedUIs, we use assistant_reply
      const assistantMsg: UiMsg = {
        role: "assistant",
        text: data.assistant_reply,
      };

      setChats((prev) =>
        prev.map((c) =>
          c.id === currentChatId ? { ...c, messages: [...c.messages, assistantMsg] } : c
        )
      );

      await saveTranscript(currentChatId, baseMessages.concat([assistantMsg]));
    } catch (err: any) {
      toast.error(err?.message ?? "Prediction failed");
    } finally {
      setLoading(false);
      setUiPrompt("");
    }
  };

  if (!open) return null;

  // Send only the inner HTML fragment to Draw.io.
  const insertIntoDrawio = () => {
    try {
      const doc = new DOMParser().parseFromString(previewHtml, "text/html");
      const fragment = doc.getElementById("ai-content")?.innerHTML || doc.body.innerHTML || previewHtml;
      window.parent.postMessage({ type: "insertIntoDrawio", data: fragment.trim() }, "*");
      toast.success("Sent snippet to Draw.io iframe");
    } catch {
      window.parent.postMessage({ type: "insertIntoDrawio", data: previewHtml }, "*");
    }
    onClose?.();
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(previewHtml);
      toast.success("HTML copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  const handleApply = () => {
    try {
      const doc = new DOMParser().parseFromString(previewHtml, "text/html");
      const fragment = doc.getElementById("ai-content")?.innerHTML || doc.body.innerHTML || previewHtml;
      onApply?.(fragment.trim());
      onClose?.();
    } catch {
      onApply?.(previewHtml);
      onClose?.();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center">
      <div className="w-11/12 md:w-[1100px] h-[90vh] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex">
        {/* Sidebar */}
        <aside className="hidden md:flex w-72 bg-[#F7F9FD] border-r border-gray-200 flex-col">
          <div className="px-4 pt-4">
            <div className="flex items-center gap-3 rounded-2xl border border-gray-300 bg-white px-3 py-3">
              <div className="leading-tight">
                <div className="text-xl font-extrabold italic text-black">InterfaceGenie AI</div>
                <div className="text-base text-black">Premium Assistant</div>
              </div>
            </div>
          </div>
          <div className="p-4">
            <button
              onClick={async () => {
                try {
                  const { data, error } = await supabase
                    .from("simple_chats")
                    .insert({ user_key: getUserKey(), title: "InterfaceGenie", transcript: [] })
                    .select()
                    .single();
                  if (error) throw error;

                  const c = { id: data.id as string, title: data.title ?? "InterfaceGenie", messages: [] as UiMsg[] };
                  setChats((prev) => [c, ...prev]);
                  setCurrentChatId(c.id);
                  setGeneratedUIs([]);
                  setSelectedIdx(null);
                  setPreviewHtml(
                    '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div id="ai-content"></div></body></html>'
                  );
                } catch (e: any) {
                  toast.error(e?.message ?? "Failed to create chat");
                }
              }}
              className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> New Chat
            </button>
          </div>
          <nav className="px-3 space-y-1 text-sm">
            <div className="space-y-1">
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => {
                    setCurrentChatId(chat.id);
                    setGeneratedUIs([]);
                    setSelectedIdx(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border shadow-sm ${
                    chat.id === currentChatId ? "bg-white border-blue-400" : "bg-white border-gray-200 hover:border-blue-200"
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      chat.id === currentChatId ? "bg-blue-600" : "bg-blue-300"
                    }`}
                  ></span>
                  <span className="truncate text-black font-medium">{chat.title}</span>
                </button>
              ))}
            </div>
          </nav>
          <div className="mt-auto p-4">
            <div className="flex items-center gap-3 rounded-2xl border border-gray-300 bg-white px-3 py-3">
              <div className="w-8 h-8 rounded-full bg-pink-300 text-black grid place-items-center text-sm font-semibold">C</div>
              <div className="leading-tight">
                <div className="text-sm font-medium text-black underline">Settings</div>
                <div className="text-xs text-black">Preferences</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Chat panel */}
        <section className="flex-1 flex flex-col bg-white">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div>
              <div className="font-semibold text-black">{currentChat.title}</div>
              <div className="text-xs text-black">Online · Responds instantly</div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-red-500 text-black text-sm hover:bg-red-600"
              title="Close preview"
            >
              ×
            </button>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-auto p-6 space-y-4 bg-white">
            {currentChat.messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[80%] rounded-2xl bg-blue-500 p-3 text-sm text-black shadow"
                      : "max-w-[80%] rounded-2xl bg-gray-50 border border-gray-200 p-3 text-sm text-black shadow-sm"
                  }
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-100 grid place-items-center">🤖</div>
                <div className="h-6 px-3 rounded-full bg-gray-100 flex items-center">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-black animate-bounce [animation-delay:-200ms]"></span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-black mx-1 animate-bounce"></span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-black animate-bounce [animation-delay:200ms]"></span>
                </div>
              </div>
            )}

            {/* Generated UI thumbnails */}
            {generatedUIs.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {generatedUIs.slice(0, 4).map((ui, idx) => (
                  <label
                    key={idx}
                    className={`relative border rounded ${selectedIdx === idx ? "border-blue-600" : "border-gray-300"} cursor-pointer`}
                  >
                    <input
                      type="radio"
                      name="generatedUi"
                      className="absolute top-1 right-1 z-10"
                      checked={selectedIdx === idx}
                      onChange={() => {
                        setPreviewHtml(ui);
                        setSelectedIdx(idx);
                      }}
                    />
                    <iframe
                      title={`ui-${idx}`}
                      sandbox="allow-scripts allow-same-origin"
                      srcDoc={ui}
                      className="w-full h-[220px] border-0 rounded"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        try {
                          const doc = new DOMParser().parseFromString(ui, "text/html");
                          const styleEls = Array.from(doc.querySelectorAll("style, link[rel='stylesheet']"))
                            .map((el) => (el as HTMLElement).outerHTML)
                            .join("");
                          const content = doc.getElementById("ai-content")?.innerHTML || doc.body.innerHTML || ui;
                          const fullDoc = `<!DOCTYPE html><html><head><meta charset="utf-8">${styleEls}</head><body style="margin:0">${content.trim()}</body></html>`;
                          onApply?.(fullDoc);
                        } catch {
                          onApply?.(ui);
                        }
                      }}
                      className="absolute bottom-1 left-1 px-2 py-1 text-xs bg-blue-400 text-black rounded hover:bg-blue-500"
                    >
                      Apply
                    </button>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="p-4 border-t bg-[#F7F9FD]">
            <div className="flex items-center gap-2 bg-white border rounded-full px-3 py-2 shadow-sm">
              <input
                value={uiPrompt}
                onChange={(e) => setUiPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && uiPrompt.trim()) handlePredictUI();
                }}
                placeholder="Ask InterfaceGenie anything..."
                className="flex-1 h-9 px-1 text-sm text-black placeholder-black bg-transparent focus:outline-none"
              />
              <div
                style={{
                  backgroundColor: "#AAF064",
                  border: "2px solid #000000",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  cursor: "pointer",
                }}
                title="Scissors"
              >
                <Scissors className="w-4 h-4" color="black" />
              </div>
              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "2px solid #A0A0A0",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  cursor: "pointer",
                }}
                title="Voice"
              >
                <Mic className="w-4 h-4" color="black" />
              </div>
              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "2px solid #A0A0A0",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  cursor: "pointer",
                }}
                title="Attach"
              >
                <Paperclip className="w-4 h-4" color="black" />
              </div>
              <button
                onClick={handlePredictUI}
                disabled={loading}
                className={`w-9 h-9 flex items-center justify-center rounded-full ${
                  loading ? "bg-gray-300" : "bg-blue-600 hover:bg-blue-700"
                } text-white`}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}