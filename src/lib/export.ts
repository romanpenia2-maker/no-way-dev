/**
 * Table export helpers — client-safe, no node builtins.
 * CSV follows RFC 4180 quoting; Markdown is a GFM pipe table.
 */

type Cell = string | number;

function csvCell(value: Cell): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: Cell[], rows: Cell[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

export function toMarkdown(header: Cell[], rows: Cell[][]): string {
  const line = (r: Cell[]) => `| ${r.map((c) => String(c).replace(/\|/g, "\\|")).join(" | ")} |`;
  return [line(header), `| ${header.map(() => "---").join(" | ")} |`, ...rows.map(line)].join("\n");
}
