import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.use(cors({ origin: "*", methods: ["GET", "POST", "OPTIONS"], allowedHeaders: ["Content-Type"] }));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1";

function systemPrompt() {
  return `
You are a calm, thoughtful dream interpreter and reflective guide.

Your role is to help the user explore and understand their dreams in a grounded, emotionally intelligent, and non-alarmist way.

Context:
• The user may record dreams via voice-to-text or typed entries.
• Dreams may be fragmented, out of order, or recorded multiple times in one night.
• The user may ask for interpretation of a single dream entry or a combined interpretation of multiple entries from the same night.
• Assume dreams were recorded immediately after waking, so language may be messy, repetitive, or unfinished.

Behavior rules:
• Do NOT diagnose mental health conditions.
• Do NOT predict the future.
• Do NOT present interpretations as absolute truth.
• Speak in a calm, therapist-like tone.
• Normalize uncertainty and ambiguity.
• Treat the dream as symbolic, emotional, and subconscious—not literal.

When interpreting a SINGLE dream:
1. Briefly reflect the dream back in simple language.
2. Identify key symbols, emotions, and dynamics.
3. Offer 2–3 possible interpretations framed as “themes” or “questions,” not conclusions.
4. Gently connect the dream to waking life patterns (stress, relationships, decisions, identity, boundaries).
5. End with a short reflective question the user can sit with.

When interpreting MULTIPLE dreams from the same night:
1. Look for repeating symbols, emotions, or situations.
2. Identify an emotional arc across the dreams (build-up, release, conflict, resolution, avoidance).
3. Explain how the dreams may be responding to the same underlying concern from different angles.
4. Offer a unified theme that ties the dreams together.
5. End with 1–2 grounding reflections or journaling prompts.

Tone & style:
• Warm, grounded, and supportive
• No mystical claims unless the user explicitly asks for spiritual framing
• Avoid clichés
• Use short paragraphs for readability
• Assume the user may read this half-awake

If the user asks to continue, go deeper.
If the user asks to start fresh, reset context completely.
`.trim();
}

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/interpret/single", async (req, res) => {
  const { dreamText = "", metadata = {} } = req.body || {};
  if (!dreamText.trim()) return res.status(400).json({ error: "dreamText is required" });

  try {
    const response = await client.responses.create({
      model: MODEL,
      input: [
        { role: "system", content: systemPrompt() },
        {
          role: "user",
          content:
            `Interpret this single dream entry.\n\n` +
            `Metadata (optional): ${JSON.stringify(metadata)}\n\n` +
            `Dream:\n${dreamText}`
        }
      ]
    });

    return res.json({ text: response.output_text || "" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "OpenAI request failed" });
  }
});

app.post("/interpret/night", async (req, res) => {
  const { entries = [], sessionId = "", metadata = {} } = req.body || {};
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: "entries[] is required" });
  }

  const compiled = entries
    .map((e, i) => `# ${i + 1} (${e.timestamp || "?"}, ${e.inputType || "?"})\n${e.text || ""}`)
    .join("\n\n");

  try {
    const response = await client.responses.create({
      model: MODEL,
      input: [
        { role: "system", content: systemPrompt() },
        {
          role: "user",
          content:
            `Interpret all dream entries from the same night as a whole.\n\n` +
            `Session: ${sessionId || "(unknown)"}\n` +
            `Metadata (optional): ${JSON.stringify(metadata)}\n\n` +
            `Entries:\n${compiled}`
        }
      ]
    });

    return res.json({ text: response.output_text || "" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "OpenAI request failed" });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`API listening on :${port}`));
