// These tests document provider normalization, caching, pagination, and fallback behavior.
import { describe, expect, it } from 'vitest';
import { getProductsByBarcodes, mapProduct, searchProducts } from './open-food-facts.js';

// Use mocked provider responses so tests remain deterministic and do not consume API quota.
describe('Open Food Facts adapter', () => {
  // Prefer the selected locale while preserving deterministic fallbacks.
  it('uses the requested localized title before English and original values', () => {
    expect(
      mapProduct(
        {
          code: '123',
          product_name: 'Original',
          product_name_en: 'English',
          product_name_fr: 'Francais',
        },
        'fr',
      ).name,
    ).toBe('Francais');
  });

  // Missing fields and malformed numbers should remain safe, explicit omissions.
  it('keeps incomplete data stable and maps numeric nutrition values only', () => {
    expect(
      mapProduct({ code: '123', nutriments: { proteins_100g: 8, salt_100g: 'unknown' } }, 'de'),
    ).toMatchObject({
      barcode: '123',
      name: null,
      brand: null,
      imageUrl: null,
      nutrition: { protein: 8, salt: undefined },
    });
  });

  // The adapter should map one provider page and reuse it on a repeated request.
  it('returns and caches up to 20 relevant search results', async () => {
    const originalFetch = global.fetch;
    let requests = 0;
    let requestedUrl = '';
    global.fetch = async (input) => {
      requests += 1;
      requestedUrl = String(input);
      return Response.json({
        count: 80,
        page: 3,
        page_count: 20,
        page_size: 20,
        hits: [
          ...Array.from({ length: 25 }, (_, index) => ({
            code: `${9_000_000_000_000 + index}`,
            product_name: `Coca-Cola product ${index + 1}`,
            brands: ['Coca-Cola'],
            nutriments: { proteins_100g: index },
          })),
          { code: '999', product_name: 'Orange soda', brands: 'Coca-Cola Company' },
        ],
      });
    };

    try {
      const result = await searchProducts('coca-cola', 'en', 3);
      const cachedResult = await searchProducts('coca-cola', 'en', 3);
      const requestUrl = new URL(requestedUrl);

      expect(requestUrl.origin).toBe('https://search.openfoodfacts.org');
      expect(requestUrl.pathname).toBe('/search');
      expect(requestUrl.searchParams.get('q')).toBe('coca-cola');
      expect(requestUrl.searchParams.get('page')).toBe('3');
      expect(requestUrl.searchParams.get('page_size')).toBe('20');
      expect(requestUrl.searchParams.has('sort_by')).toBe(false);
      expect(result.products).toHaveLength(20);
      expect(result.products.every((product) => product.name?.includes('Coca-Cola'))).toBe(true);
      expect(result.pagination).toEqual({ page: 3, hasNext: true, hasPrevious: true });
      expect(cachedResult).toEqual(result);
      expect(requests).toBe(1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // Provider failures must be surfaced instead of silently inventing catalog data.
  it('reports an upstream search failure instead of showing invented fallback products', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => new Response('', { status: 503 });

    try {
      await expect(searchProducts('provider-error-test', 'en')).rejects.toThrow(
        'Open Food Facts search returned 503.',
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  // Visible nutrition records should be fetched together to reduce upstream calls.
  it('loads nutrition for visible products in one batch request', async () => {
    const originalFetch = global.fetch;
    let requestedUrl = '';
    global.fetch = async (input) => {
      requestedUrl = String(input);
      return Response.json({
        products: [
          { code: '3017624010701', nutriments: { proteins_100g: 6 } },
          { code: '5449000000439', nutriments: {} },
        ],
      });
    };

    try {
      const result = await getProductsByBarcodes(['3017624010701', '5449000000439'], 'en');
      const requestUrl = new URL(requestedUrl);

      expect(requestUrl.searchParams.get('code')).toBe('3017624010701,5449000000439');
      expect(requestUrl.searchParams.get('page_size')).toBe('2');
      expect(result.products).toHaveLength(2);
      expect(result.products[0]?.nutrition.protein).toBe(6);
      expect(result.failedBarcodes).toEqual([]);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // Individual product reads keep nutrition resilient when the legacy batch endpoint is down.
  it('falls back to individual product reads when a batch request fails', async () => {
    const originalFetch = global.fetch;
    let requests = 0;
    global.fetch = async (input) => {
      requests += 1;
      const url = new URL(String(input));
      if (url.pathname === '/cgi/search.pl') return new Response('', { status: 503 });
      const barcode = url.pathname.match(/product\/(\d+)\.json$/)?.[1];
      return Response.json({
        status: 1,
        product: { code: barcode, nutriments: { proteins_100g: 7.9 } },
      });
    };

    try {
      const result = await getProductsByBarcodes(['8000500310427', '7613034626844'], 'en');
      expect(requests).toBe(3);
      expect(result.products).toHaveLength(2);
      expect(result.products.every((product) => product.nutrition.protein === 7.9)).toBe(true);
      expect(result.failedBarcodes).toEqual([]);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // A cached barcode should not trigger another provider request.
  it('reuses cached nutrition without another request', async () => {
    const originalFetch = global.fetch;
    let requests = 0;
    global.fetch = async () => {
      requests += 1;
      return Response.json({
        products: [{ code: '4006381333931', nutriments: { proteins_100g: 4 } }],
      });
    };

    try {
      await getProductsByBarcodes(['4006381333931'], 'en');
      const cached = await getProductsByBarcodes(['4006381333931'], 'en');
      expect(requests).toBe(1);
      expect(cached.products[0]?.nutrition.protein).toBe(4);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
