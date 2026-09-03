// Keep the supported language list in one shared module so the API and web app stay in sync.
export const supportedLocales = ['en', 'nl', 'de', 'fr'] as const;

// Derive the locale union directly from the supported list to prevent invalid language values.
export type SupportedLocale = (typeof supportedLocales)[number];

/** Normalized nutrition values per 100 g; omitted fields were unavailable upstream. */
export interface ProductNutrition {
  /** Energy value in kilocalories per 100 grams. */
  energyKcal?: number;
  /** Total fat in grams per 100 grams. */
  fat?: number;
  /** Saturated fat in grams per 100 grams. */
  saturatedFat?: number;
  /** Carbohydrates in grams per 100 grams. */
  carbohydrates?: number;
  /** Sugars in grams per 100 grams. */
  sugars?: number;
  /** Fibre in grams per 100 grams. */
  fiber?: number;
  /** Protein in grams per 100 grams. */
  protein?: number;
  /** Salt in grams per 100 grams. */
  salt?: number;
}

/** Stable Foodex product shape shared by the API and web application. */
export interface ProductSummary {
  /** Open Food Facts product barcode. */
  barcode: string;
  /** Localized product name, or null when the provider has no name. */
  name: string | null;
  /** Product brand, or null when it is not supplied. */
  brand: string | null;
  /** Front image URL, or null when no usable image exists. */
  imageUrl: string | null;
  /** Normalized nutrition values; fields may be omitted when unavailable. */
  nutrition: ProductNutrition;
}
