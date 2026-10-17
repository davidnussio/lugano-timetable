import type { Locale } from "../config";
import { de } from "./de";
import { en } from "./en";
import { it, type Messages } from "./it";

export type { Messages };

export const messages: Record<Locale, Messages> = { it, de, en };

// Each language in its own words, for the switch in the footer
export const languageNames: Record<Locale, string> = {
  it: "Italiano",
  de: "Deutsch",
  en: "English",
};
