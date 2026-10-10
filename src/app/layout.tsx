import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cn } from "~/lib/utils";
import { TimerProvider } from "~/timer/timer-provider";
import { TimerBar } from "./components/timer-bar";
import "./globals.css";

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Lugano Bus",
  description: "Partenze in tempo reale dei bus TPL di Lugano",
  appleWebApp: { capable: true, title: "Lugano Bus", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1217" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body
        className={cn(
          fontSans.variable,
          fontMono.variable,
          "min-h-dvh bg-background font-sans antialiased"
        )}>
        <TimerProvider>
          <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
            {children}
            <TimerBar />
          </div>
        </TimerProvider>
      </body>
    </html>
  );
}
