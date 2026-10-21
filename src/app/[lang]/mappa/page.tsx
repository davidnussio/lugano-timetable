import { StopsHeader } from "~/app/components/stops-header";
import { getI18n } from "~/i18n/server";
import { StopsMap } from "./stops-map-loader";

export default async function MapPage() {
  const { m } = await getI18n();
  return (
    <main className="flex flex-1 flex-col">
      <StopsHeader title={m.map.title} current="/mappa" />
      <div className="relative min-h-80 flex-1 overflow-hidden border-t border-border">
        <StopsMap />
      </div>
    </main>
  );
}
