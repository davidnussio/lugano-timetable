import type { NextApiRequest, NextApiResponse } from "next";

import { z } from "zod";
import { getItineraries, getRouting, getTargets } from "~/timetable/api";
import { Itineraries, Routing, Target } from "~/timetable/models";

type Data = Target[] | Itineraries[] | Routing[] | { error: string };

const mapInteger = (items: string[] | string) =>
  Array.isArray(items) ? items.map((item) => Number(item)) : [Number(items)];

const ValidCommands = z.discriminatedUnion("params", [
  z.object({
    params: z.literal("targets"),
  }),
  z.object({
    params: z.literal("itineraries"),
    itineraries: z
      .array(z.string())
      .transform(mapInteger)
      .or(z.string().transform(mapInteger)),
  }),
  z.object({
    params: z.literal("routing"),
    routing: z
      .array(z.string())
      .transform(mapInteger)
      .or(z.string().transform(mapInteger)),
  }),
]);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const command = ValidCommands.safeParse({
    ...req.query,
    params: req.query.params?.[0],
  });

  if (!command.success) {
    console.log("Bad request:", command.error, req.query);
    res.status(400).json({ error: "Bad request" });
    return;
  }

  console.log("Command:", command.data);

  switch (command.data.params) {
    case "targets":
      res.status(200).send(await getTargets());
      break;
    case "itineraries":
      res.status(200).send(await getItineraries(command.data.itineraries));
      break;
    case "routing":
      res.status(200).send(await getRouting(command.data.routing));
      break;
    default:
      res.status(400).json({ error: "Bad request" });
      break;
  }
}
