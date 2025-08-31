import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY! });

// Required fields to consider the intake "done"
const REQUIRED_FIELDS = ["job_description", "address", "time_window", "budget_band"] as const;
type RequiredField = (typeof REQUIRED_FIELDS)[number];
//comment
// The fixed, desired flow (with chips)
//
const FLOW: Array<{
  key:
    | "job_description"
    | "property_type"
    | "address"
    | "time_window"
    | "access"
    | "materials"
    | "budget_band";
  question: string;
  options?: string[];
}> = [
  {
    key: "job_description",
    question: "What exactly needs to be done?",
    options: ["Retile shower", "Replace vanity", "New power point", "Other"],
  },
  {
    key: "property_type",
    question: "What type of property is this?",
    options: ["House", "Apartment"],
  },
  { key: "address", question: "Where's the job?" },
  {
    key: "time_window",
    question: "When works for you?",
    options: ["Weekday", "Weekend", "Specific dates"],
  },
  {
    key: "access",
    question: "Any access constraints?",
    options: ["Lift", "Stairs", "Parking", "None"],
  },
  {
    key: "materials",
    question: "Do you have materials?",
    options: ["I have materials", "I need materials", "Not sure yet"],
  },
  {
    key: "budget_band",
    question: "What's your budget range?",
    options: ["<$3k", "$3–5k", "$5–8k", ">$8k", "Skip"],
  },
];

// --- Utils ------------------------------------------------------------

function extractJsonBlock(s: string): string | null {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return s.slice(start, end + 1);
}

function firstMissingRequired(state: Record<string, any>): RequiredField | null {
  for (const k of REQUIRED_FIELDS) {
    if (!state?.[k] || String(state[k]).trim() === "") return k;
  }
  return null;
}

// Guess which flow step the last assistant question belonged to
function stepFromAssistantText(txt?: string) {
  if (!txt) return null as (typeof FLOW)[number]["key"] | null;
  const t = txt.toLowerCase();
  if (t.includes("exactly needs") || t.includes("kind of job")) return "job_description";
  if (t.includes("type of property")) return "property_type";
  if (t.includes("where's the job") || t.includes("address")) return "address";
  if (t.includes("when works") || t.includes("when would you like")) return "time_window";
  if (t.includes("access constraints")) return "access";
  if (t.includes("have materials")) return "materials";
  if (t.includes("budget")) return "budget_band";
  return null;
}

// Very light inference for job description when user types "retile"/"tiles" etc
function inferJobDescription(text: string): string | null {
  const t = text.toLowerCase();
  const map: Array<[string[], string]> = [
    [["retile", "tiling", "tiles", "tile"], "Bathroom/shower retiling"],
    [["plumb", "plumbing", "leak", "tap", "faucet"], "Plumbing"],
    [["electric", "power point", "socket", "outlet", "lighting"], "Electrical"],
    [["paint", "painting"], "Painting"],
    [["carpentry", "carpenter", "wood"], "Carpentry"],
    [["roof", "roofing"], "Roofing"],
    [["hvac", "aircon", "ac", "air conditioning"], "HVAC"],
    [["landscap", "garden"], "Landscaping"],
    [["handyman"], "Handyman"],
  ];
  for (const [keys, label] of map) {
    if (keys.some((k) => t.includes(k))) return label;
  }
  const trimmed = text.trim();
  if (trimmed && trimmed.length < 120) return trimmed;
  return null;
}

// Decide the *next* step we should ask (fixed order)
function nextStep(state: any): (typeof FLOW)[number] | null {
  for (const step of FLOW) {
    const v = state?.[step.key];
    // address & budget may be empty if not yet filled
    if (v === undefined || String(v).trim() === "") return step;
  }
  return null;
}

// --- Main handler -----------------------------------------------------

export async function POST(req: Request) {
  try {
    const { messages = [], state = {} } = await req.json();

    // Pull last user + assistant text
    const lastUser = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";
    const lastAssistant = [...messages]
      .reverse()
      .find((m: any) => m.role === "assistant")?.content as string | undefined;

    // Clone state and attempt to fill the field that was just asked
    const working: any = {
      job_description: state?.job_description ?? "",
      property_type: state?.property_type ?? "",
      address: state?.address ?? "",
      time_window: state?.time_window ?? "",
      access: state?.access ?? "",
      materials: state?.materials ?? "",
      budget_band: state?.budget_band ?? "",
      tasks: state?.tasks ?? [],
      crew_options: state?.crew_options ?? [],
    };

    const expectedKey = stepFromAssistantText(lastAssistant || "");
    if (expectedKey && lastUser) {
      if (expectedKey === "job_description") {
        working.job_description ||= inferJobDescription(String(lastUser)) ?? "";
      } else {
        working[expectedKey] ||= String(lastUser).trim();
      }
    }

    // If a required field is still missing, ask the next step in *your* order
    const next = nextStep(working);

    if (next) {
      // Build the question and chips
      return NextResponse.json({
        assistant_reply: next.question,
        options: next.options ?? [],
        state: working,
        done: false,
      });
    }

    // If all steps have values, confirm that *required* ones are present
    const stillMissing = firstMissingRequired(working);
    if (stillMissing) {
      // Ask specifically for the missing required field
      const forced = FLOW.find((s) => s.key === stillMissing)!;
      return NextResponse.json({
        assistant_reply: forced.question,
        options: forced.options ?? [],
        state: working,
        done: false,
      });
    }

    // Done — produce a short summary (optionally let Groq phrase it)
    let summary =
      `OK — I have everything. Summary: ${working.job_description} at ${working.address}, ` +
      `timing ${working.time_window}, budget ${working.budget_band}.`;

    try {
      const r = await groqClient.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content:
              "Write a single concise sentence summarizing this job plan, friendly and professional.",
          },
          {
            role: "user",
            content: JSON.stringify({
              job_description: working.job_description,
              address: working.address,
              time_window: working.time_window,
              budget_band: working.budget_band,
              property_type: working.property_type,
              access: working.access,
              materials: working.materials,
            }),
          },
        ],
        max_tokens: 120,
        temperature: 0.3,
      });
      const raw = r.choices[0]?.message?.content ?? "";
      const txt = extractJsonBlock(raw) ? "" : raw.trim(); // if model gave JSON, ignore & keep fallback
      if (txt) summary = "OK — I have everything. " + txt;
    } catch {
      // fine, use fallback summary
    }

    return NextResponse.json({
      assistant_reply: summary,
      options: [],
      state: working,
      done: true,
    });
  } catch (error: any) {
    console.error("Error in /api/predict-ui:", error);
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}