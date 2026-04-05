import type { PageLoad } from './$types';
import type { Run } from '$lib/types';

export const prerender = true;

export const load: PageLoad = async () => {
  // Import all JSON files at build time
  const modules = import.meta.glob('$lib/results/*.json', {
    import: 'default',
    eager: true
  });

  // Convert { "/static/results/run1.json": {...}, ... } into an array
  const runs = Object.entries(modules).map(([path, data]) => {
    const id = path.split('/').pop()!.replace('.json', '');
    return { ...(data as any), id };
  });

  // Sort by timestamp field
  runs.sort((a, b) => b.metadata.timestamp.localeCompare(a.metadata.timestamp));

  return { runs };
};