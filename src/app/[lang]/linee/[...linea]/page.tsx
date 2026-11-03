import { LineView } from "./line-view";

// A static shell, rendered on the first visit of each line and then served
// by the CDN: the stops and the buses are loaded by the client
export function generateStaticParams() {
  return [];
}

export default async function LinePage({
  params,
}: {
  params: Promise<{ linea: string[] }>;
}) {
  const { linea } = await params;
  // Route, then the direction when chosen
  return <LineView route={linea[0]} dir={linea[1]} />;
}
