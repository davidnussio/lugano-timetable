// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { GetTargets } from "~/timetable/commands/get-targets.command";

type Data = any;

import { Redis } from "@upstash/redis";
import { z } from "zod";
import { CommandBus } from "~/timetable/commands/command-bus";
import { GetItineraries } from "~/timetable/commands/get-itineraries.command";
import { GetRouting } from "~/timetable/commands/get-routing.command";
import {
  Itineraries,
  ItinerariesResponse,
  RoutingResponse,
  Target,
  TargetResponse,
} from "~/timetable/models";

const redis = new Redis({
  url: "https://eu2-busy-corgi-30856.upstash.io",
  token:
    "AXiIACQgZDIwYjgwZDQtYzkyYy00ZDIxLWIzOWItNjNjOTUxYmIzMzZmM2E2YTc0OTYxNjdkNDYzNTlkYzg4OWUwZjUxMTM3MTg=",
});

const commandBus = new CommandBus(redis);

async function getTargets(req: NextApiRequest, res: NextApiResponse<Data>) {
  const result = await commandBus.execute<TargetResponse>(new GetTargets());
  if (result.cached) {
    res.status(200).json(result.data);
    return;
  }

  const cacheData: Record<string, Target> = {};

  for (const target of result.data.data) {
    for (const identifier of target.Identifiers) {
      cacheData[`target-${identifier}`] = target;
    }
  }
  await redis.mset(cacheData);
  res.status(200).json(result);
}

async function getItineraries(req: NextApiRequest, res: NextApiResponse<Data>) {
  const { itineraries } = req.query as { itineraries: string[] };
  const parameters = itineraries.map((item) => Number(item));
  const result = await commandBus.execute<ItinerariesResponse>(
    new GetItineraries({ parameters })
  );

  const sortedData = [...result.data.data].sort(
    (a: Itineraries, b: Itineraries) => {
      const numberOne = Number(a.RouteCode);
      const numberTwo = Number(b.RouteCode);

      if (Number.isNaN(numberOne)) {
        return 1;
      }
      if (Number.isNaN(numberTwo)) {
        return -1;
      }

      return numberOne - numberTwo;
    }
  );

  res.status(200).json(sortedData);
}

async function getRouting(req: NextApiRequest, res: NextApiResponse<Data>) {
  const { routing } = req.query as { routing: string[] };
  const parameters = routing.map((item) => Number(item));

  const result = await commandBus.execute<RoutingResponse>(
    new GetRouting({ parameters })
  );

  const uids = result.data.data.map((item) => `target-${item.UID}`);
  const targets: Target[] = await redis.mget(...uids);

  const data = result.data.data.map((item, index) => {
    const { Name, Label } = targets[index];
    return { ...item, Name, Label };
  });

  res.status(200).json(data);
}

const ValidCommands = z.object({
  params: z.array(z.enum(["targets", "itineraries", "routing"])),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  console.log("Request:", req.query);
  const command = ValidCommands.safeParse(req.query);
  if (!command.success) {
    res.status(400).json({ error: "Bad request" });
    return;
  }

  console.log("Command:", command.data);
  switch (command.data.params[0]) {
    case "targets":
      await getTargets(req, res);
      break;
    case "itineraries":
      await getItineraries(req, res);
      break;
    case "routing":
      await getRouting(req, res);
      break;
    default:
      res.status(400).json({ error: "Bad request" });
      break;
  }
}
