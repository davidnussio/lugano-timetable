import type { Messages } from "./it";

// British English. Glossary: fermata → stop, partenze → departures,
// tragitto → journey, coincidenza → connection, esci tra → leave in
export const en: Messages = {
  meta: {
    description: "Real-time departures of the TPL buses in Lugano",
  },
  manifest: {
    nearMe: {
      name: "Stops near me",
      shortName: "Near me",
      description: "The stops closest to where you are",
    },
    journey: {
      name: "Journey",
      shortName: "Journey",
      description: "Find a connection between two stops",
    },
    timer: {
      name: "Timer",
      shortName: "Timer",
      description: "When to leave to catch the bus",
    },
  },
  nav: {
    label: "View",
    list: "List",
    map: "Map",
    journey: "Journey",
  },
  footer: {
    disclaimer:
      "Unofficial app, not affiliated with Trasporti Pubblici Luganesi (TPL). Times and positions come from TPL's real-time data and, for journeys, from transport.opendata.ch: they may be inaccurate, always check at the stop.",
    createdBy: "Made by",
    language: "Language",
  },
};
