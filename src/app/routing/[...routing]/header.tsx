"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "~/ui/button";

export default function Header() {
  const router = useRouter();

  return (
    <h1 className="relative m-4 text-3xl font-bold tracking-tight text-center">
      <Button
        className="absolute left-0 rounded"
        variant="ghost"
        onClick={() => router.back()}>
        <ChevronLeft />
      </Button>
      Fermate
    </h1>
  );
}
