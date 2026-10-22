"use client";

import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { useI18n } from "~/i18n/i18n-provider";

// The trash button of the history and the question before clearing it, as
// a card of the app rather than the dialog of the browser
export function ClearHistory({
  trips,
  className,
  onClear,
}: {
  trips: number;
  className: string;
  onClear: () => void;
}) {
  const { m } = useI18n();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" aria-label={m.history.clear} title={m.history.clear} className={className}>
          <Trash2 className="size-5" />
        </button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100%-2rem)] max-w-sm gap-0 rounded-2xl border-border bg-card p-5 text-center shadow-xl sm:rounded-2xl">
        <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <Trash2 aria-hidden className="size-6" />
        </span>
        <DialogTitle className="text-lg font-semibold tracking-tight">
          {m.history.clearTitle}
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted-foreground">
          {m.history.clearBody(trips)}
        </DialogDescription>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <DialogClose asChild>
            <button
              type="button"
              className="h-11 rounded-xl border border-border bg-background text-sm font-semibold transition-colors hover:bg-muted active:bg-muted">
              {m.history.clearCancel}
            </button>
          </DialogClose>
          <DialogClose asChild>
            <button
              type="button"
              onClick={onClear}
              className="h-11 rounded-xl bg-destructive text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 active:bg-destructive/90">
              {m.history.clearConfirm}
            </button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
