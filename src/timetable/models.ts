export enum RoutingStatus {
  FeatureStation = 0,
  CurrentStation = 1,
  PassedStation = 2,
}

// http://bs.tplsa.ch/RTPI/rtpi?data=%7Bsource%3A%221CD6A938DCC3352AFEE32F999EA75FCC%22%2Ctype%3AEXIT%7D&_=1677068700318
export interface ApiResponse<T> {
  status: string;
  type: string;
  source: string;
  data: T[];
  sessionId: string;
}

export interface Target {
  Name: string;
  Identifiers: string[];
  Codes: string[];
  Label: string;
}

export interface TargetResponse extends ApiResponse<Target> {}

// Fermata
// http://bs.tplsa.ch/RTPI/rtpi?data=%7Bsource%3A%22223117F924B0195F08858D21059372D5%22%2Cdestination%3A0%2Ctype%3AGET_ITINERARIES%2Cdata%3A%7Bparameters%3A%5B475%2C476%5D%7D%7D&_=1677066372095

export interface Itineraries {
  Dest: string;
  Routing: string;
  Dir: string;
  Stall: string;
  Pred: number;
  RouteCode: string;
  Img: string;
  Route: string;
  Time: string;
  Target: string;
  FromTarget: number;
  ToTarget: number;
}
export interface ItinerariesResponse extends ApiResponse<Itineraries> {
  validity: string;
}

// data: {source:"DB18A712A667797BB3AFF2F537532542",destination:0,type:GETROUTING,data:{parameters:[478,23,2,183]}}
export interface Routing {
  Status: RoutingStatus;
  UID: string;
  Code: string;
  Time: string;
  Pred: number;
}

export interface RoutingResponse extends ApiResponse<Routing> {
  validity: string;
  lastcom: string;
  vehicle: string;
  delay: string;
  itinerary: string;
}

// IdentifierMap = {id: Target}
