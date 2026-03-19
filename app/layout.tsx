import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://casaai.it";

export const metadata: Metadata = {
  title: {
    default: "CasaAI - Trova la tua casa ideale con l'AI",
    template: "%s | CasaAI",
  },
  description:
    "Marketplace immobiliare italiano con intelligenza artificiale conversazionale. Descrivi la tua vita ideale e l'AI troverà la casa perfetta per te.",
  metadataBase: new URL(APP_URL),
  openGraph: {
    type: "website",
    locale: "it_IT",
    url: APP_URL,
    siteName: "CasaAI",
    title: "CasaAI - Trova la tua casa ideale con l'AI",
    description:
      "Marketplace immobiliare italiano con intelligenza artificiale conversazionale.",
  },
  twitter: {
    card: "summary_large_image",
    title: "CasaAI",
    description: "Trova la tua casa ideale con l'AI",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: APP_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
