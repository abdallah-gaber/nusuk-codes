import { ar, type TranslationKey } from "./locales/ar";
import { en } from "./locales/en";
import { id } from "./locales/id";

export type { TranslationKey } from "./locales/ar";
export const languages = ["ar", "en", "id"] as const;
export type Language = typeof languages[number];
export const dictionaries = { ar, en, id };
export const languageNames = { ar: "العربية", en: "English", id: "Bahasa Indonesia" };
export const locales = { ar: "ar-EG", en: "en", id: "id-ID" };
export const LANGUAGE_KEY = "nusuk:language:v1";
export const SITE_URL = "https://nusuk.abdallahgaber.dev";

export function isLanguage(value: unknown): value is Language {
  return languages.some((language) => language === value);
}
export function pathLanguage(path: string): Language | undefined {
  const match = /^\/(ar|en|id)\/?$/.exec(path);
  return match ? match[1] as Language : undefined;
}
export function detectLanguage(path: string, saved: unknown, preferred: readonly string[]): Language {
  const route = pathLanguage(path);
  if (route) return route;
  if (isLanguage(saved)) return saved;
  for (const preference of preferred) {
    const language = preference.toLowerCase().split("-")[0];
    if (isLanguage(language)) return language;
  }
  return "ar";
}
export function readLanguage(storage: Pick<Storage, "getItem">): string | null {
  try { return storage.getItem(LANGUAGE_KEY); } catch { return null; }
}
export function saveLanguage(storage: Pick<Storage, "setItem">, language: Language) {
  try { storage.setItem(LANGUAGE_KEY, language); } catch { /* Session choice still works. */ }
}
export const direction = (language: Language) => language === "ar" ? "rtl" : "ltr";
export function languagePath(language: Language, search = "", hash = "") {
  return `/${language}/${search}${hash}`;
}
export function translate(language: Language, key: TranslationKey, values: Record<string, string | number> = {}) {
  return dictionaries[language][key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`));
}
export class LocalizedError extends Error {
  constructor(public readonly key: TranslationKey) {
    super(ar[key]); // Retain existing default error messages for callers.
  }
}
