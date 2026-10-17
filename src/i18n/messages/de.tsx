import type { Messages } from "./it";

// Swiss Standard German: "ss", never "ß".
// Glossary: fermata → Haltestelle, partenze → Abfahrten, tragitto →
// Verbindung, coincidenza → Anschluss, esci tra → Losgehen in
export const de: Messages = {
  meta: {
    description: "Echtzeit-Abfahrten der TPL-Busse in Lugano",
  },
  manifest: {
    nearMe: {
      name: "Haltestellen in meiner Nähe",
      shortName: "In der Nähe",
      description: "Die nächsten Haltestellen von deinem Standort aus",
    },
    journey: {
      name: "Verbindung",
      shortName: "Verbindung",
      description: "Eine Verbindung zwischen zwei Haltestellen suchen",
    },
    timer: {
      name: "Timer",
      shortName: "Timer",
      description: "Wann du losgehen musst, um den Bus zu erwischen",
    },
  },
  nav: {
    label: "Ansicht",
    list: "Liste",
    map: "Karte",
    journey: "Verbindung",
  },
  footer: {
    disclaimer:
      "Inoffizielle App, nicht verbunden mit den Trasporti Pubblici Luganesi (TPL). Fahrzeiten und Positionen stammen aus den Echtzeitdaten der TPL und, für Verbindungen, von transport.opendata.ch: Sie können ungenau sein, prüfe sie immer an der Haltestelle.",
    createdBy: "Erstellt von",
    language: "Sprache",
  },
};
