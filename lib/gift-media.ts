export type GiftMedia = Record<string, { still: string; transitions?: Record<string, string> }>;

// Media sources stay here so supplied clips can replace stills without changing the layout.
export const invitationMedia = {
  landingLoop: "/assets/landing-loop-optimized.mp4" as string | null,
  heartIntro: null as string | null,
  gifts: {
    heart: { label: "Приду без подарка, но любя", still: "/assets/gift-heart.webp", transitions: {} },
    "1000": { label: "1 тысяча рублей", still: "/assets/gift-1000.webp", transitions: {} },
    "2000": { label: "2 тысячи рублей", still: "/assets/gift-2000.webp", transitions: {} },
    "3000": { label: "3 тысячи рублей", still: "/assets/gift-3000.webp", transitions: {} },
    "4000": { label: "4 тысячи рублей", still: "/assets/gift-4000.webp", transitions: {} },
    "5000": { label: "5 тысяч рублей", still: "/assets/gift-5000.webp", transitions: {} },
    own: { label: "Приду со своим подарком", still: "/assets/gift-own.webp", transitions: {} },
  } as Record<string, { label: string; still: string; transitions: Record<string, string> }>,
};

export function giftMediaFor(media: GiftMedia, from: string | null, to: string) {
  return { still: media[to]?.still, transitionVideo: from ? media[from]?.transitions?.[to] : undefined };
}
