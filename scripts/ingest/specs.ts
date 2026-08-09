import * as cheerio from 'cheerio';
import type { RawSpecRow, SpecValueKind } from '../../src/data/contract.js';

/**
 * Stage 1c — turning `specsTab.content` into rows (design D3, task 3.3).
 *
 * The published table is a run of `<table>`s, each opened by a `tr.title` whose
 * `<h3>` names the section, followed by `<tr><th>label</th><td>value</td></tr>`.
 *
 * The value cell is where the tri-state comes from: Garmin marks support with
 * `class="yes"` / `class="no"` on an *empty* cell. A row that is simply absent is
 * neither — which is exactly what distinguishes "not supported" from
 * "not published", and why `valueKind` is carried rather than inferred later.
 */

/** `<br>` is a real separator here: battery modes and wrist sizes ride on it. */
function cellText($: cheerio.CheerioAPI, cell: cheerio.Cheerio<any>): string {
  const clone = cell.clone();
  clone.find('br').replaceWith('\n');
  return $(clone)
    .text()
    .replace(/[\u00a0\u202f\u2009]/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

function valueKindOf(classAttr: string | undefined): SpecValueKind {
  const classes = (classAttr ?? '').split(/\s+/);
  if (classes.includes('yes')) return 'marker-yes';
  if (classes.includes('no')) return 'marker-no';
  return 'text';
}

export function parseSpecTable(html: string | null | undefined): RawSpecRow[] {
  if (!html) return [];
  const $ = cheerio.load(html);
  const rows: RawSpecRow[] = [];
  let section = '';
  let order = 0;

  $('table').each((_, table) => {
    $(table)
      .find('tr')
      .each((__, tr) => {
        const $tr = $(tr);

        // A section header row: `tr.title` carrying an <h3>, or any row whose only
        // cell is a heading.
        const heading = $tr.find('h1,h2,h3,h4').first();
        if (heading.length > 0) {
          const text = heading.text().replace(/\s+/g, ' ').trim();
          if (text) section = text;
          return;
        }

        const label = $tr.find('th').first();
        const value = $tr.find('td').first();
        if (label.length === 0 || value.length === 0) return;

        const labelText = label.text().replace(/\s+/g, ' ').trim();
        if (!labelText) return;

        rows.push({
          section,
          label: labelText,
          value: cellText($, value),
          valueKind: valueKindOf(value.attr('class')),
          order: order++,
        });
      });
  });

  return rows;
}

/** The in-the-box tab is a plain `<ul>`; each item is one packed component. */
export function parseBoxContents(html: string | null | undefined): string[] {
  if (!html) return [];
  const $ = cheerio.load(html);
  const items = $('li')
    .map((_, li) => $(li).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter((text) => text.length > 0);
  if (items.length > 0) return items;

  // Some models publish the box contents as loose text rather than a list.
  const text = $.root().text().replace(/\s+/g, ' ').trim();
  return text ? [text] : [];
}
