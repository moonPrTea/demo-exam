import type {Config, ConfigInput} from './types.js';
import {generateDataset, normalizeConfig} from './generator.js';

// Keep the seeded generator stable so old saved attempts remain reproducible.
export function newVariant(
  input: ConfigInput,
  previous: Config | null,
  seedFactory: () => string,
) {
  const base = normalizeConfig(input);
  const old = previous ? generateDataset(previous) : null;
  for (let attempt = 0; attempt < 64; attempt++) {
    const candidate = {...base, seed: seedFactory()};
    if (candidate.seed === previous?.seed) continue;
    const dataset = generateDataset(candidate);
    if (
      !old ||
      dataset.tasks.every(
        (task, index) => task.prompt !== old.tasks[index].prompt,
      )
    )
      return dataset.config;
  }
  throw new Error('Не удалось подобрать новые условия. Попробуй ещё раз.');
}
