import assert from "node:assert/strict";
import { test } from "node:test";
import { createGiftSwitcher, createInvitationFlow, invitationReducer } from "../lib/invitation-flow.ts";
import type { InvitationFlow } from "../lib/invitation-flow.ts";

test("back navigation keeps choices and reuses the accepted RSVP", () => {
  let state = createInvitationFlow();
  state = invitationReducer(state, { type: "NAME_CHANGED", name: "Анна" });
  state = invitationReducer(state, { type: "RSVP_SUBMIT" });
  state = invitationReducer(state, { type: "RSVP_ACCEPTED" });
  assert.equal(state.landingPhase, "idle");
  state = invitationReducer(state, { type: "SHOW_FIRST_GIFT" });
  assert.equal(state.landingPhase, "heartIntro");
  state = invitationReducer(state, { type: "HEART_INTRO_ENDED" });
  state = invitationReducer(state, { type: "GIFT_ENTER", id: "2000", index: 2 });
  state = invitationReducer(state, { type: "GIFT_CONFIRM" });
  state = invitationReducer(state, { type: "DRINK_TOGGLE", id: "cider" });
  state = invitationReducer(state, { type: "DRINKS_CONFIRM" });

  state = invitationReducer(state, { type: "BACK" });
  assert.equal(state.stage, "drinks");
  assert.deepEqual(state.drinkIds, ["cider"]);
  state = invitationReducer(state, { type: "DRINK_TOGGLE", id: "tea" });
  state = invitationReducer(state, { type: "BACK" });
  assert.equal(state.stage, "gift");
  assert.equal(state.giftId, "2000");
  state = invitationReducer(state, { type: "BACK" });
  assert.equal(state.stage, "landing");
  assert.equal(state.landingPhase, "idle");
  assert.equal(invitationReducer(state, { type: "RSVP_SUBMIT" }), state);
  assert.equal(invitationReducer(state, { type: "NAME_CHANGED", name: "Другой" }), state);

  state = invitationReducer(state, { type: "RESUME_GIFTS" });
  assert.equal(state.stage, "gift");
  assert.equal(state.giftId, "2000");
  assert.deepEqual(state.drinkIds, ["cider", "tea"]);
  state = invitationReducer(state, { type: "GIFT_CONFIRM" });
  state = invitationReducer(state, { type: "DRINKS_CONFIRM" });
  assert.equal(state.stage, "invitation");
  assert.deepEqual(state.drinkIds, ["cider", "tea"]);
});

test("gift image switcher commits only the latest decoded image and recovers from errors", async () => {
  const pending = new Map<string, Array<{ resolve: () => void; reject: () => void }>>();
  const commits: string[] = [];
  let failures = 0;
  const switcher = createGiftSwitcher(["heart", "1000", "2000"], id => new Promise<void>((resolve, reject) => {
    pending.set(id, [...(pending.get(id) ?? []), { resolve, reject: () => reject(new Error("network")) }]);
  }), id => commits.push(id), () => { failures++; });

  switcher.step(0, 1);
  switcher.step(0, 1);
  pending.get("1000")![0].resolve();
  await Promise.resolve();
  assert.deepEqual(commits, []);
  pending.get("2000")![0].resolve();
  await Promise.resolve();
  assert.deepEqual(commits, ["2000"]);

  switcher.step(0, -1);
  pending.get("1000")![1].reject();
  await Promise.resolve();
  assert.deepEqual(commits, ["2000"]);
  assert.equal(failures, 1);
  switcher.step(2, 1);
  pending.get("heart")![0].resolve();
  await Promise.resolve();
  assert.deepEqual(commits, ["2000", "heart"]);

  switcher.step(0, 1);
  switcher.cancel();
  pending.get("1000")![2].resolve();
  await Promise.resolve();
  assert.deepEqual(commits, ["2000", "heart"]);
});

test("late gift events cannot complete a newer transition", () => {
  let state: InvitationFlow = { ...createInvitationFlow(), stage: "gift" };
  state = invitationReducer(state, { type: "GIFT_SELECT", id: "a", index: 0 });
  const token = state.giftTransitionToken;
  assert.equal(state.giftIndex, null);
  assert.equal(state.giftToIndex, 0);
  assert.equal(invitationReducer(state, { type: "GIFT_SELECT", id: "b", index: 1 }), state);
  assert.equal(invitationReducer(state, { type: "GIFT_MEDIA_ENDED", token: token - 1 }), state);
  state = invitationReducer(state, { type: "GIFT_MEDIA_ENDED", token });
  assert.equal(state.giftId, "a");
  assert.equal(state.giftPhase, "ready");
});

test("heart still is ready after the intro", () => {
  let state: InvitationFlow = { ...createInvitationFlow(), landingPhase: "giftReady", rsvpAccepted: true };
  state = invitationReducer(state, { type: "GIFT_ENTER", id: "heart", index: 0 });
  assert.equal(state.stage, "gift");
  assert.equal(state.giftId, "heart");
  assert.equal(state.giftPhase, "ready");
  assert.equal(invitationReducer(state, { type: "GIFT_CONFIRM" }).stage, "drinks");
});

test("direct gift selection is ready immediately and ignores old transition callbacks", () => {
  const initial: InvitationFlow = { ...createInvitationFlow(), stage: "gift" };
  const transitioning = invitationReducer(initial, { type: "GIFT_SELECT", id: "heart", index: 0 });
  const state = invitationReducer(transitioning, { type: "GIFT_SET", id: "2000", index: 2 });
  assert.equal(state.giftId, "2000");
  assert.equal(state.giftPhase, "ready");
  assert.equal(invitationReducer(state, { type: "GIFT_MEDIA_ENDED", token: transitioning.giftTransitionToken }), state);
});

test("a drink is required and invitation printing can replay", () => {
  let state: InvitationFlow = { ...createInvitationFlow(), stage: "drinks", rsvpAccepted: true, name: "Анна" };
  assert.equal(invitationReducer(state, { type: "DRINKS_CONFIRM" }), state);
  state = invitationReducer(state, { type: "DRINK_TOGGLE", id: "tea" });
  state = invitationReducer(state, { type: "DRINKS_CONFIRM" });
  assert.equal(state.stage, "invitation");
  assert.equal(state.printerPhase, "receipt");
  state = invitationReducer(state, { type: "RECEIPT_READY" });
  assert.equal(state.printerPhase, "printing");
  state = invitationReducer(state, { type: "PRINT_FINISHED" });
  assert.equal(state.printerPhase, "printed");
  assert.equal(invitationReducer(state, { type: "REPLAY_PRINT" }).printerPhase, "receipt");
});

test("a new page starts without the previous guest choices", () => {
  const state = invitationReducer(createInvitationFlow(), { type: "NAME_CHANGED", name: "Demo guest" });
  assert.equal(state.name, "Demo guest");
  const fresh = createInvitationFlow();
  assert.equal(fresh.stage, "landing");
  assert.equal(fresh.name, "");
  assert.deepEqual(fresh.drinkIds, []);
  assert.equal(fresh.giftId, null);
});
