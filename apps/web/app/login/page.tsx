'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supportedLocales, type SupportedLocale } from '@foodex/shared';
import { apiRequest } from '../api-client';

// The manual translation table keeps the assignment's four supported languages explicit and auditable.
const loginWords = {
  en: {
    back: 'Back to products',
    welcome: 'Welcome back',
    language: 'Language',
    login: 'Sign in',
    signingIn: 'Signing in...',
    intro: 'A clearer way to shop your everyday favourites.',
    introText:
      'Explore packaged foods, understand the essentials, and unlock detailed nutrition with an active subscription.',
    email: 'Email address',
    password: 'Password',
    demo: 'Demo account',
    useDemo: 'Use demo credentials',
    loginError: 'Unable to sign in with those credentials.',
    loading: 'Loading your workspace...',
    productSource: 'Open Food Facts search',
    premiumAccess: 'Foodex Premium access',
  },
  nl: {
    back: 'Terug naar producten',
    welcome: 'Welkom terug',
    language: 'Taal',
    login: 'Inloggen',
    signingIn: 'Inloggen...',
    intro: 'Een helderdere manier om je dagelijkse favorieten te kiezen.',
    introText:
      'Ontdek verpakte voeding, begrijp de belangrijkste gegevens en ontgrendel voedingsdetails met een actief abonnement.',
    email: 'E-mailadres',
    password: 'Wachtwoord',
    demo: 'Demoaccount',
    useDemo: 'Gebruik demo-inloggegevens',
    loginError: 'Inloggen met deze gegevens is niet gelukt.',
    loading: 'Werkruimte laden...',
    productSource: 'Zoeken in Open Food Facts',
    premiumAccess: 'Foodex Premium-toegang',
  },
  de: {
    back: 'Zurück zu den Produkten',
    welcome: 'Willkommen zurück',
    language: 'Sprache',
    login: 'Anmelden',
    signingIn: 'Anmeldung...',
    intro: 'Eine klarere Art, alltägliche Favoriten auszuwählen.',
    introText:
      'Entdecke verpackte Lebensmittel, verstehe die wichtigsten Angaben und schalte Nährwerte mit einem aktiven Abo frei.',
    email: 'E-Mail-Adresse',
    password: 'Passwort',
    demo: 'Demokonto',
    useDemo: 'Demo-Zugangsdaten verwenden',
    loginError: 'Anmeldung mit diesen Zugangsdaten nicht möglich.',
    loading: 'Arbeitsbereich wird geladen...',
    productSource: 'Open Food Facts-Suche',
    premiumAccess: 'Foodex Premium-Zugang',
  },
  fr: {
    back: 'Retour aux produits',
    welcome: 'Bon retour',
    language: 'Langue',
    login: 'Se connecter',
    signingIn: 'Connexion...',
    intro: 'Une façon plus claire de choisir vos favoris du quotidien.',
    introText:
      'Découvrez des produits emballés, comprenez les informations essentielles et débloquez la nutrition avec un abonnement actif.',
    email: 'Adresse e-mail',
    password: 'Mot de passe',
    demo: 'Compte démo',
    useDemo: 'Utiliser les identifiants de démonstration',
    loginError: 'Connexion impossible avec ces identifiants.',
    loading: 'Chargement de votre espace...',
    productSource: 'Recherche Open Food Facts',
    premiumAccess: 'Accès Foodex Premium',
  },
} as const;

type DemoCredentials = { email: string; password: string };

export default function LoginPage() {
  const [locale, setLocale] = useState<SupportedLocale>('en');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [demoCredentials, setDemoCredentials] = useState<DemoCredentials | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loginFailed, setLoginFailed] = useState(false);
  const text = loginWords[locale];

  function changeLocale(value: SupportedLocale) {
    setLocale(value);
    document.documentElement.lang = value;
    localStorage.setItem('foodex-locale', value);
  }

  useEffect(() => {
    // Restore the manual locale before the user interacts with the form.
    const saved = localStorage.getItem('foodex-locale');
    const nextLocale =
      saved && supportedLocales.includes(saved as SupportedLocale)
        ? (saved as SupportedLocale)
        : 'en';
    setLocale(nextLocale);
    document.documentElement.lang = nextLocale;
  }, []);

  useEffect(() => {
    // Keep authenticated users out of the login route and load the assignment-only demo credentials.
    void Promise.all([
      apiRequest('/api/auth/session').then(async (response) => {
        const data = (await response.json()) as { authenticated?: boolean };
        if (data.authenticated) window.location.replace('/');
      }),
      apiRequest('/api/auth/demo-credentials')
        .then((response) => (response.ok ? response.json() : null))
        .then((credentials: DemoCredentials | null) => setDemoCredentials(credentials)),
    ])
      .catch(() => setDemoCredentials(null))
      .finally(() => setSessionReady(true));
  }, []);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setLoginFailed(false);
    try {
      const response = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error('Invalid demo credentials');
      window.location.assign('/');
    } catch {
      setLoginFailed(true);
      setBusy(false);
    }
  }

  if (!sessionReady) {
    return (
      <main
        className="session-loading grid min-h-screen place-content-center gap-4"
        aria-live="polite"
      >
        <span className="loader-mark" />
        {text.loading}
      </main>
    );
  }

  return (
    <main className="auth-page grid min-h-screen lg:grid-cols-[1.15fr_0.85fr]">
      <section className="auth-intro">
        <p className="eyebrow">TECHNICAL TEST PROJECT</p>
        <h1>Foodex</h1>
        <p>{text.introText}</p>
        <div className="intro-grid">
          <span>{text.productSource}</span>
          <span>{text.premiumAccess}</span>
          <span>EN / NL / DE / FR</span>
        </div>
      </section>
      <section className="login-shell">
        <div className="language-row">
          <Link className="text-button" href="/">
            {text.back}
          </Link>
          <span>{text.welcome}</span>
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
        </div>
        <div className="login-card">
          <p className="eyebrow">{text.login}</p>
          <h2>{text.intro}</h2>
          <form onSubmit={login}>
            <label>
              {text.email}
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              {text.password}
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <button disabled={busy} type="submit">
              {busy ? text.signingIn : text.login} <b>→</b>
            </button>
          </form>
          {demoCredentials && (
            <div className="demo-box">
              <div>
                <small>{text.demo}</small>
                <strong>{demoCredentials.email}</strong>
                <code>{demoCredentials.password}</code>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEmail(demoCredentials.email);
                  setPassword(demoCredentials.password);
                }}
              >
                {text.useDemo}
              </button>
            </div>
          )}
          {loginFailed && (
            <p className="notice" aria-live="polite">
              {text.loginError}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
