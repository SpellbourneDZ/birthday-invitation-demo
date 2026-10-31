import type { Metadata } from "next";
import type { ReactNode } from "react";
import { event } from "../lib/event";
import { Geist } from "next/font/google";

const geist = Geist({ subsets: ["latin", "cyrillic"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: event.pageTitle,
  description: event.pageDescription,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={geist.variable}>
      <body>{children}</body>
    </html>
  );
}
