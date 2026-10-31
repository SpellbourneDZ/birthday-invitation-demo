import Link from "next/link";
import type { Metadata } from "next";
import AuthShell from "./auth-shell";
import "./admin.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Редактор приглашения", robots: { index: false, follow: false } };

export default function Admin() {
  const configured = (process.env.ADMIN_PASSWORD?.length ?? 0) >= 12 && (process.env.ADMIN_SESSION_SECRET?.length ?? 0) >= 32;
  if (!configured) return <main className="admin-shell admin-login"><p className="admin-eyebrow">Редактор приглашения</p><h1>Подключите админку</h1><p>Настройте пароль и секрет сессии на своём хостинге. Инструкция находится в README, раздел «Админка». До настройки вход отключён.</p><Link href="/">Открыть приглашение</Link></main>;
  // Auth state is resolved with an uncached POST, never embedded in cacheable HTML.
  return <AuthShell />;
}
