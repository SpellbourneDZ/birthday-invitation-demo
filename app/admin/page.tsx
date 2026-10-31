import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, validSession } from "../../lib/admin-auth";
import Editor from "./editor";
import "./admin.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Редактор приглашения", robots: { index: false, follow: false } };

export default async function Admin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const configured = (process.env.ADMIN_PASSWORD?.length ?? 0) >= 12 && (process.env.ADMIN_SESSION_SECRET?.length ?? 0) >= 32;
  if (!configured) return <main className="admin-shell admin-login"><p className="admin-eyebrow">Редактор приглашения</p><h1>Подключите админку</h1><p>Настройте пароль и секрет сессии на своём хостинге. Инструкция находится в README, раздел «Админка». До настройки вход отключён.</p><Link href="/">Открыть приглашение</Link></main>;
  if (!validSession((await cookies()).get(ADMIN_COOKIE)?.value)) return <main className="admin-shell admin-login"><p className="admin-eyebrow">Редактор приглашения</p><h1>Войти</h1><p>Используйте пароль владельца сайта.</p><form action="/api/admin/login" method="post"><label htmlFor="password">Пароль</label><input id="password" name="password" type="password" autoComplete="current-password" required maxLength={256} />{(await searchParams).error && <p className="admin-error" role="alert">Неверный пароль.</p>}<button className="admin-primary">Войти</button></form><Link href="/">Открыть приглашение</Link></main>;
  return <Editor />;
}
