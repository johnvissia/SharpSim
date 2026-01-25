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
    <svg className="sports-balls" width="180" height="180" viewBox="0 0 120 120" style={{'marginBottom': '2rem'}}>
      {/* Basketball - top middle */}
      <g className="ball-1">
        <circle className="ball-path" cx="60" cy="40" r="22" stroke="white" strokeWidth="1.5" fill="none" />
        <path className="ball-path" d="M42 25 C 50 35, 70 35, 78 25" stroke="white" strokeWidth="1.5" fill="none" />
        <path className="ball-path" d="M42 55 C 50 45, 70 45, 78 55" stroke="white" strokeWidth="1.5" fill="none" />
        <path className="ball-path" d="M38 40 H 82" stroke="white" strokeWidth="1.5" fill="none" />
      </g>
      {/* Baseball - bottom left */}
      <g className="ball-2">
        <circle className="ball-path" cx="35" cy="85" r="16" stroke="white" strokeWidth="1.5" fill="none" />
        <path className="ball-path" d="M24 78 C 35 82, 35 88, 24 92" stroke="white" strokeWidth="1" fill="none" />
        <path className="ball-path" d="M46 78 C 35 82, 35 88, 46 92" stroke="white" strokeWidth="1" fill="none" />
      </g>
      {/* Football - bottom right */}
      <g className="ball-3">
        <ellipse className="ball-path" cx="85" cy="85" rx="20" ry="13" stroke="white" strokeWidth="1.5" fill="none" />
        <path className="ball-path" d="M83 81h4" stroke="white" strokeWidth="1" fill="none" />
        <path className="ball-path" d="M83 83h4" stroke="white" strokeWidth="1" fill="none" />
        <path className="ball-path" d="M83 85h4" stroke="white" strokeWidth="1" fill="none" />
        <path className="ball-path" d="M83 87h4" stroke="white" strokeWidth="1" fill="none" />
        <path className="ball-path" d="M85 80v10" stroke="white" strokeWidth="1" fill="none" />
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
