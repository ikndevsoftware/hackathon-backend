import { detectBot, fixedWindow, shield } from '@arcjet/nest';

export type ArcjetMode = 'LIVE' | 'DRY_RUN';

export function buildArcjetRules(mode: ArcjetMode) {
  return [
    shield({ mode }),
    detectBot({
      mode,
      allow: ['CATEGORY:SEARCH_ENGINE'],
    }),
    fixedWindow({
      mode,
      window: '60s',
      max: 10,
    }),
  ];
}
