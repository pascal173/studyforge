export async function POST(request: Request) {
  const { prompt, action, subject } = await request.json();

  let systemPrompt = `You are an expert, patient university tutor helping students with any subject. 
  Current subject: ${subject || "General"}`;

  if (action === "flashcards") {
    systemPrompt += " Generate 8 high-quality flashcards. Format: Front: ... Back: ...";
  } else if (action === "quiz") {
    systemPrompt += " Create 6 multiple choice questions with 4 options, correct answer, and explanation.";
  } else if (action === "plan") {
    systemPrompt += " Create a realistic and detailed 7-day study plan based on the material.";
  } else if (action === "suggestions") {
    systemPrompt += " Give important study tips, common mistakes students make, key focus areas, and effective learning strategies for this topic.";
  } else {
    systemPrompt += " Provide a clear and concise summary of the key points.";
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

    if (!response.ok) {
      return Response.json({
        error: "Ollama responded with an error. Check that the selected model is installed.",
      }, { status: response.status });
    }

    const data = await response.json();
    return Response.json({ result: data.response });
  } catch {
    return Response.json({ 
      error: "Ollama is not running. Start it with: ollama run llama3.1:8b" 
    }, { status: 500 });
  }
}
