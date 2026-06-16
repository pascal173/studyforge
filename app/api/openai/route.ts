export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json({
      error: "OpenAI API key is missing. Add OPENAI_API_KEY to .env.local.",
    }, { status: 400 });
  }

  const { prompt, action, subject, instruction } = await request.json();
  const material = typeof prompt === "string" ? prompt.trim() : "";

  if (!material) {
    return Response.json({
      error: "No study material was provided.",
    }, { status: 400 });
  }

  const model = process.env.OPENAI_MODEL || "gpt-5.5";

  const task = [
    `You are a rigorous study tutor for ${subject || "General"}.`,
    "Create a deep, complete study output from the material.",
    "Cover definitions, key ideas, examples, relationships, likely exam points, and weak spots.",
    instruction ? `Student request: ${instruction}` : "",
    `Mode: ${action}`,
  ].filter(Boolean).join("\n");

  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 45000);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        input: `${task}\n\nMaterial:\n${material}`,
        max_output_tokens: 3500,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json({
        error: data?.error?.message || "OpenAI request failed.",
      }, { status: response.status });
    }

    const outputText =
      data.output_text ||
      data.output
        ?.flatMap((item: { content?: { text?: string }[] }) => item.content || [])
        .map((item: { text?: string }) => item.text || "")
        .join("\n");

    return Response.json({ result: outputText || "No response" });
  } catch {
    return Response.json({
      error: "Could not reach OpenAI in time. Check your internet connection or try a shorter document.",
    }, { status: 500 });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
