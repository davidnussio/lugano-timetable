import { Redis } from "@upstash/redis";
import { CommandBus } from "./commands/command-bus";
import { GetItineraries } from "./commands/get-itineraries.command";
import { GetRouting } from "./commands/get-routing.command";
import { GetTargets } from "./commands/get-targets.command";
import {
  Itineraries,
  ItinerariesResponse,
  Routing,
  RoutingResponse,
  Target,
  TargetResponse,
} from "./models";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const commandBus = new CommandBus(redis);

export async function getTargets(): Promise<Target[]> {
  const result = await commandBus.execute<TargetResponse>(new GetTargets());
  if (result.cached) {
    return result.data.data;
  }

  const cacheData: Record<string, Target> = {};

  for (const target of result.data.data) {
    for (const identifier of target.Identifiers) {
      cacheData[`target-${identifier}`] = target;
    }
  }
  await redis.mset(cacheData);
  return result.data.data;
}

export async function getItineraries(
  parameters: number[]
): Promise<Itineraries[]> {
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

  return sortedData;
}

export async function getRouting(parameters: number[]): Promise<Routing[]> {
  const result = await commandBus.execute<RoutingResponse>(
    new GetRouting({ parameters })
  );

  const uids = result.data.data.map((item) => `target-${item.UID}`);
  const targets: Target[] = await redis.mget(...uids);

  const data = result.data.data.map((item, index) => {
    const { Name, Label } = targets[index];
    return { ...item, Name, Label };
  });

  return data;
}
