import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { DataCard } from "@/components/common/DataCard";
import { WarnBadge } from "@/components/common/WarnBadge";
import { Input } from "@/components/ui/input";
import { ALL_RULES, severityWeight } from "@/lib/weather/thresholds/dwd";
import { WARN_LEVEL, type WarnLevel } from "@/lib/weather/thresholds/warn-level";
import {
  CATEGORY_LABEL,
  LEXIKON,
  lexFirstLetter,
  searchLexikon,
  type LexCategory,
  type LexEntry,
} from "@/lib/learn/lexikon";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/learn")({
  head: () => ({
    meta: [
      { title: "Lernmodus — ForecastHub" },
      { name: "description", content: "Begriffe, Schwellen und Konzepte verständlich erklärt." },
    ],
  }),
  component: LearnPage,
});

const WARN_LEVELS_ORDERED: WarnLevel[] = [1, 2, 3, 4];
const WARN_STUFEN_TEXT = WARN_LEVELS_ORDERED.map((l) => `${l} ${WARN_LEVEL[l].name}`).join(", ");

const CONCEPTS = [
  {
    title: "Beobachtung vs. Nowcast vs. Modell",
    text: "Beobachtungen kommen von Stationen und Radar und zeigen den Ist-Zustand. Nowcasts extrapolieren die nächsten 0–2 Stunden direkt aus dem Radar. Modellprognosen rechnen die Physik der Atmosphäre stunden- bis tageweit voraus.",
  },
  {
    title: "Warum DWD-Schwellen?",
    text: `Der DWD nutzt vier Stufen: ${WARN_STUFEN_TEXT}. ForecastHub orientiert sich daran, damit Einordnungen vergleichbar bleiben.`,
  },
  {
    title: "Wie verlässlich ist ein Wert?",
    text: "Jede Karte zeigt Quelle, Stand und Auflösung. Je gröber das Modell, desto weniger lokale Details. Stationsdaten sind punktgenau, decken aber nicht jeden Ort ab.",
  },
];

const SLUG_TO_TERM: Record<string, string> = Object.fromEntries(
  LEXIKON.map((e) => [e.slug, e.term]),
);

function groupByLetter(entries: LexEntry[]): { letter: string; items: LexEntry[] }[] {
  const map = new Map<string, LexEntry[]>();
  for (const e of entries) {
    const l = lexFirstLetter(e.term);
    if (!map.has(l)) map.set(l, []);
    map.get(l)!.push(e);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "de"))
    .map(([letter, items]) => ({
      letter,
      items: items.sort((a, b) => a.term.localeCompare(b.term, "de")),
    }));
}

export function LearnPage() {
  const sorted = [...ALL_RULES].sort(
    (a, b) => severityWeight(a.severity) - severityWeight(b.severity),
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<LexCategory | "all">("all");

  const filtered = useMemo(() => {
    const byQuery = searchLexikon(query);
    return category === "all" ? byQuery : byQuery.filter((e) => e.category === category);
  }, [query, category]);

  const groups = useMemo(() => groupByLetter(filtered), [filtered]);
  const availableLetters = useMemo(() => groups.map((g) => g.letter), [groups]);

  const handleRelatedClick = (slug: string) => {
    const term = SLUG_TO_TERM[slug];
    if (term) {
      setQuery(term);
      setCategory("all");
    }
  };

  const scrollToLetter = (letter: string) => {
    const el = document.getElementById(`lex-letter-${letter}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Lernmodus</h1>
        <p className="text-xs text-muted-foreground">
          Begriffe und Schwellen für die eigene Einordnung.
        </p>
      </div>

      <DataCard title="Lexikon">
        <div className="flex flex-col gap-3">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Begriff suchen…"
            aria-label="Lexikon durchsuchen"
          />

          <div className="flex flex-wrap gap-1.5">
            <CategoryChip
              active={category === "all"}
              label="Alle"
              onClick={() => setCategory("all")}
            />
            {(Object.keys(CATEGORY_LABEL) as LexCategory[]).map((key) => (
              <CategoryChip
                key={key}
                active={category === key}
                label={CATEGORY_LABEL[key]}
                onClick={() => setCategory(key)}
              />
            ))}
          </div>

          {availableLetters.length > 0 && (
            <div
              className="flex flex-wrap gap-1"
              aria-label="Alphabetische Sprungleiste"
            >
              {availableLetters.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => scrollToLetter(l)}
                  className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-background/50 px-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {l}
                </button>
              ))}
            </div>
          )}

          {groups.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              Keine Treffer für „{query}".
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {groups.map((g) => (
                <section key={g.letter} className="flex flex-col gap-2">
                  <h3
                    id={`lex-letter-${g.letter}`}
                    className="scroll-mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {g.letter}
                  </h3>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {g.items.map((entry) => (
                      <article
                        key={entry.slug}
                        className="flex flex-col gap-1.5 rounded-md border border-border bg-background/50 p-3"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h4 className="text-sm font-semibold text-foreground">{entry.term}</h4>
                          <span className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {CATEGORY_LABEL[entry.category]}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{entry.definition}</p>
                        {entry.example && (
                          <p className="border-l-2 border-border pl-2 text-xs italic text-muted-foreground">
                            {entry.example}
                          </p>
                        )}
                        {entry.related && entry.related.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {entry.related.map((slug) => {
                              const term = SLUG_TO_TERM[slug];
                              if (!term) return null;
                              return (
                                <button
                                  key={slug}
                                  type="button"
                                  onClick={() => handleRelatedClick(slug)}
                                  className="inline-flex items-center rounded-md border border-border bg-background/40 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                >
                                  {term}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </DataCard>

      <DataCard title="Konzepte">
        <div className="flex flex-col gap-3">
          {CONCEPTS.map((c) => (
            <article key={c.title} className="rounded-md border border-border bg-background/50 p-3">
              <h3 className="text-sm font-semibold text-foreground">{c.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{c.text}</p>
            </article>
          ))}
        </div>
      </DataCard>

      <DataCard title="DWD-orientierte Schwellen">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-1.5 pr-3">Stufe</th>
                <th className="py-1.5 pr-3">Parameter</th>
                <th className="py-1.5 pr-3">Schwelle</th>
                <th className="py-1.5 pr-3">Bedeutung</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-t border-border/50 align-top">
                  <td className="py-2 pr-3">
                    <WarnBadge severity={r.severity} />
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.parameter}</td>
                  <td className="py-2 pr-3 font-medium">{r.label}</td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">{r.explain}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataCard>
    </div>
  );
}

function CategoryChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background/50 text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
