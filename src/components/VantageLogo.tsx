'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/firebase';

const VantageLogo = () => {
  const { user } = useUser();

  return (
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
        {/* Soccer Ball - top middle */}
        <g className="ball-1">
          <circle className="ball-path" cx="75" cy="45" r="28" stroke="white" strokeWidth="1.5" fill="none" />
          <path className="ball-path" d="M75 35 L 85 42 L 81 53 L 69 53 L 65 42 Z" stroke="white" strokeWidth="1.5" fill="none" />
          <path className="ball-path" d="M75 35 L 75 17" stroke="white" strokeWidth="1.5" fill="none" />
          <path className="ball-path" d="M85 42 L 100 32" stroke="white" strokeWidth="1.5" fill="none" />
          <path className="ball-path" d="M81 53 L 90 68" stroke="white" strokeWidth="1.5" fill="none" />
          <path className="ball-path" d="M69 53 L 60 68" stroke="white" strokeWidth="1.5" fill="none" />
          <path className="ball-path" d="M65 42 L 50 32" stroke="white" strokeWidth="1.5" fill="none" />
        </g>
        {/* Baseball - bottom left */}
        <g className="ball-2">
          <circle className="ball-path" cx="45" cy="105" r="20" stroke="white" strokeWidth="1.5" fill="none" />
          <path className="ball-path" d="M35 88 C 45 95, 45 115, 35 122" stroke="white" strokeWidth="1.5" fill="none" />
          <path className="ball-path" d="M55 88 C 45 95, 45 115, 55 122" stroke="white" strokeWidth="1.5" fill="none" />
          <path className="ball-path" d="M38 95 L 41 97 M 40 105 L 43 105 M 38 115 L 41 113" stroke="white" strokeWidth="1" fill="none" />
          <path className="ball-path" d="M52 95 L 49 97 M 50 105 L 47 105 M 52 115 L 49 113" stroke="white" strokeWidth="1" fill="none" />
        </g>
        {/* Football - bottom right */}
        <g className="ball-3">
          <path className="ball-path" d="M80 105 Q 105 80, 130 105 Q 105 130, 80 105" stroke="white" strokeWidth="1.5" fill="none" />
          <path className="ball-path" d="M88 95 L 88 115" stroke="white" strokeWidth="1.5" fill="none" />
          <path className="ball-path" d="M122 95 L 122 115" stroke="white" strokeWidth="1.5" fill="none" />
          <path className="ball-path" d="M95 105 L 115 105" stroke="white" strokeWidth="1.5" fill="none" />
          <path className="ball-path" d="M98 102 v 6 M 102 102 v 6 M 106 102 v 6 M 110 102 v 6 M 114 102 v 6" stroke="white" strokeWidth="1" fill="none" />
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
              <Link href={user ? "/dashboard" : "/login"}>
                  <LogIn className="mr-2 h-5 w-5" />
                  Enter App
              </Link>
          </Button>
      </div>
    </div>
  );
};

export { VantageLogo };

