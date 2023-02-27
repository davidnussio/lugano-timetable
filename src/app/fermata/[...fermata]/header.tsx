"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function Header() {
  return (
    <h1 className="relative m-4 text-3xl font-bold tracking-tight text-center">
      <Link className="absolute left-0 rounded" href="/">
        <ChevronLeft />
      </Link>
      Fermate
    </h1>
  );
}
