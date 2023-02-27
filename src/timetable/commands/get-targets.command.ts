import { Target } from "../models";
import { ApiCommand } from "./api.command";

export class GetTargets extends ApiCommand {
  static readonly NAME = "get_targets";

  constructor() {
    super(GetTargets.NAME);
  }

  public needsToken() {
    return false;
  }

  public useCache() {
    return true;
  }
}

// http://bs.tplsa.ch/RTPI/rtpi?data=%7Bsource%3A%227B1D7F37886C278A97882D1ACA4C5084%22%2Cdestination%3A0%2Ctype%3AGETITINERARIES%2Cdata%3A%257B%2522parameters%2522%253A%255B631%252C385%255D%257D%7D
// http://bs.tplsa.ch/RTPI/rtpi?data=%7Bsource%3A%224F0918AE52577C097C5F09EC36503CEF%22%2Cdestination%3A0%2Ctype%3AGETITINERARIES%2Cdata%3A%7Bparameters%3A%5B475%2C476%5D%7D%7D
