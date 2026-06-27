import React, { useEffect, useRef } from 'react';

interface SafeAdSenseAdProps {
  client: string;
  slot: string;
  style?: React.CSSProperties;
  format?: string;
  responsive?: string;
  className?: string;
}

export const SafeAdSenseAd: React.FC<SafeAdSenseAdProps> = ({
  client,
  slot,
  style = { display: 'block' },
  format = 'auto',
  responsive = 'true',
  className = ''
}) => {
  const isLoaded = useRef(false);

  useEffect(() => {
    if (isLoaded.current) return;
    
    const timer = setTimeout(() => {
      try {
        if (typeof window !== 'undefined') {
          const adsbygoogle = (window as any).adsbygoogle || [];
          adsbygoogle.push({});
          isLoaded.current = true;
          console.log(`[SafeAdSense] Successfully initialized ad unit for slot ${slot}`);
        }
      } catch (err) {
        console.warn("[SafeAdSense] Handled AdSense warning safely (normal if adblocker is active):", err);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [slot]);

  return (
    <div className={`adsense-wrapper overflow-hidden flex items-center justify-center ${className}`}>
      <ins
        className="adsbygoogle"
        style={style}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive}
      />
    </div>
  );
};
