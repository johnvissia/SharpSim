// This file has been removed to resolve a build conflict between the Next.js App Router and Pages Router.
// Its functionality is superseded by the debug tool at /api/debug-game-line-grading/route.ts.

export default function handler(req: any, res: any) {
  res.status(404).json({ error: 'Endpoint moved to /api/debug-game-line-grading' });
}
