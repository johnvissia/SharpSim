import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SharpSim: Sports Analytics & Edge Simulation',
    short_name: 'SharpSim',
    description: 'Real-time sports betting simulation, algorithmic edge modeling, and bankroll tracking.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#090a0f',
    theme_color: '#090a0f',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
