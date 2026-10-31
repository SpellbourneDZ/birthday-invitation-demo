"use client";

import { useEffect, useRef, useState } from "react";
import "./receipt.css";

type ReceiptData = {
  name: string;
  giftLabel: string;
  drinkLabels: string[];
};

type ReceiptSceneProps = ReceiptData & {
  onBack: () => void;
  walletEnabled?: boolean;
  onAddToWallet?: () => Promise<void>;
};

function ReceiptRule() {
  return <div className="receipt-rule" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <span key={index} />)}</div>;
}

export function ReceiptContent({ name, giftLabel, drinkLabels, exported = false }: ReceiptData & { exported?: boolean }) {
  return <article className={`receipt-paper${exported ? " receipt-paper-export" : ""}`} aria-label="Пригласительный чек">
    <h2 className="receipt-paper-title">Пригласительный<br />на день рождения</h2>
    <ReceiptRule />
    <div className="receipt-event">
      <p>Билет на празднование<br />дня рождения Алекса</p>
      <p>Дата: 15 июля 2027<br />Время: 18:00<br />Место: Кафе «Праздник» (пример)</p>
    </div>
    <ReceiptRule />
    <div className="receipt-positions">
      <div className="receipt-row receipt-row-heading"><span>Позиция</span><span>Наименование</span></div>
      <div className="receipt-row"><span><i>1</i> Гость</span><span>{name}</span></div>
      <div className="receipt-row"><span><i>2</i> Подарок</span><span>{giftLabel}</span></div>
      <div className="receipt-row"><span><i>3</i> Напитки</span><span>{drinkLabels.join(", ")}</span></div>
    </div>
    <div className="receipt-bottom">
      <img className="receipt-barcode" src={exported ? "/assets/receipt-barcode-export.svg" : "/assets/receipt-barcode.svg"} alt="" width={exported ? 257 : 265} height={exported ? 34 : 35} />
      <ReceiptRule />
      <div className="receipt-footer"><span>ДЕМО</span><span>2027</span></div>
    </div>
  </article>;
}

export default function ReceiptScene({ name, giftLabel, drinkLabels, onBack, walletEnabled = false, onAddToWallet }: ReceiptSceneProps) {
  const printWindowRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [ready, setReady] = useState(false);
  const [printed, setPrinted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [walletPending, setWalletPending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const node = printWindowRef.current?.querySelector(".receipt-paper");
    if (!node) return;
    let active = true;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => {
      setReducedMotion(media.matches);
      if (media.matches) setPrinted(true);
    };
    const measure = () => setHeight(Math.ceil(node.getBoundingClientRect().height));
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    media.addEventListener("change", updateMotion);
    updateMotion();
    document.fonts.ready.then(() => {
      if (!active) return;
      measure();
      setReady(true);
    });
    return () => { active = false; observer.disconnect(); media.removeEventListener("change", updateMotion); };
  }, []);

  async function downloadPng() {
    const node = exportRef.current;
    if (!node || downloading) return;
    setDownloading(true);
    setMessage("");
    try {
      await document.fonts.ready;
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(node, {
        backgroundColor: "#ffffff",
        scale: 3,
        width: node.scrollWidth,
        height: node.scrollHeight,
        windowWidth: Math.max(window.innerWidth, node.scrollWidth),
        windowHeight: Math.max(window.innerHeight, node.scrollHeight),
      });
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("PNG export failed")), "image/png"));
      const file = new File([blob], "priglashenie.png", { type: "image/png" });
      if (window.matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] }) && navigator.share) {
        try { await navigator.share({ files: [file], title: "Приглашение" }); return; }
        catch (error) { if ((error as DOMException).name === "AbortError") return; }
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setMessage("Не удалось создать PNG. Попробуй ещё раз.");
    } finally { setDownloading(false); }
  }

  async function addToWallet() {
    if (!walletEnabled || !onAddToWallet || walletPending) return;
    setWalletPending(true);
    setMessage("");
    try { await onAddToWallet(); }
    catch { setMessage("Не удалось добавить билет в Wallet. Чек можно скачать как PNG."); }
    finally { setWalletPending(false); }
  }

  const walletAvailable = walletEnabled && !!onAddToWallet;

  return <section className="receipt-scene" aria-label="Приглашение на день рождения">
    <div className="receipt-copy">
      <h1>Отлично!</h1>
      <p>Я очень рад, что ты придешь на мой день рождения!</p>
      <p>Остался последний шаг – получить пригласительный.</p>
    </div>
    <div className="receipt-printer-scene">
      <div className="receipt-print-window" ref={printWindowRef} style={{ height: ready ? height : 0, opacity: ready ? 1 : 0 }}>
        <div className={`receipt-print-motion${ready && !reducedMotion && !printed ? " is-printing" : ""}`} style={{ "--receipt-height": `${height}px` } as React.CSSProperties} onAnimationEnd={event => { if (event.target === event.currentTarget) setPrinted(true); }}>
          <ReceiptContent name={name} giftLabel={giftLabel} drinkLabels={drinkLabels} />
        </div>
      </div>
      <div className="receipt-printer" aria-hidden="true">
        <div className="receipt-printer-slot"><img src="/assets/receipt-printer-slot.png" alt="" /></div>
      </div>
      <div className="receipt-export-source" ref={exportRef} aria-hidden="true"><ReceiptContent name={name} giftLabel={giftLabel} drinkLabels={drinkLabels} exported /></div>
    </div>
    <div className="receipt-actions" hidden={!ready || !printed}>
      <button className="back-button" type="button" onClick={onBack} aria-label="Вернуться на предыдущий шаг">Назад</button>
      <button className="receipt-button receipt-download" type="button" onClick={downloadPng} disabled={downloading}>{downloading ? "Гружу..." : "Скачать"}</button>
      {walletAvailable && <button className="receipt-button receipt-wallet" type="button" onClick={addToWallet} disabled={walletPending}>
        <span className="receipt-wallet-icon" aria-hidden="true"><img src="/assets/receipt-wallet-layer.svg" alt="" /><img src="/assets/receipt-wallet-icon.svg" alt="" /></span>
        {walletPending ? "Добавляем…" : "Добавить в Wallet"}
      </button>}
    </div>
    {message && <p className="receipt-error" role="alert">{message}</p>}
  </section>;
}
