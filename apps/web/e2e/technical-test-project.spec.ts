// End-to-end tests cover the user journeys that connect search, login, subscriptions, and UI state.
import { expect, test, type Page } from '@playwright/test';

// Keep the fixture small and predictable so browser assertions focus on interface behavior.
const product = {
  barcode: '3017624010701',
  name: 'Nutella',
  brand: 'Sample Foods',
  imageUrl:
    'https://images.openfoodfacts.org/images/products/301/762/401/0701/front_en.100.200.jpg',
};

const localizedNames = {
  en: 'Nutella',
  nl: 'Nederlandse Nutella',
  de: 'Deutsche Nutella',
  fr: 'Nutella française',
} as const;

async function mockApi(page: Page, status = 'INACTIVE') {
  // Browser tests isolate the interface; app integration tests exercise the real Express routes.
  let signedIn = false;
  await page.route('http://localhost:4000/api/auth/demo-credentials', (route) =>
    route.fulfill({ json: { email: 'demo@technicaltest.local', password: 'DemoPassword123!' } }),
  );
  await page.route('http://localhost:4000/api/auth/session', (route) =>
    route.fulfill({
      status: signedIn ? 200 : 401,
      json: signedIn
        ? { authenticated: true, user: { email: 'demo@technicaltest.local' } }
        : { authenticated: false },
    }),
  );
  await page.route('http://localhost:4000/api/auth/login', (route) => {
    signedIn = true;
    return route.fulfill({ json: { user: { email: 'demo@technicaltest.local' } } });
  });
  await page.route('http://localhost:4000/api/auth/logout', (route) => {
    signedIn = false;
    return route.fulfill({ status: 204 });
  });
  await page.route('http://localhost:4000/api/subscription', (route) =>
    route.fulfill({ json: { status } }),
  );
  await page.route('http://localhost:4000/api/checkout', (route) =>
    route.fulfill({ json: { url: 'http://localhost:3000/?checkout=canceled' } }),
  );
  await page.route('http://localhost:4000/api/checkout/complete', (route) =>
    route.fulfill({ json: { status } }),
  );
  await page.route('http://localhost:4000/api/products/search**', (route) => {
    const url = new URL(route.request().url());
    const searchPage = Number(url.searchParams.get('page') ?? '1');
    const locale = (url.searchParams.get('locale') ?? 'en') as keyof typeof localizedNames;
    return route.fulfill({
      json: {
        products: Array.from({ length: 20 }, (_, index) => ({
          ...product,
          barcode:
            index === 0
              ? searchPage === 1
                ? product.barcode
                : '5449000000439'
              : `${searchPage}${String(index).padStart(12, '0')}`,
          name:
            index === 0
              ? searchPage === 1
                ? localizedNames[locale]
                : 'Search page two'
              : `Related product ${searchPage}-${index + 1}`,
        })),
        pagination: {
          page: searchPage,
          hasNext: searchPage === 1,
          hasPrevious: searchPage > 1,
        },
      },
    });
  });
  await page.route('http://localhost:4000/api/products/nutrition', async (route) => {
    const { barcodes } = route.request().postDataJSON() as { barcodes: string[] };
    return route.fulfill({
      json: {
        products: Object.fromEntries(
          barcodes.map((barcode) => [
            barcode,
            { status: 'available', nutrition: { protein: 6, sugars: 54 } },
          ]),
        ),
      },
    });
  });
}

// Extend the public mock with authenticated account and recent-search responses.
async function mockAuthenticatedSession(page: Page, status = 'INACTIVE') {
  await mockApi(page, status);
  await page.unroute('http://localhost:4000/api/auth/session');
  await page.route('http://localhost:4000/api/auth/session', (route) =>
    route.fulfill({ json: { authenticated: true, user: { email: 'demo@technicaltest.local' } } }),
  );
  await page.route('http://localhost:4000/api/recent-searches**', (route) =>
    route.fulfill(
      route.request().method() === 'DELETE'
        ? { status: 204 }
        : {
            json: {
              searches: [
                { id: 'recent-1', query: 'oat milk' },
                { id: 'recent-2', query: 'dark chocolate' },
              ],
            },
          },
    ),
  );
}

// Navigate through the same login flow a reviewer uses in the browser.
async function signInWithDemoAccount(page: Page) {
  await page.getByRole('link', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await completeDemoLogin(page);
}

// Fill the assignment demo credentials and wait until the landing page is restored.
async function completeDemoLogin(page: Page) {
  await page.getByRole('button', { name: 'Use demo credentials' }).click();
  await page.locator('form').getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel('Search products')).toBeVisible();
}

// Reuse the primary search journey across tests that need visible products.
async function searchForNutella(page: Page) {
  await page.getByLabel('Search products').fill('nutella');
  await page.getByRole('button', { name: 'Search products' }).click();
  await expect(page.getByRole('heading', { name: 'Nutella' })).toBeVisible();
}

// The initial page is empty; entering and clearing a query should reset all result state.
test('starts empty, searches on demand, and clears when the input becomes blank', async ({
  page,
}) => {
  await mockApi(page);
  let searchRequests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/products/search')) searchRequests += 1;
  });
  await page.goto('/');
  await expect(page.locator('.project-logo')).toBeVisible();
  await expect(page.locator('link[rel="icon"][type="image/webp"]').first()).toHaveAttribute(
    'href',
    /foodex-logo-/,
  );
  await expect(page.getByText('Better choices start with the label.')).toHaveCount(0);
  await expect(page.getByText('The food codex', { exact: true })).toHaveCount(0);
  await expect(
    page.getByText('Search by product title, brand, or barcode to explore packaged foods.'),
  ).toHaveCount(0);
  await expect(
    page.getByText('Search by product title, brand, or barcode.', { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.product-grid article')).toHaveCount(0);
  expect(searchRequests).toBe(0);

  await searchForNutella(page);
  await expect(page.locator('#results .result-head > span')).toHaveText('20 items');
  await page.getByLabel('Search products').fill('');
  await expect(page.locator('#results')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Clear search' })).toHaveCount(0);
});

// The empty landing page should still use the full viewport instead of floating the footer upward.
test('keeps the footer at the bottom before the first search', async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');

  const footerBottom = await page
    .locator('.site-footer')
    .evaluate((footer) => footer.getBoundingClientRect().bottom);
  expect(footerBottom).toBeGreaterThanOrEqual(640);
});

// The dedicated login route should show Foodex branding and no retired copy.
test('serves the branded sign-in form at the dedicated login route', async ({ page }) => {
  await mockApi(page);
  await page.goto('/login');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('.auth-brand img')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Foodex' })).toBeVisible();
  await expect(page.getByText('Better choices start with the label.')).toHaveCount(0);
});

// An authenticated free-plan user should see the subscription prompt instead of nutrition.
test('keeps nutrition locked for an inactive demo user', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await signInWithDemoAccount(page);
  await searchForNutella(page);
  await expect(page.getByText('Free Plan', { exact: true })).toBeVisible();
  await expect(page.getByText('🔒 Subscribe to View Nutrition').first()).toBeVisible();
});

// Checkout redirects must restore the public search query and visible products.
test('restores product results after returning from Stripe Checkout', async ({ page }) => {
  await mockAuthenticatedSession(page);
  await page.unroute('http://localhost:4000/api/checkout');
  await page.route('http://localhost:4000/api/checkout', (route) =>
    route.fulfill({ json: { url: 'http://localhost:3000/?checkout=success' } }),
  );
  const checkoutRequest = page.waitForRequest('http://localhost:4000/api/checkout');
  await page.goto('/');
  await searchForNutella(page);
  await page.getByRole('button', { name: '🔒 Subscribe to View Nutrition' }).first().click();
  await checkoutRequest;
  await expect(page).toHaveURL(/\?checkout=success$/);
  await expect(page.getByRole('heading', { name: 'Nutella' })).toBeVisible();
  await expect(page.getByLabel('Search products')).toHaveValue('nutella');
});

// The account callout should create a Checkout request for authenticated users.
test('starts Stripe Checkout from the monthly subscription callout', async ({ page }) => {
  await mockAuthenticatedSession(page);
  const checkoutRequest = page.waitForRequest('http://localhost:4000/api/checkout');
  await page.goto('/');
  await page.getByRole('button', { name: /Start monthly subscription/ }).click();
  await checkoutRequest;
});

// Pagination should move between provider pages without changing the active query.
test('uses simple previous and next controls for search pages', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await searchForNutella(page);
  const pagination = page.getByRole('navigation', { name: 'Product pages' });
  await expect(pagination.getByText('1', { exact: true })).toBeVisible();
  await pagination.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Search page two' })).toBeVisible();
  await expect(pagination.getByText('2', { exact: true })).toBeVisible();
  await expect(pagination.getByRole('button', { name: 'Next' })).toBeDisabled();
});

// A public visitor should be routed through login while keeping the current search intact.
test('prompts a public visitor to sign in before subscribing', async ({ page }) => {
  await mockApi(page);
  let searchRequests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/products/search')) searchRequests += 1;
  });
  await page.goto('/');
  await searchForNutella(page);
  await page
    .getByRole('button', { name: /Sign in to subscribe and unlock nutrition/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('demo@technicaltest.local')).toBeVisible();
  await completeDemoLogin(page);
  await expect(page.getByRole('heading', { name: 'Nutella' })).toBeVisible();
  await expect(page.getByLabel('Search products')).toHaveValue('nutella');
  expect(searchRequests).toBe(1);
});

// Authenticated users should see history and be able to remove one or all entries.
test('hydrates an active session and reuses recent searches', async ({ page }) => {
  await mockAuthenticatedSession(page);
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Recent searches' })).toBeVisible();
  await page.locator('.recent-search-query').filter({ hasText: 'oat milk' }).click();
  await expect(page.getByRole('heading', { name: 'Nutella' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete recent search: oat milk' }).click();
  await expect(page.locator('.recent-search-item').filter({ hasText: 'oat milk' })).toHaveCount(0);
  await expect(
    page.locator('.recent-search-item').filter({ hasText: 'dark chocolate' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Clear recent searches' }).click();
  await expect(page.getByRole('navigation', { name: 'Recent searches' })).toHaveCount(0);
});

// Active subscribers should receive nutrition automatically for visible products.
test('automatically shows protected nutrition for an active subscription', async ({ page }) => {
  await mockApi(page, 'ACTIVE');
  await page.goto('/');
  await signInWithDemoAccount(page);
  await searchForNutella(page);
  await expect(page.getByLabel('Nutrition per 100g').first()).toBeVisible();
  await expect(page.getByText('Protein', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('6', { exact: true }).first()).toBeVisible();
});

// The UI should distinguish missing provider data from a temporary request error.
test('distinguishes unavailable nutrition from a temporary request failure', async ({ page }) => {
  await mockApi(page, 'ACTIVE');
  await page.unroute('http://localhost:4000/api/products/nutrition');
  await page.route('http://localhost:4000/api/products/nutrition', async (route) => {
    const { barcodes } = route.request().postDataJSON() as { barcodes: string[] };
    return route.fulfill({
      json: {
        products: Object.fromEntries(
          barcodes.map((barcode) => [barcode, { status: 'unavailable' }]),
        ),
      },
    });
  });
  await page.goto('/');
  await signInWithDemoAccount(page);
  await searchForNutella(page);
  await expect(
    page.getByText('Nutrition details are unavailable for this product.').first(),
  ).toBeVisible();
  await expect(page.getByText('Nutrition could not be loaded right now.')).toHaveCount(0);
});

// Changing locale should refetch names and update the document language attribute.
test('refetches localized product data and updates the document language', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await searchForNutella(page);
  const localizedRequest = page.waitForRequest(
    (request) =>
      request.url().includes('/api/products/search') &&
      new URL(request.url()).searchParams.get('locale') === 'nl',
  );
  await page.getByLabel('Language').selectOption('nl');
  await localizedRequest;
  await expect(page.getByRole('heading', { name: 'Nederlandse Nutella' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
});

// The clear and submit controls must remain usable without overlap on small screens.
test('keeps search controls separate on a mobile viewport', async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByLabel('Search products').fill('chocolate spread');
  const controlsOverlap = await page.evaluate(() => {
    const clear = document.querySelector('.clear-search')?.getBoundingClientRect();
    const submit = document
      .querySelector(".search-hero form > button[type='submit']")
      ?.getBoundingClientRect();
    if (!clear || !submit) return true;
    return !(
      clear.right <= submit.left ||
      clear.bottom <= submit.top ||
      clear.top >= submit.bottom
    );
  });
  expect(controlsOverlap).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
