/* eslint-disable @next/next/no-img-element */
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
        <Button variant="ghost">
          <SquareChartGantt size={18} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-full max-h-full h-full flex flex-col">
        <DialogHeader>
          <DialogTitle>Oriario</DialogTitle>
          <DialogDescription>
            Consulta gli orari aggiornati per la fermata del bus.
          </DialogDescription>
        </DialogHeader>
        <div className="m-auto h-full w-full relative flex-grow justify-end">
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
            <Button>Chiudi</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
