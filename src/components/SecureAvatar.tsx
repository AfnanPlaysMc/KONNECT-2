import React from 'react';

interface SecureAvatarProps {
  src: string;
  alt: string;
  className?: string;
}

export function SecureAvatar({ src, alt, className = "w-10 h-10 rounded-full" }: SecureAvatarProps) {
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div 
      className={`relative select-none overflow-hidden flex-shrink-0 ${className}`}
      onContextMenu={handleContextMenu}
    >
      {/* Real Image */}
      <img 
        src={src || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"} 
        alt={alt} 
        draggable="false"
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover select-none pointer-events-none no-screenshot-css"
      />
      
      {/* Invisible protective overlay to block save-as, clicks, and drag-and-drop */}
      <div className="absolute inset-0 bg-transparent cursor-default select-none" />
      
      {/* Visual cyber authenticity scanline effects */}
      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-transparent pointer-events-none mix-blend-overlay" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,_rgba(0,0,0,0.08)_50%)] bg-[size:100%_4px] pointer-events-none opacity-20" />
    </div>
  );
}
