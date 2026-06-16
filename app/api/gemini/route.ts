type GeminiPart = {
  text?: string;
};

type GeminiCandidate = {
  content?: {
    parts?: GeminiPart[];
  };
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json({
      error: "Gemini API key is missing. Add GEMINI_API_KEY to .env.local or Vercel.",
    }, { status: 400 });
  }

  const { prompt, action, subject, instruction } = await request.json();
  const material = typeof prompt === "string" ? prompt.trim() : "";

  if (!material) {
    return Response.json({
      error: "No study material was provided.",
    }, { status: 400 });
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const task = [
    `You are a rigorous study tutor for ${subject || "General"}.`,
    "Create a deep, complete study output from the material.",
    "Cover definitions, key ideas, examples, relationships, likely exam points, and weak spots.",
    "Make the answer more useful than a short summary; include structured sections and study guidance.",
    instruction ? `Student request: ${instruction}` : "",
    `Mode: ${action}`,
  ].filter(Boolean).join("\n");

  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 45000);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${task}\n\nMaterial:\n${material}` }],
            },
          ],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 4096,
          },
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      return Response.json({
        error: data?.error?.message || "Gemini request failed.",
      }, { status: response.status });
    }

    const result = (data.candidates as GeminiCandidate[] | undefined)
      ?.flatMap((candidate) => candidate.content?.parts || [])
      .map((part) => part.text || "")
      .join("\n")
      .trim();

    return Response.json({ result: result || "No response" });
  } catch {
    return Response.json({
      error: "Could not reach Gemini in time. Check your API key, quota, internet connection, or try a shorter document.",
    }, { status: 500 });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
