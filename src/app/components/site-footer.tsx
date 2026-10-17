import Link from "next/link";
import { getI18n } from "~/i18n/server";
import { LanguageSwitcher } from "~/i18n/language-switcher";

const link = "font-medium text-foreground underline-offset-2 hover:underline";

// The short disclaimer at the end of every page, the details on the privacy
// page, and the choice of the language
export async function SiteFooter() {
  const { locale, m } = await getI18n();
  return (
    <footer className="space-y-1 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 text-center text-xs text-muted-foreground">
      <p>
        {m.footer.unofficial} ·{" "}
        <Link href="/privacy" className={link}>
          {m.footer.privacy}
        </Link>
      </p>
      <p>
        {m.footer.createdBy}{" "}
        {/* A followed link, no nofollow or noreferrer: the backlink counts */}
        <a href="https://dambox.ch/projects" target="_blank" rel="noopener" className={link}>
          David Nussio (dambox)
        </a>
      </p>
      <LanguageSwitcher current={locale} label={m.footer.language} />
    </footer>
  );
}
