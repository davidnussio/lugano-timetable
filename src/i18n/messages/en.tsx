import type { ReactNode } from "react";
import type { Messages } from "./it";

const decimal = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  useGrouping: false,
});

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
  common: {
    back: "Back",
    close: "Close",
    loading: "Loading",
    live: "Live",
    reconnecting: "Reconnecting…",
    line: (line?: string) => (line ? `Line ${line}` : "Line"),
    delay: "Delayed",
    delayMinutes: (minutes: number) => `${minutes} min late`,
    timerOn: "Timer on",
    openTimer: "Open the timer",
    startTimer: (line: string, time: string) => `Start a timer for line ${line} at ${time}`,
    noDeparturesSoon: "No departures in the next few minutes",
    serviceUnavailable: "Service unavailable, trying again…",
    journeyFromHere: "Journey from here",
    nearMe: "Near me",
    locating: "Locating…",
    locationDenied: "Location not allowed",
    locationUnavailable: "Location unavailable",
    dismissAlert: "Dismiss alert",
  },
  timetable: {
    open: "Timetable of the stop",
    title: "Timetable",
    description: "The up-to-date times of this bus stop.",
    unavailable: "Timetable unavailable",
  },
  stops: {
    title: "Stops",
    search: "Search for a stop",
    clearSearch: "Clear search",
    favorites: "Favourites",
    nearest: "Nearest",
    all: "All stops",
    noResults: (search: string) => `No stops for “${search}”`,
    now: "Now",
    ridesHintTitle: "Favourite rides:",
    ridesHint: "open a line from its stop and tap the star to see its next departures right here.",
    closeHint: "Close the tip",
    then: "then",
    unavailable: "Unavailable",
    noDepartures: "No departures",
    favoriteJourneys: "Favourite journeys",
  },
  stop: {
    title: "Stop",
    addFavorite: "Add to favourites",
    removeFavorite: "Remove from favourites",
    nextDepartures: "Next departures",
    walk: (minutes: number) => `about ${minutes} min on foot`,
    filterByLine: "Filter by line",
    allLines: "All",
    lineNotRunning: (line: string) => `Line ${line}, no departures now`,
    noDeparturesOfLine: (line: string) => `No departures of line ${line} in the next few minutes`,
    noDeparturesOfLines: "No departures of the chosen lines in the next few minutes",
    showAllLines: "Show all lines",
    fallbackSource: "Backup data from transport.opendata.ch",
    platform: (platform: string) => `Platform ${platform}`,
  },
  routing: {
    title: "Route",
    addRide: "Add the ride to favourites",
    removeRide: "Remove the ride from favourites",
    getOffChosen: (stop: string) => `Getting off at ${stop}: tap the stop again to cancel`,
    getOffHint: "Tap the stop where you get off: we'll let you know before you arrive",
    showPassed: (stops: number) =>
      stops === 1 ? "Show the previous stop" : `Show the ${stops} previous stops`,
    atOrigin: (stop: string) => `At the terminus, ${stop}`,
    atStop: (stop: string) => `At ${stop}`,
    headingTo: (stop: string) => `On the way to ${stop}`,
    atTerminus: "Arrived at the terminus",
    gone: "Bus already gone",
    here: "The bus is here",
    arrivesIn: (minutes: number) => `Arrives in ${minutes} min`,
    arriving: "Arriving",
    nextStop: "next stop",
    stopsAway: (stops: number) => (stops === 1 ? "1 stop away" : `${stops} stops away`),
    busMoving: "Bus on the way",
    busAtStop: "Bus at the stop",
    yourStop: "Your stop",
    getOffAt: (stop: string) => `Get off at ${stop}`,
    getOffHere: "Getting off here",
  },
  journey: {
    title: "Journey",
    from: "From",
    to: "To",
    fromPlaceholder: "Start",
    toPlaceholder: "Destination",
    closeSearch: "Close search",
    swap: "Swap start and destination",
    clear: "Clear start and destination",
    unavailable: "Times unavailable, trying again…",
    noConnections: "No connections found",
    pages: "Pages of connections",
    earlier: "Earlier",
    now: "Now",
    later: "Later",
    source:
      "Times and delays from transport.opendata.ch. Tap the bell to follow the journey with the timer.",
    recent: "Recent",
    intro:
      "Choose a start and a destination: with changes, trains and regional buses too. The timer will tell you when to leave and whether the connections hold.",
    fromStop: (stop: string) => `from ${stop}`,
    transfers: (transfers: number) =>
      transfers === 0 ? "direct" : transfers === 1 ? "1 change" : `${transfers} changes`,
    atRisk: "Connection at risk",
    startTimer: (time: string) => `Start a timer for the journey at ${time}`,
    walk: (minutes: number) => `${minutes} min on foot`,
    towards: (destination: string) => `towards ${destination}`,
    nearYou: "Near you",
    favoriteStops: "Favourite stops",
    searchUnavailable: "Search unavailable, try again shortly",
    searching: "Searching…",
    noStops: "No stops found",
    typeHint: "Type the name of a stop or a station",
    // When to search, and the journeys saved
    leave: "Depart",
    arrive: "Arrive",
    departAt: "Departure",
    arriveBy: "Arrive by",
    whenNow: "now",
    today: "Today",
    tomorrow: "Tomorrow",
    time: "Time",
    saveFavorite: "Save as a favourite",
    removeFavorite: "Remove from favourites",
  },
  timer: {
    title: "Timer",
    paces: { slow: "Relaxed", normal: "Normal", fast: "In a hurry" },
    learningPace: (walks: number, needed: number) => `Learning your pace (${walks}/${needed})`,
    measuredPace: "Measured pace:",
    walks: (walks: number) => (walks === 1 ? "1 walk" : `${walks} walks`),
    resetPace: "Reset",
    end: "End timer",
    cancel: "Cancel timer",
    none: "No timer running",
    noneHint:
      "Open a stop and tap the bell next to a departure: we'll let you know when it's time to leave.",
    chooseStop: "Choose a stop",
    backToTimer: "Back to the timer",
    busIn: "Bus in",
    margin: "Margin",
    departure: "Departure",
    onFoot: "On foot",
    arrived: "Arrived",
    fromAt: (stop: string, time: ReactNode) => (
      <>
        from {stop} · at {time}
      </>
    ),
    live: "Live",
    lastData: "Last update",
    busLeft: "The bus has left",
    busComing: "The bus is arriving",
    farFromStop: (distance: string) => `You're ${distance} from the stop`,
    atYourStop: (stop: string) => `You're at ${stop}`,
    atStop: (stop: string) => `at ${stop}`,
    busInClock: (clock: string) => `Bus in ${clock}`,
    nextAlert: (clock: ReactNode, minutes: number, walking: boolean) => (
      <>
        Next alert in {clock}
        {minutes === 0
          ? walking
            ? ", when you need to leave"
            : ", at departure"
          : `, ${minutes} min ${walking ? "before you need to leave" : "before departure"}`}
      </>
    ),
    whenToLeave: "Work out when to leave",
    stopPositionUnavailable: "Location of the stop unavailable",
    useGpsHint: "Uses GPS to estimate the walk to the stop",
    locationDeniedBrowser: "Location not allowed in the browser settings",
    accuracy: (meters: number) => `Accuracy ±${meters} m`,
    locating: "Locating…",
    useMyLocation: "Use my location",
    keepOpen: "Keep the app open: the screen stays on and the alerts arrive on time.",
    whereIsBus: "Where's the bus?",
    suggestedMargin: (minutes: number) =>
      `Suggested margin ${minutes} min: the bus may make up its delay`,
    getOffAt: (stop: string) => `Get off at ${stop}`,
    whereGetOff: "Where do you get off?",
    arrivalAt: (time: string) => `Arriving at ${time}`,
    arrivedAt: (time: string) => `Arrived at ${time}`,
    willAlert: "we'll let you know",
    chooseGetOff: "Choose the stop, we'll let you know before",
    towards: (destination: string) => `to ${destination}`,
    farFrom: (distance: string, stop: string) => `${distance} from ${stop}`,
    distanceFrom: (distance: string, stop: string) => `${distance} from ${stop}`,
    accuracyFrom: (distance: string, accuracy: number, stop: string) =>
      `${distance} (±${accuracy} m) from ${stop}`,
    missingMinutes: (minutes: number) => `${minutes} min short`,
    spareMinutes: (minutes: number) => `${minutes} min to spare`,
    noSpare: "no time to spare",
    expectedArrival: (time: ReactNode) => <>Expected arrival at {time}</>,
    tight: "Tight",
    atRisk: "At risk",
    changeAt: (stop: string) => `Change at ${stop}`,
    walkMinutes: (minutes: number) => `${minutes} min on foot`,
    alternativeFrom: (stop: string) => `Alternative from ${stop}`,
    alternativeTimes: (departure: ReactNode, arrival: ReactNode) => (
      <>
        at {departure}, arriving {arrival}
      </>
    ),
    useThisRoute: "Take this route",
    leaveLater: "You can leave later",
    laterPlan: (line: string, departure: ReactNode, arrival: ReactNode) => (
      <>
        Line {line} at {departure}, arriving at {arrival}
      </>
    ),
    useThis: "Take it",
    nextBus: (line: string, destination: string) => `Next ${line} to ${destination}`,
    nextBusAt: (time: ReactNode, minutes: number) => (
      <>
        at {time} · in {minutes} min
      </>
    ),
    switchBus: "Switch to this bus",
    // The trip so far, above the countdown
    trip: "Your trip",
    tripTotal: (duration: string) => `${duration} in all`,
    stepWalk: (stop: string) => `Walk to ${stop}`,
    stepWait: (stop: string) => `Wait at ${stop}`,
    stepRide: (stop: string) => `To ${stop}`,
    ongoing: (duration: string) => `for ${duration} so far`,
    departedLate: (minutes: number) => `${minutes} min late`,
    departedEarly: (minutes: number) => `${minutes} min early`,
    onTime: "on time",
    // Where the map leads once on board
    boardAt: (stop: string) => `Board at ${stop}`,
    destinationAt: (stop: string) => `Arrival at ${stop}`,
    fromYou: (distance: string) => `${distance} from you`,
    // Under the countdown once on board
    arrival: "Arrival",
    delay: "Delay",
    stops: "Stops",
    duration: "Duration",
    punctual: "On time",
  },
  notifications: {
    title: "Notifications",
    granted: "Alerts more and more often as the time gets close",
    denied: "Blocked: tap to see how to turn them back on",
    unsupported: "On iPhone, add the app to the Home Screen to get them",
    ask: "Get alerts even with the app in the background",
    enable: "Turn on",
    cannotAskAgain:
      "The browser won't let the app ask again: permission has to be given in the settings.",
    chooseAllow:
      'Choose Allow: leaving "Ask" is not enough if the browser blocked the site for a few days. Then come back here, the card updates by itself.',
    androidInstalled: (host: string) =>
      `Open ${host} in Chrome: the installed app uses Chrome's permissions.`,
    androidSiteIcon:
      "Tap the icon to the left of the address, then Permissions → Notifications → Allow.",
    androidSiteSettings: (host: string) =>
      `If it's not there: menu ⋮ → Settings → Site settings → Notifications → ${host} → Allow.`,
    androidChrome:
      "Check that Chrome may send notifications: Android Settings → Apps → Chrome → Notifications.",
    ios: "Open Settings → Notifications → Lugano Bus and turn on Allow Notifications.",
    desktopSiteIcon: "Click the icon to the left of the address, then Notifications → Allow.",
    desktopReload: "Reload the page.",
  },
  map: {
    title: "Map",
    otherOperators: "Also show the stops of the other operators",
    loading: "Loading…",
    unavailable: "Departures unavailable",
    departures: "Departures",
    operator: (name: string) => ({ AutoPostale: "PostBus", FFS: "SBB" })[name] ?? name,
    controls: {
      "Map.Title": "Map",
      "NavigationControl.ZoomIn": "Zoom in",
      "NavigationControl.ZoomOut": "Zoom out",
      "NavigationControl.ResetBearing": "Drag to rotate the map, click to reset north",
      "GeolocateControl.FindMyLocation": "Find my location",
      "GeolocateControl.LocationNotAvailable": "Location not available",
      "AttributionControl.ToggleAttribution": "Toggle attribution",
      "AttributionControl.MapFeedback": "Map feedback",
      "Popup.Close": "Close",
    },
  },
  format: {
    now: "now",
    decimal: (value: number) => decimal.format(value),
  },
  weather: { ice: "Ice", snow: "Snow", heavyRain: "Heavy rain", rain: "Rain" },
  weatherInline: { ice: "ice", snow: "snow", heavyRain: "heavy rain", rain: "rain" },
  alerts: {
    bus: (line: string, destination: string) => `Line ${line} to ${destination}`,
    busDeparts: (minutes: number) =>
      minutes <= 0 ? "The bus is arriving" : `The bus leaves in ${minutes} min`,
    busDepartsInline: (minutes: number) =>
      minutes <= 0 ? "the bus is arriving" : `the bus leaves in ${minutes} min`,
    onFoot: (minutes: number, weather?: string) =>
      `${minutes} min on foot${weather ? ` (${weather})` : ""}`,
    leaveIn: (minutes: number) => `Leave in ${minutes} min`,
    leaveNow: "Leave now",
    late: (minutes: number) => `${minutes} min late: hurry up!`,
    nextStop: (stop: string) => `Next stop: ${stop}`,
    getReady: (bus: string) => `Get ready to get off · ${bus}`,
    getOffNow: (stop: string) => `Get off now at ${stop}`,
    tightTransfer: (stop: string) => `Tight connection at ${stop}`,
    noSpare: "no time to spare, hurry up",
    transferAtRisk: (stop: string) => `Connection at ${stop} at risk`,
    lateBy: (minutes: number) => `${minutes} min late`,
    nextLine: (line: string, time: string, later: number) =>
      `Next line ${line} at ${time}, arrival ${later > 0 ? `+${later} min` : "unchanged"}`,
  },
  headline: {
    busGone: "Bus gone",
    busIn: "Bus in",
    departsIn: "Leaves in",
    arriving: "Arriving",
    atStopIn: "At the stop in",
    leaveIn: "Leave in",
    lateBy: "Late by",
    arrivedAt: (stop: string) => `Arrived at ${stop}`,
    getOffIn: (stop: string) => `Get off at ${stop} in`,
    arrivingAt: (stop: string) => `Arriving at ${stop}`,
    arrived: "Arrived",
    lineIn: (line: string) => `Line ${line} in`,
    arrivalIn: "Arriving in",
    destinationIn: "At the destination in",
  },
  ride: {
    headingTo: (stop: string) => `On the way to ${stop}`,
    busLeft: "The bus has left the stop",
    busAtStop: "The bus is at the stop",
    nextStop: "Next stop",
    stopsLeft: (stops: number) => `${stops} stops to go`,
  },
  rideInline: {
    headingTo: (stop: string) => `on the way to ${stop}`,
    busLeft: "the bus has left the stop",
    busAtStop: "the bus is at the stop",
    nextStop: "next stop",
    stopsLeft: (stops: number) => `${stops} stops to go`,
  },
  reliability: {
    onTime: "Usually leaves on time",
    late: (minutes: number) => `Usually leaves +${minutes} min late`,
    early: (minutes: number) => `Usually leaves ${minutes} min early`,
    within: (minutes: number) => `80% within +${minutes} min`,
    allOnTime: "80% on time",
    days: (days: number) => `(${days} days)`,
  },
};
