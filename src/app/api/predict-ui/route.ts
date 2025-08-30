import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Required fields for intake
const REQUIRED_FIELDS = ["job_description", "address", "time_window", "budget_band"];

const SYSTEM_PROMPT = `
You are "CrewConnect AI", an intake + planning assistant for service jobs.

Your job:
1. Understand the client request (e.g. "I need my bathroom fixed").
2. Parse natural language into structured tasks (plumber, tiler, electrician, etc).
3. Ask clarifying questions (budget, time window, urgency, special needs).
4. Build a task plan:
   - Identify required roles
   - Estimate time, dependencies, and rough costs
5. Find and rank workers (skills/licences, distance, availability, reliability, cost fit).
6. Optimise scheduling & logistics:
   - Overlapping availability
   - Minimise travel + carbon footprint
   - Generate a timeline
7. Build trust:
   - For clients: explain "Why this team?"
   - For workers: explain "Why you got this offer?"

Rules:
- Ask ONE short, clear question at a time until you have all required info.
- When you have enough info, reply with "OK — I have everything." and give:
   • A one-paragraph summary
   • A structured JSON state
- Always return your reply inside this JSON envelope:

{
  "assistant_reply": "<your message to the user>",
  "state": {
    "job_description": "...",
    "address": "...",
    "time_window": "...",
    "budget_band": "...",
    "tasks": [ { "role": "...", "details": "..." } ],
    "crew_options": [ { "type": "cheapest|fastest|greenest", "crew": [ ... ] } ]
  },
  "done": true|false
}

Return ONLY valid JSON. No extra commentary.
`;

export async function POST(req: Request) {
  try {
    const { messages = [], state = {} } = await req.json();

    const payload = {
      model: "claude-3-5-sonnet-latest",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: "Current collected state: " + JSON.stringify(state || {}),
        },
        ...messages,
      ],
    };

    const response = await anthropicClient.messages.create(payload);
    const text = response.content[0]?.text?.trim() || "{}";

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {
        assistant_reply: "Sorry, I didn’t understand. Can you tell me what job you need done?",
        state,
        done: false,
      };
    }

    // Ensure required fields exist
    const cleanState = {
      job_description: parsed.state?.job_description ?? state.job_description ?? "",
      address: parsed.state?.address ?? state.address ?? "",
      time_window: parsed.state?.time_window ?? state.time_window ?? "",
      budget_band: parsed.state?.budget_band ?? state.budget_band ?? "",
      tasks: parsed.state?.tasks ?? state.tasks ?? [],
      crew_options: parsed.state?.crew_options ?? state.crew_options ?? [],
    };

    const missing = REQUIRED_FIELDS.filter((k) => !cleanState[k]);
    const done = parsed.done === true && missing.length === 0;

    return NextResponse.json({
      assistant_reply: parsed.assistant_reply,
      state: cleanState,
      done,
    });
  } catch (error: any) {
    console.error("Error in /api/predict-ui:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}