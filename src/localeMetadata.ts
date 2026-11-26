import { archiveLabels } from "./archiveLabels";
import { direction, languages, languageNames, SITE_URL, translate, type Language } from "./i18n";

export function localeMetadata(language: Language, archived = false) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const canonical = `${SITE_URL}/${language}/`;
  const labels = archiveLabels[language];
  const title = archived ? `${labels.status} · ${t("brand")}` : t("pageTitle");
  const socialTitle = archived ? title : t("socialTitle");
  const description = archived ? labels.description : t("pageDescription");
  const socialDescription = archived ? labels.description : t("socialDescription");
  return {
    title, canonical,
    meta: {
      description,
      "og:locale": { ar: "ar_EG", en: "en_US", id: "id_ID", ur: "ur_PK" }[language],
      "og:site_name": t("brand"),
      "og:title": socialTitle,
      "og:description": socialDescription,
      "og:url": canonical,
      "og:image:alt": t("imageAlt"),
      "twitter:title": socialTitle,
      "twitter:description": socialDescription,
      "twitter:image:alt": t("imageAlt"),
    },
    schema: {
      "@context": "https://schema.org", "@type": "WebSite",
      name: t("brand"), alternateName: translate(language === "ar" ? "en" : "ar", "brand"),
      url: canonical, inLanguage: language, description: socialDescription,
    },
  };
}
export function applyLocaleMetadata(language: Language, page: Document, archived = false) {
  const metadata = localeMetadata(language, archived);
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
export function staticIntroduction(language: Language, archived = false) {
  const t = (key: Parameters<typeof translate>[1]) => escapeHtml(translate(language, key));
  const links = languages.map((locale) => '<a href="/' + locale + '/" lang="' + locale + '">' +
    escapeHtml(languageNames[locale]) + "</a>").join(" · ");
  if (archived) {
    const labels = archiveLabels[language];
    return '<main class="static-intro"><h1>' + t("brand") + "</h1><h2>" + escapeHtml(labels.title) +
      "</h2><p>" + escapeHtml(labels.description) + "</p><p>" + escapeHtml(labels.thanks) +
      "</p><p>" + t("footerDisclaimer") + '</p><nav aria-label="' + t("language") + '">' + links + "</nav></main>";
  }
  const steps = [1, 2, 3].map((number) => {
    const title = ("step" + number + "Title") as Parameters<typeof translate>[1];
    const body = ("step" + number + "Body") as Parameters<typeof translate>[1];
    return "<li><h3>" + t(title) + "</h3><p>" + t(body) + "</p></li>";
  }).join("");
  return '<main class="static-intro"><h1>' + t("brand") + "</h1><p>" + t("pageDescription") +
    "</p><h2>" + t("officialIntroTitle") + "</h2><p>" + t("officialIntroBody") +
    '</p><a href="https://services.nusuk.sa/app" rel="noopener noreferrer">' + t("officialIntroAction") +
    "</a><h2>" + t("howTitle") + "</h2><ol>" + steps + "</ol><h2>" + t("transparencyTitle") +
    "</h2><p>" + t("transparencyBody") + "</p><p>" + t("footerDisclaimer") +
    '</p><nav aria-label="' + t("language") + '">' + links + "</nav></main>";
}
export function localizedHtml(html: string, language: Language, preview = false, archived = false): string {
  const metadata = localeMetadata(language, archived);
  let result = html.replace(/<html[^>]*>/, `<html lang="${language}" dir="${direction(language)}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(metadata.title)}</title>`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${metadata.canonical}" />`)
    .replace(/<noscript>[\s\S]*?<\/noscript>/, `<noscript>${escapeHtml(archived ? archiveLabels[language].description : translate(language, "noScript"))}</noscript>`)
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
  result = result.replace(/<div id="root">[\s\S]*?<\/div>/,
    '<div id="root">' + staticIntroduction(language, archived) + "</div>");
  result = result.replace(/\s*<meta name="robots" content="noindex, nofollow"\s*\/>/g, "");
  if (preview) result = result.replace("</head>", '<meta name="robots" content="noindex, nofollow" />\n</head>');
  return result.replace("</head>", alternates + "\n  </head>");
}
