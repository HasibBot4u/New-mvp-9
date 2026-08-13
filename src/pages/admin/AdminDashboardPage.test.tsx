// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import AdminDashboardPage from './AdminDashboardPage';

// Chainable supabase query stub: any method chain resolves to an empty
// successful result, matching the safeQuery(..., fallback) pattern used
// by the dashboard.
function makeChain() {
  const ret: any = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') {
        return (resolve: any, reject: any) =>
          Promise.resolve({ data: [], error: null }).then(resolve, reject);
      }
      return () => ret;
    },
  });
  return ret;
}

vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    from: () => makeChain(),
    rpc: () => Promise.resolve({ data: null, error: null }),
    channel: () => ({ on: () => ({ on: () => ({ subscribe: () => {} }) }), subscribe: () => {} }),
    removeChannel: () => {},
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
  },
}));
vi.mock('@/shared/hooks/useAdminStats', () => ({
  useAdminStats: () => ({
    stats: { live_users: 1, active_streams: 0, server_resources: { cpu_percent: 1, memory_percent: 1 } },
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/features/live/useRealtime', () => ({ useRealtime: () => ({}) }));
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('@/features/catalog/CatalogContext', () => ({ useCatalog: () => ({ refresh: vi.fn(), catalog: null }) }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: {
      stats: { total_users: 10, total_videos: 5, total_subjects: 2, total_chapters: 3, total_watch_seconds: 3600 },
      chart: [],
      activity: []
    },
    isLoading: false,
    refetch: vi.fn()
  })
}));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: () => <div data-testid="bar-chart" />,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null
}));

describe('AdminDashboardPage', () => {
  it('renders dashboard with stats', async () => {
    const { findByText } = render(<AdminDashboardPage />);
    // The dashboard gates on async fetches (metrics + supabase fan-out),
    // so assert with async queries. Stage 2: the old assertions targeted
    // Bengali labels that no longer exist anywhere in the component.
    expect(await findByText('Overview', {}, { timeout: 4000 })).toBeTruthy();
    expect(await findByText('Recent Signups', {}, { timeout: 4000 })).toBeTruthy();
  });
});
