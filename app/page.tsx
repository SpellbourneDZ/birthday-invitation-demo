"use client";

import { Fragment, FormEvent, KeyboardEvent, TouchEvent, useEffect, useRef, useState } from "react";
import { chromatic, slotText } from "slot-text";
import "slot-text/style.css";
import { createGiftSwitcher, createInvitationFlow, invitationReducer } from "../lib/invitation-flow";
import { event as eventDetails } from "../lib/event";
import { invitationMedia } from "../lib/gift-media";
import { drinks, drinkImageSource } from "../lib/drinks";
import type { FlowEvent } from "../lib/invitation-flow";
import ReceiptScene from "./receipt";
import StartupScreen from "./startup-screen";
import "./invitation.css";

const giftIds = ["1000", "2000", "3000", "4000", "5000", "own", "heart"];

const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("ru", { granularity: "grapheme" }) : null;

function BirthdayWords() {
  const element = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!element.current) return;
    const label = slotText(element.current, "день рождения");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const roll = () => {
      if (!document.hidden && !motion.matches) {
        label.set("день рождения", { direction: "up", skipUnchanged: false, color: chromatic({ from: 200, spread: 200 }) });
      }
    };
    const firstRoll = window.setTimeout(roll, 550);
    const repeat = window.setInterval(roll, 3600);
    return () => { window.clearTimeout(firstRoll); window.clearInterval(repeat); label.destroy(); };
  }, []);

  return <span className="birthday-motion" ref={element}>день рождения</span>;
}

function GentleWords({ text, start = 0 }: { text: string; start?: number }) {
  let index = start;
  return text.split(" ").map((word, wordIndex) => <Fragment key={`${word}-${wordIndex}`}>
    {wordIndex > 0 && " "}
    <span className="gentle-word">{(segmenter ? Array.from(segmenter.segment(word), part => part.segment) : Array.from(word)).map((char, charIndex) =>
      <span key={charIndex} className="gentle-char" style={{ animationDelay: `${index++ * 7.5}ms` }}>{char}</span>)}</span>
  </Fragment>);
}

export default function Home() {
  const [flow, setFlow] = useState(createInvitationFlow);
  function dispatch(event: FlowEvent) { setFlow(state => invitationReducer(state, event)); }
  const [hydrated, setHydrated] = useState(false);
  const [startupShown, setStartupShown] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [videoStatus, setVideoStatus] = useState<"missing" | "loading" | "ready" | "error">(invitationMedia.landingLoop ? "loading" : "missing");
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [preparingGift, setPreparingGift] = useState(false);
  const [readyGiftId, setReadyGiftId] = useState<string | null>(null);
  const [giftLoadError, setGiftLoadError] = useState(false);
  const [giftRetry, setGiftRetry] = useState(0);
  const [mediaError, setMediaError] = useState(false);
  const submitting = useRef(false);
  const giftImages = useRef<Record<string, HTMLImageElement | null>>({});
  const giftDecodes = useRef(new Map<string, { image: HTMLImageElement; ready: Promise<void> }>());
  const failedGiftImages = useRef(new Set<string>());
  const giftSwitcher = useRef<ReturnType<typeof createGiftSwitcher> | null>(null);
  const touchStart = useRef<number | null>(null);
  const landingVideo = useRef<HTMLVideoElement>(null);
  const stageHeading = useRef<HTMLHeadingElement>(null);
  const modalButton = useRef<HTMLButtonElement>(null);
  const modalTrigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    for (const id of giftIds) void prepareGift(id).catch(() => {});
    return () => giftSwitcher.current?.cancel();
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const images = drinks.flatMap(drink => drink.images.map(number => {
      const image = new Image();
      image.fetchPriority = "low";
      image.src = drinkImageSource(drink.id, number);
      void image.decode().catch(() => {});
      return image;
    }));
    // Keep decoded images referenced until this page closes.
    return () => { images.length = 0; };
  }, [hydrated]);


  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!hydrated || !startupShown || (flow.stage === "landing" && flow.landingPhase === "idle")) return;
    const frame = window.requestAnimationFrame(() => {
      const heading = stageHeading.current || document.querySelector<HTMLElement>(".receipt-copy h1");
      if (heading) { heading.tabIndex = -1; window.scrollTo({ top: 0, behavior: "auto" }); heading.focus({ preventScroll: true }); }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hydrated, startupShown, flow.stage, flow.landingPhase]);

  useEffect(() => {
    if (flow.landingPhase !== "heartIntro") return;
    if (invitationMedia.heartIntro && !mediaError && !reducedMotion) {
      const timer = window.setTimeout(() => setMediaError(true), 5000);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => dispatch({ type: "HEART_INTRO_ENDED" }), reducedMotion ? 0 : 360);
    return () => window.clearTimeout(timer);
  }, [flow.landingPhase, mediaError, reducedMotion]);

  useEffect(() => {
    if (flow.landingPhase !== "giftReady") return;
    const timer = window.setTimeout(() => dispatch({ type: "GIFT_ENTER", id: giftIds[0], index: 0 }), 0);
    return () => window.clearTimeout(timer);
  }, [flow.landingPhase]);

  const currentGiftId = flow.giftId && giftIds.includes(flow.giftId) ? flow.giftId : giftIds[0];
  const currentGift = invitationMedia.gifts[currentGiftId];

  useEffect(() => {
    if (flow.stage !== "gift" || readyGiftId === currentGiftId) return;
    let active = true;
    void prepareGift(currentGiftId).then(() => {
      if (!active) return;
      setReadyGiftId(currentGiftId);
      setGiftLoadError(false);
    }, () => { if (active) setGiftLoadError(true); });
    return () => { active = false; };
  }, [flow.stage, currentGiftId, readyGiftId, giftRetry]);

  useEffect(() => {
    if (!modalOpen) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const trigger = modalTrigger.current;
    modalButton.current?.focus();
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setModalOpen(false);
      if (event.key === "Tab") { event.preventDefault(); modalButton.current?.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); (trigger || previous)?.focus(); };
  }, [modalOpen]);

  function showToast(text: string) { setToast({ text, key: Date.now() }); }

  function prepareGift(id: string): Promise<void> {
    const image = giftImages.current[id];
    if (!image) return Promise.reject(new Error("Gift image is not mounted"));
    const cached = giftDecodes.current.get(id);
    if (cached?.image === image) return cached.ready;
    if (failedGiftImages.current.has(id)) image.src = `${invitationMedia.gifts[id].still}?retry=${Date.now()}`;
    let timeout: number | undefined;
    const ready = Promise.race([
      image.decode(),
      new Promise<void>((_, reject) => { timeout = window.setTimeout(() => reject(new Error("Gift image timed out")), 8000); }),
    ]).then(() => { if (giftDecodes.current.get(id)?.image === image) failedGiftImages.current.delete(id); }, error => {
      if (giftDecodes.current.get(id)?.image === image) {
        giftDecodes.current.delete(id);
        failedGiftImages.current.add(id);
      }
      throw error;
    }).finally(() => window.clearTimeout(timeout));
    giftDecodes.current.set(id, { image, ready });
    return ready;
  }

  if (!giftSwitcher.current) giftSwitcher.current = createGiftSwitcher(
    giftIds,
    prepareGift,
    (id, index) => {
      setFlow(state => invitationReducer(state, { type: "GIFT_SET", id, index }));
      setReadyGiftId(id);
      setGiftLoadError(false);
    },
    () => showToast("Не удалось загрузить подарок. Попробуй ещё раз"),
  );

  async function submitRsvp(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (flow.rsvpAccepted) {
      submitting.current = true;
      setPreparingGift(true);
      try {
        await prepareGift(currentGiftId);
        setReadyGiftId(currentGiftId);
        dispatch({ type: flow.giftId ? "RESUME_GIFTS" : "SHOW_FIRST_GIFT" });
      } catch { showToast("Не удалось загрузить подарок. Попробуй ещё раз"); }
      finally { submitting.current = false; setPreparingGift(false); }
      return;
    }
    const name = flow.name.normalize("NFC").trim().replace(/\s+/gu, " ");
    if (!name) { showToast("Скрытно не получится, напиши имя"); return; }
    submitting.current = true;
    dispatch({ type: "NAME_CHANGED", name });
    dispatch({ type: "RSVP_SUBMIT" });
    try {
      dispatch({ type: "RSVP_ACCEPTED" });
      setPreparingGift(true);
      try {
        await prepareGift(giftIds[0]);
        setReadyGiftId(giftIds[0]);
        dispatch({ type: "SHOW_FIRST_GIFT" });
      } catch { showToast("Подарок не загрузился. Попробуй продолжить ещё раз"); }
      finally { setPreparingGift(false); }
    } catch {
      dispatch({ type: "RSVP_FAILED" });
      showToast("Не удалось продолжить. Попробуй ещё раз");
    } finally { submitting.current = false; }
  }

  function stepGift(step: 1 | -1) {
    if (flow.stage !== "gift") return;
    giftSwitcher.current?.step(giftIds.indexOf(currentGiftId), step);
  }

  function goBack() {
    giftSwitcher.current?.cancel();
    setReadyGiftId(null);
    setGiftLoadError(false);
    setToast(null);
    dispatch({ type: "BACK" });
  }

  function confirmDrinks() {
    if (!flow.drinkIds.length) { showToast("Обязательно нужно выбрать напиток"); return; }
    setToast(null);
    dispatch({ type: "DRINKS_CONFIRM" });
  }

  function giftKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (flow.stage !== "gift" || modalOpen || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.key === "ArrowRight") { event.preventDefault(); stepGift(1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); stepGift(-1); }
  }

  function giftTouchEnd(event: TouchEvent<HTMLElement>) {
    if (touchStart.current === null) return;
    const distance = event.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(distance) > 45) stepGift(distance < 0 ? 1 : -1);
    touchStart.current = null;
  }



  const showingGift = flow.stage === "gift" || (flow.stage === "landing" && ["heartIntro", "giftReady"].includes(flow.landingPhase));
  const expanded = showingGift;
  const giftVisual = flow.stage === "gift" || ["heartIntro", "giftReady"].includes(flow.landingPhase);
  const giftVisualReady = readyGiftId === currentGiftId;

  const startupMediaReady = flow.stage === "landing" ? reducedMotion || videoStatus === "ready" || videoStatus === "error" || videoStatus === "missing" : flow.stage === "gift" ? giftVisualReady || giftLoadError : true;

  return <StartupScreen hydrated={hydrated} mediaReady={startupMediaReady} onReveal={setStartupShown}>{hydrated && <main className={`invitation stage-${flow.stage}`}>
    {eventDetails.demoNotice && <p className="demo-notice">{eventDetails.demoNotice}</p>}
    {(flow.stage === "landing" || flow.stage === "gift") && <section className={`main-scene ${showingGift ? "show-gift" : "show-landing"}`} onKeyDown={giftKeyDown}>
      <div className={`portrait ${expanded ? "expand" : ""}`} onTouchStart={event => { touchStart.current = event.touches[0].clientX; }} onTouchEnd={giftTouchEnd}>
        <img className="portrait-image neutral" src="/assets/landing-raw-1.webp" alt="" />
        {invitationMedia.landingLoop && videoStatus !== "error" && !reducedMotion && flow.stage === "landing" && <video ref={landingVideo} className="portrait-image" src={invitationMedia.landingLoop} poster="/assets/landing-raw-1.webp" preload="auto" autoPlay muted playsInline loop
          onCanPlay={() => setVideoStatus("ready")} onError={() => setVideoStatus("error")} />}
        {giftIds.map(id => <img key={id} ref={element => { giftImages.current[id] = element; }} className={`portrait-image gift-image ${giftVisual && giftVisualReady && id === currentGiftId ? "is-active" : ""} ${giftVisual && giftVisualReady && id === currentGiftId && flow.landingPhase === "heartIntro" ? "heart-reveal" : ""}`} src={invitationMedia.gifts[id].still} fetchPriority={id === giftIds[0] ? "high" : "low"} alt="" />)}
        {giftVisual && <>
          {flow.landingPhase === "heartIntro" && invitationMedia.heartIntro && !mediaError && !reducedMotion && <video className="portrait-image intro-video" src={invitationMedia.heartIntro} poster="/assets/landing-raw-1.webp" preload="auto" autoPlay muted playsInline onEnded={() => dispatch({ type: "HEART_INTRO_ENDED" })} onError={() => setMediaError(true)} />}

        </>}
        <img className="portrait-fade" src="/assets/portrait-fade.svg" alt="" />
      </div>
      {!showingGift ? <div className="landing-content">
        <div className="event-details" id="demo-event"><span className="date"><span className="demo-calendar" aria-hidden="true"><small>{eventDetails.calendarMonth}</small>{eventDetails.calendarDay}</span>{eventDetails.dateLabel}, {eventDetails.time}</span><a className="location" href={eventDetails.mapUrl || "#demo-event"}><img className="event-icon" src="/assets/2gis-icon.png" alt="" width="24" height="24" />{eventDetails.location}</a></div>
        <h1 className="hero-copy" aria-label="Приходи праздновать мой день рождения"><span className="gentle-content" aria-hidden="true"><GentleWords text="Приходи праздновать" /><br /> <GentleWords text="мой" start={20} />{" "}<BirthdayWords /></span></h1>
        <p className="landing-description">{eventDetails.description}</p>
        <form className={`rsvp-form ${toast && !flow.name.trim() ? "is-invalid" : ""}`} onSubmit={submitRsvp} noValidate><label className="sr-only" htmlFor="guest-name">Твоё имя</label><input id="guest-name" value={flow.name} maxLength={80} autoComplete="name" placeholder="Напиши свое имя" aria-invalid={!!toast && !flow.name.trim()} onChange={event => dispatch({ type: "NAME_CHANGED", name: event.target.value })} disabled={flow.rsvpAccepted || flow.landingPhase !== "idle"} /><button className="primary-button" type="submit" disabled={preparingGift || flow.landingPhase !== "idle"}>{flow.landingPhase === "submitting" ? "Отправляю…" : preparingGift ? "Загружаю…" : flow.rsvpAccepted ? "Продолжить" : "Я приду!"}</button>{toast && <div className="rsvp-feedback"><p key={toast.key} className="toast" role="alert">{toast.text}</p></div>}</form>
      </div> : <div className="gift-content">
        <h2 ref={stageHeading} tabIndex={-1}>Выбери подарок</h2>
        <div className="gift-description"><p>Собрал небольшой вишлист. Листай варианты стрелочками и выбирай, что хотел бы мне подарить. Я не увижу твой выбор, так что для меня всё останется сюрпризом!</p>
        <button ref={modalTrigger} className="text-button" type="button" onClick={() => setModalOpen(true)}>Почему такие подарки?</button>
        </div>
        <div className="gift-actions">
          <div className="gift-switcher">
            <button className="arrow-button" type="button" aria-label="Предыдущий подарок" disabled={flow.stage !== "gift"} onClick={() => stepGift(-1)}><img src="/assets/gift-arrow-left.svg" alt="" width="24" height="24" /></button>
            <div className="gift-selection-label" aria-live="polite">
              {giftVisualReady ? currentGift.label : giftLoadError
                ? <button className="text-button" type="button" onClick={() => { setGiftLoadError(false); setGiftRetry(value => value + 1); }}>Повторить загрузку</button>
                : "Загружаю подарок…"}
            </div>
            <button className="arrow-button" type="button" aria-label="Следующий подарок" disabled={flow.stage !== "gift"} onClick={() => stepGift(1)}><img src="/assets/gift-arrow-right.svg" alt="" width="24" height="24" /></button>
          </div>
          <div className="gift-confirm-actions">
            <button className="back-button" type="button" onClick={goBack} aria-label="Вернуться на предыдущий шаг">Назад</button>
            <button className="primary-button" type="button" disabled={flow.stage !== "gift" || !giftVisualReady} onClick={() => { giftSwitcher.current?.cancel(); setReadyGiftId(null); dispatch({ type: "GIFT_CONFIRM" }); }}>Выбрать</button>
          </div>
        </div>
      </div>}
    </section>}
    {flow.stage === "drinks" && <section className="drinks-scene">
      <div className="scene-intro"><h2 ref={stageHeading} tabIndex={-1}>Выбери напиток</h2><p>Выбери то, что хочешь пить этим вечером. Можно выбрать несколько напитков сразу, это не запрещено</p></div>
      <div className="drink-grid">{drinks.map(drink => <button key={drink.id} type="button" className={`drink-card ${flow.drinkIds.includes(drink.id) ? "selected" : ""}`} aria-pressed={flow.drinkIds.includes(drink.id)} onClick={() => dispatch({ type: "DRINK_TOGGLE", id: drink.id })}>
        <span className="drink-text"><strong>{drink.name}</strong><span>{drink.detail}</span></span>
        <span className="drink-check" aria-hidden="true">{flow.drinkIds.includes(drink.id) && <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M16.6667 5L7.5 14.1667L3.33333 10" stroke="white" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>
        <span className={`drink-art drink-art-${drink.id}`} aria-hidden="true">{drink.images.map(number => <img key={number} src={drinkImageSource(drink.id, number)} alt="" />)}</span>
      </button>)}</div>
      <div className="stage-actions"><button className="back-button" type="button" onClick={goBack} aria-label="Вернуться на предыдущий шаг">Назад</button><button className="primary-button continue-button" type="button" onClick={confirmDrinks}>Продолжить</button></div>
      {toast && <p key={toast.key} className="toast" role="alert">{toast.text}</p>}
    </section>}
    {flow.stage === "invitation" && <ReceiptScene onBack={goBack} name={flow.name} giftLabel={invitationMedia.gifts[currentGiftId].label} drinkLabels={drinks.filter(drink => flow.drinkIds.includes(drink.id)).map(drink => drink.name)} />}
    {modalOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setModalOpen(false); }}><div className="steam-modal" role="dialog" aria-modal="true" aria-labelledby="steam-title"><img src={eventDetails.wishlistImage} alt={eventDetails.wishlistImageAlt} /><h2 id="steam-title">{eventDetails.wishlistTitle}</h2><p>{eventDetails.wishlistDescription}</p><button ref={modalButton} className="primary-button" type="button" onClick={() => setModalOpen(false)}>Хорошо</button></div></div>}
  </main>}</StartupScreen>;
}
