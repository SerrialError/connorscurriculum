import { describe, expect, it } from 'vitest';
import { cmsConfig } from './cms';
import { loadRegistry } from './registry';

describe('cmsConfig', () => {
  const registry = loadRegistry();
  const config = cmsConfig(registry);

  it('has one lesson collection per subject, stored where the content loader reads lessons', () => {
    expect(config.collections.map((c) => c.folder)).toEqual([...registry.keys()].map((id) => `src/content/lessons/${id}`));
    for (const c of config.collections) expect(c.path).toBe('{{chapter}}-{{slug}}/index');
  });

  it('offers every chapter and CED topic as options', () => {
    const apchem = registry.get('apchem')!;
    const fields = Object.fromEntries(config.collections[0]!.fields.map((f) => [f.name, f]));
    expect((fields.chapter as { options: { value: number }[] }).options.map((o) => o.value)).toEqual(apchem.chapters.map((c) => c.number));
    expect((fields.cedTopics as { options: { value: string }[] }).options.map((o) => o.value)).toEqual([...apchem.topics.keys()]);
  });
});
