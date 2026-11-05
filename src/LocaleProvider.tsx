import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  detectLanguage, direction, languageNames, languagePath, languages, locales, pathLanguage,
  readLanguage, saveLanguage, translate, type Language, type TranslationKey,
} from "./i18n";
import { applyLocaleMetadata } from "./localeMetadata";

function localeValue(language: Language) {
  return {
    language, locale: locales[language], dir: direction(language),
    t: (key: TranslationKey, values?: Record<string, string | number>) => translate(language, key, values),
    n: (value: number, options?: Intl.NumberFormatOptions) => value.toLocaleString(locales[language], options),
  };
}
const LocaleContext = createContext({ ...localeValue("ar"), setLanguage: (language: Language) => { void language; } });
export const useLocale = () => useContext(LocaleContext);

export function LocaleProvider({ children, initialLanguage }: { children: ReactNode; initialLanguage?: Language }) {
  const [language, updateLanguage] = useState<Language>(() => {
    if (initialLanguage) return initialLanguage;
    let saved: string | null = null;
    try { saved = readLanguage(localStorage); } catch { /* Storage itself may be blocked. */ }
    return detectLanguage(location.pathname, saved, navigator.languages);
  });
  const explicitRoute = useRef(typeof location === "undefined" ? undefined : pathLanguage(location.pathname));
  const scrollPosition = useRef<number | null>(null);
  const value = useMemo(() => ({ ...localeValue(language), setLanguage(next: Language) {
    scrollPosition.current = window.scrollY;
    try { saveLanguage(localStorage, next); } catch { /* Session choice still works. */ }
    window.history.pushState(null, "", languagePath(next, location.search, location.hash));
    updateLanguage(next);
  } }), [language]);

  useLayoutEffect(() => {
    applyLocaleMetadata(language, document);
    if (!pathLanguage(location.pathname))
      window.history.replaceState(null, "", languagePath(language, location.search, location.hash));
    if (scrollPosition.current !== null) {
      window.scrollTo({ top: scrollPosition.current, behavior: "instant" });
      scrollPosition.current = null;
    }
  }, [language]);
  useEffect(() => {
    // Direct language URLs are explicit choices. Browser detection alone does not save a preference.
    if (explicitRoute.current) {
      try { saveLanguage(localStorage, explicitRoute.current); } catch { /* Storage may be blocked. */ }
      explicitRoute.current = undefined;
    }
    const onBack = () => updateLanguage(detectLanguage(location.pathname, language, navigator.languages));
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, [language]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function LanguageSelector() {
  const { language, setLanguage, t } = useLocale();
  return (
    <label className="language-select">
      <span className="sr-only">{t("language")}</span>
      <select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
        {languages.map((lang) => <option key={lang} lang={lang} value={lang}>{languageNames[lang]}</option>)}
      </select>
    </label>
  );
}
