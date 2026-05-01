// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import AdminDashboardPage from './AdminDashboardPage';

// Mock everything out
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('@/contexts/CatalogContext', () => ({ useCatalog: () => ({ refresh: vi.fn(), catalog: null }) }));
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
  it('renders dashboard with stats', () => {
    const { getByText } = render(<AdminDashboardPage />);
    expect(getByText('মোট ব্যবহারকারী')).toBeTruthy();
    expect(getByText('10')).toBeTruthy();
  });
});
