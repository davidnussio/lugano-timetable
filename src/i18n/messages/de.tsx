import type { ReactNode } from "react";
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
    unofficial: "Inoffizielle App, nicht mit den TPL verbunden",
    privacy: "Datenschutz",
    createdBy: "Erstellt von",
    language: "Sprache",
  },
  common: {
    back: "Zurück",
    close: "Schliessen",
    loading: "Wird geladen",
    live: "Echtzeit",
    reconnecting: "Neu verbinden…",
    line: (line?: string) => (line ? `Linie ${line}` : "Linie"),
    delay: "Verspätung",
    delayMinutes: (minutes: number) => `Verspätung ${minutes} min`,
    timerOn: "Timer aktiv",
    openTimer: "Timer öffnen",
    startTimer: (line: string, time: string) => `Timer für Linie ${line} um ${time} starten`,
    noDeparturesSoon: "Keine Abfahrten in den nächsten Minuten",
    serviceUnavailable: "Dienst nicht verfügbar, neuer Versuch läuft…",
    journeyFromHere: "Verbindung ab hier",
    nearMe: "In der Nähe",
    locating: "Standort wird ermittelt…",
    locationDenied: "Standort nicht erlaubt",
    locationUnavailable: "Standort nicht verfügbar",
    dismissAlert: "Hinweis schliessen",
  },
  timetable: {
    open: "Fahrplan der Haltestelle",
    title: "Fahrplan",
    description: "Die aktuellen Fahrzeiten an dieser Bushaltestelle.",
    unavailable: "Fahrplan nicht verfügbar",
  },
  stops: {
    title: "Haltestellen",
    search: "Haltestelle suchen",
    clearSearch: "Suche löschen",
    favorites: "Favoriten",
    nearest: "Am nächsten",
    all: "Alle Haltestellen",
    noResults: (search: string) => `Keine Haltestelle für «${search}»`,
    now: "Jetzt",
    ridesHintTitle: "Lieblingsfahrten:",
    ridesHint:
      "Öffne eine Linie an ihrer Haltestelle und tippe auf den Stern, dann siehst du hier gleich die nächsten Abfahrten.",
    closeHint: "Tipp schliessen",
    then: "dann",
    unavailable: "Nicht verfügbar",
    noDepartures: "Keine Abfahrt",
  },
  stop: {
    title: "Haltestelle",
    addFavorite: "Zu den Favoriten hinzufügen",
    removeFavorite: "Aus den Favoriten entfernen",
    nextDepartures: "Nächste Abfahrten",
    walk: (minutes: number) => `etwa ${minutes} min zu Fuss`,
    filterByLine: "Nach Linie filtern",
    allLines: "Alle",
    lineNotRunning: (line: string) => `Linie ${line}, jetzt keine Abfahrt`,
    noDeparturesOfLine: (line: string) =>
      `Keine Abfahrten der Linie ${line} in den nächsten Minuten`,
    noDeparturesOfLines: "Keine Abfahrten der gewählten Linien in den nächsten Minuten",
    showAllLines: "Alle Linien anzeigen",
    fallbackSource: "Ersatzdaten von transport.opendata.ch",
    platform: (platform: string) => `Kante ${platform}`,
  },
  routing: {
    title: "Strecke",
    addRide: "Fahrt zu den Favoriten hinzufügen",
    removeRide: "Fahrt aus den Favoriten entfernen",
    getOffChosen: (stop: string) =>
      `Ausstieg in ${stop}: tippe nochmals auf die Haltestelle, um ihn aufzuheben`,
    getOffHint: "Tippe auf die Haltestelle, an der du aussteigst: Wir melden uns vor der Ankunft",
    showPassed: (stops: number) =>
      stops === 1 ? "Vorherige Haltestelle anzeigen" : `${stops} vorherige Haltestellen anzeigen`,
    atOrigin: (stop: string) => `An der Endhaltestelle ${stop}`,
    atStop: (stop: string) => `An der Haltestelle ${stop}`,
    headingTo: (stop: string) => `Unterwegs nach ${stop}`,
    atTerminus: "An der Endhaltestelle angekommen",
    gone: "Bus schon vorbei",
    here: "Der Bus ist da",
    arrivesIn: (minutes: number) => `Kommt in ${minutes} min`,
    arriving: "Fährt ein",
    nextStop: "nächste Haltestelle",
    stopsAway: (stops: number) =>
      stops === 1 ? "1 Haltestelle entfernt" : `${stops} Haltestellen entfernt`,
    busMoving: "Bus unterwegs",
    busAtStop: "Bus an der Haltestelle",
    yourStop: "Deine Haltestelle",
    getOffAt: (stop: string) => `Ausstieg in ${stop}`,
    getOffHere: "Hier aussteigen",
  },
  journey: {
    title: "Verbindung",
    from: "Von",
    to: "Nach",
    fromPlaceholder: "Start",
    toPlaceholder: "Ziel",
    closeSearch: "Suche schliessen",
    swap: "Start und Ziel tauschen",
    unavailable: "Fahrzeiten nicht verfügbar, neuer Versuch läuft…",
    noConnections: "Keine Verbindung gefunden",
    pages: "Seiten der Verbindungen",
    earlier: "Früher",
    now: "Jetzt",
    later: "Später",
    source:
      "Fahrzeiten und Verspätungen von transport.opendata.ch. Tippe auf die Glocke, um die Verbindung mit dem Timer zu verfolgen.",
    recent: "Zuletzt",
    intro:
      "Wähle Start und Ziel: auch mit Umsteigen, Zügen und Regionalbussen. Der Timer sagt dir, wann du losgehen musst und ob die Anschlüsse klappen.",
    fromStop: (stop: string) => `ab ${stop}`,
    transfers: (transfers: number) =>
      transfers === 0 ? "direkt" : transfers === 1 ? "1 Umstieg" : `${transfers} Umstiege`,
    atRisk: "Anschluss gefährdet",
    startTimer: (time: string) => `Timer für die Verbindung um ${time} starten`,
    walk: (minutes: number) => `${minutes} min zu Fuss`,
    towards: (destination: string) => `Richtung ${destination}`,
    nearYou: "In deiner Nähe",
    favoriteStops: "Lieblingshaltestellen",
    searchUnavailable: "Suche nicht verfügbar, versuche es gleich nochmals",
    searching: "Suche…",
    noStops: "Keine Haltestelle gefunden",
    typeHint: "Gib den Namen einer Haltestelle oder eines Bahnhofs ein",
  },
  timer: {
    title: "Timer",
    paces: { slow: "Gemütlich", normal: "Normal", fast: "Eilig" },
    learningPace: (walks: number, needed: number) => `Ich lerne dein Tempo (${walks}/${needed})`,
    measuredPace: "Gemessenes Tempo:",
    walks: (walks: number) => (walks === 1 ? "1 Weg" : `${walks} Wege`),
    resetPace: "Zurücksetzen",
    end: "Timer beenden",
    cancel: "Timer abbrechen",
    none: "Kein Timer aktiv",
    noneHint:
      "Öffne eine Haltestelle und tippe auf die Glocke neben einer Abfahrt: Wir melden uns, wenn es Zeit ist loszugehen.",
    chooseStop: "Haltestelle wählen",
    backToTimer: "Zurück zum Timer",
    busIn: "Bus in",
    margin: "Reserve",
    departure: "Abfahrt",
    onFoot: "Zu Fuss",
    arrived: "Angekommen",
    fromAt: (stop: string, time: ReactNode) => (
      <>
        ab {stop} · um {time}
      </>
    ),
    live: "Live",
    lastData: "Letzter Stand",
    busLeft: "Der Bus ist abgefahren",
    busComing: "Der Bus fährt ein",
    farFromStop: (distance: string) => `Du bist ${distance} von der Haltestelle entfernt`,
    atYourStop: (stop: string) => `Du bist an der Haltestelle ${stop}`,
    atStop: (stop: string) => `an der Haltestelle ${stop}`,
    busInClock: (clock: string) => `Bus in ${clock}`,
    nextAlert: (clock: ReactNode, minutes: number, walking: boolean) => (
      <>
        Nächster Hinweis in {clock}
        {minutes === 0
          ? walking
            ? ", wenn du losgehen musst"
            : ", bei der Abfahrt"
          : `, ${minutes} min ${walking ? "bevor du losgehen musst" : "vor der Abfahrt"}`}
      </>
    ),
    whenToLeave: "Berechnen, wann du losgehen musst",
    stopPositionUnavailable: "Standort der Haltestelle nicht verfügbar",
    useGpsHint: "Schätzt mit GPS die Gehzeit bis zur Haltestelle",
    locationDeniedBrowser: "Standort in den Browser-Einstellungen nicht erlaubt",
    accuracy: (meters: number) => `Genauigkeit ±${meters} m`,
    locating: "Standort wird ermittelt…",
    useMyLocation: "Meinen Standort verwenden",
    keepOpen:
      "Lass die App offen: Der Bildschirm bleibt an und die Hinweise kommen pünktlich.",
    whereIsBus: "Wo ist der Bus?",
    suggestedMargin: (minutes: number) =>
      `Empfohlene Reserve ${minutes} min: Der Bus kann die Verspätung aufholen`,
    getOffAt: (stop: string) => `Aussteigen in ${stop}`,
    whereGetOff: "Wo steigst du aus?",
    arrivalAt: (time: string) => `Ankunft um ${time}`,
    arrivedAt: (time: string) => `Angekommen um ${time}`,
    willAlert: "wir melden uns",
    chooseGetOff: "Wähle die Haltestelle, wir melden uns vorher",
    towards: (destination: string) => `nach ${destination}`,
    farFrom: (distance: string, stop: string) => `${distance} von ${stop}`,
    distanceFrom: (distance: string, stop: string) => `${distance} von ${stop}`,
    accuracyFrom: (distance: string, accuracy: number, stop: string) =>
      `${distance} (±${accuracy} m) von ${stop}`,
    missingMinutes: (minutes: number) => `es fehlen ${minutes} min`,
    spareMinutes: (minutes: number) => `${minutes} min Reserve`,
    noSpare: "keine Reserve",
    expectedArrival: (time: ReactNode) => <>Voraussichtliche Ankunft um {time}</>,
    tight: "Knapp",
    atRisk: "Gefährdet",
    changeAt: (stop: string) => `Umsteigen in ${stop}`,
    walkMinutes: (minutes: number) => `${minutes} min zu Fuss`,
    alternativeFrom: (stop: string) => `Alternative ab ${stop}`,
    alternativeTimes: (departure: ReactNode, arrival: ReactNode) => (
      <>
        um {departure}, Ankunft {arrival}
      </>
    ),
    useThisRoute: "Diese Verbindung nehmen",
    leaveLater: "Du kannst später losgehen",
    laterPlan: (line: string, departure: ReactNode, arrival: ReactNode) => (
      <>
        Linie {line} um {departure}, Ankunft um {arrival}
      </>
    ),
    useThis: "Nehmen",
    nextBus: (line: string, destination: string) => `Nächster ${line} nach ${destination}`,
    nextBusAt: (time: ReactNode, minutes: number) => (
      <>
        um {time} · in {minutes} min
      </>
    ),
    switchBus: "Zu diesem Bus wechseln",
  },
  notifications: {
    title: "Benachrichtigungen",
    granted: "Immer häufigere Hinweise, je näher die Zeit rückt",
    denied: "Blockiert: Tippe, um zu sehen, wie du sie wieder erlaubst",
    unsupported: "Füge die App auf dem iPhone zum Home-Bildschirm hinzu, um sie zu erhalten",
    ask: "Erhalte Hinweise auch, wenn die App im Hintergrund ist",
    enable: "Aktivieren",
    cannotAskAgain:
      "Der Browser lässt die App nicht nochmals fragen: Die Erlaubnis muss in den Einstellungen erteilt werden.",
    chooseAllow:
      "Wähle «Zulassen»: «Fragen» reicht nicht, wenn der Browser die Website für ein paar Tage blockiert hat. Komm dann hierher zurück, die Karte aktualisiert sich von selbst.",
    androidInstalled: (host: string) =>
      `Öffne ${host} in Chrome: Die installierte App verwendet die Berechtigungen von Chrome.`,
    androidSiteIcon:
      "Tippe auf das Symbol links neben der Adresse, dann Berechtigungen → Benachrichtigungen → Zulassen.",
    androidSiteSettings: (host: string) =>
      `Falls es nicht erscheint: Menü ⋮ → Einstellungen → Website-Einstellungen → Benachrichtigungen → ${host} → Zulassen.`,
    androidChrome:
      "Prüfe, ob Chrome Benachrichtigungen senden darf: Android-Einstellungen → Apps → Chrome → Benachrichtigungen.",
    ios: "Öffne Einstellungen → Mitteilungen → Lugano Bus und aktiviere «Mitteilungen erlauben».",
    desktopSiteIcon:
      "Klicke auf das Symbol links neben der Adresse, dann Benachrichtigungen → Zulassen.",
    desktopReload: "Lade die Seite neu.",
  },
  map: {
    title: "Karte",
    otherOperators: "Auch die Haltestellen der anderen Unternehmen anzeigen",
    loading: "Wird geladen…",
    unavailable: "Abfahrten nicht verfügbar",
    departures: "Abfahrten",
    operator: (name: string) => ({ AutoPostale: "PostAuto", FFS: "SBB" })[name] ?? name,
    controls: {
      "Map.Title": "Karte",
      "NavigationControl.ZoomIn": "Vergrössern",
      "NavigationControl.ZoomOut": "Verkleinern",
      "NavigationControl.ResetBearing":
        "Ziehen, um die Karte zu drehen, klicken, um nach Norden auszurichten",
      "GeolocateControl.FindMyLocation": "Meinen Standort finden",
      "GeolocateControl.LocationNotAvailable": "Standort nicht verfügbar",
      "AttributionControl.ToggleAttribution": "Quellenangaben ein- oder ausblenden",
      "AttributionControl.MapFeedback": "Feedback zur Karte",
      "Popup.Close": "Schliessen",
    },
  },
};
