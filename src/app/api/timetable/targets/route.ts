import { Timetable } from "~/timetable/timetable";
import { respond } from "../respond";

export function GET() {
  return respond(Timetable.use((timetable) => timetable.targets));
}
