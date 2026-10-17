import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { isLocale } from "./config";
import { messages } from "./messages";

// The language of the page being rendered, for server components: the proxy
// put it in the /[lang] segment
export async function getI18n() {
  const locale = await lang();
  if (!isLocale(locale)) notFound();
  return { locale, m: messages[locale] };
}
