export const drinks = [
  { id: "red-wine", name: "Красное вино", detail: "Для душевных разговоров", images: [1] },
  { id: "white-wine", name: "Белое вино", detail: "Если хочется чего-то полегче", images: [2] },
  { id: "strong-beer", name: "Крепкое пиво", detail: "Если любишь горечь", images: [3] },
  { id: "light-beer", name: "Лёгкое пиво", detail: "Если не любишь горечь", images: [4] },
  { id: "non-alcoholic-beer", name: "Безалкогольное пиво", detail: "Если хочется пива, но без градусов", images: [5] },
  { id: "butterbeer", name: "Сливочное пиво", detail: "Если получится найти", images: [6] },
  { id: "martini", name: "Мартини", detail: "Для тех, кто хочет что-то другое", images: [7] },
  { id: "cider", name: "Сидр", detail: "Яблочный или грушевый", images: [8] },
  { id: "juice-tea", name: "Сок или чай", detail: "Если ты сейчас за ЗОЖ", images: [9, 10] },
];

export function drinkImageSource(id: string, number: number): string {
  return id === "martini" ? "/assets/martini.png" : `/assets/drink-${number}.webp`;
}
