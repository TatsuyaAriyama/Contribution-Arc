import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  EN_TRANSLATIONS,
  SUPPORTED_LANGUAGES,
  type Language,
} from "./translations";

const LANGUAGE_STORAGE_KEY = "contribution-arc-language";
const DEFAULT_LANGUAGE: Language = "ja";

type Interpolations = Record<string, string | number>;

export interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  /**
   * Translate a Japanese string to the active language.
   * The Japanese text passed in is also the lookup key — when language
   * is "ja" it returns the key unchanged; when "en" it returns the
   * mapped English (or the key as fallback when no mapping exists).
   */
  t: (jaText: string, vars?: Interpolations) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  try {
    const raw = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (raw && (SUPPORTED_LANGUAGES as string[]).includes(raw)) {
      return raw as Language;
    }
  } catch {
    /* localStorage unavailable; fall through */
  }
  return DEFAULT_LANGUAGE;
}

function applyInterpolations(template: string, vars?: Interpolations): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export interface LanguageProviderProps {
  children: ReactNode;
  /**
   * Optional initial language override (e.g. injected after the user
   * document loads). Falls back to localStorage, then DEFAULT_LANGUAGE.
   */
  initialLanguage?: Language | null;
}

export function LanguageProvider({ children, initialLanguage }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (initialLanguage && (SUPPORTED_LANGUAGES as string[]).includes(initialLanguage)) {
      return initialLanguage;
    }
    return readStoredLanguage();
  });

  // Sync to <html lang> so assistive tech and browser hyphenation match.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  useEffect(() => {
    if (!initialLanguage) return;
    if (!(SUPPORTED_LANGUAGES as string[]).includes(initialLanguage)) return;
    setLanguageState((current) => (current === initialLanguage ? current : initialLanguage));
  }, [initialLanguage]);

  const setLanguage = useCallback((next: Language) => {
    if (!(SUPPORTED_LANGUAGES as string[]).includes(next)) return;
    setLanguageState(next);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      /* ignore — best-effort cache */
    }
  }, []);

  const t = useCallback(
    (jaText: string, vars?: Interpolations): string => {
      if (language === "ja") {
        return applyInterpolations(jaText, vars);
      }
      const translated = EN_TRANSLATIONS[jaText] ?? jaText;
      if (import.meta.env.DEV && !(jaText in EN_TRANSLATIONS)) {
        // Help spot untranslated strings during development.
        // eslint-disable-next-line no-console
        console.warn(`[i18n] No EN translation for: ${jaText}`);
      }
      return applyInterpolations(translated, vars);
    },
    [language],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within a <LanguageProvider>");
  }
  return ctx;
}

/**
 * Non-React lookup helper for service modules. Prefer the `t` from
 * useTranslation() inside React components.
 */
export function translate(language: Language, jaText: string, vars?: Interpolations): string {
  if (language === "ja") return applyInterpolations(jaText, vars);
  const translated = EN_TRANSLATIONS[jaText] ?? jaText;
  return applyInterpolations(translated, vars);
}

export { LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE };
