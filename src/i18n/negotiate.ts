import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config";

// The language of a request: the one chosen in the footer, else the first
// supported one of the browser ("de-CH,de;q=0.9,en;q=0.8" → "de"), else Italian
export function pickLocale(
  cookie: string | undefined,
  acceptLanguage: string | null | undefined
): Locale {
  if (isLocale(cookie)) return cookie;
  const preferred = (acceptLanguage ?? "")
    .split(",")
    .map((entry, index) => {
      const [tag, ...params] = entry.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return {
        language: tag.split("-")[0].toLowerCase(),
        weight: q === undefined ? 1 : Number(q.slice(2)) || 0,
        index,
      };
    })
    .filter(({ weight }) => weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .map(({ language }) => language);
  return preferred.find(isLocale) ?? defaultLocale;
}

// The `lang` cookie of a `document.cookie` string
export function cookieLocale(cookies: string): string | undefined {
  return cookies
    .split(";")
    .map((c) => c.trim().split("="))
    .find(([name]) => name === LOCALE_COOKIE)?.[1];
}
