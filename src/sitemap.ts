import fs from 'fs';
import path from 'path';

const SITE_URL = 'https://nexusedu.com';

const pages = [
  '/',
  '/courses/physics',
  '/courses/chemistry',
  '/courses/math',
  '/about',
  '/pricing'
];

export function generateSitemap() {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (page) => `  <url>
    <loc>${SITE_URL}${page}</loc>
    <changefreq>daily</changefreq>
    <priority>${page === '/' ? '1.0' : '0.8'}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  const publicDir = path.resolve(__dirname, '../public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
  }
  
  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap);
  console.log('Sitemap generated successfully.');
}

// Execute if run directly
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  generateSitemap();
}
