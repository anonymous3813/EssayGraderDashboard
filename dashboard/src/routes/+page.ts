import type { PageLoad } from './$types';
import type { Run } from '$lib/types';

export const load: PageLoad = async ({ fetch }) => {
  const manifest: string[] = await fetch('/results/manifest.json').then(r => r.json());

  const runs: Run[] = await Promise.all(
    manifest.map(async (file) => {
      const data = await fetch(`/results/${file}`).then(r => r.json());
      return { ...data, id: file.replace('.json', '') } as Run;
    })
  );
  runs.sort((a, b) => b.metadata.timestamp.localeCompare(a.metadata.timestamp));
  return { runs };
};