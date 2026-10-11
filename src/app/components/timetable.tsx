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
import { ZoomableImage } from "./zoomable-image";

export function Timetable({ url }: { url: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Orario della fermata"
          className="size-8 shrink-0 rounded-full text-muted-foreground/70 hover:bg-muted hover:text-foreground">
          <SquareChartGantt className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="flex h-full max-h-full max-w-full touch-none flex-col bg-background">
        <DialogHeader>
          <DialogTitle>Orario</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Consulta gli orari aggiornati per la fermata del bus.
          </DialogDescription>
        </DialogHeader>
        <ZoomableImage src={url} alt="Orario della fermata" />
        <DialogFooter>
          <DialogClose asChild>
            <Button className="h-11 rounded-xl">Chiudi</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
