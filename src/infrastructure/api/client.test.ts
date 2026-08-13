import { describe, it, expect, vi } from 'vitest';

// src/config/env.ts computes API_BASE_URL eagerly at module load, so each
// test resets the module registry and sets env BEFORE importing.
describe('getStreamUrl', () => {
  it('builds telegram stream url from configured API base', async () => {
    vi.resetModules();
    import.meta.env.VITE_API_BASE_URL = 'http://localhost:10000';
    const { getStreamUrl } = await import('./client');
    expect(getStreamUrl({ id: 'vid123', source_type: 'telegram' }))
      .toBe('http://localhost:10000/api/stream/vid123');
  });

  it('builds drive url via the Cloudflare worker when configured', async () => {
    vi.resetModules();
    import.meta.env.VITE_API_BASE_URL = 'http://localhost:10000';
    import.meta.env.VITE_CLOUDFLARE_WORKER_URL = 'https://worker.dev';
    const { getStreamUrl } = await import('./client');
    expect(getStreamUrl({ id: 'vid123', source_type: 'drive', drive_file_id: 'drivexyz' }))
      .toBe('https://worker.dev/drive/drivexyz');
  });

  it('returns empty for drive sources without a worker URL', async () => {
    vi.resetModules();
    import.meta.env.VITE_API_BASE_URL = 'http://localhost:10000';
    delete import.meta.env.VITE_CLOUDFLARE_WORKER_URL;
    const { getStreamUrl } = await import('./client');
    expect(getStreamUrl({ id: 'vid123', source_type: 'drive', drive_file_id: 'drivexyz' }))
      .toBe('');
  });
});
