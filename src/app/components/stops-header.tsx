import { List, MapIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "~/lib/utils";

const views = [
  { href: "/", label: "Lista", Icon: List },
  { href: "/mappa", label: "Mappa", Icon: MapIcon },
] as const;

type View = (typeof views)[number]["href"];

// Title of the stop list and of the map, with the switch between the two
export function StopsHeader({ title, current }: { title: string; current: View }) {
  return (
    <header className="flex items-end justify-between gap-3 px-4 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Lugano Bus
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      </div>
      <nav aria-label="Vista" className="flex shrink-0 rounded-full bg-muted p-1">
        {views.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={href === current ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors",
              href === current
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}>
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
