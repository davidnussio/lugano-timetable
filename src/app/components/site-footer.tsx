import { getI18n } from "~/i18n/server";
import { LanguageSwitcher } from "~/i18n/language-switcher";

// Disclaimer at the end of every page, and the choice of the language
export async function SiteFooter() {
  const { locale, m } = await getI18n();
  return (
    <footer className="space-y-1 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 text-center text-xs text-muted-foreground">
      <p>{m.footer.disclaimer}</p>
      <p>
        {m.footer.createdBy}{" "}
        <a
          href="https://dambox.ch/projects"
          target="_blank"
          rel="noopener"
          className="font-medium text-foreground underline-offset-2 hover:underline">
          dambox
        </a>
      </p>
      <LanguageSwitcher current={locale} label={m.footer.language} />
    </footer>
  );
}
