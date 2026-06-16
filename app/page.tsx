'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BookOpen,
  CheckCircle2,
  Download,
  FileText,
  HelpCircle,
  Library,
  Loader2,
  Plus,
  Save,
  Square,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import Image from 'next/image';
import type { LucideIcon } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import mammoth from 'mammoth';

type StudyMode = 'summary' | 'flashcards' | 'quiz' | 'plan' | 'suggestions';

type Subject = {
  id: string;
  name: string;
  color: string;
  goal: string;
  createdAt: string;
};

type StudyDocument = {
  id: string;
  subjectId: string;
  fileName: string;
  fileType: string;
  content: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
};

type Reminder = {
  id: string;
  subjectId: string;
  title: string;
  time: string;
  enabled: boolean;
};

type StudyGeneration = {
  id: string;
  subjectId: string;
  documentId: string;
  mode: StudyMode;
  result: string;
  createdAt: string;
};

type PdfTextItem = {
  str?: string;
};

type QuizQuestion = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

type QuizAttempt = {
  id: string;
  subjectId: string;
  documentId: string;
  score: number;
  total: number;
  missed: string[];
  createdAt: string;
};

type Flashcard = {
  front: string;
  back: string;
};

type StudySettings = {
  deepStudy: boolean;
  quizDifficulty: 'standard' | 'exam' | 'advanced';
  voiceRate: number;
  darkMode: boolean;
};

type DashboardMetric = {
  label: string;
  value: string | number;
  Icon: LucideIcon;
};

const DB_NAME = 'studyforge-offline';
const DB_VERSION = 2;
const APP_VERSION = '0.3.0';
const RELEASE_NOTES = [
  'Added backups, reader, quiz history, weak areas, flashcard review, search, settings, dark theme, and Gemini-only AI.',
];
const SUBJECT_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2'];
const DEFAULT_SETTINGS: StudySettings = {
  deepStudy: false,
  quizDifficulty: 'exam',
  voiceRate: 0.92,
  darkMode: false,
};

function getSentences(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 35);
}

function getKeywords(text: string) {
  const stopWords = new Set([
    'about',
    'after',
    'also',
    'because',
    'between',
    'could',
    'every',
    'from',
    'have',
    'into',
    'more',
    'must',
    'other',
    'should',
    'than',
    'that',
    'their',
    'there',
    'these',
    'they',
    'this',
    'those',
    'through',
    'when',
    'where',
    'which',
    'with',
    'would',
  ]);
  const counts = new Map<string, number>();

  text
    .toLowerCase()
    .match(/[a-z][a-z-]{3,}/g)
    ?.forEach((word) => {
      if (!stopWords.has(word)) counts.set(word, (counts.get(word) || 0) + 1);
    });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

function localStudyGeneration(text: string, mode: StudyMode, subject: string, instruction = '') {
  const sentences = getSentences(text);
  const keywords = getKeywords(text);
  const studyKeywords = keywords.length ? keywords : ['main idea', 'key detail', 'important point'];
  const highlights = sentences.slice(0, 8);
  const instructionLine = instruction.trim() ? `\nStudent focus: ${instruction.trim()}` : '';

  if (mode === 'flashcards') {
    return studyKeywords.slice(0, 8).map((keyword, index) => {
      const clue = sentences.find((sentence) => sentence.toLowerCase().includes(keyword)) || highlights[index] || text.slice(0, 160);
      return `Front: What should you remember about "${keyword}"?\nBack: ${clue}`;
    }).join('\n\n');
  }

  if (mode === 'quiz') {
    return studyKeywords.slice(0, 6).map((keyword, index) => {
      const answer = sentences.find((sentence) => sentence.toLowerCase().includes(keyword)) || highlights[index] || 'Review the source note for the exact detail.';
      return `${index + 1}. Which idea is strongly connected to "${keyword}"?\nA. A minor unrelated detail\nB. The main explanation in your notes\nC. A random date\nD. None of the above\nAnswer: B\nExplanation: ${answer}`;
    }).join('\n\n');
  }

  if (mode === 'plan') {
    return [
      `7-day plan for ${subject}`,
      'Day 1: Read the material once and mark confusing sections.',
      `Day 2: Review key terms: ${studyKeywords.slice(0, 5).join(', ')}.`,
      'Day 3: Rewrite the strongest points in your own words.',
      'Day 4: Use flashcards for recall, not rereading.',
      'Day 5: Answer practice questions and fix weak areas.',
      'Day 6: Teach the topic out loud from memory.',
      'Day 7: Do a final review and update progress to 100%.',
    ].join('\n');
  }

  if (mode === 'suggestions') {
    return [
      'Offline study suggestions',
      `Focus first on: ${studyKeywords.slice(0, 6).join(', ')}.`,
      'Turn each heading or repeated term into one question.',
      'After every reading session, close the note and recall five points from memory.',
      'Use the progress slider honestly so you can see what still needs work.',
      'If a section feels hard, make it tomorrow\'s first task.',
      instructionLine,
    ].join('\n');
  }

  return [
    `Local summary for ${subject}`,
    instructionLine,
    ...highlights.slice(0, 6).map((sentence) => `- ${sentence}`),
    `\nKey terms: ${studyKeywords.join(', ')}`,
  ].filter(Boolean).join('\n');
}

function makeQuiz(text: string): QuizQuestion[] {
  const sentences = getSentences(text);
  const keywords = getKeywords(text);
  const quizKeywords = keywords.length ? keywords : ['main idea', 'key detail', 'important point'];
  const fallbackOptions = ['Review the core idea', 'Ignore the topic', 'Memorize without context', 'Skip the section'];

  return quizKeywords.slice(0, 6).map((keyword, index) => {
    const explanation = sentences.find((sentence) => sentence.toLowerCase().includes(keyword)) || sentences[index] || text.slice(0, 180);
    const options = [
      explanation.length > 120 ? `${explanation.slice(0, 117)}...` : explanation,
      fallbackOptions[1],
      fallbackOptions[2],
      fallbackOptions[3],
    ];

    return {
      question: `Which statement best explains "${keyword}" in this material?`,
      options,
      answerIndex: 0,
      explanation,
    };
  });
}

function makeFlashcards(text: string): Flashcard[] {
  const sentences = getSentences(text);
  const keywords = getKeywords(text);
  const terms = keywords.length ? keywords : ['main idea', 'key detail', 'important point'];

  return terms.slice(0, 10).map((term, index) => ({
    front: `What should you remember about "${term}"?`,
    back: sentences.find((sentence) => sentence.toLowerCase().includes(term)) || sentences[index] || text.slice(0, 220),
  }));
}

function splitIntoReaderPages(text: string) {
  const chunks = text.match(/[\s\S]{1,1800}(?=\s|$)/g) || [];
  return chunks.map((chunk) => chunk.trim()).filter(Boolean);
}

function chunkedLocalSummary(text: string, subject: string, instruction: string) {
  const chunks = splitIntoReaderPages(text).slice(0, 8);
  const sections = chunks.map((chunk, index) => {
    const points = getSentences(chunk).slice(0, 4);
    return [`Section ${index + 1}`, ...points.map((point) => `- ${point}`)].join('\n');
  });

  return [
    `Deep offline study guide for ${subject}`,
    instruction.trim() ? `Focus: ${instruction.trim()}` : '',
    sections.join('\n\n'),
    `\nKey terms: ${getKeywords(text).join(', ') || 'main idea, key detail, important point'}`,
  ].filter(Boolean).join('\n\n');
}

function parseQuizQuestions(raw: string): QuizQuestion[] {
  const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(cleaned) as { questions?: QuizQuestion[] };

  return (parsed.questions || [])
    .filter((question) => {
      return (
        typeof question.question === 'string' &&
        Array.isArray(question.options) &&
        question.options.length === 4 &&
        Number.isInteger(question.answerIndex) &&
        question.answerIndex >= 0 &&
        question.answerIndex < 4 &&
        typeof question.explanation === 'string'
      );
    })
    .slice(0, 8);
}

function scoreProgress(current: number, activity: 'read' | 'generated' | 'quiz', quizPercent = 0) {
  if (activity === 'read') return Math.max(current, 15);
  if (activity === 'generated') return Math.max(current, 45);
  return Math.max(current, Math.min(100, Math.round(55 + quizPercent * 0.45)));
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function openStudyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('subjects')) db.createObjectStore('subjects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('documents')) db.createObjectStore('documents', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('reminders')) db.createObjectStore('reminders', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('generations')) db.createObjectStore('generations', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('quizAttempts')) db.createObjectStore('quizAttempts', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'id' });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStore<T>(storeName: string): Promise<T[]> {
  const db = await openStudyDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

async function putStore<T>(storeName: string, value: T): Promise<void> {
  const db = await openStudyDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readwrite').objectStore(storeName).put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function deleteStore(storeName: string, id: string): Promise<void> {
  const db = await openStudyDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readwrite').objectStore(storeName).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export default function StudyForge() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [documents, setDocuments] = useState<StudyDocument[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [generations, setGenerations] = useState<StudyGeneration[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState('');
  const [activeDocumentId, setActiveDocumentId] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [subjectGoal, setSubjectGoal] = useState('');
  const [manualText, setManualText] = useState('');
  const [mode, setMode] = useState<StudyMode>('summary');
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [customInstruction, setCustomInstruction] = useState('');
  const [onlineDeepStudy, setOnlineDeepStudy] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizDone, setQuizDone] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  const [reminderTime, setReminderTime] = useState('18:00');
  const [activeTab, setActiveTab] = useState<'workspace' | 'library' | 'reader' | 'review' | 'settings' | 'help'>('workspace');
  const [readerPage, setReaderPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [activeFlashcard, setActiveFlashcard] = useState(0);
  const [showFlashcardBack, setShowFlashcardBack] = useState(false);
  const [settings, setSettings] = useState<StudySettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [savedSubjects, savedDocuments, savedReminders, savedGenerations, savedAttempts, savedSettings] = await Promise.all([
          readStore<Subject>('subjects'),
          readStore<StudyDocument>('documents'),
          readStore<Reminder>('reminders'),
          readStore<StudyGeneration>('generations'),
          readStore<QuizAttempt>('quizAttempts'),
          readStore<StudySettings & { id: string }>('settings'),
        ]);

        setSubjects(savedSubjects);
        setDocuments(savedDocuments);
        setReminders(savedReminders);
        setGenerations(savedGenerations);
        setQuizAttempts(savedAttempts);
        const storedSettings = savedSettings[0];
        if (storedSettings) {
          const nextSettings = { ...DEFAULT_SETTINGS, ...storedSettings };
          setSettings(nextSettings);
          setOnlineDeepStudy(nextSettings.deepStudy);
        }
        setActiveSubjectId(savedSubjects[0]?.id ?? '');
        setActiveDocumentId(savedDocuments[0]?.id ?? '');
      } catch {
        toast.error('Could not open offline storage.');
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV !== 'production') {
        navigator.serviceWorker.getRegistrations()
          .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
          .catch(() => undefined);
        return;
      }

      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const seenVersion = window.localStorage.getItem('studyforgeSeenVersion');
    if (seenVersion !== APP_VERSION) {
      window.setTimeout(() => setShowUpdatePopup(true), 0);
    }
  }, []);

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  const dismissUpdatePopup = () => {
    window.localStorage.setItem('studyforgeSeenVersion', APP_VERSION);
    setShowUpdatePopup(false);
  };

  const activeSubject = subjects.find((subject) => subject.id === activeSubjectId);
  const subjectDocuments = documents.filter((document) => document.subjectId === activeSubjectId);
  const activeDocument = documents.find((document) => document.id === activeDocumentId);
  const activeText = activeDocument?.content || manualText;
  const readableText = aiResult || activeText;
  const readerPages = useMemo(() => splitIntoReaderPages(activeText), [activeText]);
  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return documents;
    return documents.filter((document) => {
      const subjectName = subjects.find((subject) => subject.id === document.subjectId)?.name || '';
      return `${document.fileName} ${subjectName} ${document.content}`.toLowerCase().includes(query);
    });
  }, [documents, searchQuery, subjects]);
  const weakAreas = useMemo(() => {
    return [...new Set(quizAttempts.flatMap((attempt) => attempt.missed))].slice(0, 12);
  }, [quizAttempts]);

  const dashboard = useMemo(() => {
    const averageProgress = documents.length
      ? Math.round(documents.reduce((total, document) => total + document.progress, 0) / documents.length)
      : 0;

    return {
      subjects: subjects.length,
      documents: documents.length,
      averageProgress,
      reminders: reminders.filter((reminder) => reminder.enabled).length,
    };
  }, [documents, reminders, subjects]);

  const saveSettings = async (nextSettings: StudySettings) => {
    setSettings(nextSettings);
    setOnlineDeepStudy(nextSettings.deepStudy);
    await putStore('settings', { id: 'main', ...nextSettings });
  };

  const createSubject = async () => {
    if (!subjectName.trim()) return toast.error('Add a subject name first.');

    const subject: Subject = {
      id: uid('subject'),
      name: subjectName.trim(),
      goal: subjectGoal.trim() || 'Build steady understanding',
      color: SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length],
      createdAt: new Date().toISOString(),
    };

    await putStore('subjects', subject);
    setSubjects((current) => [subject, ...current]);
    setActiveSubjectId(subject.id);
    setSubjectName('');
    setSubjectGoal('');
    toast.success(`Subject added: ${subject.name}`);
  };

  const extractFile = async (file: File) => {
    const fileType = file.name.split('.').pop()?.toLowerCase() || 'txt';
    let extractedText = '';

    if (fileType === 'pdf') {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pages: string[] = [];

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push((content.items as PdfTextItem[]).map((item) => item.str || '').join(' '));
      }

      extractedText = pages.join('\n\n');
    } else if (fileType === 'txt' || fileType === 'md') {
      extractedText = await file.text();
    } else if (fileType === 'docx') {
      const arrayBuffer = await file.arrayBuffer();
      const docx = await mammoth.extractRawText({ arrayBuffer });
      extractedText = docx.value;
    } else {
      throw new Error('Unsupported file type');
    }

    return extractedText.trim();
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!activeSubjectId) return toast.error('Create or select a subject first.');

    setLoading(true);
    try {
      const nextDocuments: StudyDocument[] = [];

      for (const file of Array.from(files)) {
        const content = await extractFile(file);
        const document: StudyDocument = {
          id: uid('doc'),
          subjectId: activeSubjectId,
          fileName: file.name,
          fileType: file.name.split('.').pop()?.toLowerCase() || 'txt',
          content,
          progress: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await putStore('documents', document);
        nextDocuments.push(document);
      }

      setDocuments((current) => [...nextDocuments, ...current]);
      setActiveDocumentId(nextDocuments[0]?.id ?? activeDocumentId);
      toast.success(`Saved ${nextDocuments.length} document${nextDocuments.length === 1 ? '' : 's'} offline.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not read one of the files.');
    } finally {
      setLoading(false);
    }
  };

  const saveManualDocument = async () => {
    if (!activeSubjectId) return toast.error('Create or select a subject first.');
    if (!manualText.trim()) return toast.error('Write or paste study notes first.');

    const document: StudyDocument = {
      id: uid('doc'),
      subjectId: activeSubjectId,
      fileName: 'Manual notes',
      fileType: 'note',
      content: manualText.trim(),
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await putStore('documents', document);
    setDocuments((current) => [document, ...current]);
    setActiveDocumentId(document.id);
    setManualText('');
    toast.success('Notes saved offline.');
  };

  const updateDocumentProgress = async (documentId: string, progress: number) => {
    const document = documents.find((item) => item.id === documentId);
    if (!document) return;
    const updated = { ...document, progress, updatedAt: new Date().toISOString() };
    await putStore('documents', updated);
    setDocuments((current) => current.map((document) => (document.id === updated.id ? updated : document)));
  };

  const markDocumentRead = (documentId: string) => {
    const document = documents.find((item) => item.id === documentId);
    if (!document) return;
    updateDocumentProgress(documentId, scoreProgress(document.progress, 'read')).catch(() => undefined);
  };

  const askAI = async () => {
    if (!activeText.trim()) return toast.error('Load or write study material first.');

    setLoading(true);
    setAiResult('');
    setQuizDone(false);
    setQuizAnswers({});
    setQuizQuestions([]);
    const subject = activeSubject?.name || 'General';

    if (mode === 'quiz') {
      if (!onlineDeepStudy) {
        const questions = makeQuiz(activeText);
        setQuizQuestions(questions);
        setAiResult('');
        if (activeDocument) {
          await updateDocumentProgress(activeDocument.id, scoreProgress(activeDocument.progress, 'generated'));
        }
        setLoading(false);
        return;
      }
    }

    if (!onlineDeepStudy) {
      const result = mode === 'summary'
        ? chunkedLocalSummary(activeText, subject, customInstruction)
        : localStudyGeneration(activeText, mode, subject, customInstruction);

      setAiResult(result);
      if (activeDocument) {
        await updateDocumentProgress(activeDocument.id, scoreProgress(activeDocument.progress, 'generated'));
      }
      if (activeSubjectId && activeDocumentId) {
        const generation: StudyGeneration = {
          id: uid('gen'),
          subjectId: activeSubjectId,
          documentId: activeDocumentId,
          mode,
          result,
          createdAt: new Date().toISOString(),
        };
        await putStore('generations', generation);
        setGenerations((current) => [generation, ...current]);
      }
      setLoading(false);
      return;
    }

    let timeout: number | undefined;

    try {
      const controller = new AbortController();
      timeout = window.setTimeout(() => controller.abort(), onlineDeepStudy ? 25000 : 8000);
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: activeText.slice(0, onlineDeepStudy ? 20000 : 6000),
          action: mode,
          subject,
          instruction: customInstruction.trim(),
        }),
      });

      const data = (await res.json()) as { result?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error || 'AI request failed.');

      const result = data.result || 'No response';
      if (mode === 'quiz') {
        const questions = parseQuizQuestions(result);
        if (questions.length === 0) throw new Error('Deep quiz did not return usable questions.');
        setQuizQuestions(questions);
        setAiResult('');
        if (activeDocument) {
          await updateDocumentProgress(activeDocument.id, scoreProgress(activeDocument.progress, 'generated'));
        }
        return;
      }

      setAiResult(result);
      if (activeDocument) {
        await updateDocumentProgress(activeDocument.id, scoreProgress(activeDocument.progress, 'generated'));
      }

      if (activeSubjectId && activeDocumentId) {
        const generation: StudyGeneration = {
          id: uid('gen'),
          subjectId: activeSubjectId,
          documentId: activeDocumentId,
          mode,
          result,
          createdAt: new Date().toISOString(),
        };
        await putStore('generations', generation);
        setGenerations((current) => [generation, ...current]);
      }
    } catch {
      if (mode === 'quiz') {
        const questions = makeQuiz(activeText);
        setQuizQuestions(questions);
        setAiResult('');
        if (activeDocument) {
          await updateDocumentProgress(activeDocument.id, scoreProgress(activeDocument.progress, 'generated'));
        }
        toast.success('Deep quiz is unavailable, so StudyForge used the offline quiz generator.');
        return;
      }

      const result = localStudyGeneration(activeText, mode, subject, customInstruction);
      setAiResult(result);
      if (activeDocument) {
        await updateDocumentProgress(activeDocument.id, scoreProgress(activeDocument.progress, 'generated'));
      }
      toast.success('Gemini is unavailable, so StudyForge used its offline generator.');

      if (activeSubjectId && activeDocumentId) {
        const generation: StudyGeneration = {
          id: uid('gen'),
          subjectId: activeSubjectId,
          documentId: activeDocumentId,
          mode,
          result,
          createdAt: new Date().toISOString(),
        };
        await putStore('generations', generation);
        setGenerations((current) => [generation, ...current]);
      }
    } finally {
      if (timeout) window.clearTimeout(timeout);
      setLoading(false);
    }
  };

  const saveReminder = async () => {
    if (!activeSubjectId) return toast.error('Choose a subject for the reminder.');

    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    const reminder: Reminder = {
      id: uid('reminder'),
      subjectId: activeSubjectId,
      title: `Study ${activeSubject?.name || 'today'}`,
      time: reminderTime,
      enabled: true,
    };

    await putStore('reminders', reminder);
    setReminders((current) => [reminder, ...current]);
    toast.success('Study reminder saved.');
  };

  const readAloud = () => {
    if (!readableText.trim()) return toast.error('Nothing to read yet.');
    if (!('speechSynthesis' in window)) return toast.error('Read aloud is not supported in this browser.');

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(readableText.slice(0, 12000));
    utterance.rate = settings.voiceRate;
    utterance.pitch = 1;
    utterance.onend = () => setIsReading(false);
    utterance.onerror = () => setIsReading(false);
    setIsReading(true);
    window.speechSynthesis.speak(utterance);
  };

  const stopReading = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsReading(false);
  };

  const submitQuiz = async () => {
    setQuizDone(true);
    if (!activeDocument || quizQuestions.length === 0) return;

    const correctAnswers = quizQuestions.filter((question, index) => quizAnswers[index] === question.answerIndex).length;
    const quizPercent = Math.round((correctAnswers / quizQuestions.length) * 100);
    const missed = quizQuestions
      .filter((question, index) => quizAnswers[index] !== question.answerIndex)
      .map((question) => question.question);
    const attempt: QuizAttempt = {
      id: uid('attempt'),
      subjectId: activeSubjectId,
      documentId: activeDocument.id,
      score: correctAnswers,
      total: quizQuestions.length,
      missed,
      createdAt: new Date().toISOString(),
    };
    await putStore('quizAttempts', attempt);
    setQuizAttempts((current) => [attempt, ...current]);
    await updateDocumentProgress(activeDocument.id, scoreProgress(activeDocument.progress, 'quiz', quizPercent));
  };

  const startFlashcards = () => {
    if (!activeText.trim()) return toast.error('Load a document first.');
    setFlashcards(makeFlashcards(activeText));
    setActiveFlashcard(0);
    setShowFlashcardBack(false);
    setActiveTab('review');
  };

  const nextFlashcard = () => {
    setShowFlashcardBack(false);
    setActiveFlashcard((current) => (flashcards.length ? (current + 1) % flashcards.length : 0));
  };

  const exportBackup = () => {
    const backup = {
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      subjects,
      documents,
      reminders,
      generations,
      quizAttempts,
      settings,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `studyforge-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file: File | null) => {
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text()) as {
        subjects?: Subject[];
        documents?: StudyDocument[];
        reminders?: Reminder[];
        generations?: StudyGeneration[];
        quizAttempts?: QuizAttempt[];
        settings?: StudySettings;
      };

      await Promise.all([
        ...(backup.subjects || []).map((item) => putStore('subjects', item)),
        ...(backup.documents || []).map((item) => putStore('documents', item)),
        ...(backup.reminders || []).map((item) => putStore('reminders', item)),
        ...(backup.generations || []).map((item) => putStore('generations', item)),
        ...(backup.quizAttempts || []).map((item) => putStore('quizAttempts', item)),
      ]);

      if (backup.settings) await saveSettings({ ...DEFAULT_SETTINGS, ...backup.settings });

      setSubjects(await readStore<Subject>('subjects'));
      setDocuments(await readStore<StudyDocument>('documents'));
      setReminders(await readStore<Reminder>('reminders'));
      setGenerations(await readStore<StudyGeneration>('generations'));
      setQuizAttempts(await readStore<QuizAttempt>('quizAttempts'));
      toast.success('Backup imported.');
    } catch {
      toast.error('Could not import that backup file.');
    }
  };

  const deleteDocument = async (id: string) => {
    await deleteStore('documents', id);
    setDocuments((current) => current.filter((document) => document.id !== id));
    if (activeDocumentId === id) setActiveDocumentId('');
    toast.success('Document removed.');
  };

  return (
    <main className={`min-h-screen ${settings.darkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#f8fafc] text-slate-950'}`}>
      <Toaster position="top-center" />

      {showUpdatePopup && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 px-4">
          <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">StudyForge update</p>
            <h2 className="mt-2 text-2xl font-bold">Version {APP_VERSION}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">New features and fixes are ready on this device.</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {RELEASE_NOTES.map((note) => (
                <li key={note} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={16} />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
            <button onClick={dismissUpdatePopup} className="mt-5 w-full rounded-md bg-slate-950 px-4 py-3 font-semibold text-white">
              Continue studying
            </button>
          </section>
        </div>
      )}

      <header className={`border-b ${settings.darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Image src="/icon.svg" width={54} height={54} alt="StudyForge logo" className="rounded-2xl shadow-sm" priority />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Offline study companion</p>
              <h1 className="text-3xl font-bold">StudyForge</h1>
            </div>
          </div>
          <nav className={`flex flex-wrap gap-2 rounded-lg border p-1 ${settings.darkMode ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-50'}`}>
            {(['workspace', 'library', 'reader', 'review', 'settings', 'help'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-md px-4 py-2 text-sm font-semibold capitalize ${
                  activeTab === tab ? 'bg-blue-700 text-white' : settings.darkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-6 md:grid-cols-4">
        {([
          { label: 'Subjects', value: dashboard.subjects, Icon: BookOpen },
          { label: 'Documents', value: dashboard.documents, Icon: Library },
          { label: 'Progress', value: `${dashboard.averageProgress}%`, Icon: CheckCircle2 },
          { label: 'Reminders', value: dashboard.reminders, Icon: Bell },
        ] satisfies DashboardMetric[]).map(({ label, value, Icon }) => (
          <div key={label} className={`rounded-lg border p-4 ${settings.darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-500">{label}</p>
              <Icon className="text-blue-700" size={20} />
            </div>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 pb-10 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Plus size={18} /> Add subject
            </h2>
            <input
              value={subjectName}
              onChange={(event) => setSubjectName(event.target.value)}
              className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Biology, Algebra, Literature..."
            />
            <input
              value={subjectGoal}
              onChange={(event) => setSubjectGoal(event.target.value)}
              className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Goal for this subject"
            />
            <button onClick={createSubject} className="mt-3 w-full rounded-md bg-blue-700 px-4 py-2 font-semibold text-white">
              Save subject
            </button>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-bold">Subjects</h2>
            <div className="mt-3 space-y-2">
              {subjects.length === 0 && <p className="text-sm text-slate-500">Add your first subject to begin.</p>}
              {subjects.map((subject) => (
                <button
                  key={subject.id}
                  onClick={() => {
                    setActiveSubjectId(subject.id);
                    const firstDocument = documents.find((document) => document.subjectId === subject.id);
                    setActiveDocumentId(firstDocument?.id ?? '');
                    if (firstDocument) markDocumentRead(firstDocument.id);
                  }}
                  className={`w-full rounded-md border px-3 py-3 text-left ${
                    activeSubjectId === subject.id ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: subject.color }} />
                    {subject.name}
                  </span>
                  <span className="mt-1 block text-xs opacity-75">{subject.goal}</span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        {activeTab === 'workspace' && (
          <section className="space-y-5">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-bold">{activeSubject?.name || 'Choose a subject'}</h2>
                  <p className="text-sm text-slate-500">Upload multiple files, paste notes, track progress, and generate study aids offline-first.</p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-slate-950 px-4 py-2 font-semibold text-white">
                  <Upload size={18} /> Upload files
                  <input type="file" accept=".pdf,.txt,.md,.docx" multiple className="hidden" onChange={(event) => uploadFiles(event.target.files)} />
                </label>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[260px_1fr]">
                <div className="rounded-lg border border-slate-200">
                  {subjectDocuments.length === 0 && <p className="p-4 text-sm text-slate-500">No documents in this subject yet.</p>}
                  {subjectDocuments.map((document) => (
                    <button
                      key={document.id}
                      onClick={() => {
                        setActiveDocumentId(document.id);
                        markDocumentRead(document.id);
                      }}
                      className={`flex w-full items-start gap-3 border-b border-slate-100 p-3 text-left last:border-b-0 ${
                        activeDocumentId === document.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <FileText className="mt-1 text-blue-700" size={18} />
                      <span>
                        <span className="block text-sm font-semibold">{document.fileName}</span>
                        <span className="block text-xs text-slate-500">{document.progress}% complete</span>
                      </span>
                    </button>
                  ))}
                </div>

                <div>
                  <textarea
                    value={activeDocument?.content ?? manualText}
                    onChange={(event) => (activeDocument ? undefined : setManualText(event.target.value))}
                    readOnly={Boolean(activeDocument)}
                    className="h-72 w-full resize-none rounded-lg border border-slate-300 bg-white p-4 text-sm leading-6"
                    placeholder="Paste notes here or upload PDFs, TXT, MD, and DOCX files."
                  />
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {!activeDocument && (
                      <button onClick={saveManualDocument} className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white">
                        <Save size={18} /> Save notes
                      </button>
                    )}
                    {activeDocument && (
                      <>
                        <p className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">
                          Auto progress score: {activeDocument.progress}%
                        </p>
                        <button onClick={() => deleteDocument(activeDocument.id)} className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">
                          <Trash2 size={16} /> Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap gap-2">
                {(['summary', 'flashcards', 'quiz', 'plan', 'suggestions'] as StudyMode[]).map((item) => (
                  <button
                    key={item}
                    onClick={() => setMode(item)}
                    className={`rounded-md px-4 py-2 text-sm font-semibold capitalize ${
                      mode === item ? 'bg-blue-700 text-white' : 'border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <textarea
                value={customInstruction}
                onChange={(event) => setCustomInstruction(event.target.value)}
                className="mt-4 h-24 w-full resize-none rounded-lg border border-slate-300 p-3 text-sm"
                placeholder="Optional: describe exactly what you want before generating, such as 'explain like I am new', 'focus on exam questions', or 'make it detailed'."
              />
              <label className="mt-3 flex items-center gap-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={onlineDeepStudy}
                  onChange={(event) => setOnlineDeepStudy(event.target.checked)}
                  className="h-4 w-4"
                />
                Use Gemini online deep study mode when available
              </label>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={askAI}
                  disabled={loading || !activeText.trim()}
                  className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                  Generate {mode}{onlineDeepStudy ? ' with deep study' : ' offline'}
                </button>
                <button
                  onClick={isReading ? stopReading : readAloud}
                  disabled={!readableText.trim()}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isReading ? <Square size={18} /> : <Volume2 size={18} />}
                  {isReading ? 'Stop reading' : 'Read aloud'}
                </button>
                <button
                  onClick={startFlashcards}
                  disabled={!activeText.trim()}
                  className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-5 py-3 font-semibold text-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <BookOpen size={18} />
                  Review flashcards
                </button>
              </div>
              {aiResult && <div className="mt-5 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm leading-6">{aiResult}</div>}
              {quizQuestions.length > 0 && (
                <div className="mt-5 space-y-4">
                  {quizQuestions.map((question, questionIndex) => (
                    <div key={question.question} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="font-semibold">{questionIndex + 1}. {question.question}</p>
                      <div className="mt-3 space-y-2">
                        {question.options.map((option, optionIndex) => {
                          const isSelected = quizAnswers[questionIndex] === optionIndex;
                          const isCorrect = quizDone && optionIndex === question.answerIndex;
                          const isWrong = quizDone && isSelected && optionIndex !== question.answerIndex;

                          return (
                            <button
                              key={`${questionIndex}-${optionIndex}`}
                              onClick={() => !quizDone && setQuizAnswers((current) => ({ ...current, [questionIndex]: optionIndex }))}
                              className={`block w-full rounded-md border px-3 py-2 text-left text-sm ${
                                isCorrect ? 'border-emerald-500 bg-emerald-50' : isWrong ? 'border-red-500 bg-red-50' : isSelected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'
                              }`}
                            >
                              {String.fromCharCode(65 + optionIndex)}. {option}
                            </button>
                          );
                        })}
                      </div>
                      {quizDone && <p className="mt-3 text-sm text-slate-700"><span className="font-semibold">Explanation:</span> {question.explanation}</p>}
                    </div>
                  ))}
                  {!quizDone ? (
                    <button
                      onClick={submitQuiz}
                      disabled={Object.keys(quizAnswers).length < quizQuestions.length}
                      className="rounded-md bg-blue-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Submit quiz
                    </button>
                  ) : (
                    <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">
                      Score: {quizQuestions.filter((question, index) => quizAnswers[index] === question.answerIndex).length} / {quizQuestions.length}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Bell size={18} /> Study reminder
              </h2>
              <div className="mt-3 flex flex-wrap gap-3">
                <input type="time" value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2" />
                <button onClick={saveReminder} className="rounded-md bg-amber-600 px-4 py-2 font-semibold text-white">
                  Save reminder
                </button>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'library' && (
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="text-xl font-bold">Offline library</h2>
              <div className="flex flex-wrap gap-2">
                <button onClick={exportBackup} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">
                  <Download size={16} /> Export backup
                </button>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold">
                  <Upload size={16} /> Import backup
                  <input type="file" accept="application/json,.json" className="hidden" onChange={(event) => importBackup(event.target.files?.[0] || null)} />
                </label>
              </div>
            </div>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Search subjects, files, and saved text..."
            />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {filteredDocuments.map((document) => (
                <div key={document.id} className="rounded-lg border border-slate-200 p-4">
                  <p className="font-semibold">{document.fileName}</p>
                  <p className="text-sm text-slate-500">{subjects.find((subject) => subject.id === document.subjectId)?.name || 'No subject'}</p>
                  <div className="mt-3 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-blue-700" style={{ width: `${document.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
            {weakAreas.length > 0 && (
              <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <h3 className="font-bold text-amber-900">Weak areas to revise</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
                  {weakAreas.map((area) => <li key={area}>{area}</li>)}
                </ul>
              </div>
            )}
            {quizAttempts.length > 0 && <h3 className="mt-8 text-lg font-bold">Quiz history</h3>}
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {quizAttempts.slice(0, 8).map((attempt) => (
                <div key={attempt.id} className="rounded-lg border border-slate-200 p-4">
                  <p className="font-semibold">Score: {attempt.score} / {attempt.total}</p>
                  <p className="text-sm text-slate-500">{new Date(attempt.createdAt).toLocaleString()}</p>
                  {attempt.missed.length > 0 && <p className="mt-2 text-sm text-red-700">{attempt.missed.length} weak area{attempt.missed.length === 1 ? '' : 's'} saved</p>}
                </div>
              ))}
            </div>
            {generations.length > 0 && <h3 className="mt-8 text-lg font-bold">Saved AI outputs</h3>}
            <div className="mt-3 space-y-3">
              {generations.slice(0, 8).map((generation) => (
                <details key={generation.id} className="rounded-lg border border-slate-200 p-4">
                  <summary className="cursor-pointer font-semibold capitalize">{generation.mode}</summary>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{generation.result}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'reader' && (
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-bold">Reader</h2>
            {!activeDocument && <p className="mt-3 text-sm text-slate-500">Select a saved document to read it page by page.</p>}
            {activeDocument && (
              <>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-600">{activeDocument.fileName}</p>
                  <p className="text-sm text-slate-500">Page {Math.min(readerPage + 1, readerPages.length || 1)} / {readerPages.length || 1}</p>
                </div>
                <article className="mt-4 min-h-80 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm leading-7 whitespace-pre-wrap">
                  {readerPages[readerPage] || activeDocument.content}
                </article>
                <div className="mt-4 flex gap-3">
                  <button onClick={() => setReaderPage((page) => Math.max(0, page - 1))} className="rounded-md border border-slate-300 px-4 py-2 font-semibold">Previous</button>
                  <button
                    onClick={() => {
                      setReaderPage((page) => Math.min(Math.max(readerPages.length - 1, 0), page + 1));
                      markDocumentRead(activeDocument.id);
                    }}
                    className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white"
                  >
                    Next page
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {activeTab === 'review' && (
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-bold">Flashcard review</h2>
            {flashcards.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Open a document and choose Review flashcards to begin.</p>
            ) : (
              <div className="mt-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
                  <p className="text-sm font-semibold text-slate-500">Card {activeFlashcard + 1} / {flashcards.length}</p>
                  <p className="mt-4 text-xl font-bold">{showFlashcardBack ? flashcards[activeFlashcard].back : flashcards[activeFlashcard].front}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button onClick={() => setShowFlashcardBack((shown) => !shown)} className="rounded-md bg-slate-950 px-4 py-2 font-semibold text-white">
                    {showFlashcardBack ? 'Show front' : 'Show answer'}
                  </button>
                  <button onClick={nextFlashcard} className="rounded-md border border-slate-300 px-4 py-2 font-semibold">Next card</button>
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'settings' && (
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-bold">Settings</h2>
            <div className="mt-4 space-y-4">
              <label className="flex items-center gap-3 font-semibold">
                <input type="checkbox" checked={settings.darkMode} onChange={(event) => saveSettings({ ...settings, darkMode: event.target.checked })} />
                Dark theme
              </label>
              <label className="flex items-center gap-3 font-semibold">
                <input type="checkbox" checked={settings.deepStudy} onChange={(event) => saveSettings({ ...settings, deepStudy: event.target.checked })} />
                Use Gemini deep study by default
              </label>
              <label className="block font-semibold">
                Quiz difficulty
                <select value={settings.quizDifficulty} onChange={(event) => saveSettings({ ...settings, quizDifficulty: event.target.value as StudySettings['quizDifficulty'] })} className="mt-2 block rounded-md border border-slate-300 px-3 py-2">
                  <option value="standard">Standard</option>
                  <option value="exam">Exam</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>
              <label className="block font-semibold">
                Read aloud speed: {settings.voiceRate.toFixed(2)}x
                <input type="range" min="0.7" max="1.2" step="0.05" value={settings.voiceRate} onChange={(event) => saveSettings({ ...settings, voiceRate: Number(event.target.value) })} className="mt-2 block" />
              </label>
            </div>
          </section>
        )}

        {activeTab === 'help' && (
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <HelpCircle size={20} /> Help
            </h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[
                ['Offline use', 'Install the app from your browser menu. Uploaded notes, extracted text, progress, reminders, and AI outputs are stored locally in IndexedDB.'],
                ['PDF support', 'PDF parsing now uses a local worker copied into the app, so reading PDFs no longer depends on a CDN.'],
                ['AI modes', 'StudyForge can use Gemini for online deep study if GEMINI_API_KEY is set. Without it, the app uses the built-in offline generator.'],
                ['Deep quiz', 'When Gemini deep study is enabled, quiz mode asks Gemini for harder comprehension questions, then shows them in the same interactive quiz interface.'],
                ['Progress scoring', 'Progress is scored automatically. Opening a document, generating study aids, and submitting quiz answers all raise the score based on your activity.'],
                ['Backups and search', 'Use the Library tab to search saved documents, export a backup, import a backup, view quiz history, and review weak areas.'],
                ['Reader and review', 'Use Reader for page-by-page study and Review for flashcards generated from the active document.'],
                ['Read aloud', 'Use the Read aloud button to listen to the generated answer. If no answer has been generated yet, it reads the current notes or extracted document text.'],
                ['Backups', 'Your browser owns the offline database. Export/import can be added next so you can move your study library between devices.'],
              ].map(([title, body]) => (
                <article key={title} className="rounded-lg border border-slate-200 p-4">
                  <h3 className="font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
