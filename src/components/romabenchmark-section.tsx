import { getRomaBenchmark } from "@/lib/data/romabenchmark";
import type { RomaCheck } from "@data/schemas/romabenchmark.schema";

function CheckCell({ value, note }: { value: RomaCheck | undefined; note?: string }) {
  if (value === "pass") {
    return <span className="font-bold text-ink">✓</span>;
  }
  if (value === "fail") {
    return (
      <span className="font-bold text-ink underline decoration-2 underline-offset-4" title={note}>
        ✗
      </span>
    );
  }
  return <span className="text-ink2">—</span>;
}

function fmtMs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * RomaBenchmark — a one-day, script-verified shootout of the six models
 * hosted behind the CEHWA gateway. Data: data/meta/romabenchmark.json.
 */
export function RomaBenchmarkSection() {
  const bench = getRomaBenchmark();
  const rounds = bench.rounds;
  const models = bench.models;

  return (
    <section className="border-b border-line py-12" id="romabenchmark">
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">
            Field test · {bench.runAt}
          </p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            RomaBenchmark
          </h2>
          <p className="max-w-3xl text-sm leading-6 text-ink2">
            Six frontier models behind one gateway —{" "}
            <span className="font-semibold text-ink">{bench.gateway.name}</span>{" "}
            (<span className="font-mono text-xs">{bench.gateway.baseUrl}</span>) — run through a
            gauntlet of short but nasty tasks. Every answer verified against script-computed
            ground truth; every coding solution executed, not eyeballed.
          </p>
        </div>

        {/* Results matrix */}
        <div className="overflow-x-auto border border-line">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink">
                <th className="px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">
                  Model
                </th>
                {rounds.map((r) => (
                  <th
                    key={r.id}
                    title={r.task}
                    className="px-3 py-2 text-center font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2"
                  >
                    {r.label}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr
                  key={m.name}
                  className="border-b border-line last:border-0 hover:bg-ink hover:text-paper [&:hover_*]:text-paper"
                >
                  <td className="whitespace-nowrap px-3 py-2 font-semibold text-ink">{m.name}</td>
                  {rounds.map((r) => (
                    <td key={r.id} className="px-3 py-2 text-center">
                      <CheckCell value={m.checks[r.id]} note={m.failNotes?.[r.id]} />
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums text-ink">
                    {m.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Tasks */}
          <div className="space-y-2">
            <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">
              Tasks &amp; ground truth
            </h3>
            <ul className="space-y-3">
              {rounds.map((r) => (
                <li key={r.id} className="border-l-2 border-line pl-3">
                  <span className="font-mono text-xs font-bold text-ink">{r.label}</span>{" "}
                  <span className="text-sm text-ink">{r.task}</span>
                  <div className="font-mono text-xs tabular-nums text-ink2">{r.answer}</div>
                </li>
              ))}
            </ul>
          </div>

          {/* Performance */}
          <div className="space-y-2">
            <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">
              Latency &amp; tokens (single run, via gateway)
            </h3>
            <div className="overflow-x-auto border border-line">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink">
                    <th className="px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">
                      Model
                    </th>
                    <th className="px-3 py-2 text-right font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">
                      R3 math
                    </th>
                    <th className="px-3 py-2 text-right font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">
                      R4 code
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m) => (
                    <tr
                      key={m.name}
                      className="border-b border-line last:border-0 hover:bg-ink hover:text-paper [&:hover_*]:text-paper"
                    >
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-ink">{m.name}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-xs tabular-nums text-ink2">
                        {m.r3 ? `${fmtMs(m.r3.ms)} · ${m.r3.tokens} tok` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-xs tabular-nums text-ink2">
                        {m.r4 ? `${fmtMs(m.r4.ms)} · ${m.r4.tokens} tok` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Verdicts */}
            <ul className="space-y-2 pt-2">
              {models.map((m) => (
                <li key={m.name} className="text-sm leading-6 text-ink2">
                  <span className="font-semibold text-ink">{m.name}.</span> {m.verdict}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Failures detail */}
        {models.some((m) => m.failNotes && Object.keys(m.failNotes).length > 0) && (
          <div className="border border-line p-4">
            <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">
              Where models broke
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-ink2">
              {models.flatMap((m) =>
                Object.entries(m.failNotes ?? {}).map(([roundId, note]) => (
                  <li key={`${m.name}-${roundId}`}>
                    <span className="font-semibold text-ink">{m.name}</span>{" "}
                    <span className="font-mono text-xs uppercase">{roundId}</span>: {note}
                  </li>
                )),
              )}
            </ul>
          </div>
        )}

        {/* Incidents */}
        {bench.incidents && bench.incidents.length > 0 && (
          <div className="border border-ink p-4">
            <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink">
              ⚠ Gateway stability
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-ink">
              {bench.incidents.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Methodology */}
        <div className="space-y-2 border-t border-line pt-3">
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink2">
            Methodology
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-ink2">
            {bench.methodology.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
