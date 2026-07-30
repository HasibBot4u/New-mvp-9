import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.SITE_URL) {
  console.warn('Warning: SITE_URL env var not set. Falling back to http://localhost:5173');
}
const SITE_URL = process.env.SITE_URL ?? 'http://localhost:5173';

const pages = [
  '/',
  '/about',
  '/contact',
  '/pricing',
  '/privacy',
  '/terms',
  '/refund-policy',
  '/success-stories'
];

export function generateSitemap() {
  const lastmod = new Date().toISOString().split('T')[0];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (page) => `  <url>
    <loc>${SITE_URL}${page}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${page === '/' ? '1.0' : '0.8'}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  const distDir = path.resolve(__dirname, '../dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemap);
  console.log('Sitemap generated successfully in dist/sitemap.xml.');
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateSitemap();
}
