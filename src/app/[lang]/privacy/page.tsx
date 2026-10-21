import type { Metadata } from "next";
import { PageHeader } from "~/app/components/page-header";
import { getI18n } from "~/i18n/server";
import { policies } from "./policy";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  const policy = policies[locale];
  return { title: `${policy.title} · LuGo`, description: policy.description };
}

// What the app does with the data of the visitor, and where the timetables
// come from: the long text that used to sit in the footer of every page
export default async function PrivacyPage() {
  const { locale } = await getI18n();
  const policy = policies[locale];
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title={policy.title} subtitle={policy.updated} back="/" />
      <div className="space-y-6 px-5 py-6 text-sm leading-relaxed">
        {policy.sections.map((section) => (
          <section key={section.title} className="space-y-2">
            <h2 className="text-base font-semibold tracking-tight">{section.title}</h2>
            <div className="space-y-2 text-muted-foreground">{section.body}</div>
          </section>
        ))}
      </div>
    </main>
  );
}
