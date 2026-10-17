import { NextResponse, type NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE } from "~/i18n/config";
import { pickLocale } from "~/i18n/negotiate";

const ONE_YEAR = 60 * 60 * 24 * 365;

// Every page lives under /[lang], but the URLs stay the same in every
// language: the language comes from the cookie or the browser and the page is
// rewritten to its own, cached by the CDN per language.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const [, first, ...rest] = pathname.split("/");

  // "/en" or "/de/tragitto": a link with a language, kept for next time
  if (isLocale(first)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${rest.join("/")}`;
    const response = NextResponse.redirect(url);
    response.cookies.set(LOCALE_COOKIE, first, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
    return response;
  }

  const locale = pickLocale(
    request.cookies.get(LOCALE_COOKIE)?.value,
    request.headers.get("accept-language")
  );
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Not the APIs, the icons and the files of public/
  matcher: [
    "/((?!api/|_next/|shortcut-icon/|icon|apple-icon|maplibre/|sw\\.js|favicon\\.ico).*)",
  ],
};
