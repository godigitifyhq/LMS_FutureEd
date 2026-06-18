import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "FutureEd — Lead Management System",
  description:
    "FutureEd's Lead Management System — track, manage, and convert education leads efficiently across all your campaigns and channels.",
  icons: {
    icon: "/logo.jpg",
    shortcut: "/logo.jpg",
    apple: "/logo.jpg",
  },
  openGraph: {
    title: "FutureEd — Lead Management System",
    description:
      "FutureEd's Lead Management System — track, manage, and convert education leads efficiently across all your campaigns and channels.",
    type: "website",
    images: [{ url: "/logo.jpg", width: 512, height: 512, alt: "FutureEd Logo" }],
  },
  twitter: {
    card: "summary",
    title: "FutureEd — Lead Management System",
    description:
      "FutureEd's Lead Management System — track, manage, and convert education leads efficiently.",
    images: ["/logo.jpg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
