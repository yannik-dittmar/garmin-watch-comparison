import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { REPORTS } from './paths.js';
import type { RunReport, RunReportEntry } from '../../src/data/contract.js';

/**
 * Coverage is run output, not debug logging: a scraper's failure mode is quiet
 * loss, so every exclusion, gap, and failure lands in a file that gets reviewed
 * (design D4, task 12.1).
 */
export class Reporter {
  private readonly entries: RunReportEntry[] = [];
  private readonly startedAt = new Date().toISOString();

  constructor(private readonly stage: RunReport['stage']) {}

  add(kind: RunReportEntry['kind'], subject: string, detail: string): void {
    this.entries.push({ kind, subject, detail });
  }

  count(kind: RunReportEntry['kind']): number {
    return this.entries.filter((e) => e.kind === kind).length;
  }

  get all(): readonly RunReportEntry[] {
    return this.entries;
  }

  /** Writes `data/reports/<stage>.json` and returns the report. */
  async write(fileName = `${this.stage}.json`): Promise<RunReport> {
    const report: RunReport = {
      stage: this.stage,
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      entries: this.entries,
    };
    await mkdir(REPORTS, { recursive: true });
    await writeFile(path.join(REPORTS, fileName), JSON.stringify(report, null, 2), 'utf8');
    return report;
  }

  /** One-line-per-kind summary for the console at the end of a run. */
  summary(): string {
    const byKind = new Map<string, number>();
    for (const e of this.entries) byKind.set(e.kind, (byKind.get(e.kind) ?? 0) + 1);
    if (byKind.size === 0) return 'no report entries';
    return [...byKind].map(([k, n]) => `${k}: ${n}`).join(', ');
  }
}

export async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2), 'utf8');
}
