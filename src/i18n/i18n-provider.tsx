"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "./config";
import { messages, type Messages } from "./messages";

interface I18nContextValue {
  readonly locale: Locale;
  readonly m: Messages;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (value === null) throw new Error("useI18n outside of I18nProvider");
  return value;
}

// The language chosen by the proxy for this page, for client components
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, m: messages[locale] }), [locale]);
  return <I18nContext value={value}>{children}</I18nContext>;
}
