export const locales = ["it", "de", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "it";

// The choice of the visitor, read by the proxy on every request
export const LOCALE_COOKIE = "lang";

export function isLocale(value: string | undefined): value is Locale {
  return (locales as readonly (string | undefined)[]).includes(value);
}

// The pages live under /[lang], but their URLs never show it: "/de/timer"
// on the server is "/timer" in the browser
export function stripLocale(pathname: string): string {
  const [, first, ...rest] = pathname.split("/");
  return isLocale(first) ? `/${rest.join("/")}` : pathname;
}
