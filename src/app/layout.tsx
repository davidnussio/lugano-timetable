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
      {/*
        <head /> will contain the components returned by the nearest parent
        head.tsx. Find out more at https://beta.nextjs.org/docs/api-reference/file-conventions/head
      */}
      <head />
      <body
        className={cn(
          inter.className,
          "mx-auto max-w-md w-full flex flex-col h-screen py-2 overflow-y-scroll"
        )}>
        {children}
      </body>
    </html>
  );
}
