"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function TopBar({ title }: { title: React.ReactNode }) {
  const router = useRouter();

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-background">
      <button
        className="p-2 -ml-2"
        aria-label="Go back"
        onClick={() => router.back()}>
        <ChevronLeft className="h-5 w-5" />
      </button>
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="w-8 h-8"></div>
      {/* <Avatar className="h-8 w-8">
        <AvatarImage src="/placeholder-avatar.jpg" alt="User avatar" />
        <AvatarFallback>US</AvatarFallback>
      </Avatar> */}
    </header>
  );
}
