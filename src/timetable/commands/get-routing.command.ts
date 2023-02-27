import { ApiCommand } from "./api.command";

export class GetRouting extends ApiCommand {
  static readonly NAME = "get_routing";

  constructor(data: Record<string, number[]> = {}) {
    super(GetRouting.NAME, data);
  }
}
