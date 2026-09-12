import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { PerspectiveProvider } from "@/lib/perspective-context";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VoltP2P | Renewable Energy P2P Trading Marketplace",
  description: "Peer-to-peer renewable energy marketplace with constraint matching, digital signatures, and verifiable trust proof.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} dark antialiased`}>
      <body className="min-h-screen bg-[#080d1a] text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-200">
        <PerspectiveProvider>
          {children}
        </PerspectiveProvider>
      </body>
    </html>
  );
}
