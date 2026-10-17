// The Italian texts, and through `Messages` the shape every language follows.
// Texts with values are functions: each language builds its own sentence.
export const it = {
  meta: {
    description: "Partenze in tempo reale dei bus TPL di Lugano",
  },
  manifest: {
    nearMe: {
      name: "Fermate vicino a me",
      shortName: "Vicino a me",
      description: "Le fermate più vicine alla tua posizione",
    },
    journey: {
      name: "Tragitto",
      shortName: "Tragitto",
      description: "Cerca un collegamento tra due fermate",
    },
    timer: {
      name: "Timer",
      shortName: "Timer",
      description: "Quando uscire per prendere il bus",
    },
  },
  nav: {
    label: "Vista",
    list: "Lista",
    map: "Mappa",
    journey: "Tragitto",
  },
  footer: {
    disclaimer:
      "App non ufficiale, non affiliata a Trasporti Pubblici Luganesi (TPL). Orari e posizioni vengono dai dati in tempo reale di TPL e, per i tragitti, da transport.opendata.ch: possono essere imprecisi, verifica sempre alla fermata.",
    createdBy: "Creato da",
    language: "Lingua",
  },
};

export type Messages = typeof it;
