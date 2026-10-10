import { StopsHeader } from "../components/stops-header";
import { StopsMap } from "./stops-map-loader";

export default function MapPage() {
  return (
    <main className="flex flex-1 flex-col">
      <StopsHeader title="Mappa" current="/mappa" />
      <div className="relative min-h-80 flex-1 overflow-hidden border-t border-border">
        <StopsMap />
      </div>
    </main>
  );
}
