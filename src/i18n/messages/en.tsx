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
    unofficial: "Unofficial app, not affiliated with TPL",
    privacy: "Privacy",
    createdBy: "Made by",
    language: "Language",
  },
};
