import { Timetable } from "~/timetable/timetable";
import { respond } from "../respond";

// The stop list rarely changes: the CDN asks the RTPI server at most once a
// day, and keeps serving the old list while refreshing it or when it is down
const CACHE_CONTROL =
  "public, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800";

export function GET() {
  return respond(Timetable.use((timetable) => timetable.targets)).then(
    (response) => {
      if (response.ok) response.headers.set("Cache-Control", CACHE_CONTROL);
      return response;
    }
  );
}
