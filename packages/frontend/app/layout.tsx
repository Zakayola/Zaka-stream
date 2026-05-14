/**
 * app/layout.tsx — Root layout for Zaka-Stream dashboard
 */

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zaka-Stream — Decentralized Token Streaming on Stellar",
  description:
    "Stream any Stellar asset continuously to recipients. Real-time decentralized payroll and grant distribution, powered by Soroban smart contracts.",
  keywords: [
    "Stellar",
    "Soroban",
    "token streaming",
    "DeFi",
    "decentralized payroll",
    "Zaka-Stream",
    "Drips Wave",
  ],
  authors: [{ name: "AlAfiz", url: "https://github.com/AlAfiz" }],
  openGraph: {
    title: "Zaka-Stream — Decentralized Token Streaming",
    description:
      "Stream Stellar assets continuously to recipients. Built for decentralized payroll and grant distribution.",
    url: "https://github.com/zakayola/Zaka-Stream",
    siteName: "Zaka-Stream",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zaka-Stream",
    description: "Decentralized token streaming on Stellar/Soroban",
    creator: "@AlAfiz",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-mesh antialiased">{children}</body>
    </html>
  );
}
