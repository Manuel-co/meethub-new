import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import NavProgress from "@/components/app/NavProgress";
import "./globals.css";

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MeetHub — Seamless meeting collaboration for teams",
  description:
    "Schedule, meet, and collaborate in one calm place. Video, chat, calendar, and whiteboard for modern teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${hanken.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
    >
      {/* browser extensions (e.g. ColorZilla) add attributes to <body> before React loads */}
      <body className="min-h-full flex flex-col bg-paper text-ink" suppressHydrationWarning>
        <NavProgress />
        {children}
      </body>
    </html>
  );
}
