"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface TopBarProps {
  title: React.ReactNode;
  rightAction?: React.ReactNode;
}

export function TopBar({ title, rightAction }: TopBarProps) {
  const router = useRouter();

  return (
    <header className="flex items-center justify-between px-4 py-4 bg-background sticky top-0 z-10">
      <button
        className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
        aria-label="Go back"
        onClick={() => router.back()}>
        <ChevronLeft className="h-5 w-5 text-primary" />
      </button>
      <h1 className="text-lg font-semibold text-primary tracking-tight">{title}</h1>
      <div className="w-9 h-9 flex items-center justify-center">
        {rightAction}
      </div>
    </header>
  );
}
