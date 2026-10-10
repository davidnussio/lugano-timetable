import { SquareChartGantt } from "lucide-react";
import Image from "next/image";
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
      <DialogContent className="max-w-full max-h-full h-full flex flex-col bg-background">
        <DialogHeader>
          <DialogTitle>Orario</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Consulta gli orari aggiornati per la fermata del bus.
          </DialogDescription>
        </DialogHeader>
        <div className="m-auto h-full w-full relative grow justify-end">
          <Image
            alt="Timetable"
            title="Image"
            src={url}
            fill
            style={{ objectFit: "contain", margin: "4rem" }}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button className="h-11 rounded-xl">Chiudi</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
