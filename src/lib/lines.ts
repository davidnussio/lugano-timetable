// Background colors of the TPL lines, keyed by RTPI route id: they tint the
// route timeline, and the badges until the colors of the server are loaded.
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
