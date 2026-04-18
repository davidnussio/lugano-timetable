"use client";

import { ChevronRight, Eraser, Star } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { ScrollArea } from "~/components/ui/scroll-area";
import { useFavorites } from "~/hooks/use-favorites";
import { Target } from "~/timetable/models";
import { TimetableScanner } from "./components/timetable-scanner";
import { TopBar } from "./components/topbar";

function bySearchValue(
  search: string
): (value: Target, index: number, array: Target[]) => boolean {
  if (search === "") return () => true;

  return (target) => {
    const searchValue = search.toLowerCase();
    return (
      target.Name.toLowerCase().includes(searchValue) ||
      target.Label.toLowerCase().includes(searchValue) ||
      target.Identifiers.some((identifier) =>
        identifier.toLowerCase().includes(searchValue)
      )
    );
  };
}

export interface FiltrableListTargetsProps {
  targets: Target[];
}

export function FiltrableListTargets({
  targets,
}: FiltrableListTargetsProps): JSX.Element {
  const [search, setSearch] = useState<string>("");
  const deferredSearch = useDeferredValue(search);
  const { isLoaded, isFavorite } = useFavorites();
  const router = useRouter();

  const handleStopDetected = useCallback(
    (target: Target) => {
      router.push(`/fermata/${target.Identifiers.join("/")}`);
    },
    [router]
  );

  const filteredTargets = useMemo(
    () => targets.filter(bySearchValue(deferredSearch)),
    [deferredSearch, targets]
  );

  // Sort favorites to the top
  const sortedTargets = useMemo(() => {
    if (!isLoaded) return filteredTargets;
    
    return [...filteredTargets].sort((a, b) => {
      const aIsFav = isFavorite(a.Identifiers);
      const bIsFav = isFavorite(b.Identifiers);
      if (aIsFav && !bIsFav) return -1;
      if (!aIsFav && bIsFav) return 1;
      return 0;
    });
  }, [filteredTargets, isLoaded, isFavorite]);

  return (
    <>
      <TopBar
        title="Fermate"
        rightAction={
          <TimetableScanner
            targets={targets}
            onStopDetected={handleStopDetected}
          />
        }
      />
      <div className="flex flex-col gap-4 px-4 pb-4">
        <div className="sticky top-[65px] z-10 bg-background pt-2 pb-3">
          <Input
            type="text"
            value={search}
            placeholder="Cerca fermata..."
            className="h-12 text-base bg-card border-border focus:ring-accent focus:border-accent rounded-xl"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ScrollArea className="min-h-max h-max">
          <ul className="divide-y divide-border rounded-xl overflow-hidden bg-card border border-border">
            {sortedTargets.map((target) => {
              const isFav = isLoaded && isFavorite(target.Identifiers);
              return (
                <li
                  key={target.Label + target.Identifiers.join(",")}
                  className="transition-colors hover:bg-muted"
                >
                  <Link
                    className="flex items-center justify-between px-4 py-3.5 gap-3"
                    href={`/fermata/${target.Identifiers.join("/")}`}
                  >
                    {isFav && (
                      <Star className="h-4 w-4 flex-shrink-0 fill-accent text-accent" />
                    )}
                    <div className="flex flex-col items-start flex-1 min-w-0">
                      <span className="font-medium text-foreground truncate w-full">
                        {target.Name}
                      </span>
                      <span className="text-xs text-muted-foreground truncate w-full">
                        {target.Label}
                      </span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </Link>
                </li>
              );
            })}
            {sortedTargets.length === 0 && (
              <li className="px-4 py-6">
                <div className="text-center text-muted-foreground">
                  <Button
                    variant="ghost"
                    onClick={() => setSearch("")}
                    className="text-accent hover:text-accent hover:bg-accent/10"
                  >
                    <Eraser className="mr-2 h-4 w-4" /> Nessun risultato
                  </Button>
                </div>
              </li>
            )}
          </ul>
        </ScrollArea>
      </div>
    </>
  );
}
