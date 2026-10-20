import type { ReactNode } from "react";

const decimal = new Intl.NumberFormat("it", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  useGrouping: false,
});

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
    unofficial: "App non ufficiale, non affiliata a TPL",
    privacy: "Privacy",
    createdBy: "Creato da",
    language: "Lingua",
  },
  common: {
    back: "Indietro",
    close: "Chiudi",
    loading: "Caricamento",
    live: "In tempo reale",
    reconnecting: "Riconnessione…",
    line: (line?: string) => (line ? `Linea ${line}` : "Linea"),
    delay: "Ritardo",
    delayMinutes: (minutes: number) => `Ritardo ${minutes} min`,
    timerOn: "Timer attivo",
    openTimer: "Apri il timer",
    startTimer: (line: string, time: string) => `Avvia timer per la linea ${line} delle ${time}`,
    noDeparturesSoon: "Nessuna partenza nei prossimi minuti",
    serviceUnavailable: "Servizio non disponibile, nuovo tentativo in corso…",
    journeyFromHere: "Tragitto da qui",
    nearMe: "Vicino a me",
    locating: "Localizzazione…",
    locationDenied: "Posizione non autorizzata",
    locationUnavailable: "Posizione non disponibile",
    dismissAlert: "Chiudi avviso",
  },
  timetable: {
    open: "Orario della fermata",
    title: "Orario",
    description: "Consulta gli orari aggiornati per la fermata del bus.",
    unavailable: "Orario non disponibile",
  },
  stops: {
    title: "Fermate",
    search: "Cerca una fermata",
    clearSearch: "Cancella ricerca",
    favorites: "Preferiti",
    nearest: "Più vicine",
    all: "Tutte le fermate",
    noResults: (search: string) => `Nessuna fermata per “${search}”`,
    now: "Adesso",
    ridesHintTitle: "Corse preferite:",
    ridesHint:
      "apri una linea dalla sua fermata e tocca la stella, qui vedrai subito le prossime partenze.",
    closeHint: "Chiudi il suggerimento",
    then: "poi",
    unavailable: "Non disponibile",
    noDepartures: "Nessuna partenza",
  },
  stop: {
    title: "Fermata",
    addFavorite: "Aggiungi ai preferiti",
    removeFavorite: "Rimuovi dai preferiti",
    nextDepartures: "Prossime partenze",
    walk: (minutes: number) => `circa ${minutes} min a piedi`,
    filterByLine: "Filtra per linea",
    allLines: "Tutte",
    lineNotRunning: (line: string) => `Linea ${line}, nessuna partenza ora`,
    noDeparturesOfLine: (line: string) => `Nessuna partenza della linea ${line} nei prossimi minuti`,
    noDeparturesOfLines: "Nessuna partenza delle linee scelte nei prossimi minuti",
    showAllLines: "Mostra tutte le linee",
    fallbackSource: "Dati di riserva da transport.opendata.ch",
    platform: (platform: string) => `Corsia ${platform}`,
  },
  routing: {
    title: "Percorso",
    addRide: "Aggiungi la corsa ai preferiti",
    removeRide: "Rimuovi la corsa dai preferiti",
    getOffChosen: (stop: string) => `Scendi a ${stop}: tocca di nuovo la fermata per annullare`,
    getOffHint: "Tocca la fermata dove scendi: ti avviseremo prima di arrivare",
    showPassed: (stops: number) =>
      stops === 1 ? "Mostra la fermata precedente" : `Mostra ${stops} fermate precedenti`,
    atOrigin: (stop: string) => `Al capolinea ${stop}`,
    atStop: (stop: string) => `Alla fermata ${stop}`,
    headingTo: (stop: string) => `In viaggio verso ${stop}`,
    atTerminus: "Arrivato al capolinea",
    gone: "Bus già passato",
    here: "Il bus è qui",
    arrivesIn: (minutes: number) => `Arriva tra ${minutes} min`,
    arriving: "In arrivo",
    nextStop: "prossima fermata",
    stopsAway: (stops: number) => (stops === 1 ? "1 fermata da te" : `${stops} fermate da te`),
    busMoving: "Bus in viaggio",
    busAtStop: "Bus alla fermata",
    yourStop: "La tua fermata",
    getOffAt: (stop: string) => `Scendo a ${stop}`,
    getOffHere: "Scendo qui",
  },
  journey: {
    title: "Tragitto",
    from: "Da",
    to: "A",
    fromPlaceholder: "Partenza",
    toPlaceholder: "Destinazione",
    closeSearch: "Chiudi ricerca",
    swap: "Inverti partenza e destinazione",
    unavailable: "Orari non disponibili, nuovo tentativo in corso…",
    noConnections: "Nessun collegamento trovato",
    pages: "Pagine dei collegamenti",
    earlier: "Prima",
    now: "Adesso",
    later: "Più tardi",
    source:
      "Orari e ritardi da transport.opendata.ch. Tocca la campanella per seguire il tragitto con il timer.",
    recent: "Recenti",
    intro:
      "Scegli partenza e destinazione: anche con cambi, treni e bus regionali. Il timer ti dirà quando uscire e se le coincidenze reggono.",
    fromStop: (stop: string) => `da ${stop}`,
    transfers: (transfers: number) =>
      transfers === 0 ? "diretto" : transfers === 1 ? "1 cambio" : `${transfers} cambi`,
    atRisk: "Coincidenza a rischio",
    startTimer: (time: string) => `Avvia timer per il tragitto delle ${time}`,
    walk: (minutes: number) => `A piedi ${minutes} min`,
    towards: (destination: string) => `direzione ${destination}`,
    nearYou: "Vicino a te",
    favoriteStops: "Fermate preferite",
    searchUnavailable: "Ricerca non disponibile, riprova tra poco",
    searching: "Ricerca…",
    noStops: "Nessuna fermata trovata",
    typeHint: "Scrivi il nome di una fermata o di una stazione",
    // When to search, and the journeys saved
    leave: "Parti",
    arrive: "Arriva",
    departAt: "Partenza",
    arriveBy: "Arrivo entro",
    whenNow: "adesso",
    today: "Oggi",
    tomorrow: "Domani",
    time: "Orario",
    saveFavorite: "Salva tra i preferiti",
    removeFavorite: "Togli dai preferiti",
  },
  timer: {
    title: "Timer",
    paces: { slow: "Con calma", normal: "Normale", fast: "Di fretta" },
    learningPace: (walks: number, needed: number) => `Sto imparando il tuo passo (${walks}/${needed})`,
    measuredPace: "Passo misurato:",
    walks: (walks: number) => (walks === 1 ? "1 percorso" : `${walks} percorsi`),
    resetPace: "Azzera",
    end: "Termina timer",
    cancel: "Annulla timer",
    none: "Nessun timer attivo",
    noneHint:
      "Apri una fermata e tocca la campanella accanto a una partenza: ti avviseremo quando è ora di uscire.",
    chooseStop: "Scegli una fermata",
    backToTimer: "Torna al timer",
    busIn: "Bus tra",
    margin: "Margine",
    departure: "Partenza",
    onFoot: "A piedi",
    arrived: "Arrivato",
    fromAt: (stop: string, time: ReactNode) => (
      <>
        da {stop} · alle {time}
      </>
    ),
    live: "Live",
    lastData: "Ultimo dato",
    busLeft: "Il bus è partito",
    busComing: "Il bus sta arrivando",
    farFromStop: (distance: string) => `Sei a ${distance} dalla fermata`,
    atYourStop: (stop: string) => `Sei alla fermata ${stop}`,
    atStop: (stop: string) => `alla fermata ${stop}`,
    busInClock: (clock: string) => `Bus tra ${clock}`,
    nextAlert: (clock: ReactNode, minutes: number, walking: boolean) => (
      <>
        Prossimo avviso tra {clock}
        {minutes === 0
          ? walking
            ? ", quando devi uscire"
            : ", alla partenza"
          : `, a ${minutes} min ${walking ? "dall'uscita" : "dalla partenza"}`}
      </>
    ),
    whenToLeave: "Calcola quando uscire",
    stopPositionUnavailable: "Posizione della fermata non disponibile",
    useGpsHint: "Usa il GPS per stimare il tempo a piedi fino alla fermata",
    locationDeniedBrowser: "Posizione non autorizzata nelle impostazioni del browser",
    accuracy: (meters: number) => `Precisione ±${meters} m`,
    locating: "Localizzazione in corso…",
    useMyLocation: "Usa la mia posizione",
    keepOpen: "Tieni aperta l'app: lo schermo resta acceso e gli avvisi arrivano puntuali.",
    whereIsBus: "Dov'è il bus?",
    suggestedMargin: (minutes: number) =>
      `Margine consigliato ${minutes} min: il bus può recuperare il ritardo`,
    getOffAt: (stop: string) => `Scendi a ${stop}`,
    whereGetOff: "Dove scendi?",
    arrivalAt: (time: string) => `Arrivo alle ${time}`,
    arrivedAt: (time: string) => `Arrivato alle ${time}`,
    willAlert: "ti avviseremo",
    chooseGetOff: "Scegli la fermata, ti avviseremo prima",
    towards: (destination: string) => `verso ${destination}`,
    farFrom: (distance: string, stop: string) => `a ${distance} da ${stop}`,
    distanceFrom: (distance: string, stop: string) => `${distance} da ${stop}`,
    accuracyFrom: (distance: string, accuracy: number, stop: string) =>
      `${distance} (±${accuracy} m) da ${stop}`,
    missingMinutes: (minutes: number) => `mancano ${minutes} min`,
    spareMinutes: (minutes: number) => `${minutes} min di margine`,
    noSpare: "nessun margine",
    expectedArrival: (time: ReactNode) => <>Arrivo previsto alle {time}</>,
    tight: "Stretta",
    atRisk: "A rischio",
    changeAt: (stop: string) => `Cambio a ${stop}`,
    walkMinutes: (minutes: number) => `${minutes} min a piedi`,
    alternativeFrom: (stop: string) => `Alternativa da ${stop}`,
    alternativeTimes: (departure: ReactNode, arrival: ReactNode) => (
      <>
        alle {departure}, arrivo {arrival}
      </>
    ),
    useThisRoute: "Usa questo percorso",
    leaveLater: "Puoi uscire più tardi",
    laterPlan: (line: string, departure: ReactNode, arrival: ReactNode) => (
      <>
        Linea {line} alle {departure}, arrivo alle {arrival}
      </>
    ),
    useThis: "Usa questo",
    nextBus: (line: string, destination: string) => `Prossimo ${line} per ${destination}`,
    nextBusAt: (time: ReactNode, minutes: number) => (
      <>
        alle {time} · tra {minutes} min
      </>
    ),
    switchBus: "Passa a questo bus",
    // The trip so far, above the countdown
    trip: "Il tuo viaggio",
    tripTotal: (duration: string) => `Totale ${duration}`,
    stepWalk: (stop: string) => `A piedi fino a ${stop}`,
    stepWait: (stop: string) => `Attesa a ${stop}`,
    stepRide: (stop: string) => `Fino a ${stop}`,
    ongoing: (duration: string) => `in corso da ${duration}`,
    departedLate: (minutes: number) => `${minutes} min di ritardo`,
    departedEarly: (minutes: number) => `${minutes} min in anticipo`,
    onTime: "puntuale",
    // Where the map leads once on board
    boardAt: (stop: string) => `Sali a ${stop}`,
    destinationAt: (stop: string) => `Arrivo a ${stop}`,
    fromYou: (distance: string) => `a ${distance} da te`,
    // Under the countdown once on board
    arrival: "Arrivo",
    delay: "Ritardo",
    stops: "Fermate",
    duration: "Durata",
    punctual: "Puntuale",
  },
  notifications: {
    title: "Notifiche",
    granted: "Avvisi sempre più frequenti man mano che si avvicina l'ora",
    denied: "Bloccate: tocca per vedere come riattivarle",
    unsupported: "Su iPhone aggiungi l'app alla schermata Home per riceverle",
    ask: "Ricevi un avviso anche con l'app in secondo piano",
    enable: "Attiva",
    cannotAskAgain:
      "Il browser non lascia all'app chiedere di nuovo il permesso: va dato dalle impostazioni.",
    chooseAllow:
      'Scegli Consenti: lasciare "Chiedi" non basta se il browser ha bloccato il sito per qualche giorno. Poi torna qui, la scheda si aggiorna da sola.',
    androidInstalled: (host: string) =>
      `Apri ${host} in Chrome: l'app installata usa le autorizzazioni di Chrome.`,
    androidSiteIcon:
      "Tocca l'icona a sinistra dell'indirizzo, poi Autorizzazioni → Notifiche → Consenti.",
    androidSiteSettings: (host: string) =>
      `Se non compare: menu ⋮ → Impostazioni → Impostazioni sito → Notifiche → ${host} → Consenti.`,
    androidChrome:
      "Controlla che Chrome possa inviare notifiche: Impostazioni Android → App → Chrome → Notifiche.",
    ios: "Apri Impostazioni → Notifiche → Lugano Bus e attiva Consenti notifiche.",
    desktopSiteIcon: "Clicca sull'icona a sinistra dell'indirizzo, poi Notifiche → Consenti.",
    desktopReload: "Ricarica la pagina.",
  },
  map: {
    title: "Mappa",
    otherOperators: "Mostra anche le fermate degli altri operatori",
    loading: "Caricamento…",
    unavailable: "Partenze non disponibili",
    departures: "Partenze",
    // The companies with a name in each language: the others keep theirs
    operator: (name: string) => name,
    // The labels of the buttons of MapLibre, English by default
    controls: {
      "Map.Title": "Mappa",
      "NavigationControl.ZoomIn": "Ingrandisci",
      "NavigationControl.ZoomOut": "Riduci",
      "NavigationControl.ResetBearing": "Trascina per ruotare la mappa, tocca per tornare a nord",
      "GeolocateControl.FindMyLocation": "Trova la mia posizione",
      "GeolocateControl.LocationNotAvailable": "Posizione non disponibile",
      "AttributionControl.ToggleAttribution": "Mostra o nascondi i crediti",
      "AttributionControl.MapFeedback": "Segnala un problema della mappa",
      "Popup.Close": "Chiudi",
    },
  },
  format: {
    now: "ora",
    // "4,7": one decimal, with the comma used so far
    decimal: (value: number) => decimal.format(value),
  },
  // What slows down the walk, at the start of a sentence…
  weather: { ice: "Ghiaccio", snow: "Neve", heavyRain: "Pioggia forte", rain: "Pioggia" },
  // …and within one
  weatherInline: { ice: "ghiaccio", snow: "neve", heavyRain: "pioggia forte", rain: "pioggia" },
  alerts: {
    bus: (line: string, destination: string) => `Linea ${line} per ${destination}`,
    busDeparts: (minutes: number) =>
      minutes <= 0 ? "Il bus sta arrivando" : `Il bus parte tra ${minutes} min`,
    busDepartsInline: (minutes: number) =>
      minutes <= 0 ? "il bus sta arrivando" : `il bus parte tra ${minutes} min`,
    onFoot: (minutes: number, weather?: string) =>
      `${minutes} min a piedi${weather ? ` (${weather})` : ""}`,
    leaveIn: (minutes: number) => `Esci tra ${minutes} min`,
    leaveNow: "Esci ora",
    late: (minutes: number) => `In ritardo di ${minutes} min: affrettati!`,
    nextStop: (stop: string) => `Prossima fermata: ${stop}`,
    getReady: (bus: string) => `Preparati a scendere · ${bus}`,
    getOffNow: (stop: string) => `Scendi ora a ${stop}`,
    tightTransfer: (stop: string) => `Coincidenza stretta a ${stop}`,
    noSpare: "nessun margine, affrettati",
    transferAtRisk: (stop: string) => `Coincidenza a rischio a ${stop}`,
    lateBy: (minutes: number) => `in ritardo di ${minutes} min`,
    nextLine: (line: string, time: string, later: number) =>
      `Prossima linea ${line} alle ${time}, arrivo ${later > 0 ? `+${later} min` : "invariato"}`,
  },
  // The main line of the timer, followed by the countdown
  headline: {
    busGone: "Bus partito",
    busIn: "Bus tra",
    departsIn: "Parte tra",
    arriving: "In arrivo",
    atStopIn: "Alla fermata tra",
    leaveIn: "Esci tra",
    lateBy: "In ritardo di",
    arrivedAt: (stop: string) => `Arrivato a ${stop}`,
    getOffIn: (stop: string) => `Scendi a ${stop} tra`,
    arrivingAt: (stop: string) => `In arrivo a ${stop}`,
    arrived: "Arrivato",
    lineIn: (line: string) => `Linea ${line} tra`,
    arrivalIn: "Arrivo tra",
    destinationIn: "A destinazione tra",
  },
  // What is left of the ride, at the start of a sentence…
  ride: {
    headingTo: (stop: string) => `In viaggio verso ${stop}`,
    busLeft: "Il bus ha lasciato la fermata",
    busAtStop: "Il bus è alla fermata",
    nextStop: "Prossima fermata",
    stopsLeft: (stops: number) => `Ancora ${stops} fermate`,
  },
  // …and within one
  rideInline: {
    headingTo: (stop: string) => `in viaggio verso ${stop}`,
    busLeft: "il bus ha lasciato la fermata",
    busAtStop: "il bus è alla fermata",
    nextStop: "prossima fermata",
    stopsLeft: (stops: number) => `ancora ${stops} fermate`,
  },
  reliability: {
    onTime: "Di solito parte in orario",
    late: (minutes: number) => `Di solito parte con +${minutes} min`,
    early: (minutes: number) => `Di solito parte ${minutes} min prima`,
    within: (minutes: number) => `80% entro +${minutes} min`,
    allOnTime: "80% in orario",
    days: (days: number) => `(${days} giorni)`,
  },
};

export type Messages = typeof it;
