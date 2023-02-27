"use client";

import { ChevronRight, Eraser } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { Target } from "~/timetable/models";
import { Button } from "~/ui/button";
import { Input } from "~/ui/input";
import { ScrollArea } from "~/ui/scroll-area";

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

  const filteredTargets = useMemo(
    () => targets.filter(bySearchValue(deferredSearch)),
    [deferredSearch, targets]
  );

  return (
    <>
      <div className="mb-4">
        <Input
          type="text"
          value={search}
          placeholder="search..."
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <ScrollArea className="min-h-max h-max border rounded-lg">
        <ul role="list" className="divide-y divide-gray-200">
          {filteredTargets.map((target) => (
            <li
              key={target.Label + target.Identifiers.join(",")}
              className="px-4 py-2">
              <Link
                className="flex items-center justify-between"
                href={`/fermata/${target.Identifiers.join("/")}`}>
                <div className="flex flex-col items-start">
                  {target.Name}
                  <div className="text-xs font-light">{target.Label}</div>
                </div>
                <div>
                  <ChevronRight />
                </div>
              </Link>
            </li>
          ))}
          {filteredTargets.length === 0 && (
            <li>
              <div className="text-center text-gray-500 py-2">
                <Button variant="ghost" onClick={() => setSearch("")}>
                  <Eraser className="mr-2 h-4 w-4" /> Nessun risultato
                </Button>
              </div>
            </li>
          )}
        </ul>
      </ScrollArea>
    </>
  );
}
