'use client';
import React from 'react';

const VantageLogo = () => (
  <div
    style={{
      backgroundColor: '#2C2F3E',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: 'calc(100vh - 5.5rem)',
      width: '100%',
      overflow: 'hidden',
    }}
  >
    <svg className="sports-balls" width="120" height="120" viewBox="0 0 100 100" style={{'marginBottom': '2rem'}}>
      {/* Basketball - top middle */}
      <g className="ball-1">
        <circle className="ball-path" cx="50" cy="30" r="18" stroke="white" strokeWidth="1.5" fill="none" />
        <path className="ball-path" d="M35.3 18.2 C 40 25, 60 25, 64.7 18.2" stroke="white" strokeWidth="1.5" fill="none" />
        <path className="ball-path" d="M35.3 41.8 C 40 35, 60 35, 64.7 41.8" stroke="white" strokeWidth="1.5" fill="none" />
        <path className="ball-path" d="M32 30 H 68" stroke="white" strokeWidth="1.5" fill="none" />
      </g>
      {/* Baseball - bottom left */}
      <g className="ball-2">
        <circle className="ball-path" cx="25" cy="70" r="14" stroke="white" strokeWidth="1.5" fill="none" />
        <path className="ball-path" d="M16 64 C 25 67, 25 73, 16 76" stroke="white" strokeWidth="1" fill="none" />
        <path className="ball-path" d="M34 64 C 25 67, 25 73, 34 76" stroke="white" strokeWidth="1" fill="none" />
      </g>
      {/* Football - bottom right */}
      <g className="ball-3">
        <ellipse className="ball-path" cx="75" cy="70" rx="18" ry="11" stroke="white" strokeWidth="1.5" fill="none" />
        <path className="ball-path" d="M73 66h4" stroke="white" strokeWidth="1" fill="none" />
        <path className="ball-path" d="M73 68h4" stroke="white" strokeWidth="1" fill="none" />
        <path className="ball-path" d="M73 70h4" stroke="white" strokeWidth="1" fill="none" />
        <path className="ball-path" d="M73 72h4" stroke="white" strokeWidth="1" fill="none" />
        <path className="ball-path" d="M75 65v10" stroke="white" strokeWidth="1" fill="none" />
      </g>
    </svg>

    <svg className="signature" viewBox="0 0 500 80">
      <text className="signature-text" x="50%" y="50%" dy=".35em" textAnchor="middle">
        Vantage Bets
      </text>
    </svg>

    <div className="slogan-wrapper">
      <p className="slogan">FUTURISTIC BETTING</p>
    </div>
  </div>
);

export { VantageLogo };
