import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans, Inter, Newsreader } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/hooks/useAuth";
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/metadata";
import InputModality from "@/components/ui/InputModality";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex-sans",
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || SITE_URL),
  title: {
    default: "Classfully | Interactive classroom engagement for universities",
    template: "%s | Classfully",
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: 'Tareef Jafferi', url: SITE_URL }],
  creator: 'Tareef Jafferi',
  publisher: SITE_NAME,
  category: 'education',
  keywords: [
    'classroom engagement platform',
    'interactive classroom',
    'university classroom polling',
    'student participation',
    'live classroom quizzes',
    'student attendance tracking',
    'classroom feedback',
    'higher education technology',
  ],
  alternates: {
    canonical: '/',
    languages: { en: '/' },
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    title: "Classfully | Interactive classroom engagement for universities",
    description: DEFAULT_DESCRIPTION,
    url: '/',
    siteName: SITE_NAME,
    locale: 'en_US',
    type: "website",
    images: [{
      url: '/opengraph-image',
      width: 1200,
      height: 630,
      alt: 'Classfully, classroom participation that builds over time',
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Classfully | Interactive classroom engagement for universities",
    description: DEFAULT_DESCRIPTION,
    images: ['/twitter-image'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 3,
  userScalable: true,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${fraunces.variable} ${plexSans.variable} ${newsreader.variable} antialiased`}>
        <InputModality />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
