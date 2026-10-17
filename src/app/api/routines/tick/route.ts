import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { tick } from "~/routines/tick";
import { respond } from "../../respond";

// The timetable may be slow: room for a few retries of opendata
export const maxDuration = 60;

// Whether the request carries `Authorization: Bearer ${CRON_SECRET}`.
// Compared in constant time, not to leak the secret a character at a time.
function authorized(request: NextRequest, secret: string): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

// GET or POST /api/routines/tick, every minute from an external scheduler
// (Upstash QStash, cron-job.org…): sends the notifications that are due
function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Not configured" }, { status: 503 });
  if (!authorized(request, secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return respond(tick);
}

export const GET = handle;
export const POST = handle;
