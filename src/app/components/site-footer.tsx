// Disclaimer at the end of every page
export function SiteFooter() {
  return (
    <footer className="space-y-1 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 text-center text-xs text-muted-foreground">
      <p>
        App non ufficiale, non affiliata a Trasporti Pubblici Luganesi (TPL).
        Orari e posizioni vengono dai dati in tempo reale di TPL e possono
        essere imprecisi: verifica sempre alla fermata.
      </p>
      <p>
        Creato da <span className="font-medium text-foreground">dambox</span>
      </p>
    </footer>
  );
}
