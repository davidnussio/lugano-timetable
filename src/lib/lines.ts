// Background colors of the TPL line badges (bs.tplsa.ch/images/routes),
// keyed by RTPI route id. Used to tint the route timeline.
const LINE_COLORS: Record<string, string> = {
  "2": "#F36F23",
  "19": "#C62525",
  "20": "#942B7B",
  "21": "#ED7735",
  "22": "#9A6C58",
  "23": "#005F9A",
  "24": "#C5D668",
  "25": "#C5D668",
  "26": "#C5D668",
  "27": "#0081B8",
  "28": "#6CB64D",
  "29": "#FEC43B",
  "30": "#C5D668",
  "31": "#C5D668",
  "32": "#6C689E",
  "33": "#009F4F",
  "35": "#C5D668",
  "36": "#C5D668",
};

export function lineColor(route: string): string {
  return LINE_COLORS[route] ?? "var(--primary)";
}

// The badge image of a route, from the itinerary `Img` ("20.jpg") or the id
export function lineImage(imgOrRoute: string): string {
  const name = imgOrRoute.includes(".")
    ? imgOrRoute.replace(".jpg", ".png")
    : `${imgOrRoute}.png`;
  return `http://bs.tplsa.ch/images/routes/${name}`;
}
