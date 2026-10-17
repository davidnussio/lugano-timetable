import { RoutingView } from "./routing-view";

// A static shell, rendered on the first visit of each trip and then served by
// the CDN: the stops of the trip are loaded by the client
export function generateStaticParams() {
  return [];
}

export default async function RoutingPage({
  params,
}: {
  params: Promise<{ routing: string[] }>;
}) {
  const { routing } = await params;
  return <RoutingView routing={routing} />;
}
