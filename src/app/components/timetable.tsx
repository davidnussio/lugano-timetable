/* eslint-disable @next/next/no-img-element */
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

export function Timetable({ url }: { url: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost">
          <SquareChartGantt size={18} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-full max-h-full h-full">
        <DialogHeader>
          <DialogTitle>Oriario</DialogTitle>
          <DialogDescription>
            Consulta gli orari aggiornati per la fermata del bus.
          </DialogDescription>
        </DialogHeader>
        <div className="mx-auto">
          <img
            alt="Timetable"
            title="Image"
            src={url}
            // className="w-full h-full"
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button>Chiudi</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
