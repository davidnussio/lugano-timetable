import type { Locale } from "~/i18n/config";

// The privacy policy, in each language. Only the privacy page imports it, so
// it stays out of the messages every page sends to the browser.

interface PolicySection {
  readonly title: string;
  readonly body: React.ReactNode;
}

export interface Policy {
  readonly title: string;
  readonly description: string;
  readonly updated: string;
  readonly sections: readonly PolicySection[];
}

const DAMBOX = "https://dambox.ch";
const CONTACT = "https://dambox.ch/contact";

// Followed links, no nofollow or noreferrer: they count as backlinks
function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="font-medium text-foreground underline underline-offset-2">
      {children}
    </a>
  );
}

const it: Policy = {
  title: "Privacy",
  description: "Quali dati usa Lugano Bus, dove restano e a chi passano.",
  updated: "Aggiornata il 17 ottobre 2026",
  sections: [
    {
      title: "In breve",
      body: (
        <ul className="list-disc space-y-1 pl-5">
          <li>Nessun account, nessuna pubblicità, nessuna statistica sulle visite.</li>
          <li>Preferiti, timer e impostazioni restano sul tuo dispositivo.</li>
          <li>
            La posizione serve solo se la permetti, e non viene salvata da
            nessuna parte.
          </li>
        </ul>
      ),
    },
    {
      title: "Chi gestisce l'app",
      body: (
        <>
          <p>
            Lugano Bus è un progetto personale di David Nussio, titolare del
            trattamento dei dati. David Nussio sviluppa software con{" "}
            <Ext href={DAMBOX}>dambox</Ext>, software house di Lugano. Per
            qualsiasi domanda scrivici dalla{" "}
            <Ext href={CONTACT}>pagina contatti di dambox.ch</Ext>.
          </p>
          <p>
            Trattiamo i dati secondo la Legge federale sulla protezione dei
            dati (LPD) e, dove si applica, il Regolamento generale sulla
            protezione dei dati dell&apos;UE (GDPR).
          </p>
        </>
      ),
    },
    {
      title: "App non ufficiale",
      body: (
        <p>
          Lugano Bus non è affiliata a Trasporti Pubblici Luganesi (TPL). Orari
          e posizioni dei bus vengono dai dati in tempo reale di TPL e, per i
          tragitti, da transport.opendata.ch; la mappa è di swisstopo. I dati
          possono essere imprecisi o in ritardo: verifica sempre alla fermata.
        </p>
      ),
    },
    {
      title: "Cosa resta sul tuo dispositivo",
      body: (
        <>
          <p>
            L&apos;app salva nella memoria del browser (localStorage) le
            fermate preferite, le linee filtrate, gli ultimi tragitti cercati,
            il timer attivo con le sue impostazioni, il tuo passo medio
            imparato dalle camminate e le corse che usi più spesso, con le ore
            in cui avvii il timer. Servono a ritrovare tutto alla prossima
            apertura e non vengono mai inviati a noi.
          </p>
          <p>
            Il service worker tiene in cache i file dell&apos;app, per aprirla
            più in fretta. L&apos;unico cookie, <code>lang</code>, ricorda la
            lingua scelta per un anno: è tecnico, non serve a tracciarti.
          </p>
          <p>
            Per cancellare tutto basta eliminare i dati del sito dalle
            impostazioni del browser.
          </p>
        </>
      ),
    },
    {
      title: "La tua posizione",
      body: (
        <>
          <p>
            Solo se dai il permesso, l&apos;app legge la tua posizione per
            mostrarti le fermate vicine, la distanza dalla fermata e quando
            uscire. Quasi sempre il calcolo avviene nel browser.
          </p>
          <p>
            In tre casi una posizione arrotondata passa dal nostro server a un
            servizio pubblico, che ci risponde:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              le fermate vicine nella ricerca di un tragitto, a circa 10 metri,
              a transport.opendata.ch;
            </li>
            <li>
              il dislivello fino alla fermata, a circa 20 metri, a swisstopo;
            </li>
            <li>
              il meteo mentre cammini verso la fermata, a circa 5 chilometri,
              a Open-Meteo.
            </li>
          </ul>
          <p>
            Il nostro server non salva queste posizioni e non inoltra il tuo
            indirizzo IP. Le risposte possono restare per qualche tempo nella
            cache della rete di distribuzione, legate alle coordinate
            arrotondate.
          </p>
          <p>
            Le immagini della mappa le scarica il tuo browser direttamente da
            swisstopo, che vede quindi il tuo indirizzo IP e la zona che stai
            guardando.
          </p>
        </>
      ),
    },
    {
      title: "Notifiche",
      body: (
        <p>
          Gli avvisi del timer, le vibrazioni e i suoni li genera il tuo
          browser mentre il timer è attivo, e lo schermo resta acceso finché
          serve. Non usiamo notifiche push: non salviamo nessuna iscrizione sul
          server.
        </p>
      ),
    },
    {
      title: "Server e fornitori",
      body: (
        <>
          <p>
            L&apos;app è ospitata da Vercel Inc. (Stati Uniti), che registra
            dati tecnici di ogni richiesta (indirizzo IP, data e ora, pagina,
            browser) per farla funzionare in modo sicuro. Questi dati possono
            essere trasferiti negli Stati Uniti: Vercel è certificata secondo
            lo Swiss-U.S. Data Privacy Framework, che la Svizzera riconosce
            come garanzia di una protezione adeguata dei dati.
          </p>
          <p>
            Il nostro database (Upstash) contiene solo dati pubblici sugli
            orari, come la puntualità delle corse degli ultimi 60 giorni:
            niente che ti riguardi.
          </p>
          <p>
            Orari, tragitti, mappa e meteo li chiede il nostro server a TPL,
            transport.opendata.ch, swisstopo e Open-Meteo, non il tuo browser
            (tranne le immagini della mappa, vedi sopra).
          </p>
        </>
      ),
    },
    {
      title: "I tuoi diritti",
      body: (
        <p>
          Puoi chiederci quali dati ti riguardano, farli correggere o
          cancellare e opporti al loro trattamento, dalla{" "}
          <Ext href={CONTACT}>pagina contatti di dambox.ch</Ext>. Puoi anche
          rivolgerti all&apos;Incaricato federale della protezione dei dati e
          della trasparenza (IFPDT).
        </p>
      ),
    },
    {
      title: "Modifiche",
      body: (
        <p>
          Se l&apos;app cambia il modo in cui usa i dati aggiorniamo questa
          pagina e la data in alto.
        </p>
      ),
    },
  ],
};

const de: Policy = {
  title: "Datenschutz",
  description: "Welche Daten Lugano Bus verwendet, wo sie bleiben und an wen sie gehen.",
  updated: "Aktualisiert am 17. Oktober 2026",
  sections: [
    {
      title: "Kurz gesagt",
      body: (
        <ul className="list-disc space-y-1 pl-5">
          <li>Kein Konto, keine Werbung, keine Besucherstatistik.</li>
          <li>Favoriten, Timer und Einstellungen bleiben auf deinem Gerät.</li>
          <li>
            Der Standort wird nur verwendet, wenn du es erlaubst, und nirgends
            gespeichert.
          </li>
        </ul>
      ),
    },
    {
      title: "Wer die App betreibt",
      body: (
        <>
          <p>
            Lugano Bus ist ein persönliches Projekt von David Nussio,
            verantwortlich für die Datenbearbeitung. David Nussio entwickelt
            Software mit <Ext href={DAMBOX}>dambox</Ext>, einem Softwarehaus in
            Lugano. Bei Fragen schreib uns über die{" "}
            <Ext href={CONTACT}>Kontaktseite von dambox.ch</Ext>.
          </p>
          <p>
            Wir bearbeiten Daten nach dem Bundesgesetz über den Datenschutz
            (DSG) und, wo anwendbar, nach der Datenschutz-Grundverordnung der
            EU (DSGVO).
          </p>
        </>
      ),
    },
    {
      title: "Inoffizielle App",
      body: (
        <p>
          Lugano Bus ist nicht mit den Trasporti Pubblici Luganesi (TPL)
          verbunden. Fahrzeiten und Buspositionen stammen aus den Echtzeitdaten
          der TPL und, für Verbindungen, von transport.opendata.ch; die Karte
          ist von swisstopo. Die Daten können ungenau oder verspätet sein:
          prüfe sie immer an der Haltestelle.
        </p>
      ),
    },
    {
      title: "Was auf deinem Gerät bleibt",
      body: (
        <>
          <p>
            Die App speichert im Browser (localStorage) deine
            Lieblingshaltestellen, die gefilterten Linien, die letzten
            gesuchten Verbindungen, den laufenden Timer mit seinen
            Einstellungen, dein beim Gehen gelerntes Tempo und die Fahrten, die
            du am häufigsten nutzt, mit den Uhrzeiten, zu denen du den Timer
            startest. So findest du beim nächsten Öffnen alles wieder. Diese
            Daten werden nie an uns gesendet.
          </p>
          <p>
            Der Service Worker speichert die Dateien der App zwischen, damit sie
            schneller startet. Das einzige Cookie, <code>lang</code>, merkt sich
            ein Jahr lang die gewählte Sprache: Es ist technisch notwendig und
            dient nicht dem Tracking.
          </p>
          <p>
            Um alles zu löschen, entferne die Websitedaten in den Einstellungen
            deines Browsers.
          </p>
        </>
      ),
    },
    {
      title: "Dein Standort",
      body: (
        <>
          <p>
            Nur wenn du es erlaubst, liest die App deinen Standort, um dir
            Haltestellen in der Nähe, die Entfernung zur Haltestelle und den
            Zeitpunkt zum Losgehen zu zeigen. Fast immer wird das im Browser
            berechnet.
          </p>
          <p>
            In drei Fällen geht ein gerundeter Standort über unseren Server an
            einen öffentlichen Dienst, der uns antwortet:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Haltestellen in der Nähe bei der Verbindungssuche, auf etwa 10
              Meter genau, an transport.opendata.ch;
            </li>
            <li>
              die Steigung bis zur Haltestelle, auf etwa 20 Meter genau, an
              swisstopo;
            </li>
            <li>
              das Wetter, während du zur Haltestelle gehst, auf etwa 5
              Kilometer genau, an Open-Meteo.
            </li>
          </ul>
          <p>
            Unser Server speichert diese Standorte nicht und gibt deine
            IP-Adresse nicht weiter. Die Antworten können eine Zeit lang im
            Cache des Content-Delivery-Netzwerks bleiben, verknüpft mit den
            gerundeten Koordinaten.
          </p>
          <p>
            Die Kartenbilder lädt dein Browser direkt von swisstopo, das daher
            deine IP-Adresse und den angezeigten Ausschnitt sieht.
          </p>
        </>
      ),
    },
    {
      title: "Benachrichtigungen",
      body: (
        <p>
          Die Hinweise des Timers, Vibrationen und Töne erzeugt dein Browser,
          solange der Timer läuft, und der Bildschirm bleibt so lange wie nötig
          an. Wir verwenden keine Push-Benachrichtigungen: Auf dem Server wird
          kein Abonnement gespeichert.
        </p>
      ),
    },
    {
      title: "Server und Anbieter",
      body: (
        <>
          <p>
            Die App wird von Vercel Inc. (USA) gehostet. Vercel protokolliert
            technische Daten jeder Anfrage (IP-Adresse, Datum und Uhrzeit,
            Seite, Browser), um einen sicheren Betrieb zu gewährleisten. Diese
            Daten können in die USA übermittelt werden: Vercel ist nach dem
            Swiss-U.S. Data Privacy Framework zertifiziert, das die Schweiz als
            angemessenen Datenschutz anerkennt.
          </p>
          <p>
            Unsere Datenbank (Upstash) enthält nur öffentliche Fahrplandaten,
            etwa die Pünktlichkeit der Fahrten der letzten 60 Tage: nichts, was
            dich betrifft.
          </p>
          <p>
            Fahrzeiten, Verbindungen, Karte und Wetter fragt unser Server bei
            TPL, transport.opendata.ch, swisstopo und Open-Meteo ab, nicht dein
            Browser (ausser den Kartenbildern, siehe oben).
          </p>
        </>
      ),
    },
    {
      title: "Deine Rechte",
      body: (
        <p>
          Du kannst über die{" "}
          <Ext href={CONTACT}>Kontaktseite von dambox.ch</Ext> Auskunft über
          deine Daten verlangen, sie berichtigen oder löschen lassen und der
          Bearbeitung widersprechen. Du kannst dich auch an den
          Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB)
          wenden.
        </p>
      ),
    },
    {
      title: "Änderungen",
      body: (
        <p>
          Wenn die App Daten anders verwendet, aktualisieren wir diese Seite
          und das Datum oben.
        </p>
      ),
    },
  ],
};

const en: Policy = {
  title: "Privacy",
  description: "What data Lugano Bus uses, where it stays and who it goes to.",
  updated: "Updated on 17 October 2026",
  sections: [
    {
      title: "In short",
      body: (
        <ul className="list-disc space-y-1 pl-5">
          <li>No account, no ads, no visitor statistics.</li>
          <li>Favourites, timer and settings stay on your device.</li>
          <li>
            Your location is used only if you allow it, and it is never stored.
          </li>
        </ul>
      ),
    },
    {
      title: "Who runs the app",
      body: (
        <>
          <p>
            Lugano Bus is a personal project by David Nussio, the data
            controller. David Nussio builds software with{" "}
            <Ext href={DAMBOX}>dambox</Ext>, a software house in Lugano. For any
            question, write to us from the{" "}
            <Ext href={CONTACT}>dambox.ch contact page</Ext>.
          </p>
          <p>
            We process data under the Swiss Federal Act on Data Protection
            (FADP) and, where it applies, the EU General Data Protection
            Regulation (GDPR).
          </p>
        </>
      ),
    },
    {
      title: "Unofficial app",
      body: (
        <p>
          Lugano Bus is not affiliated with Trasporti Pubblici Luganesi (TPL).
          Times and bus positions come from TPL&apos;s real-time data and, for
          journeys, from transport.opendata.ch; the map is by swisstopo. The
          data may be inaccurate or late: always check at the stop.
        </p>
      ),
    },
    {
      title: "What stays on your device",
      body: (
        <>
          <p>
            The app saves in your browser (localStorage) your favourite stops,
            the lines you filtered, your recent journey searches, the running
            timer and its settings, the walking pace it learned from your
            walks and the rides you use most, with the hours you start the
            timer. They let you find everything again next time and are never
            sent to us.
          </p>
          <p>
            The service worker caches the app&apos;s files so it opens faster.
            The only cookie, <code>lang</code>, remembers your language for a
            year: it is technical and does not track you.
          </p>
          <p>
            To erase everything, clear this site&apos;s data in your browser
            settings.
          </p>
        </>
      ),
    },
    {
      title: "Your location",
      body: (
        <>
          <p>
            Only if you allow it, the app reads your location to show nearby
            stops, how far the stop is and when to leave. Almost always the
            calculation happens in your browser.
          </p>
          <p>
            In three cases a rounded location goes through our server to a
            public service, which answers us:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              nearby stops when searching a journey, to about 10 metres, to
              transport.opendata.ch;
            </li>
            <li>the climb to the stop, to about 20 metres, to swisstopo;</li>
            <li>
              the weather while you walk to the stop, to about 5 kilometres, to
              Open-Meteo.
            </li>
          </ul>
          <p>
            Our server does not store these locations and does not pass on
            your IP address. The answers may stay for a while in the content
            delivery network&apos;s cache, keyed by the rounded coordinates.
          </p>
          <p>
            Your browser loads the map images straight from swisstopo, which
            therefore sees your IP address and the area you are looking at.
          </p>
        </>
      ),
    },
    {
      title: "Notifications",
      body: (
        <p>
          The timer&apos;s alerts, vibrations and sounds come from your
          browser while the timer runs, and the screen stays on as long as
          needed. We do not use push notifications: no subscription is stored
          on the server.
        </p>
      ),
    },
    {
      title: "Servers and providers",
      body: (
        <>
          <p>
            The app is hosted by Vercel Inc. (USA), which logs technical data
            about each request (IP address, date and time, page, browser) to
            run it securely. This data may be transferred to the United States:
            Vercel is certified under the Swiss-U.S. Data Privacy Framework,
            which Switzerland recognises as ensuring adequate data protection.
          </p>
          <p>
            Our database (Upstash) holds only public timetable data, such as
            how punctual the rides were over the last 60 days: nothing about
            you.
          </p>
          <p>
            Times, journeys, the map and the weather are requested by our
            server from TPL, transport.opendata.ch, swisstopo and Open-Meteo,
            not by your browser (except the map images, see above).
          </p>
        </>
      ),
    },
    {
      title: "Your rights",
      body: (
        <p>
          You can ask us what data concerns you, have it corrected or deleted
          and object to its processing, from the{" "}
          <Ext href={CONTACT}>dambox.ch contact page</Ext>. You can also turn
          to the Federal Data Protection and Information Commissioner (FDPIC).
        </p>
      ),
    },
    {
      title: "Changes",
      body: (
        <p>
          If the app changes how it uses data, we update this page and the
          date at the top.
        </p>
      ),
    },
  ],
};

export const policies: Record<Locale, Policy> = { it, de, en };
