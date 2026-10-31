"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import Editor from "./editor";

export default function AuthShell() {
  const [state, setState] = useState<"checking" | "login" | "editor">("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function checkSession() {
    const response = await fetch("/api/admin/session", { method: "POST", cache: "no-store", credentials: "same-origin" });
    if (response.status !== 200 && response.status !== 401) throw new Error("Не удалось проверить сессию. Повторите вход.");
    setState(response.ok ? "editor" : "login");
    return response.ok;
  }

  useEffect(() => {
    let active = true;
    fetch("/api/admin/session", { method: "POST", cache: "no-store", credentials: "same-origin" }).then(response => {
      if (!active) return;
      setState(response.ok ? "editor" : "login");
      if (response.status !== 200 && response.status !== 401) setError("Не удалось проверить сессию. Повторите вход.");
    }).catch(() => { if (active) { setState("login"); setError("Не удалось проверить сессию. Повторите вход."); } });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const form = event.currentTarget;
    try {
      const response = await fetch("/api/admin/login", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ password: String(new FormData(form).get("password") || "") }) });
      if (!response.ok) {
        if (response.status === 401) throw new Error("Неверный пароль.");
        if (response.status === 429) throw new Error("Слишком много попыток. Повторите через минуту.");
        if (response.status === 403) throw new Error("Адрес сайта не совпадает с ADMIN_ALLOWED_ORIGINS. Проверьте настройку на хостинге.");
        throw new Error("Не удалось войти. Повторите попытку.");
      }
      if (!await checkSession()) throw new Error("Браузер не сохранил сессию. Разрешите cookies для этого сайта и повторите вход.");
      form.reset();
    } catch (err) { setError(err instanceof Error ? err.message : "Не удалось войти. Повторите попытку."); }
    finally { setBusy(false); }
  }

  if (state === "checking") return <main className="admin-shell admin-login"><p role="status">Проверяю вход…</p></main>;
  if (state === "editor") return <Editor />;
  return <main className="admin-shell admin-login"><p className="admin-eyebrow">Редактор приглашения</p><h1>Войти</h1><p>Используйте пароль владельца сайта.</p><form action="/api/admin/login" method="post" onSubmit={submit}><label htmlFor="password">Пароль</label><input id="password" name="password" type="password" autoComplete="current-password" required maxLength={256} disabled={busy} />{error && <p className="admin-error" role="alert">{error}</p>}<button className="admin-primary" disabled={busy}>{busy ? "Вхожу…" : "Войти"}</button></form><Link href="/">Открыть приглашение</Link></main>;
}
