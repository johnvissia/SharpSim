'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';
import Link from 'next/link';

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
      position: 'relative',
    }}
  >
    <svg className="sports-balls" width="220" height="220" viewBox="0 0 150 150" style={{'marginBottom': '2rem'}}>
      {/* Basketball - top middle */}
      <g className="ball-1">
        <circle className="ball-path" cx="75" cy="45" r="28" stroke="white" strokeWidth="1.5" fill="none" />
        <path className="ball-path" d="M51 28 C 65 40, 85 40, 99 28" stroke="white" strokeWidth="1.5" fill="none" />
        <path className="ball-path" d="M51 62 C 65 50, 85 50, 99 62" stroke="white" strokeWidth="1.5" fill="none" />
        <path className="ball-path" d="M75 17 V 73" stroke="white" strokeWidth="1.5" fill="none" />
        <path className="ball-path" d="M47 45 H 103" stroke="white" strokeWidth="1.5" fill="none" />
      </g>
      {/* Baseball - bottom left */}
      <g className="ball-2">
        <circle className="ball-path" cx="45" cy="105" r="20" stroke="white" strokeWidth="1.5" fill="none" />
        <path className="ball-path" d="M32 96 C 45 100, 45 110, 32 114" stroke="white" strokeWidth="1" fill="none" />
        <path className="ball-path" d="M58 96 C 45 100, 45 110, 58 114" stroke="white" strokeWidth="1" fill="none" />
      </g>
      {/* Football - bottom right */}
      <g className="ball-3">
        <ellipse className="ball-path" cx="105" cy="105" rx="25" ry="18" stroke="white" strokeWidth="1.5" fill="none" />
        <path className="ball-path" d="M103 100h4" stroke="white" strokeWidth="1" fill="none" />
        <path className="ball-path" d="M103 103h4" stroke="white" strokeWidth="1" fill="none" />
        <path className="ball-path" d="M103 106h4" stroke="white" strokeWidth="1" fill="none" />
        <path className="ball-path" d="M103 109h4" stroke="white" strokeWidth="1" fill="none" />
        <path className="ball-path" d="M105 98v14" stroke="white" strokeWidth="1" fill="none" />
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

    <div className="login-button-wrapper">
        <Button asChild size="lg">
            <Link href="/dashboard">
                <LogIn className="mr-2 h-5 w-5" />
                Enter App
            </Link>
        </Button>
    </div>
  </div>
);

export { VantageLogo };
