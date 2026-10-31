import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist } from "next/font/google";

const geist = Geist({ subsets: ["latin", "cyrillic"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Приглашение · Демо",
  description: "Демонстрация интерактивного приглашения с вымышленными данными. Ответы не отправляются и не сохраняются.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={geist.variable}>
      <body>{children}</body>
    </html>
  );
}
