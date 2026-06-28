import type { Metadata } from "next";
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
  title: "Crisp — Real-Time ZK Solvency Oracle",
  description:
    "Continuous privacy-preserving solvency verification for stablecoin issuers on Stellar.",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Crisp — Real-Time ZK Solvency Oracle",
    description:
      "Continuous privacy-preserving solvency verification for stablecoin issuers on Stellar.",
    url: "https://crisp.edycu.dev",
    siteName: "Crisp",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Crisp",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Crisp — Real-Time ZK Solvency Oracle",
    description:
      "Continuous privacy-preserving solvency verification for stablecoin issuers on Stellar.",
    images: ["/og-image.png"],
  },
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
