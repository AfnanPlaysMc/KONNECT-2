import React from 'react';

export function AppLogo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" id="konnect-app-logo">
      <defs>
        <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>
        <filter id="logo-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      
      {/* Connected nodes representing the futuristic Konnect Network */}
      <circle cx="35" cy="35" r="14" fill="url(#logo-grad)" filter="url(#logo-glow)" />
      <circle cx="65" cy="65" r="14" fill="url(#logo-grad)" filter="url(#logo-glow)" />
      
      {/* Elegant networking bridge curve */}
      <path 
        d="M35 35 C50 30, 50 70, 65 65" 
        stroke="url(#logo-grad)" 
        strokeWidth="6" 
        strokeLinecap="round" 
      />
      
      {/* Glowing connection junctions */}
      <circle cx="35" cy="35" r="5" fill="#FFFFFF" />
      <circle cx="65" cy="65" r="5" fill="#FFFFFF" />
      <circle cx="50" cy="48" r="3.5" fill="#93C5FD" />
    </svg>
  );
}
