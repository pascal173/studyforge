import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://studyforge.vercel.app"),
  title: "StudyForge",
  description: "An offline-first AI study companion for subjects, PDFs, reminders, and progress.",
  manifest: "/manifest.webmanifest",
  applicationName: "StudyForge",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "StudyForge",
    description: "Offline-first AI study companion for PDFs, quizzes, reminders, and progress.",
    siteName: "StudyForge",
    images: ["/logo.svg"],
    type: "website",
  },
  appleWebApp: {
    capable: true,
    title: "StudyForge",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
