# StudyForge

StudyForge is an offline-first study companion built with Next.js. It helps you create subjects, upload multiple PDF/TXT/MD/DOCX files, save manual notes, track progress, set study reminders, generate study aids, take quizzes, review flashcards, search your library, and back up your data.

## Features

- Offline PWA app shell and fallback page
- Local PDF.js worker in `public/pdf.worker.min.mjs`
- IndexedDB storage for subjects, documents, reminders, generated outputs, quiz attempts, and settings
- Gemini online deep study mode
- Built-in offline generator when Gemini is unavailable
- Interactive quiz mode with history, scores, explanations, and weak areas
- Automatic progress scoring from reading, generation, and quiz performance
- Reader tab for page-style text reading
- Flashcard review mode
- Library search
- Export/import backup
- Dark theme toggle
- Browser read-aloud support
- Update popup that shows the latest release note once per app version

## Gemini Deep Study

Create `.env.local` in the project folder:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/). Restart the dev server after changing `.env.local`.

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

The hosted app does not use your PC as a server. Gemini deep study mode works from Vercel when the API key is set, and offline mode works without any API.

## Development

```bash
npm run dev
npm run lint
npm run build
```

Open `http://localhost:3000`.
