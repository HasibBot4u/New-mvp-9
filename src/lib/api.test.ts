import { describe, it, expect } from 'vitest';
import { getStreamUrl } from './api';

describe('api functions', () => {
  it('generates stream url correctly for telegram', () => {
    import.meta.env.VITE_API_BASE_URL = 'http://localhost:10000';
    const video = { id: 'vid123', source_type: 'telegram' };
    expect(getStreamUrl(video)).toBe('http://localhost:10000/api/stream/vid123');
  });

  it('generates stream url correctly for drive', () => {
    import.meta.env.VITE_CLOUDFLARE_WORKER_URL = 'https://worker.dev';
    const video = { id: 'vid123', source_type: 'drive', drive_file_id: 'drivexyz' };
    expect(getStreamUrl(video)).toBe('https://worker.dev/drive/drivexyz');
  });
});
