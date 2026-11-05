import { direction, languages, SITE_URL, translate, type Language } from "./i18n";

export function localeMetadata(language: Language) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const canonical = `${SITE_URL}/${language}/`;
  return {
    title: t("pageTitle"), canonical,
    meta: {
      description: t("pageDescription"),
      "og:locale": { ar: "ar_EG", en: "en_US", id: "id_ID" }[language],
      "og:site_name": t("brand"),
      "og:title": t("socialTitle"),
      "og:description": t("socialDescription"),
      "og:url": canonical,
      "og:image:alt": t("imageAlt"),
      "twitter:title": t("socialTitle"),
      "twitter:description": t("socialDescription"),
      "twitter:image:alt": t("imageAlt"),
    },
    schema: {
      "@context": "https://schema.org", "@type": "WebSite",
      name: t("brand"), alternateName: translate(language === "ar" ? "en" : "ar", "brand"),
      url: canonical, inLanguage: language, description: t("socialDescription"),
    },
  };
}
export function applyLocaleMetadata(language: Language, page: Document) {
  const metadata = localeMetadata(language);
  page.documentElement.lang = language;
  page.documentElement.dir = direction(language);
  page.title = metadata.title;
  for (const [key, value] of Object.entries(metadata.meta)) {
    page.querySelector(`meta[name="${key}"],meta[property="${key}"]`)?.setAttribute("content", value);
  }
  page.querySelector('link[rel="canonical"]')?.setAttribute("href", metadata.canonical);
  const schema = page.querySelector('script[type="application/ld+json"]');
  if (schema) schema.textContent = JSON.stringify(metadata.schema);
}

const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
export function localizedHtml(html: string, language: Language): string {
  const metadata = localeMetadata(language);
  let result = html.replace(/<html[^>]*>/, `<html lang="${language}" dir="${direction(language)}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(metadata.title)}</title>`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${metadata.canonical}" />`)
    .replace(/<noscript>[\s\S]*?<\/noscript>/, `<noscript>${escapeHtml(translate(language, "noScript"))}</noscript>`)
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/,
      `<script type="application/ld+json">${JSON.stringify(metadata.schema)}</script>`);
  for (const [key, value] of Object.entries(metadata.meta)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`(<meta (?:name|property)="${escapedKey}" content=")[^"]*("\\s*\\/>)`),
      (_, start: string, end: string) => start + escapeHtml(value) + end);
  }
  // Rebuild the alternate set exactly once, including on the already-localized build output.
  result = result.replace(/\s*<link rel="alternate" hreflang="[^"]*" href="[^"]*"\s*\/>/g, "");
  const alternates = [...languages.map((lang) =>
    `    <link rel="alternate" hreflang="${lang}" href="${SITE_URL}/${lang}/" />`),
    `    <link rel="alternate" hreflang="x-default" href="${SITE_URL}/" />`].join("\n");
  return result.replace("</head>", alternates + "\n  </head>");
}
