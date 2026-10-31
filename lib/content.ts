import initialContent from "../content/invitation.json" with { type: "json" };

export type EventDetails = typeof initialContent.event;
export type Gift = { id: string; label: string; image: string };
export type InvitationContent = { event: EventDetails; gifts: Gift[] };
export const defaultContent: InvitationContent = initialContent;

export function imageSource(value: unknown): value is string {
  return typeof value === "string" && (/^\/(assets|uploads)\/[a-zA-Z0-9._/-]+$/.test(value) && !value.includes("..")
    || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length <= 700_000);
}

export function parseContent(value: unknown): InvitationContent {
  if (!value || typeof value !== "object") throw new Error("Некорректное содержимое");
  const input = value as Record<string, unknown>;
  if (!input.event || typeof input.event !== "object" || !Array.isArray(input.gifts) || input.gifts.length < 1 || input.gifts.length > 20) {
    throw new Error("Нужно от 1 до 20 подарков");
  }
  const source = input.event as Record<string, unknown>;
  const event = Object.fromEntries(Object.keys(initialContent.event).map(key => {
    const text = source[key];
    if (typeof text !== "string" || text.length > (key === "wishlistImage" ? 700_000 : 4000) || text.includes("\0")) throw new Error(`Проверьте поле ${key}`);
    return [key, text];
  })) as EventDetails;
  if (!event.pageTitle.trim() || !event.hostGenitive.trim() || !event.dateFull.trim() || !event.location.trim()) throw new Error("Укажите название, имя, дату и место");
  if (event.mapUrl && (!URL.canParse(event.mapUrl) || new URL(event.mapUrl).protocol !== "https:")) throw new Error("Ссылка на карту должна начинаться с https://");
  if (!imageSource(event.wishlistImage)) throw new Error("Некорректное изображение вишлиста");
  const ids = new Set<string>();
  const gifts = input.gifts.map((item: unknown) => {
    if (!item || typeof item !== "object") throw new Error("Некорректная карточка");
    const { id, label, image } = item as Record<string, unknown>;
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(id) || ["__proto__", "constructor", "prototype"].includes(id) || ids.has(id)) throw new Error("Идентификаторы подарков должны быть уникальными");
    if (typeof label !== "string" || !label.trim() || label.length > 100 || !imageSource(image)) throw new Error("У каждого подарка нужны название (до 100 символов) и изображение");
    ids.add(id);
    return { id, label: label.trim(), image };
  });
  return { event, gifts };
}
