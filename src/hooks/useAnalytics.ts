import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { analytics } from '../lib/analytics';

export function useAnalytics() {
  const location = useLocation();

  // Track page views automatically on route change
  useEffect(() => {
    analytics.track('page_view', {
      path: location.pathname,
      search: location.search,
      title: document.title
    });
  }, [location]);

  return {
    track: analytics.track.bind(analytics),
    identify: analytics.identify.bind(analytics)
  };
}
