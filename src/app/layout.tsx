import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/hooks/useAuth";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Interactive Case Study Platform",
  description: "The most beautiful and intuitive platform for delivering interactive case studies with student grade tracking.",
};

export const viewport = {
  width: 'device-width',
  initialScale: 0.9,
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
      <body className={`${inter.variable} font-sans antialiased bg-gray-50`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
