import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/hooks/useAuth";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://classfully.com'),
  title: {
    default: "Classfully | Classroom participation that builds over time",
    template: "%s",
  },
  description: "The participation layer for university courses. Run live classroom interactions and build a useful record of attendance, understanding, questions, and progress.",
  applicationName: "Classfully",
  openGraph: {
    title: "Classfully",
    description: "Make every class count toward the next.",
    siteName: "Classfully",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Classfully",
    description: "Make every class count toward the next.",
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
      <body className={`${inter.variable} ${fraunces.variable} antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
