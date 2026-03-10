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
        <Button 
          variant="ghost" 
          size="sm"
          className="h-8 w-8 p-0 rounded-full hover:bg-muted"
        >
          <SquareChartGantt size={16} className="text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-full max-h-full h-full flex flex-col bg-background">
        <DialogHeader>
          <DialogTitle className="text-primary">Orario</DialogTitle>
          <DialogDescription className="text-muted-foreground">
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
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Chiudi</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
