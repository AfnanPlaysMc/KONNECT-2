import React from 'react';

export function AppLogo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" id="konnect-app-logo">
      <defs>
        <linearGradient id="logo-grad-primary" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#818CF8" />
        </linearGradient>
        <linearGradient id="logo-grad-accent" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <filter id="logo-glow-intense" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      {/* Outer elegant tech ring */}
      <circle cx="50" cy="50" r="44" stroke="url(#logo-grad-accent)" strokeWidth="1.5" strokeDasharray="6 3" className="opacity-40" />
      <circle cx="50" cy="50" r="38" stroke="url(#logo-grad-primary)" strokeWidth="1" className="opacity-25" />
      
      {/* Curved background pulse */}
      <path 
        d="M30 50 C30 35, 70 35, 70 50 C70 65, 30 65, 30 50 Z" 
        fill="none" 
        stroke="url(#logo-grad-accent)" 
        strokeWidth="3" 
        strokeLinecap="round"
        className="opacity-20"
      />

      {/* Main futuristic overlapping 'K' and infinity connection loop */}
      <path 
        d="M32 28 V72 M32 50 L64 28 M44 39 L64 72" 
        stroke="url(#logo-grad-primary)" 
        strokeWidth="8" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        filter="url(#logo-glow-intense)"
      />

      <path 
        d="M32 28 V72 M32 50 L64 28 M44 39 L64 72" 
        stroke="url(#logo-grad-accent)" 
        strokeWidth="3.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      
      {/* Radiant glow points at key intersection nodes */}
      <circle cx="32" cy="28" r="4.5" fill="#FFFFFF" filter="url(#logo-glow-intense)" />
      <circle cx="32" cy="72" r="4.5" fill="#FFFFFF" filter="url(#logo-glow-intense)" />
      <circle cx="64" cy="28" r="4.5" fill="#FFFFFF" filter="url(#logo-glow-intense)" />
      <circle cx="64" cy="72" r="4.5" fill="#FFFFFF" filter="url(#logo-glow-intense)" />
      
      {/* Core glowing nucleus */}
      <circle cx="32" cy="50" r="5" fill="url(#logo-grad-accent)" />
      <circle cx="32" cy="50" r="2.5" fill="#FFFFFF" />
    </svg>
  );
}
