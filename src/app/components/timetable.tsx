"use client";

import { SquareChartGantt } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { useI18n } from "~/i18n/i18n-provider";
import { ZoomableImage } from "./zoomable-image";

export function Timetable({ url }: { url: string }) {
  const { m } = useI18n();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={m.timetable.open}
          className="size-8 shrink-0 rounded-full text-muted-foreground/70 hover:bg-muted hover:text-foreground">
          <SquareChartGantt className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="flex h-full max-h-full max-w-full touch-none flex-col bg-background">
        <DialogHeader>
          <DialogTitle>{m.timetable.title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {m.timetable.description}
          </DialogDescription>
        </DialogHeader>
        <ZoomableImage src={url} alt={m.timetable.open} />
        <DialogFooter>
          <DialogClose asChild>
            <Button className="h-11 rounded-xl">{m.common.close}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
