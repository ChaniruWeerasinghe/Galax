import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import LenisProvider from "@/components/LenisProvider";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "Galax Studios | High-End Photography Portfolio",
    template: "%s | Galax Studios"
  },
  description: "A premium, ultra-fast portfolio manager for high-end photography studios. View our stunning visual stories and exclusive event galleries.",
  keywords: ["photography", "portfolio", "studio", "high-end photography", "event galleries", "photo hosting"],
  authors: [{ name: "Chaniru Weerasinghe" }],
  creator: "Chaniru Weerasinghe",
  icons: {
    icon: '/logo.png', // Uses the logo as the favicon
    apple: '/logo.png',
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Galax Studios",
    title: "Galax Studios | High-End Photography Portfolio",
    description: "A premium, ultra-fast portfolio manager for high-end photography studios. View our stunning visual stories and exclusive event galleries.",
    images: [
      {
        url: '/og-image.png', // The social preview you uploaded earlier
        width: 1200,
        height: 630,
        alt: "Galax Studios Preview"
      }
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Galax Studios | High-End Photography Portfolio",
    description: "A premium, ultra-fast portfolio manager for high-end photography studios.",
    images: ['/og-image.png'], // The social preview you uploaded earlier
    creator: "@ChaniruWeerasinghe",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${outfit.className}`}>
        <LenisProvider>
          {children}
        </LenisProvider>
      </body>
    </html>
  );
}
