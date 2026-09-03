import type { ProductNutrition, ProductSummary, SupportedLocale } from '@foodex/shared';

const SEARCH_API_URL = 'https://search.openfoodfacts.org/search';
const LEGACY_SEARCH_API_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const PRODUCT_FIELDS =
  'code,brands,image_front_small_url,product_name,product_name_en,product_name_nl,product_name_de,product_name_fr,nutriments';
const PRODUCT_PAGE_SIZE = 20;
const NUTRITION_BATCH_SIZE = 5;
const PRODUCT_CACHE_LIMIT = 500;
const PAGE_CACHE_LIMIT = 250;
const PAGE_CACHE_TTL_MS = 15 * 60 * 1_000;
const PAGE_CACHE_STALE_TTL_MS = 24 * 60 * 60 * 1_000;
const PRODUCT_FAILURE_TTL_MS = 60 * 1_000;
const SEARCH_REQUEST_INTERVAL_MS = 6_100;
const REQUEST_HEADERS = {
  'User-Agent': 'Foodex/0.1 (contact: s4tch001@users.noreply.github.com)',
};

type PublicProductSummary = Omit<ProductSummary, 'nutrition'>;

/** Products loaded for protected nutrition plus barcodes whose provider request failed. */
export interface ProductBatchResult {
  products: ProductSummary[];
  failedBarcodes: string[];
}
/** One provider-ranked search page and the navigation state exposed to the browser. */
export interface ProductSearchPage {
  products: ProductSummary[];
  pagination: {
    page: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// Bounded process-local caches reduce provider traffic without pretending Foodex owns the dataset.
const productCache = new Map<string, ProductSummary | null>();
const productFailures = new Map<string, number>();
const productRequests = new Map<string, Promise<ProductBatchResult>>();
const pageCache = new Map<
  string,
  { expiresAt: number; staleUntil: number; page: ProductSearchPage }
>();
const pageRequests = new Map<string, Promise<ProductSearchPage>>();
// Legacy nutrition searches are serialized to stay below Open Food Facts' documented limit.
let nextSearchRequestAt = 0;
let searchRequestQueue = Promise.resolve();

interface OpenFoodFactsProduct {
  code?: string;
  brands?: string | string[];
  image_front_small_url?: string;
  product_name?: string;
  product_name_en?: string;
  product_name_nl?: string;
  product_name_de?: string;
  product_name_fr?: string;
  nutriments?: Record<string, unknown>;
}

interface SearchResponse {
  count?: number;
  page?: number;
  page_count?: number;
  page_size?: number;
  hits?: OpenFoodFactsProduct[];
  products?: OpenFoodFactsProduct[];
}

async function fetchOpenFoodFacts(url: URL): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    return await fetch(url, { headers: REQUEST_HEADERS, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithRetry(url: URL): Promise<Response> {
  let response = await fetchOpenFoodFacts(url);
  if (![429, 502, 503, 504].includes(response.status)) return response;

  const retryAfterSeconds = Number(response.headers.get('retry-after'));
  const delayMs =
    process.env.NODE_ENV === 'test' ? 0 : Math.min(retryAfterSeconds * 1_000 || 750, 2_000);
  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  response = await fetchOpenFoodFacts(url);
  return response;
}

function fetchOpenFoodFactsSearch(url: URL): Promise<Response> {
  if (process.env.NODE_ENV === 'test') return fetchOpenFoodFacts(url);

  const request = searchRequestQueue.then(async () => {
    const delay = Math.max(0, nextSearchRequestAt - Date.now());
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    nextSearchRequestAt = Date.now() + SEARCH_REQUEST_INTERVAL_MS;
    return fetchOpenFoodFacts(url);
  });
  searchRequestQueue = request.then(
    () => undefined,
    () => undefined,
  );
  return request;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function localizeName(product: OpenFoodFactsProduct, locale: SupportedLocale): string | null {
  // Source translations are incomplete, so preserve a predictable locale -> English -> original fallback.
  const localized = product[`product_name_${locale}` as const];
  return (
    localized?.trim() || product.product_name_en?.trim() || product.product_name?.trim() || null
  );
}

function mapNutrition(nutriments: Record<string, unknown> | undefined): ProductNutrition {
  return {
    energyKcal: optionalNumber(nutriments?.['energy-kcal_100g']),
    fat: optionalNumber(nutriments?.fat_100g),
    saturatedFat: optionalNumber(nutriments?.['saturated-fat_100g']),
    carbohydrates: optionalNumber(nutriments?.carbohydrates_100g),
    sugars: optionalNumber(nutriments?.sugars_100g),
    fiber: optionalNumber(nutriments?.fiber_100g),
    protein: optionalNumber(nutriments?.proteins_100g),
    salt: optionalNumber(nutriments?.salt_100g),
  };
}

/** Normalizes an Open Food Facts record into Foodex's stable product contract. */
export function mapProduct(product: OpenFoodFactsProduct, locale: SupportedLocale): ProductSummary {
  const brand = Array.isArray(product.brands) ? product.brands.join(', ') : product.brands;
  return {
    barcode: product.code ?? '',
    name: localizeName(product, locale),
    brand: brand?.trim() || null,
    imageUrl: product.image_front_small_url?.trim() || null,
    nutrition: mapNutrition(product.nutriments),
  };
}

function cacheProduct(barcode: string, product: ProductSummary | null) {
  productCache.delete(barcode);
  productCache.set(barcode, product);
  if (productCache.size > PRODUCT_CACHE_LIMIT) {
    const oldestBarcode = productCache.keys().next().value;
    if (oldestBarcode) productCache.delete(oldestBarcode);
  }
}

function cacheProducts(products: ProductSummary[]) {
  for (const product of products) {
    if (product.barcode) {
      productFailures.delete(product.barcode);
      cacheProduct(product.barcode, product);
    }
  }
}

function cachePage(key: string, page: ProductSearchPage) {
  pageCache.delete(key);
  pageCache.set(key, {
    expiresAt: Date.now() + PAGE_CACHE_TTL_MS,
    staleUntil: Date.now() + PAGE_CACHE_STALE_TTL_MS,
    page,
  });
  if (pageCache.size > PAGE_CACHE_LIMIT) {
    const oldestKey = pageCache.keys().next().value;
    if (oldestKey) pageCache.delete(oldestKey);
  }
}

function getCachedPage(key: string): ProductSearchPage | null {
  const cached = pageCache.get(key);
  if (!cached) return null;
  if (cached.staleUntil <= Date.now()) {
    pageCache.delete(key);
    return null;
  }
  if (cached.expiresAt <= Date.now()) return null;
  pageCache.delete(key);
  pageCache.set(key, cached);
  return cached.page;
}

function requestCachedPage(key: string, load: () => Promise<ProductSearchPage>) {
  const cached = getCachedPage(key);
  if (cached) return Promise.resolve(cached);
  const existingRequest = pageRequests.get(key);
  if (existingRequest) return existingRequest;

  const stalePage = pageCache.get(key)?.page;
  const request = load()
    .then((page) => {
      cachePage(key, page);
      return page;
    })
    .catch((error) => {
      if (stalePage) return stalePage;
      throw error;
    })
    .finally(() => pageRequests.delete(key));
  pageRequests.set(key, request);
  return request;
}

function mapSearchPage(
  payload: SearchResponse,
  locale: SupportedLocale,
  requestedPage: number,
): ProductSearchPage {
  const sourceProducts = payload.hits ?? payload.products ?? [];
  const products = sourceProducts
    .map((product) => mapProduct(product, locale))
    .filter((product) => product.barcode || product.name)
    .slice(0, PRODUCT_PAGE_SIZE);
  cacheProducts(products);
  const page = payload.page ?? requestedPage;
  const pageSize = payload.page_size ?? PRODUCT_PAGE_SIZE;
  const pageCount = payload.page_count;
  const returnedCount = sourceProducts.length;
  const totalItems = payload.count ?? null;
  return {
    products,
    pagination: {
      page,
      hasNext:
        pageCount !== undefined
          ? page < pageCount
          : totalItems !== null
            ? page * pageSize < totalItems
            : returnedCount >= pageSize,
      hasPrevious: page > 1,
    },
  };
}

/** Removes protected nutrition before a product is returned from a public search route. */
export function toPublicProduct(product: ProductSummary): PublicProductSummary {
  const { nutrition: _nutrition, ...publicProduct } = product;
  return publicProduct;
}

/** Searches a cached, locale-aware, 20-result Open Food Facts page. */
export async function searchProducts(
  query: string,
  locale: SupportedLocale,
  page = 1,
): Promise<ProductSearchPage> {
  // Search-a-licious is Open Food Facts' dedicated full-text service. Using its ranked pages
  // avoids shrinking each 20-result page with application-side filtering.
  const normalizedQuery = query.trim().toLowerCase();
  const key = `search:${locale}:${normalizedQuery}:${page}`;
  try {
    return await requestCachedPage(key, async () => {
      const url = new URL(SEARCH_API_URL);
      url.searchParams.set('q', query);
      url.searchParams.set('page', String(page));
      url.searchParams.set('page_size', String(PRODUCT_PAGE_SIZE));
      url.searchParams.set('fields', PRODUCT_FIELDS);
      const response = await fetchWithRetry(url);
      if (!response.ok) throw new Error(`Open Food Facts search returned ${response.status}.`);
      const payload = (await response.json()) as SearchResponse;
      return mapSearchPage(payload, locale, page);
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown provider error.';
    console.warn(`Open Food Facts search is unavailable: ${reason}`);
    throw error;
  }
}

async function getProductByBarcode(
  barcode: string,
  locale: SupportedLocale,
): Promise<ProductSummary | null> {
  const url = new URL(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
  );
  url.searchParams.set('fields', PRODUCT_FIELDS);
  const response = await fetchOpenFoodFacts(url);
  if (!response.ok) throw new Error(`Open Food Facts product lookup returned ${response.status}.`);
  const payload = (await response.json()) as { status?: number; product?: OpenFoodFactsProduct };
  return payload.status === 1 && payload.product ? mapProduct(payload.product, locale) : null;
}

async function loadProductChunk(
  barcodes: string[],
  locale: SupportedLocale,
): Promise<ProductBatchResult> {
  const url = new URL(LEGACY_SEARCH_API_URL);
  url.searchParams.set('action', 'process');
  url.searchParams.set('code', barcodes.join(','));
  url.searchParams.set('json', '1');
  url.searchParams.set('page_size', String(barcodes.length));
  url.searchParams.set('fields', PRODUCT_FIELDS);

  try {
    const response = await fetchOpenFoodFactsSearch(url);
    if (!response.ok) throw new Error(`Open Food Facts batch lookup returned ${response.status}.`);
    const payload = (await response.json()) as SearchResponse;
    const products = (payload.products ?? [])
      .map((product) => mapProduct(product, locale))
      .filter((product) => barcodes.includes(product.barcode));
    const productsByBarcode = new Set(products.map((product) => product.barcode));
    cacheProducts(products);
    for (const barcode of barcodes) {
      if (!productsByBarcode.has(barcode)) cacheProduct(barcode, null);
    }
    return { products, failedBarcodes: [] };
  } catch (batchError) {
    console.warn('Open Food Facts batch lookup failed; using product lookups.', batchError);
    const lookups = await Promise.allSettled(
      barcodes.map(async (barcode) => ({
        barcode,
        product: await getProductByBarcode(barcode, locale),
      })),
    );
    const products: ProductSummary[] = [];
    const failedBarcodes: string[] = [];
    lookups.forEach((lookup, index) => {
      if (lookup.status === 'rejected') {
        const barcode = barcodes[index] ?? '';
        failedBarcodes.push(barcode);
        if (barcode) productFailures.set(barcode, Date.now() + PRODUCT_FAILURE_TTL_MS);
        return;
      }
      const { barcode, product } = lookup.value;
      cacheProduct(barcode, product);
      if (product) products.push(product);
    });
    return { products, failedBarcodes: failedBarcodes.filter(Boolean) };
  }
}

async function loadProductsByBarcodes(
  barcodes: string[],
  locale: SupportedLocale,
): Promise<ProductBatchResult> {
  const products: ProductSummary[] = [];
  const failedBarcodes: string[] = [];
  const uncachedBarcodes: string[] = [];
  for (const barcode of barcodes) {
    const failureExpiresAt = productFailures.get(barcode);
    if (failureExpiresAt !== undefined && failureExpiresAt > Date.now()) {
      failedBarcodes.push(barcode);
    } else if (!productCache.has(barcode)) {
      productFailures.delete(barcode);
      uncachedBarcodes.push(barcode);
    } else {
      const product = productCache.get(barcode);
      if (product) products.push(product);
    }
  }

  const chunks = Array.from(
    { length: Math.ceil(uncachedBarcodes.length / NUTRITION_BATCH_SIZE) },
    (_, index) =>
      uncachedBarcodes.slice(index * NUTRITION_BATCH_SIZE, (index + 1) * NUTRITION_BATCH_SIZE),
  );
  const loadedChunks = await Promise.all(chunks.map((chunk) => loadProductChunk(chunk, locale)));
  return {
    products: products.concat(loadedChunks.flatMap((chunk) => chunk.products)),
    failedBarcodes: failedBarcodes.concat(loadedChunks.flatMap((chunk) => chunk.failedBarcodes)),
  };
}

/** Loads unique barcodes through cached and rate-paced Open Food Facts lookups. */
export function getProductsByBarcodes(
  barcodes: string[],
  locale: SupportedLocale,
): Promise<ProductBatchResult> {
  const uniqueBarcodes = [...new Set(barcodes)];
  if (!uniqueBarcodes.length) return Promise.resolve({ products: [], failedBarcodes: [] });

  const requestKey = `${locale}:${uniqueBarcodes.slice().sort().join(',')}`;
  const existingRequest = productRequests.get(requestKey);
  if (existingRequest) return existingRequest;

  const request = loadProductsByBarcodes(uniqueBarcodes, locale).finally(() => {
    productRequests.delete(requestKey);
  });
  productRequests.set(requestKey, request);
  return request;
}
