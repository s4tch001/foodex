export const supportedLocales = ['en', 'nl', 'de', 'fr'] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

export interface ProductNutrition {
  energyKcal?: number;
  fat?: number;
  saturatedFat?: number;
  carbohydrates?: number;
  sugars?: number;
  fiber?: number;
  protein?: number;
  salt?: number;
}

export interface ProductSummary {
  barcode: string;
  name: string | null;
  brand: string | null;
  imageUrl: string | null;
  nutrition: ProductNutrition;
}
