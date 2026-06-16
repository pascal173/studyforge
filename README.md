# StudyForge

StudyForge is an offline-first study companion built with Next.js. It helps you create subjects, upload multiple PDF/TXT/MD/DOCX files, save manual notes, track progress, set study reminders, and generate summaries, flashcards, quizzes, plans, and suggestions through Gemini online mode, local Ollama, or the built-in offline generator.

## Offline Features

- PWA manifest and service worker
- Offline app shell and fallback page
- Local PDF.js worker in `public/pdf.worker.min.mjs`
- IndexedDB storage for subjects, documents, reminders, and generated study outputs
- Browser notification permission flow for reminders
- Update popup that shows release notes once per app version

## Local AI

Install Ollama, then run:

```bash
ollama run llama3.1:8b
```

StudyForge sends AI requests to `http://localhost:11434/api/generate`.

## Online Deep Study Mode

Create `.env.local` in the project folder:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/). Restart the dev server after changing `.env.local`.

Gemini is the recommended free online provider. The app sends deep study requests through `/api/gemini`. Free limits can change, so StudyForge still keeps the built-in offline generator as a fallback.

Optional paid/backup OpenAI variables can also be added if you want to keep OpenAI support:

```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5.5
```

## Deploy Free On Vercel

1. Push this repo to GitHub.
2. Import it at https://vercel.com/new.
3. If Vercel asks for the root directory, choose this project folder.
4. Add environment variables:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

5. Deploy. Your phone can open the Vercel URL and install StudyForge from the browser menu.

The hosted app does not use your PC as a server. Ollama remains local-only, while Gemini deep study mode works from Vercel when the API key is set.

## Development

```bash
npm run dev
npm run lint
npm run build
```

Open `http://localhost:3000`.
