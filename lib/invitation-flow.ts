export type Stage = "landing" | "gift" | "drinks" | "invitation";
export type LandingPhase = "idle" | "submitting" | "heartIntro" | "giftReady";
export type GiftPhase = "idleStill" | "transitioning" | "ready";
export type PrinterPhase = "selecting" | "receipt" | "printing" | "printed";

export type InvitationFlow = {
  stage: Stage;
  name: string;
  rsvpAccepted: boolean;
  landingPhase: LandingPhase;
  giftId: string | null;
  giftIndex: number | null;
  giftPhase: GiftPhase;
  giftFrom: string | null;
  giftTo: string | null;
  giftToIndex: number | null;
  giftTransitionToken: number;
  drinkIds: string[];
  printerPhase: PrinterPhase;
};

export type FlowEvent =
  | { type: "NAME_CHANGED"; name: string }
  | { type: "RSVP_SUBMIT" }
  | { type: "RSVP_FAILED" }
  | { type: "RSVP_ACCEPTED" }
  | { type: "SHOW_FIRST_GIFT" }
  | { type: "RESUME_GIFTS" }
  | { type: "BACK" }
  | { type: "HEART_INTRO_ENDED" }
  | { type: "GIFT_ENTER"; id?: string; index?: number }
  | { type: "GIFT_SELECT"; id: string; index: number }
  | { type: "GIFT_SET"; id: string; index: number }
  | { type: "GIFT_MEDIA_ENDED"; token: number }
  | { type: "GIFT_CONFIRM" }
  | { type: "DRINK_TOGGLE"; id: string }
  | { type: "DRINKS_CONFIRM" }
  | { type: "RECEIPT_READY" }
  | { type: "PRINT_FINISHED" }
  | { type: "REPLAY_PRINT" };

export function createInvitationFlow(): InvitationFlow {
  return {
    stage: "landing", name: "", rsvpAccepted: false,
    landingPhase: "idle", giftId: null, giftIndex: null, giftPhase: "idleStill",
    giftFrom: null, giftTo: null, giftToIndex: null, giftTransitionToken: 0, drinkIds: [], printerPhase: "selecting",
  };
}

export function createGiftSwitcher(
  ids: readonly string[],
  prepare: (id: string) => Promise<void>,
  commit: (id: string, index: number) => void,
  failed: () => void,
) {
  let requestedIndex: number | null = null;
  let committedIndex: number | null = null;
  let request = 0;
  return {
    step(currentIndex: number, direction: 1 | -1) {
      const next = ((requestedIndex ?? currentIndex) + direction + ids.length) % ids.length;
      requestedIndex = next;
      const token = ++request;
      void prepare(ids[next]).then(() => {
        if (token !== request) return;
        committedIndex = next;
        commit(ids[next], next);
      }, () => {
        if (token !== request) return;
        requestedIndex = committedIndex ?? currentIndex;
        failed();
      });
    },
    cancel() { request++; requestedIndex = null; committedIndex = null; },
  };
}

export function invitationReducer(state: InvitationFlow, event: FlowEvent): InvitationFlow {
  switch (event.type) {
    case "NAME_CHANGED":
      return state.stage === "landing" && !state.rsvpAccepted && state.landingPhase === "idle" ? { ...state, name: event.name } : state;
    case "RSVP_SUBMIT":
      return state.stage === "landing" && !state.rsvpAccepted && state.landingPhase === "idle" ? { ...state, landingPhase: "submitting" } : state;
    case "RSVP_FAILED":
      return state.landingPhase === "submitting" ? { ...state, landingPhase: "idle" } : state;
    case "RSVP_ACCEPTED":
      return state.stage === "landing" && state.landingPhase === "submitting" ? { ...state, rsvpAccepted: true, landingPhase: "idle" } : state;
    case "SHOW_FIRST_GIFT":
      return state.stage === "landing" && state.landingPhase === "idle" && state.rsvpAccepted
        ? { ...state, landingPhase: "heartIntro" } : state;
    case "RESUME_GIFTS":
      return state.stage === "landing" && state.landingPhase === "idle" && state.rsvpAccepted
        ? { ...state, stage: "gift", giftPhase: "ready" } : state;
    case "BACK":
      if (state.stage === "invitation") return { ...state, stage: "drinks", printerPhase: "selecting" };
      if (state.stage === "drinks") return { ...state, stage: "gift" };
      if (state.stage === "gift") return { ...state, stage: "landing", landingPhase: "idle" };
      return state;
    case "HEART_INTRO_ENDED":
      return state.landingPhase === "heartIntro" ? { ...state, landingPhase: "giftReady" } : state;
    case "GIFT_ENTER":
      return state.stage === "landing" && state.landingPhase === "giftReady"
        ? { ...state, stage: "gift", giftId: event.id ?? null, giftIndex: event.index ?? null,
            giftPhase: event.id ? "ready" : "idleStill" } : state;
    case "GIFT_SELECT":
      return state.stage === "gift" && state.giftPhase !== "transitioning" && event.id !== state.giftId
        ? { ...state, giftPhase: "transitioning", giftFrom: state.giftId, giftTo: event.id,
            giftToIndex: event.index, giftTransitionToken: state.giftTransitionToken + 1 }
        : state;
    case "GIFT_SET":
      return state.stage === "gift"
        ? { ...state, giftId: event.id, giftIndex: event.index, giftPhase: "ready", giftFrom: null, giftTo: null, giftToIndex: null, giftTransitionToken: state.giftTransitionToken + 1 }
        : state;
    case "GIFT_MEDIA_ENDED":
      return state.stage === "gift" && state.giftPhase === "transitioning" && event.token === state.giftTransitionToken
        ? { ...state, giftId: state.giftTo, giftIndex: state.giftToIndex,
            giftPhase: "ready", giftFrom: null, giftTo: null, giftToIndex: null }
        : state;
    case "GIFT_CONFIRM":
      return state.stage === "gift" && state.giftId && state.giftPhase !== "transitioning" ? { ...state, stage: "drinks" } : state;
    case "DRINK_TOGGLE":
      return state.stage === "drinks" && state.printerPhase === "selecting"
        ? { ...state, drinkIds: state.drinkIds.includes(event.id) ? state.drinkIds.filter(id => id !== event.id) : [...state.drinkIds, event.id] }
        : state;
    case "DRINKS_CONFIRM":
      return state.stage === "drinks" && state.printerPhase === "selecting" && state.drinkIds.length > 0
        ? { ...state, stage: "invitation", printerPhase: "receipt" } : state;
    case "RECEIPT_READY":
      return state.stage === "invitation" && state.printerPhase === "receipt" ? { ...state, printerPhase: "printing" } : state;
    case "PRINT_FINISHED":
      return state.stage === "invitation" && state.printerPhase === "printing" ? { ...state, printerPhase: "printed" } : state;
    case "REPLAY_PRINT":
      return state.stage === "invitation" && state.printerPhase === "printed" ? { ...state, printerPhase: "receipt" } : state;
  }
}
