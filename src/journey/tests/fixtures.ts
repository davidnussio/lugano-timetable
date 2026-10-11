// Trimmed transport.opendata.ch responses, as returned on 2026-10-11

const station = (id: string | null, name: string, x: number, y: number) => ({
  id,
  name,
  score: null,
  coordinate: { type: "WGS84", x, y },
  distance: null,
});

const albonago = station("8591577", "Albonago, ai Ronchi", 46.015, 8.973);
const sanSiro = station("8505561", "Viganello, S. Siro", 46.0138, 8.9707);
const stazioneNord = station("8591805", "Lugano, Stazione Nord", 46.0065, 8.9465);
const lugano = station("8505300", "Lugano", 46.0055, 8.947);
const bellinzona = station("8505213", "Bellinzona", 46.1953, 9.0294);

const checkpoint = (
  where: ReturnType<typeof station>,
  arrival: number | null,
  departure: number | null,
  prognosis: { arrival?: string; departure?: string } | null = null
) => ({
  station: where,
  arrival: null,
  arrivalTimestamp: arrival,
  departure: null,
  departureTimestamp: departure,
  delay: null,
  platform: null,
  prognosis: prognosis && {
    platform: null,
    arrival: prognosis.arrival ?? null,
    departure: prognosis.departure ?? null,
    capacity1st: null,
    capacity2nd: null,
  },
});

const walk = (
  from: ReturnType<typeof station>,
  to: ReturnType<typeof station>,
  duration: number
) => ({
  journey: null,
  walk: { duration },
  departure: checkpoint(from, null, null),
  arrival: checkpoint(to, null, null),
});

// 19:34 bus 461 (ARL) to Stazione Nord, walk, 19:30 EC delayed by 31 min
export const connection = {
  from: checkpoint(albonago, null, 1791739680),
  to: checkpoint(bellinzona, 1791740760, null),
  duration: "00d00:45:00",
  transfers: 1,
  sections: [
    walk(albonago, sanSiro, 360),
    {
      journey: {
        name: "000756",
        category: "B",
        subcategory: null,
        number: "461",
        operator: "ARL",
        to: "Lugano, Ospedale Civico",
        passList: [],
      },
      walk: null,
      departure: checkpoint(sanSiro, null, 1791740040, {
        departure: "2026-10-11T19:34:00+0200",
      }),
      arrival: checkpoint(stazioneNord, 1791741000, null, {
        arrival: "2026-10-11T19:50:00+0200",
      }),
    },
    walk(stazioneNord, lugano, 300),
    {
      journey: {
        name: "000306",
        category: "EC",
        subcategory: null,
        number: "000306",
        operator: "SBB",
        to: "Zürich HB",
        passList: [],
      },
      walk: null,
      departure: checkpoint(lugano, null, 1791739800, {
        departure: "2026-10-11T20:01:00+0200",
      }),
      arrival: checkpoint(bellinzona, 1791740760, null, {
        arrival: "2026-10-11T20:13:00+0200",
      }),
    },
  ],
};

// Departures of Viganello, Centro: bus 3 with forecasts, bus 5 without
export const stationboard = {
  station: station("8591653", "Viganello, Centro", 46.012571, 8.966049),
  stationboard: [
    {
      name: "003376",
      category: "B",
      number: "3",
      operator: "TPL",
      to: "Breganzona, Posta",
      stop: checkpoint(
        station("8591653", "Viganello, Centro", 46.012571, 8.966049),
        null,
        1791742740,
        { departure: "2026-10-11T20:21:00+0200" }
      ),
      passList: [
        checkpoint(
          station("8591653", "Viganello, Centro", 46.012571, 8.966049),
          null,
          1791742740,
          { departure: "2026-10-11T20:21:00+0200" }
        ),
        checkpoint(
          station("8575286", "Lugano, Stazione Piazza Besso", 46.0072, 8.9446),
          1791743400,
          1791743400,
          { arrival: "2026-10-11T20:32:00+0200", departure: "2026-10-11T20:32:00+0200" }
        ),
      ],
    },
    {
      name: "005250",
      category: "B",
      number: "5",
      operator: "TPL",
      to: "Manno, Uovo di Manno",
      stop: checkpoint(
        station("8591653", "Viganello, Centro", 46.012571, 8.966049),
        null,
        1791742740
      ),
      passList: [],
    },
  ],
};

export const locations = {
  stations: [
    { ...station(null, "Piazza Dante Alighieri 9, Lugano", 46.0048, 8.9514), distance: 15.4 },
    { ...station("8591603", "Lugano, Centro", 46.005983, 8.952448), distance: 141, icon: "bus" },
    { ...station("8505550", "Lugano Centrale (lago)", 46.002969, 8.951559), distance: 215.3, icon: "ship" },
  ],
};
