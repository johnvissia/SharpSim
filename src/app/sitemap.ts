import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sharpsim.vercel.app';
  const lastModified = new Date();

  const routes = [
    '',
    '/dashboard',
    '/model',
    '/data',
    '/accuracy',
    '/store',
    '/soccer-pl',
    '/soccer-cl',
    '/terms',
    '/privacy',
    '/login',
    '/signup',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified,
    changeFrequency: route === '' || route === '/dashboard' ? 'hourly' : 'daily',
    priority: route === '' || route === '/dashboard' ? 1.0 : route === '/terms' || route === '/privacy' ? 0.3 : 0.8,
  }));
}
