import { cn } from "~/lib/utils";
import "./globals.css";
import { Montserrat, Space_Grotesk } from "next/font/google";

const fontSans = Montserrat({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const fontMono = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600", "700"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head />
      <body
        className={cn(
          fontSans.variable,
          fontMono.variable,
          "min-h-screen bg-background font-sans antialiased mx-auto max-w-md w-full flex flex-col h-screen overflow-y-scroll"
        )}>
        {children}
      </body>
    </html>
  );
}
