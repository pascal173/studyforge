'use client';

import { useState } from 'react';
import { Upload, BookOpen, Brain, Clock, Target, Save } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/4.7.76/pdf.worker.min.mjs`;

export default function StudyForge() {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [mode, setMode] = useState<'summary' | 'flashcards' | 'quiz' | 'plan'>('summary');

  const extractPDF = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map((item: any) => item.str).join(' ') + '\n\n';
      }
      
      setText(fullText.trim());
      setFileName(file.name);
      toast.success(`✅ Extracted text from ${file.name}`);
    } catch (err) {
      toast.error("Could not read PDF. Try another file.");
    }
  };

  const askAI = async () => {
    if (!text.trim()) return toast.error("No content loaded");

    setLoading(true);
    try {
      const res = await fetch('/api/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          action: mode,
          subject: subject || "General"
        }),
      });

      const data = await res.json();
      setResult(data.result || "No response.");
    } catch (err) {
      toast.error("Ollama not running. Run: ollama run llama3.1:8b");
    } finally {
      setLoading(false);
    }
  };

  const saveSession = () => {
    if (!subject || !text.trim()) return toast.error("Add subject + content");

    const session = {
      id: Date.now(),
      subject,
      fileName: fileName || "Manual",
      date: new Date().toLocaleDateString(),
      preview: text.substring(0, 120) + "..."
    };

    const existing = JSON.parse(localStorage.getItem('studySessions') || '[]');
    localStorage.setItem('studySessions', JSON.stringify([session, ...existing]));
    toast.success(`Session saved for ${subject}`);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <Toaster position="top-center" />

      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-bold text-center mb-2">StudyForge</h1>
        <p className="text-center text-gray-400 mb-10">AI Study Assistant for University</p>

        <input
          type="text"
          placeholder="Subject (e.g. Data Science, Organic Chemistry)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-6 py-4 mb-6 text-lg"
        />

        {/* PDF Upload */}
        <div className="border-2 border-dashed border-gray-700 rounded-2xl p-12 text-center mb-8">
          <Upload className="mx-auto mb-4 text-blue-400" size={48} />
          <p className="text-xl mb-4">Upload Lecture Notes (PDF)</p>
          <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-xl text-lg inline-block">
            Choose PDF File
            <input 
              type="file" 
              accept=".pdf" 
              onChange={(e) => e.target.files && extractPDF(e.target.files[0])}
              className="hidden" 
            />
          </label>
          {fileName && <p className="mt-4 text-green-400">Loaded: {fileName}</p>}
        </div>

        <textarea
          className="w-full h-52 bg-gray-900 border border-gray-700 rounded-2xl p-6 text-sm"
          placeholder="PDF text will appear here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="flex flex-wrap gap-3 mt-6">
          {[
            { label: "Summary", value: "summary" },
            { label: "Flashcards", value: "flashcards" },
            { label: "Practice Quiz", value: "quiz" },
            { label: "Study Plan", value: "plan" },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setMode(item.value as any)}
              className={`px-6 py-3 rounded-2xl transition-all ${mode === item.value ? 'bg-blue-600 scale-105' : 'bg-gray-800 hover:bg-gray-700'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex gap-4 mt-8">
          <button
            onClick={askAI}
            disabled={loading || !text.trim()}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 py-4 rounded-2xl font-semibold text-lg disabled:opacity-50"
          >
            {loading ? "AI Working..." : `Generate ${mode}`}
          </button>

          <button
            onClick={saveSession}
            disabled={!subject || !text.trim()}
            className="px-10 bg-green-600 hover:bg-green-700 rounded-2xl flex items-center gap-3"
          >
            <Save size={22} /> Save Session
          </button>
        </div>

        {result && (
          <div className="mt-10 bg-gray-900 border border-gray-700 rounded-3xl p-8 leading-relaxed whitespace-pre-wrap">
            {result}
          </div>
        )}
      </div>
    </div>
  );
}