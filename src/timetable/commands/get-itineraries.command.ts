import { Target } from "../models";
import { ApiCommand } from "./api.command";

export class GetItineraries extends ApiCommand {
  static readonly NAME = "get_itineraries";

  constructor(data: Record<string, number[]> = {}) {
    super(GetItineraries.NAME, data);
  }
}
