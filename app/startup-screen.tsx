"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export default function StartupScreen({ hydrated, mediaReady, onReveal, children }: { hydrated: boolean; mediaReady: boolean; onReveal: (shown: boolean) => void; children?: ReactNode }) {
  const content = useRef<HTMLDivElement>(null);
  const [assetsReady, setAssetsReady] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);

  useEffect(() => {
    if (revealed) return;
    const timeout = window.setTimeout(() => setTimedOut(true), 8000);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { clearTimeout(timeout); document.body.style.overflow = previous; };
  }, [revealed]);

  useEffect(() => {
    let active = true;
    void document.fonts.ready.then(() => { if (active) setFontsReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    const images = Array.from(content.current?.querySelectorAll<HTMLImageElement>("img:not(.gift-image), img.gift-image.is-active") ?? [])
      .filter(image => !image.closest(".receipt-export-source"));
    let completed = 0;
    const cleanups: Array<() => void> = [];
    function finish() {
      if (!active) return;
      completed++;
      setImageProgress(completed / Math.max(1, images.length));
      if (completed === images.length) setAssetsReady(true);
    }
    for (const image of images) {
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        void image.decode().catch(() => {}).then(finish);
      };
      image.addEventListener("load", settle, { once: true });
      image.addEventListener("error", settle, { once: true });
      cleanups.push(() => { image.removeEventListener("load", settle); image.removeEventListener("error", settle); });
      if (image.complete) settle();
    }
    if (!images.length) setAssetsReady(true);
    return () => { active = false; cleanups.forEach(cleanup => cleanup()); };
  }, [hydrated]);

  const ready = hydrated && ((assetsReady && fontsReady && mediaReady) || timedOut);
  const progress = ready ? 100 : Math.min(99, (hydrated ? 15 : 0) + (fontsReady ? 20 : 0) + Math.round(imageProgress * 30) + (mediaReady ? 35 : 0));

  useEffect(() => {
    if (!ready) return;
    // Give 100% one paint before revealing the fully mounted page.
    const reveal = window.setTimeout(() => { setRevealed(true); onReveal(true); }, 180);
    const remove = window.setTimeout(() => setRemoved(true), 580);
    return () => { clearTimeout(reveal); clearTimeout(remove); };
  }, [ready, onReveal]);

  return <>
    <style>{`.startup-pending *{animation-play-state:paused!important}@media(prefers-reduced-motion:reduce){.startup-overlay,.startup-overlay *{transition:none!important}}`}</style>
    <div ref={content} className={revealed ? undefined : "startup-pending"} inert={!revealed} aria-hidden={!revealed} style={{ visibility: revealed ? "visible" : "hidden" }}>{children}</div>
    {!removed && <div className="startup-overlay" role="status" aria-label="Загрузка приглашения" style={{ position: "fixed", inset: 0, zIndex: 100, display: "grid", placeItems: "center", background: "#fff", color: "#1e1f20", fontFamily: "Arial, sans-serif", opacity: revealed ? 0 : 1, pointerEvents: revealed ? "none" : "auto", transition: "opacity 350ms ease" }}>
      <div style={{ width: "min(240px, calc(100vw - 64px))", textAlign: "center" }}>
        <div aria-hidden="true" style={{ fontSize: 56, fontWeight: 600, letterSpacing: "-.04em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{progress}<span style={{ fontSize: 24, color: "#606067", marginLeft: 4 }}>%</span></div>
        <p style={{ fontSize: 14, lineHeight: 1.4, margin: "16px 0 24px", color: "#606067" }}>Готовлю приглашение…</p>
        <div role="progressbar" aria-label="Готовность приглашения" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} style={{ height: 4, borderRadius: 4, background: "#efefef", overflow: "hidden" }}><div style={{ width: `${progress}%`, height: "100%", background: "#009cf7", transition: "width 200ms ease" }} /></div>
      </div>
    </div>}
  </>;
}
