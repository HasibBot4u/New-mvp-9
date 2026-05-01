import { useDeferredValue, useMemo } from 'react';
import { useCatalog } from '../contexts/CatalogContext';

export interface SearchResult {
  id: string;
  title: string;
  type: 'video' | 'chapter' | 'subject';
  subtitle: string;
  url: string;
}

export function useSearch(query: string) {
  const { catalog, isLoading } = useCatalog();
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(() => {
    if (!deferredQuery.trim() || !catalog) return [];

    const lowerQuery = deferredQuery.toLowerCase();
    const matches: SearchResult[] = [];

    for (const subject of catalog.subjects) {
      if (matches.length >= 10) break;
      if (subject.name.toLowerCase().includes(lowerQuery)) {
        matches.push({
          id: subject.id,
          title: subject.name,
          type: 'subject',
          subtitle: 'Subject',
          url: `/subject/${subject.slug}`
        });
      }

      for (const cycle of subject.cycles) {
        if (matches.length >= 10) break;
        if (cycle.name.toLowerCase().includes(lowerQuery)) {
          matches.push({
            id: cycle.id,
            title: cycle.name,
            type: 'subject',
            subtitle: `${subject.name}`,
            url: `/cycle/${cycle.id}`
          });
        }

        for (const chapter of cycle.chapters) {
          if (matches.length >= 10) break;
          if (chapter.name.toLowerCase().includes(lowerQuery)) {
            matches.push({
              id: chapter.id,
              title: chapter.name,
              type: 'chapter',
              subtitle: `${subject.name} > ${cycle.name}`,
              url: `/chapter/${chapter.id}`
            });
          }

          for (const video of chapter.videos) {
            if (matches.length >= 10) break;
            if (video.title.toLowerCase().includes(lowerQuery)) {
              matches.push({
                id: video.id,
                title: video.title,
                type: 'video',
                subtitle: `${subject.name} > ${cycle.name} > ${chapter.name}`,
                url: `/watch/${video.id}`
              });
            }
          }
        }
      }
    }

    return matches;
  }, [deferredQuery, catalog]);

  return { results, isLoading };
}
