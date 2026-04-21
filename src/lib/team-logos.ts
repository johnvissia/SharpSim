'use client';

import * as React from 'react';
import type { LucideProps } from 'lucide-react';
import { Trophy } from 'lucide-react';

const BaseballIcon = (props: LucideProps) => (
    React.createElement('svg', {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props
    },
      React.createElement('circle', { cx: "12", cy: "12", r: "10" }),
      React.createElement('path', { d: "M12 2a7.5 7.5 0 0 0-7.5 7.5c0 1.15.26 2.24.73 3.22" }),
      React.createElement('path', { d: "M12 2a7.5 7.5 0 0 1 7.5 7.5c0 1.15-.26 2.24-.73 3.22" }),
      React.createElement('path', { d: "M2.5 9.56A7.5 7.5 0 0 1 12 22a7.5 7.5 0 0 1 9.5-12.44" })
    )
  );

const BasketballIcon = (props: LucideProps) => (
    React.createElement('svg', {
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        ...props
    },
        React.createElement('circle', { cx: '12', cy: '12', r: '10' }),
        React.createElement('path', { d: 'M4.22 14c-1.22-2.8-1.03-6.6.93-8.8' }),
        React.createElement('path', { d: 'M19.78 10c1.22 2.8 1.03 6.6-.93 8.8' }),
        React.createElement('path', { d: 'M10 4.22c2.8 1.22 6.6 1.03 8.8-.93' }),
        React.createElement('path', { d: 'M14 19.78c-2.8-1.22-6.6-1.03-8.8.93' }),
        React.createElement('path', { d: 'M2 10h20' }),
        React.createElement('path', { d: 'M12 2v20' })
    )
);

const FootballIcon = (props: LucideProps) => (
    React.createElement('svg', {
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        ...props
    },
      React.createElement('ellipse', { cx: "12", cy: "12", rx: "10", ry: "7" }),
      React.createElement('path', { d: "M12 2a10 7 0 0 0-10 7c0 2.24 1.79 4.1 4 5.3" }),
      React.createElement('path', { d: "M12 2a10 7 0 0 1 10 7c0 2.24-1.79 4.1-4 5.3" }),
      React.createElement('path', { d: "M7 12h2" }),
      React.createElement('path', { d: "M15 12h2" }),
      React.createElement('path', { d: "M12 7v10" })
    )
);

const FutbolIcon = (props: LucideProps) => (
    React.createElement('svg', {
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        ...props
    },
      React.createElement('circle', { cx: "12", cy: "12", r: "10" }),
      React.createElement('polygon', { points: "12 2 12 22 2 12 22 12" }),
      React.createElement('polygon', { points: "12 2 17 6.5 12 11 7 6.5" }),
      React.createElement('polygon', { points: "12 22 17 17.5 12 13 7 17.5" }),
      React.createElement('polygon', { points: "2 12 6.5 7 11 12 6.5 17" }),
      React.createElement('polygon', { points: "22 12 17.5 7 13 12 17.5 17" })
    )
);

const IceSkate = (props: LucideProps) => (
    React.createElement('svg', {
        xmlns: "http://www.w3.org/2000/svg",
        width: "24",
        height: "24",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        ...props
    },
      React.createElement('path', { d: "M2 16h20" }),
      React.createElement('path', { d: "M2 20h20" }),
      React.createElement('path', { d: "M6 16l-2.5 4" }),
      React.createElement('path', { d: "M18 16l2.5 4" }),
      React.createElement('path', { d: "M12 16V9a2 2 0 0 0-2-2H8" }),
      React.createElement('path', { d: "M18.5 6c-2 0-3.5-2-3.5-4" }),
      React.createElement('path', { d: "M6 2h10a2 2 0 0 1 2 2v10H4V4a2 2 0 0 1 2-2z" })
    )
);

export const sportIconMap: { [key: string]: React.ElementType<LucideProps> } = {
    'NBA': BasketballIcon,
    'WNBA': BasketballIcon,
    'NCAAM': BasketballIcon,
    'NFL': FootballIcon,
    'NHL': IceSkate,
    'Soccer': FutbolIcon,
    'MLB': BaseballIcon,
    'Default': Trophy,
};
