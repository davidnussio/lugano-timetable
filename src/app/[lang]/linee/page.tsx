import { StopsHeader } from "~/app/components/stops-header";
import { getI18n } from "~/i18n/server";
import { LineList } from "./line-list";

export default async function LinesPage() {
  const { m } = await getI18n();
  return (
    <main className="flex flex-1 flex-col">
      <StopsHeader title={m.lines.title} current="/linee" />
      <LineList />
    </main>
  );
}
