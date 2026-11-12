import { useEffect, useState } from "react";
import { ChevronDown, Info, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { fill, useT } from "../../src/i18n";
import type { Lang } from "../auth/backend";
import { GUIDE, type Block, type Chapter } from "../guide/content";
import { navigate, usePrevious, useSubroute } from "../router";
import { BackLink } from "../BackLink";

/** The user manual: a reading page with a table of contents that follows you. */
export function GuidePage({ lang }: { lang: Lang }) {
  const { t } = useT();
  const chapters = GUIDE[lang];
  const sub = useSubroute();
  const back = usePrevious();
  const backLabel = back.route === "account" ? t("guide.backAccount") : t("guide.backHome");
  const [active, setActive] = useState(chapters[0]!.id);
  const total = chapters.reduce((n, c) => n + c.minutes, 0);

  // Jump to a chapter from a link (#/guide/<chapter>).
  useEffect(() => {
    if (!sub) return;
    const el = document.getElementById(`ch-${sub}`);
    if (el) window.setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }, [sub]);

  // Highlight the chapter being read.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (seen) setActive(seen.target.id.replace(/^ch-/, ""));
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    chapters.forEach((c) => {
      const el = document.getElementById(`ch-${c.id}`);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [chapters]);

  return (
    <main className="mx-auto max-w-6xl px-5 pt-28 pb-24 sm:px-8">
      <header className="max-w-2xl">
        <BackLink label={backLabel} onClick={() => navigate(back.route === "guide" ? "home" : back.route, back.sub)} className="mb-8" />
        <h1 className="text-[clamp(2.4rem,5vw,3.75rem)] leading-[1.02] font-semibold tracking-[-0.035em] font-stretch-[108%]">{t("guide.title")}</h1>
        <p className="mt-4 text-[17px] text-muted-foreground">{t("guide.body")}</p>
        <p className="mt-3 text-[13px] text-muted-foreground">{fill(t("guide.readTime"), { n: String(total), chapters: String(chapters.length) })}</p>
      </header>

      <div className="mt-14 grid gap-12 lg:grid-cols-[220px_1fr]">
        <nav aria-label={t("guide.contents")} className="hidden lg:block">
          <ol className="sticky top-24 space-y-0.5 border-l border-border">
            {chapters.map((c, i) => (
              <li key={c.id}>
                <a
                  href={`#/guide/${c.id}`}
                  aria-current={active === c.id ? "true" : undefined}
                  className={cn(
                    "-ml-px flex gap-3 border-l py-1.5 pl-4 text-[14px] transition-colors",
                    active === c.id ? "border-brand font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="w-4 tabular-nums opacity-60">{i + 1}</span>
                  {c.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="min-w-0 space-y-8">
          {chapters.map((c, i) => (
            <ChapterView key={c.id} chapter={c} n={i + 1} />
          ))}
          <section className="glass rounded-3xl p-6 sm:p-8 lg:p-10">
            <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{t("guide.stuck.title")}</h2>
            <p className="mt-2 max-w-xl text-[15px] text-muted-foreground">{t("guide.stuck.body")}</p>
            <button
              type="button"
              onClick={() => {
                navigate("home");
                window.setTimeout(() => document.getElementById("lab")?.scrollIntoView({ behavior: "smooth" }), 700);
              }}
              className="mt-5 inline-flex h-10 items-center rounded-full bg-primary px-5 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              {t("web.hero.cta")}
            </button>
          </section>
        </article>
      </div>
    </main>
  );
}

/** Tips and notes sit beside the steps on wide screens, so the page uses its width without long lines. */
const isSide = (b: Block) => "tip" in b || "note" in b;
/** Tables and questions read best at full width. */
const isWide = (b: Block) => "rows" in b || "qa" in b;

function ChapterView({ chapter, n }: { chapter: Chapter; n: number }) {
  const { t } = useT();
  const main = chapter.blocks.filter((b) => !isSide(b) && !isWide(b));
  const side = chapter.blocks.filter(isSide);
  const wide = chapter.blocks.filter(isWide);
  return (
    <section id={`ch-${chapter.id}`} className="glass scroll-mt-24 rounded-3xl p-6 sm:p-8 lg:p-10">
      <header className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-[17px] font-semibold text-accent-foreground tabular-nums">{n}</span>
        <div className="min-w-0">
          <p className="text-[13px] text-muted-foreground tabular-nums">
            {fill(t("guide.chapter"), { n: String(n) })} · {fill(t("guide.minutes"), { n: String(chapter.minutes) })}
          </p>
          <h2 className="mt-1 text-[clamp(1.5rem,2.4vw,2rem)] leading-tight font-semibold tracking-[-0.03em] font-stretch-[105%]">{chapter.title}</h2>
          <p className="mt-1.5 text-[16px] text-muted-foreground">{chapter.summary}</p>
        </div>
      </header>

      <div className={cn("mt-8 grid gap-8", side.length > 0 && "xl:grid-cols-[minmax(0,1fr)_280px] xl:gap-10")}>
        <div className="min-w-0 space-y-6">
          {main.map((b, i) => (
            <BlockView key={i} block={b} />
          ))}
        </div>
        {side.length > 0 && (
          <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            {side.map((b, i) => (
              <BlockView key={i} block={b} />
            ))}
          </div>
        )}
      </div>

      {wide.length > 0 && (
        <div className="mt-8 space-y-6">
          {wide.map((b, i) => (
            <BlockView key={i} block={b} />
          ))}
        </div>
      )}
    </section>
  );
}

function BlockView({ block }: { block: Block }) {
  const { t } = useT();
  if ("p" in block) return <p className="max-w-[68ch] text-[16px] leading-[1.7] text-foreground/90">{block.p}</p>;
  if ("steps" in block)
    return (
      <ol className="max-w-[68ch] space-y-4">
        {block.steps.map((s, i) => (
          <li key={i} className="grid grid-cols-[1.75rem_1fr] gap-3 text-[16px] leading-[1.6]">
            <span className="mt-0.5 grid size-7 place-items-center rounded-full border border-brand/40 text-[13px] font-semibold text-brand tabular-nums">{i + 1}</span>
            <span className="pt-0.5">{s}</span>
          </li>
        ))}
      </ol>
    );
  if ("list" in block)
    return (
      <ul className="space-y-2.5">
        {block.list.map((s, i) => (
          <li key={i} className="flex gap-3 text-[16px] leading-[1.6]">
            <span aria-hidden className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-brand" />
            {s}
          </li>
        ))}
      </ul>
    );
  if ("tip" in block || "note" in block) {
    const tip = "tip" in block;
    const Icon = tip ? Lightbulb : Info;
    return (
      <aside className={cn("rounded-2xl border px-5 py-4 text-[15px] leading-[1.6]", tip ? "border-ember/30 bg-ember/5" : "border-brand/30 bg-accent/40")}>
        <p className="flex items-center gap-2 font-semibold">
          <Icon aria-hidden className={cn("size-4 shrink-0", tip ? "text-ember" : "text-brand")} />
          {tip ? t("guide.tip") : t("guide.note")}
        </p>
        <p className="mt-1.5 text-muted-foreground">{tip ? block.tip : block.note}</p>
      </aside>
    );
  }
  if ("rows" in block)
    return (
      <dl className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/50">
        {block.rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[200px_1fr] sm:gap-6">
            <dt className="text-[15px] font-semibold">{k}</dt>
            <dd className="text-[15px] text-muted-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    );
  return (
    <div className="divide-y divide-border rounded-2xl border border-border bg-card/50">
      {block.qa.map(([q, a]) => (
        <details key={q} className="group px-5 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer items-center justify-between gap-4 py-3.5 text-[15px] font-semibold">
            {q}
            <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-180" />
          </summary>
          <p className="pb-4 text-[15px] leading-[1.6] text-muted-foreground">{a}</p>
        </details>
      ))}
    </div>
  );
}
