"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "~/lib/utils";

interface PageHeaderProps {
  readonly title: React.ReactNode;
  readonly subtitle?: React.ReactNode;
  // Where to go back when the page was opened directly (no history)
  readonly back?: string;
  readonly actions?: React.ReactNode;
  readonly className?: string;
}

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  className,
}: PageHeaderProps) {
  const router = useRouter();

  const goBack = () => {
    if (back === undefined) return;
    if (window.history.length > 1) router.back();
    else router.push(back);
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex items-center gap-2 border-b border-border/60 bg-background/85 px-2 py-2.5 backdrop-blur-xl pt-[max(0.625rem,env(safe-area-inset-top))]",
        className
      )}>
      {back !== undefined ? (
        <button
          type="button"
          className="grid size-10 shrink-0 place-items-center rounded-full text-foreground transition-colors hover:bg-muted active:bg-muted"
          aria-label="Indietro"
          onClick={goBack}>
          <ChevronLeft className="size-6" />
        </button>
      ) : (
        <div className="w-2" />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="truncate text-[17px] font-semibold leading-tight tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  );
}
