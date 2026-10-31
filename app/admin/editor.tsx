"use client";

import { useEffect, useState } from "react";
import Invitation from "../invitation-client";
import { defaultContent, parseContent, type EventDetails, type InvitationContent } from "../../lib/content";

const labels: Record<keyof EventDetails, string> = {
  heroTitle: "Главный заголовок", giftHeading: "Заголовок выбора подарка", giftDescription: "Описание выбора подарка", giftHelpLabel: "Ссылка о подарках", drinksHeading: "Заголовок напитков", drinksDescription: "Описание напитков", receiptHeading: "Заголовок финального экрана", receiptIntro: "Приветствие на финальном экране", receiptDescription: "Подсказка на финальном экране",
  pageTitle: "Название вкладки", pageDescription: "Описание страницы", demoNotice: "Плашка над приглашением (можно оставить пустой)",
  hostGenitive: "Имя в родительном падеже", dateLabel: "Короткая дата", dateFull: "Дата с годом", time: "Время", calendarDay: "Число на календаре", calendarMonth: "Месяц на календаре", year: "Год в чеке",
  location: "Место и адрес", mapUrl: "Ссылка на карту (https://)", description: "Текст приглашения", receiptFooter: "Подпись чека",
  wishlistTitle: "Заголовок о подарках", wishlistDescription: "Текст о подарках", wishlistImage: "Изображение о подарках", wishlistImageAlt: "Описание изображения",
};

async function resizeImage(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 15_000_000) throw new Error("Выберите PNG, JPEG или WebP до 15 МБ");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/webp", 0.82);
    if (result.length > 660_000) throw new Error("Изображение слишком сложное. Уменьшите размер и загрузите ещё раз.");
    return result;
  } finally { bitmap.close(); }
}

export default function Editor() {
  const [draft, setDraft] = useState<InvitationContent>(defaultContent);
  const [revision, setRevision] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function load() {
    if (dirty && !window.confirm("Загрузить опубликованную версию? Несохранённые правки будут потеряны.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/content", { cache: "no-store" });
      if (response.status === 401) throw new Error("Сессия завершена. Обновите страницу и войдите снова.");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Не удалось загрузить содержимое");
      setDraft(parseContent(body.content)); setRevision(body.revision); setDirty(false);
      setMessage("Загружена последняя версия из GitHub.");
    } catch (err) { setError(err instanceof Error ? err.message : "Не удалось загрузить содержимое"); }
    finally { setBusy(false); }
  }

  function edit(value: InvitationContent) { setDraft(value); setDirty(true); setMessage(""); }
  function eventField(key: keyof EventDetails, value: string) { edit({ ...draft, event: { ...draft.event, [key]: value } }); }
  async function upload(file: File | undefined, target: string) {
    if (!file) return;
    setBusy(true); setError("");
    try {
      const image = await resizeImage(file);
      if (target === "wishlist") eventField("wishlistImage", image);
      else edit({ ...draft, gifts: draft.gifts.map(gift => gift.id === target ? { ...gift, image } : gift) });
    } catch (err) { setError(err instanceof Error ? err.message : "Не удалось прочитать изображение"); }
    finally { setBusy(false); }
  }

  async function publish() {
    setBusy(true); setError(""); setMessage("");
    try {
      const content = parseContent(draft);
      const payload = JSON.stringify({ content, revision });
      if (new TextEncoder().encode(payload).length > 3_500_000) throw new Error("За одну публикацию можно отправить до 3,5 МБ. Публикуйте новые изображения несколькими партиями.");
      const response = await fetch("/api/admin/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
      if (response.status === 401) throw new Error("Сессия завершена. Войдите снова перед публикацией.");
      if (response.status === 413) throw new Error("Хостинг отклонил размер запроса. Уменьшите изображения или публикуйте их несколькими партиями.");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Не удалось опубликовать");
      setDraft(parseContent(body.content)); setDirty(false); setRevision("");
      setMessage(`Коммит ${body.commit.slice(0, 7)} создан. Изменения появятся на сайте после успешной пересборки хостинга. Перед следующей публикацией загрузите версию из GitHub.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Публикация не удалась. Проверьте GitHub перед повторной попыткой."); }
    finally { setBusy(false); }
  }

  function move(index: number, direction: number) {
    const gifts = [...draft.gifts];
    [gifts[index], gifts[index + direction]] = [gifts[index + direction], gifts[index]];
    edit({ ...draft, gifts });
  }

  if (preview) return <><div className="admin-preview-bar"><button onClick={() => setPreview(false)}>← Вернуться в редактор</button><span>Предпросмотр · не опубликовано</span></div><Invitation content={draft} /></>;

  return <main className="admin-shell">
    <header className="admin-header"><div><p className="admin-eyebrow">Ваше приглашение</p><h1>Тексты и подарки</h1><p>Сначала загрузите версию из GitHub. Правки станут видны гостям только после публикации и пересборки сайта.</p></div><form action="/api/admin/logout" method="post"><button>Выйти</button></form></header>
    <div className="admin-toolbar"><button disabled={busy} onClick={load}>Загрузить из GitHub</button><button disabled={busy} onClick={() => { try { parseContent(draft); setPreview(true); setError(""); } catch (err) { setError((err as Error).message); } }}>Предпросмотр</button><button className="admin-primary" disabled={busy || !revision || !dirty} onClick={publish}>{busy ? "Подождите…" : "Опубликовать"}</button><span>{dirty ? "Есть несохранённые изменения" : "Нет несохранённых изменений"}</span></div>
    {error && <p className="admin-error" role="alert">{error}</p>}{message && <p className="admin-message" role="status">{message}</p>}
    <fieldset disabled={busy} className="admin-fields"><legend>Событие</legend><div className="admin-event-grid">{(Object.keys(labels) as Array<keyof EventDetails>).filter(key => key !== "wishlistImage").map(key => <label key={key}>{labels[key]}{key.toLowerCase().includes("description") || key === "demoNotice" ? <textarea rows={3} maxLength={4000} value={draft.event[key]} onChange={e => eventField(key, e.target.value)} /> : <input maxLength={4000} value={draft.event[key]} onChange={e => eventField(key, e.target.value)} />}</label>)}</div><label className="admin-image-label">{labels.wishlistImage}<img src={draft.event.wishlistImage} alt="Текущее изображение о подарках" /><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => void upload(e.target.files?.[0], "wishlist")} /></label></fieldset>
    <fieldset disabled={busy} className="admin-fields"><legend>Подарки · {draft.gifts.length} из 20</legend><p>Порядок карточек здесь соответствует стрелкам на сайте. Изображения автоматически уменьшаются до 1000 пикселей.</p><div className="admin-gifts">{draft.gifts.map((gift, index) => <article className="admin-gift" key={gift.id}><img src={gift.image} alt={`Подарок: ${gift.label}`} /><div><label>Название подарка<input maxLength={100} value={gift.label} onChange={e => edit({ ...draft, gifts: draft.gifts.map(item => item.id === gift.id ? { ...item, label: e.target.value } : item) })} /></label><label>Изображение<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => void upload(e.target.files?.[0], gift.id)} /></label><div className="admin-gift-actions"><button disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Поднять подарок ${index + 1}`}>↑ Выше</button><button disabled={index === draft.gifts.length - 1} onClick={() => move(index, 1)} aria-label={`Опустить подарок ${index + 1}`}>↓ Ниже</button><button className="admin-delete" disabled={draft.gifts.length === 1} onClick={() => edit({ ...draft, gifts: draft.gifts.filter(item => item.id !== gift.id) })}>Удалить</button></div></div></article>)}</div><button disabled={draft.gifts.length >= 20} onClick={() => edit({ ...draft, gifts: [...draft.gifts, { id: crypto.randomUUID(), label: "Новый подарок", image: "/assets/gift-own.webp" }] })}>+ Добавить подарок</button></fieldset>
    <p className="admin-footnote">Черновик существует только в этой вкладке. Публикация сохраняет тексты и изображения в истории вашего репозитория. Не размещайте здесь секретные данные.</p>
  </main>;
}
