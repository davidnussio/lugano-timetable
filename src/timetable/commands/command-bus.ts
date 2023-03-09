import {
  ApiResponse,
  Itineraries,
  ItinerariesResponse,
  RoutingResponse,
  TargetResponse,
} from "../models";
import { ApiCommand } from "./api.command";
import type { Redis } from "@upstash/redis";
import { wait } from "~/utils/wait";
import { getTargets, refreshToken } from "../api";

export class CommandBus {
  constructor(private redisCli: Redis) {}

  private async saveToken(token: string): Promise<boolean> {
    if (token) {
      await this.redisCli.set("token", token, { ex: 60 * 10 });
      return true;
    }
    return false;
  }
  private async getToken(): Promise<string> {
    return (await this.redisCli.get("token")) ?? "";
  }

  private async cacheCommandResponse(
    commandName: string,
    data: ApiResponse<any>
  ) {
    await this.redisCli.set(commandName, data);
  }

  private async executeRequest<
    R extends TargetResponse | ItinerariesResponse | RoutingResponse
  >(url: string): Promise<R> {
    console.log("- Executing request", { url });
    const backoff = 100;
    for (let i = 0; i < 5; i++) {
      console.log("- Attempt", i, new Date().toISOString());
      try {
        const response = await fetch(url);
        const json: R = await response.json();
        if (json.status !== "OK") {
          await wait(backoff * i);
          continue;
        }
        if ("validity" in json && json.validity !== "OK") {
          await wait(backoff * i);
          continue;
        }
        // Api needs new token after x amount of time (?)
        if ("data" in json && json.data.length === 0) {
          console.log("- Data is empty, getting new token");
          await wait(backoff * i);
          await refreshToken();
        }
        return Promise.resolve(json);
      } catch (error) {
        console.log("- Error");
        console.error(error);
        await wait(backoff * i);
      }
    }
    return Promise.reject("Failed to execute command");
  }

  public async execute<
    R extends TargetResponse | ItinerariesResponse | RoutingResponse
  >(command: ApiCommand): Promise<{ data: R; cached: boolean }> {
    const uuid = Math.random().toString(36).substring(7);
    console.log(
      uuid,
      "Executing command: " + command.getName(),
      command.useCache()
    );

    if (command.useCache()) {
      const cachedResponse = await this.redisCli.get<R>(command.getName());

      if (cachedResponse !== null) {
        console.log(uuid, "Using cached response");
        return { data: cachedResponse, cached: true };
      }
    }

    let token = await this.getToken();
    console.log(uuid, "Token:", token);
    if (command.needsToken() && !token) {
      console.log(uuid, "No token, getting new token");
      await refreshToken();
      token = await this.getToken();
    }

    const url = command.getRequestUrl(token);
    console.log(uuid, "Live response:", url);

    const json = await this.executeRequest<R>(url);

    if (!json) {
      throw new Error("Failed to execute command");
    }

    await this.saveToken(json.source);

    if (command.useCache()) {
      console.log(uuid, "Cache response");
      await this.cacheCommandResponse(command.getName(), json);
    }

    return { data: json, cached: false };
  }
}
