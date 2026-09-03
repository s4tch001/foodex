'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { supportedLocales, type ProductSummary, type SupportedLocale } from '@foodex/shared';
import { apiRequest } from './api-client';

const words = {
  en: {
    login: 'Sign in',
    search: 'Search products',
    searching: 'Searching...',
    placeholder: 'Search by product title or brand',
    signOut: 'Sign out',
    results: 'Products to explore',
    items: 'items',
    noBrand: 'Brand unavailable',
    noImage: 'No image',
    noBarcode: 'No barcode',
    noProductName: 'Product name unavailable',
    lock: 'Sign in and activate a subscription to view nutrition.',
    freePlan: 'Free Plan',
    subscribeToView: 'Subscribe to View Nutrition',
    premium: 'Premium',
    upgrade: 'Start monthly subscription',
    optionalAccess: 'Optional access',
    needNutrition: 'Need the nutritional breakdown?',
    nutrition: 'Nutrition per 100g',
    loadingNutrition: 'Loading nutrition...',
    recent: 'Recent searches',
    clearRecent: 'Clear recent searches',
    previous: 'Previous',
    next: 'Next',
    enterQuery: 'Enter at least two characters to search.',
    noMatches: 'No products matched that search.',
    searchError: 'Product search is unavailable right now.',
    checkoutError: 'Subscription checkout is unavailable right now.',
    nutritionError: 'Nutrition details are unavailable for this product.',
    nutritionLoadError: 'Nutrition could not be loaded right now. Please try again shortly.',
    language: 'Language',
    signInToUnlock: 'Sign in to subscribe and unlock nutrition',
    loadingSession: 'Loading your workspace...',
    skipResults: 'Skip to search results',
    nutritionLabels: {
      energyKcal: 'Energy',
      fat: 'Fat',
      saturatedFat: 'Saturated fat',
      carbohydrates: 'Carbohydrates',
      sugars: 'Sugars',
      fiber: 'Fiber',
      protein: 'Protein',
      salt: 'Salt',
    },
  },
  nl: {
    login: 'Inloggen',
    search: 'Producten zoeken',
    searching: 'Zoeken...',
    placeholder: 'Zoek op producttitel of merk',
    signOut: 'Uitloggen',
    results: 'Producten om te ontdekken',
    items: 'items',
    noBrand: 'Merk niet beschikbaar',
    noImage: 'Geen afbeelding',
    noBarcode: 'Geen barcode',
    noProductName: 'Productnaam niet beschikbaar',
    lock: 'Log in en activeer een abonnement om voeding te bekijken.',
    freePlan: 'Gratis abonnement',
    subscribeToView: 'Abonneer voor voedingsdetails',
    premium: 'Premium',
    upgrade: 'Start maandabonnement',
    optionalAccess: 'Optionele toegang',
    needNutrition: 'Heb je de voedingswaarde nodig?',
    nutrition: 'Voeding per 100g',
    loadingNutrition: 'Voeding laden...',
    recent: 'Recente zoekopdrachten',
    clearRecent: 'Recente zoekopdrachten wissen',
    previous: 'Vorige',
    next: 'Volgende',
    enterQuery: 'Voer minstens twee tekens in om te zoeken.',
    noMatches: 'Geen producten gevonden voor deze zoekopdracht.',
    searchError: 'Product zoeken is momenteel niet beschikbaar.',
    checkoutError: 'Abonnement afrekenen is momenteel niet beschikbaar.',
    nutritionError: 'Voedingsdetails zijn niet beschikbaar voor dit product.',
    nutritionLoadError: 'Voedingsdetails konden niet worden geladen. Probeer het zo opnieuw.',
    language: 'Taal',
    signInToUnlock: 'Log in om je te abonneren en voeding te ontgrendelen',
    loadingSession: 'Werkruimte laden...',
    skipResults: 'Ga naar zoekresultaten',
    nutritionLabels: {
      energyKcal: 'Energie',
      fat: 'Vet',
      saturatedFat: 'Verzadigd vet',
      carbohydrates: 'Koolhydraten',
      sugars: 'Suikers',
      fiber: 'Vezels',
      protein: 'Eiwit',
      salt: 'Zout',
    },
  },
  de: {
    login: 'Anmelden',
    search: 'Produkte suchen',
    searching: 'Suche läuft...',
    placeholder: 'Nach Produkttitel oder Marke suchen',
    signOut: 'Abmelden',
    results: 'Produkte zum Entdecken',
    items: 'Einträge',
    noBrand: 'Marke nicht verfügbar',
    noImage: 'Kein Bild',
    noBarcode: 'Kein Barcode',
    noProductName: 'Produktname nicht verfügbar',
    lock: 'Melde dich an und aktiviere ein Abo, um Nährwerte zu sehen.',
    freePlan: 'Kostenloser Plan',
    subscribeToView: 'Abonnieren für Nährwerte',
    premium: 'Premium',
    upgrade: 'Monatsabo starten',
    optionalAccess: 'Optionaler Zugang',
    needNutrition: 'Brauchst du die Nährwertaufschlüsselung?',
    nutrition: 'Nährwerte pro 100g',
    loadingNutrition: 'Nährwerte werden geladen...',
    recent: 'Letzte Suchen',
    clearRecent: 'Letzte Suchen löschen',
    previous: 'Zurück',
    next: 'Weiter',
    enterQuery: 'Gib mindestens zwei Zeichen für die Suche ein.',
    noMatches: 'Keine Produkte für diese Suche gefunden.',
    searchError: 'Die Produktsuche ist derzeit nicht verfügbar.',
    checkoutError: 'Der Abo-Checkout ist derzeit nicht verfügbar.',
    nutritionError: 'Nährwertdetails sind für dieses Produkt nicht verfügbar.',
    nutritionLoadError:
      'Die Nährwertdetails konnten nicht geladen werden. Bitte versuche es gleich erneut.',
    language: 'Sprache',
    signInToUnlock: 'Anmelden, abonnieren und Nährwerte freischalten',
    loadingSession: 'Arbeitsbereich wird geladen...',
    skipResults: 'Zu den Suchergebnissen springen',
    nutritionLabels: {
      energyKcal: 'Energie',
      fat: 'Fett',
      saturatedFat: 'Gesättigte Fettsäuren',
      carbohydrates: 'Kohlenhydrate',
      sugars: 'Zucker',
      fiber: 'Ballaststoffe',
      protein: 'Eiweiß',
      salt: 'Salz',
    },
  },
  fr: {
    login: 'Se connecter',
    search: 'Rechercher des produits',
    searching: 'Recherche...',
    placeholder: 'Rechercher par titre ou marque',
    signOut: 'Se déconnecter',
    results: 'Produits à découvrir',
    items: 'articles',
    noBrand: 'Marque indisponible',
    noImage: 'Aucune image',
    noBarcode: 'Aucun code-barres',
    noProductName: 'Nom du produit indisponible',
    lock: 'Connectez-vous et activez un abonnement pour voir la nutrition.',
    freePlan: 'Formule gratuite',
    subscribeToView: 'S’abonner pour voir la nutrition',
    premium: 'Premium',
    upgrade: 'Démarrer l’abonnement mensuel',
    optionalAccess: 'Accès facultatif',
    needNutrition: 'Besoin du détail nutritionnel?',
    nutrition: 'Nutrition pour 100g',
    loadingNutrition: 'Chargement de la nutrition...',
    recent: 'Recherches récentes',
    clearRecent: 'Effacer les recherches',
    previous: 'Précédent',
    next: 'Suivant',
    enterQuery: 'Saisissez au moins deux caractères pour rechercher.',
    noMatches: 'Aucun produit ne correspond à cette recherche.',
    searchError: 'La recherche de produits est indisponible pour le moment.',
    checkoutError: 'Le paiement de l’abonnement est indisponible pour le moment.',
    nutritionError: 'Les détails nutritionnels ne sont pas disponibles pour ce produit.',
    nutritionLoadError:
      'Les détails nutritionnels n’ont pas pu être chargés. Réessayez dans un instant.',
    language: 'Langue',
    signInToUnlock: 'Connectez-vous pour vous abonner et débloquer la nutrition',
    loadingSession: 'Chargement de votre espace...',
    skipResults: 'Aller aux résultats de recherche',
    nutritionLabels: {
      energyKcal: 'Énergie',
      fat: 'Matières grasses',
      saturatedFat: 'Acides gras saturés',
      carbohydrates: 'Glucides',
      sugars: 'Sucres',
      fiber: 'Fibres',
      protein: 'Protéines',
      salt: 'Sel',
    },
  },
} as const;

type NoticeKey = 'enterQuery' | 'noMatches' | 'searchError' | 'checkoutError' | null;
type RecentSearch = { id: string; query: string };
type NutritionStatus = 'loading' | 'unavailable' | 'error';
type NutritionResult =
  | { status: 'available'; nutrition: Record<string, number | undefined> }
  | { status: 'unavailable' }
  | { status: 'error' };
type PublicProductSummary = Omit<ProductSummary, 'nutrition'>;
type ProductPagination = {
  page: number;
  hasNext: boolean;
  hasPrevious: boolean;
};
type SearchReturnSnapshot = {
  query: string;
  page: number;
  hasNext: boolean;
  locale: SupportedLocale;
  products: PublicProductSummary[];
};

const searchReturnKey = 'foodex-search-return';

function isSearchReturnSnapshot(value: unknown): value is SearchReturnSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<SearchReturnSnapshot>;
  return (
    typeof snapshot.query === 'string' &&
    typeof snapshot.page === 'number' &&
    snapshot.page > 0 &&
    typeof snapshot.hasNext === 'boolean' &&
    supportedLocales.includes(snapshot.locale as SupportedLocale) &&
    Array.isArray(snapshot.products) &&
    snapshot.products.every(
      (product) =>
        product &&
        typeof product === 'object' &&
        typeof product.barcode === 'string' &&
        (typeof product.name === 'string' || product.name === null) &&
        (typeof product.brand === 'string' || product.brand === null) &&
        (typeof product.imageUrl === 'string' || product.imageUrl === null),
    )
  );
}

export default function HomePage() {
  // Locale, session, and entitlement state control which interface and product data are visible.
  const [locale, setLocale] = useState<SupportedLocale>('en');
  const [authenticated, setAuthenticated] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [subscriptionActive, setSubscriptionActive] = useState(false);

  // Search state is intentionally empty on first load; products appear only after a submitted query.
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<PublicProductSummary[]>([]);
  const [activeSearch, setActiveSearch] = useState<string | null>(null);
  const [searchPage, setSearchPage] = useState(1);
  const [searchHasNext, setSearchHasNext] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [nutritionByBarcode, setNutritionByBarcode] = useState<
    Record<string, Record<string, number | undefined>>
  >({});
  const [nutritionStatusByBarcode, setNutritionStatusByBarcode] = useState<
    Record<string, NutritionStatus>
  >({});
  const [unavailableImages, setUnavailableImages] = useState<Record<string, true>>({});
  const [notice, setNotice] = useState<NoticeKey>(null);
  const [busy, setBusy] = useState(false);
  const searchController = useRef<AbortController | null>(null);
  const text = words[locale];

  function changeLocale(value: SupportedLocale) {
    setLocale(value);
    document.documentElement.lang = value;
    localStorage.setItem('foodex-locale', value);
    if (activeSearch) void searchFor(activeSearch, searchPage, value);
  }
  async function loadRecentSearches() {
    try {
      const response = await apiRequest('/api/recent-searches');
      if (!response.ok) return;
      const data = (await response.json()) as { searches: RecentSearch[] };
      setRecentSearches(data.searches);
    } catch {
      setRecentSearches([]);
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem('foodex-locale');
    const nextLocale =
      saved && supportedLocales.includes(saved as SupportedLocale)
        ? (saved as SupportedLocale)
        : 'en';
    setLocale(nextLocale);
    document.documentElement.lang = nextLocale;
  }, []);
  useEffect(() => {
    // Restore one pending result page after login or Stripe returns to the landing route.
    const serializedSnapshot = sessionStorage.getItem(searchReturnKey);
    if (!serializedSnapshot) return;
    sessionStorage.removeItem(searchReturnKey);
    try {
      const snapshot = JSON.parse(serializedSnapshot) as unknown;
      if (!isSearchReturnSnapshot(snapshot)) return;
      setLocale(snapshot.locale);
      document.documentElement.lang = snapshot.locale;
      localStorage.setItem('foodex-locale', snapshot.locale);
      setQuery(snapshot.query);
      setProducts(snapshot.products);
      setActiveSearch(snapshot.query);
      setSearchPage(snapshot.page);
      setSearchHasNext(snapshot.hasNext);
    } catch {
      // Ignore malformed browser state and keep the normal clean landing page.
    }
  }, []);
  useEffect(() => {
    // Render after session hydration to prevent a signed-in user seeing a login flash on refresh.
    apiRequest('/api/auth/session')
      .then((response) => response.json())
      .then((data: { authenticated?: boolean }) => setAuthenticated(Boolean(data.authenticated)))
      .catch(() => setAuthenticated(false))
      .finally(() => setSessionReady(true));
  }, []);
  useEffect(() => {
    // Subscription state and search history are private to the signed-in demo account.
    if (!authenticated) {
      setSubscriptionActive(false);
      setRecentSearches([]);
      return;
    }
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const checkoutParams = new URLSearchParams(window.location.search);
    const checkoutReturned = checkoutParams.get('checkout') === 'success';
    let retriesRemaining = checkoutReturned ? 10 : 0;
    const refreshSubscription = async () => {
      try {
        if (checkoutReturned) {
          await apiRequest('/api/checkout/complete', {
            method: 'POST',
            body: JSON.stringify({ sessionId: checkoutParams.get('session_id') ?? undefined }),
          });
        }
        const response = await apiRequest('/api/subscription');
        const data = (await response.json()) as { status?: string };
        const active = ['ACTIVE', 'TRIALING'].includes(data.status ?? '');
        setSubscriptionActive(active);
        // Stripe may redirect before the webhook persists the entitlement; briefly recheck after success.
        if (!active && retriesRemaining > 0) {
          retriesRemaining -= 1;
          retryTimer = setTimeout(() => void refreshSubscription(), 2_000);
        }
      } catch {
        setSubscriptionActive(false);
      }
    };
    void refreshSubscription();
    void loadRecentSearches();
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [authenticated]);

  async function logout() {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    setAuthenticated(false);
    setSubscriptionActive(false);
    setNutritionByBarcode({});
    setNutritionStatusByBarcode({});
    setNotice(null);
  }
  async function search(event: React.FormEvent) {
    event.preventDefault();
    await searchFor(query);
  }
  async function searchFor(
    searchQuery: string,
    page = 1,
    requestedLocale: SupportedLocale = locale,
  ) {
    // Cancel the previous query so slower responses cannot replace newer search results.
    if (searchQuery.trim().length < 2) return setNotice('enterQuery');
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    setBusy(true);
    setNotice(null);
    try {
      const response = await apiRequest(
        `/api/products/search?query=${encodeURIComponent(searchQuery)}&locale=${requestedLocale}&page=${page}`,
        { signal: controller.signal },
      );
      if (!response.ok) throw new Error();
      const data = (await response.json()) as {
        products: PublicProductSummary[];
        pagination: ProductPagination;
      };
      if (controller.signal.aborted) return;
      setProducts(data.products);
      setActiveSearch(searchQuery.trim());
      setSearchPage(data.pagination.page);
      setSearchHasNext(data.pagination.hasNext);
      if (!data.products.length) setNotice('noMatches');
      // Public visitors can search, while authenticated searches are also stored by the backend.
      if (authenticated && page === 1) await loadRecentSearches();
    } catch {
      if (!controller.signal.aborted) setNotice('searchError');
    } finally {
      if (searchController.current === controller) {
        searchController.current = null;
        setBusy(false);
      }
    }
  }
  function clearSearch() {
    searchController.current?.abort();
    searchController.current = null;
    setQuery('');
    setProducts([]);
    setActiveSearch(null);
    setSearchPage(1);
    setSearchHasNext(false);
    setNotice(null);
    setBusy(false);
  }
  function changeQuery(value: string) {
    if (!value.trim()) {
      clearSearch();
      return;
    }
    setQuery(value);
  }
  function preserveSearchForReturn() {
    if (!activeSearch || !products.length) return;
    const snapshot: SearchReturnSnapshot = {
      query: activeSearch,
      page: searchPage,
      hasNext: searchHasNext,
      locale,
      products,
    };
    sessionStorage.setItem(searchReturnKey, JSON.stringify(snapshot));
  }
  async function checkout() {
    if (busy) return;
    if (!authenticated) {
      preserveSearchForReturn();
      window.location.assign('/login');
      return;
    }
    setBusy(true);
    try {
      const response = await apiRequest('/api/checkout', { method: 'POST' });
      const data = (await response.json()) as { url?: string };
      if (!response.ok || !data.url) throw new Error();
      preserveSearchForReturn();
      window.location.assign(data.url);
    } catch {
      setNotice('checkoutError');
      setBusy(false);
    }
  }
  async function clearRecentSearches() {
    try {
      const response = await apiRequest('/api/recent-searches', { method: 'DELETE' });
      if (!response.ok) throw new Error();
      setRecentSearches([]);
    } catch {
      setNotice('searchError');
    }
  }
  function selectProduct() {
    if (!authenticated) {
      preserveSearchForReturn();
      window.location.assign('/login');
      return;
    }
    void checkout();
  }

  async function goToSearchPage(page: number) {
    if (activeSearch) await searchFor(activeSearch, page);
  }

  const hasPreviousPage = searchPage > 1;
  const visibleNutritionBarcodes = products
    .map((product) => product.barcode)
    .filter(Boolean)
    .join('|');

  useEffect(() => {
    if (!authenticated || !subscriptionActive || !visibleNutritionBarcodes) return;

    const barcodes = visibleNutritionBarcodes
      .split('|')
      .filter((barcode) => !nutritionByBarcode[barcode]);
    if (!barcodes.length) return;

    const controller = new AbortController();
    setNutritionStatusByBarcode((current) => {
      const next = { ...current };
      for (const barcode of barcodes) next[barcode] = 'loading';
      return next;
    });

    const loadVisibleNutrition = async () => {
      try {
        const response = await apiRequest('/api/products/nutrition', {
          method: 'POST',
          body: JSON.stringify({ barcodes, locale }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const data = (await response.json()) as {
          products: Record<string, NutritionResult>;
        };
        if (controller.signal.aborted) return;
        setNutritionByBarcode((current) => {
          const next = { ...current };
          for (const barcode of barcodes) {
            const result = data.products[barcode];
            if (result?.status === 'available') next[barcode] = result.nutrition;
          }
          return next;
        });
        setNutritionStatusByBarcode((current) => {
          const next = { ...current };
          for (const barcode of barcodes) {
            const result = data.products[barcode];
            if (result?.status === 'available') delete next[barcode];
            else next[barcode] = result?.status === 'unavailable' ? 'unavailable' : 'error';
          }
          return next;
        });
      } catch {
        if (controller.signal.aborted) return;
        setNutritionStatusByBarcode((current) => {
          const next = { ...current };
          for (const barcode of barcodes) next[barcode] = 'error';
          return next;
        });
      }
    };

    void loadVisibleNutrition();
    return () => controller.abort();
    // Nutrition is cached by barcode; rerun only when the visible set or entitlement changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, subscriptionActive, visibleNutritionBarcodes, locale]);
  if (!sessionReady)
    return (
      <main
        className="session-loading grid min-h-screen place-content-center gap-4"
        aria-live="polite"
      >
        <span className="loader-mark" />
        {text.loadingSession}
      </main>
    );

  return (
    <main className="product-app mx-auto min-h-screen w-full max-w-6xl px-4 pb-16 md:px-7">
      <a className="skip-link" href="#results">
        {text.skipResults}
      </a>
      <header className="flex items-center justify-between gap-3">
        <h1 className="site-heading">
          <a className="project-title" href="#top">
            Foodex
          </a>
        </h1>
        <div>
          {authenticated && (
            <span className={subscriptionActive ? 'access active' : 'access'}>
              {subscriptionActive ? text.premium : text.freePlan}
            </span>
          )}
          <select
            aria-label={text.language}
            value={locale}
            onChange={(event) => changeLocale(event.target.value as SupportedLocale)}
          >
            {supportedLocales.map((code) => (
              <option key={code} value={code}>
                {code.toUpperCase()}
              </option>
            ))}
          </select>
          {authenticated ? (
            <button className="text-button" onClick={logout}>
              {text.signOut}
            </button>
          ) : (
            <Link
              className="text-button sign-in-button"
              href="/login"
              onClick={preserveSearchForReturn}
            >
              {text.login}
            </Link>
          )}
        </div>
      </header>
      <section id="top" className="search-hero w-full max-w-3xl">
        <form onSubmit={search}>
          <input
            aria-label={text.search}
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder={text.placeholder}
          />
          {query && (
            <button
              className="clear-search"
              type="button"
              aria-label="Clear search"
              onClick={clearSearch}
            >
              ×
            </button>
          )}
          <button disabled={busy} type="submit">
            {busy ? text.searching : text.search}
          </button>
        </form>
        {notice && (
          <p className="notice" aria-live="polite">
            {text[notice]}
          </p>
        )}
      </section>
      {authenticated && recentSearches.length > 0 && (
        <section className="recent-searches">
          <div>
            <p className="eyebrow">{text.recent}</p>
            <button className="text-button clear-recent" onClick={clearRecentSearches}>
              {text.clearRecent}
            </button>
          </div>
          <nav aria-label={text.recent}>
            {recentSearches.map((search) => (
              <button
                key={search.id}
                onClick={() => {
                  setQuery(search.query);
                  void searchFor(search.query);
                }}
              >
                {search.query}
                <b>↗</b>
              </button>
            ))}
          </nav>
        </section>
      )}
      {authenticated && !subscriptionActive && (
        <section className="subscription-callout">
          <div>
            <p className="eyebrow">{text.optionalAccess}</p>
            <h2>{text.needNutrition}</h2>
            <p>{text.lock}</p>
          </div>
          <button disabled={busy} onClick={checkout}>
            {text.upgrade} <b>↗</b>
          </button>
        </section>
      )}
      {activeSearch !== null && (
        <section id="results" className="results">
          <div className="result-head">
            <p className="eyebrow">{text.results}</p>
            <span>
              {products.length} {text.items}
            </span>
          </div>
          <div className="product-grid grid grid-cols-1 md:grid-cols-2">
            {products.map((product) => (
              <article key={product.barcode || product.name}>
                <div className="image-box">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.name ?? text.noProductName}
                      width={104}
                      height={132}
                      sizes="(max-width: 760px) 80px, 104px"
                      unoptimized
                      loading="lazy"
                      onError={() =>
                        setUnavailableImages((current) => ({ ...current, [product.barcode]: true }))
                      }
                      hidden={Boolean(unavailableImages[product.barcode])}
                    />
                  ) : (
                    <span className="product-monogram" aria-label={text.noImage}>
                      {product.name?.slice(0, 1) ?? '?'}
                    </span>
                  )}
                  {product.imageUrl && unavailableImages[product.barcode] && (
                    <span className="product-monogram" aria-label={text.noImage}>
                      {product.name?.slice(0, 1) ?? '?'}
                    </span>
                  )}
                </div>
                <div className="product-details">
                  <small>{product.brand ?? text.noBrand}</small>
                  <h2>{product.name ?? text.noProductName}</h2>
                  <span>{product.barcode || text.noBarcode}</span>
                </div>
                {(!authenticated || !subscriptionActive) && (
                  <div className="product-actions">
                    <button className="locked-action" disabled={busy} onClick={selectProduct}>
                      🔒 {authenticated ? text.subscribeToView : text.signInToUnlock}
                    </button>
                  </div>
                )}
                {authenticated && subscriptionActive && product.barcode && (
                  <section
                    className="product-nutrition"
                    aria-label={text.nutrition}
                    aria-busy={nutritionStatusByBarcode[product.barcode] === 'loading'}
                  >
                    <p>{text.nutrition}</p>
                    {nutritionByBarcode[product.barcode] ? (
                      <dl>
                        {Object.entries(nutritionByBarcode[product.barcode]).map(
                          ([name, value]) => (
                            <div key={name}>
                              <dt>
                                {text.nutritionLabels[name as keyof typeof text.nutritionLabels]}
                              </dt>
                              <dd>{value ?? '—'}</dd>
                            </div>
                          ),
                        )}
                      </dl>
                    ) : (
                      <p className="nutrition-status" role="status">
                        {nutritionStatusByBarcode[product.barcode] === 'unavailable'
                          ? text.nutritionError
                          : nutritionStatusByBarcode[product.barcode] === 'error'
                            ? text.nutritionLoadError
                            : text.loadingNutrition}
                      </p>
                    )}
                  </section>
                )}
              </article>
            ))}
          </div>
          {(hasPreviousPage || searchHasNext) && (
            <nav className="pagination" aria-label="Product pages">
              <button
                type="button"
                disabled={busy || !hasPreviousPage}
                onClick={() => void goToSearchPage(searchPage - 1)}
              >
                {text.previous}
              </button>
              <span className="pagination-page" aria-current="page">
                {searchPage}
              </span>
              <button
                type="button"
                disabled={busy || !searchHasNext}
                onClick={() => void goToSearchPage(searchPage + 1)}
              >
                {text.next}
              </button>
            </nav>
          )}
        </section>
      )}
      <footer className="site-footer">
        <span>Foodex · food codex</span>
        <span>Open Food Facts data · Stripe test mode</span>
      </footer>
    </main>
  );
}
