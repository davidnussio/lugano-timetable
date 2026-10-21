import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "~/app/components/site-footer";
import { TimerBar } from "~/app/components/timer-bar";
import "~/app/globals.css";
import { locales } from "~/i18n/config";
import { I18nProvider } from "~/i18n/i18n-provider";
import { getI18n } from "~/i18n/server";
import { cn } from "~/lib/utils";
import { TimerProvider } from "~/timer/timer-provider";

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

// Only for the clocks: not worth delaying the first render of every page
const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  preload: false,
});

// Every page is rendered once per language: the proxy picks one for each
// request, without showing it in the URL
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return {
    title: "LuGo",
    description: m.meta.description,
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "LuGo", statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1217" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale } = await getI18n();
  return (
    <html lang={locale}>
      <body
        className={cn(
          fontSans.variable,
          fontMono.variable,
          "min-h-dvh bg-background font-sans antialiased"
        )}>
        <I18nProvider locale={locale}>
          <TimerProvider>
            <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
              {children}
              <SiteFooter />
              <TimerBar />
            </div>
          </TimerProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
