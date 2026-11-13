import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// `onclick={start}` calls start(event): a function with optional parameters then gets the click
// event as its first argument (this once made "Start practice" behave like a link that starts a
// set, so Back skipped the filters). Handlers passed by name must take no parameters, or only an
// event; anything else needs an arrow function: `onclick={() => start()}`.
const dir = new URL('.', import.meta.url).pathname;
const components = readdirSync(dir).filter((f) => f.endsWith('.svelte'));

function paramsOf(source: string, name: string): string | null {
  const fn = new RegExp(`function\\s+${name}\\s*(?:<[^>]*>)?\\(([^)]*)\\)`).exec(source);
  if (fn) return fn[1]!.trim();
  const arrow = new RegExp(`(?:const|let)\\s+${name}\\s*=\\s*(?:async\\s*)?\\(([^)]*)\\)\\s*(?::[^=]*)?=>`).exec(source);
  return arrow ? arrow[1]!.trim() : null;
}

describe('event handlers passed by name', () => {
  for (const file of components) {
    it(`${file}: take no arguments other than the event`, () => {
      const source = readFileSync(join(dir, file), 'utf8');
      const bad: string[] = [];
      for (const [, name] of source.matchAll(/\bon[a-z]+=\{([A-Za-z_$][\w$]*)\}/g)) {
        const params = paramsOf(source, name!);
        if (params === null) continue; // not a local function (e.g. a prop)
        if (params === '' || /^\w+\s*:\s*\w*Event\b/.test(params)) continue;
        bad.push(`${name}(${params})`);
      }
      expect(bad).toEqual([]);
    });
  }
});
