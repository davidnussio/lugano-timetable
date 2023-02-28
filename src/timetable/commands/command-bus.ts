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
    for (let i = 0; i < 3; i++) {
      console.log("- Attempt", i, new Date().toISOString());
      try {
        const response = await fetch(url);
        const json: R = await response.json();
        if (json.status !== "OK") {
          await wait(1000);
          continue;
        }
        if ("validity" in json && json.validity !== "OK") {
          await wait(1000);
          continue;
        }
        // Api needs new token after x amount of time (?)
        if ("data" in json && json.data.length === 0) {
          console.log("- Data is empty, getting new token");
          await wait(1000);
          await refreshToken();
        }
        return Promise.resolve(json);
      } catch (error) {
        console.log("- Error");
        console.error(error);
        await wait(1000);
      }
    }
    return Promise.reject("Failed to execute command");
  }

  public async execute<
    R extends TargetResponse | ItinerariesResponse | RoutingResponse
  >(command: ApiCommand): Promise<{ data: R; cached: boolean }> {
    console.log("Executing command: " + command.getName());

    if (command.useCache()) {
      const cachedResponse = await this.redisCli.get<R>(command.getName());

      if (cachedResponse !== null) {
        console.log("Using cached response");
        return { data: cachedResponse, cached: true };
      }
    }

    const token = await this.getToken();

    if (command.needsToken() && !token) {
      console.log("No token, getting new token");
      await refreshToken();
    }

    const url = command.getRequestUrl(token);
    console.log("Live response:", url);

    const json = await this.executeRequest<R>(url);

    if (!json) {
      throw new Error("Failed to execute command");
    }

    await this.saveToken(json.source);

    if (command.useCache()) {
      console.log("Cache response");
      await this.cacheCommandResponse(command.getName(), json);
    }

    return { data: json, cached: false };
  }
}
