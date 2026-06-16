export async function POST(request: Request) {
  const { prompt, action } = await request.json();

  let systemPrompt = "You are an expert, patient university tutor that helps students with any subject.";

  if (action === "flashcards") {
    systemPrompt += " Generate 8 high-quality flashcards in this format: Front: ... Back: ...";
  } else if (action === "quiz") {
    systemPrompt += " Create 6 multiple choice questions with correct answers and explanations.";
  } else if (action === "plan") {
    systemPrompt += " Create a detailed 7-day study plan based on the material.";
  }

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "llama3.1:8b",
        prompt: `${systemPrompt}\n\nMaterial:\n${prompt}`,
        stream: false,
      }),
    });

    const data = await response.json();
    return Response.json({ result: data.response });
  } catch (error) {
    return Response.json({ error: "Ollama not responding. Run: ollama run llama3.1:8b" }, { status: 500 });
  }
}