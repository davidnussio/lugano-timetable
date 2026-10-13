import { FermataView } from "./fermata-view";

// A static shell, rendered on the first visit of each stop and then served by
// the CDN: the departures are loaded by the client
export function generateStaticParams() {
  return [];
}

export default async function FermataPage({
  params,
}: {
  params: Promise<{ fermata: string[] }>;
}) {
  const { fermata } = await params;
  return <FermataView fermata={fermata} />;
}
