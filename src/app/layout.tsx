import { cn } from "~/lib/utils";
import "./globals.css";
import { Inter as FontSans } from "next/font/google"

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
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
          "min-h-screen bg-background font-sans antialiased mx-auto max-w-md w-full flex flex-col h-screen py-2 overflow-y-scroll px-2"
        )}>
        {children}
      </body>
    </html>
  );
}
