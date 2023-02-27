import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "~/ui/utils/cn";

const inter = Inter({ subsets: ["latin"] });

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
          inter.className,
          "mx-auto max-w-md w-full flex flex-col h-screen py-2 overflow-y-scroll px-2"
        )}>
        {children}
      </body>
    </html>
  );
}
