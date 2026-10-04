import React from 'react';

interface HospitalLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showText?: boolean;
  layout?: 'horizontal' | 'vertical';
}

export const HospitalLogo: React.FC<HospitalLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  layout = 'horizontal',
}) => {
  // Dimension sizing presets
  const sizeMap = {
    sm: { icon: 34, text: 'text-xs tracking-[0.24em]' },
    md: { icon: 42, text: 'text-sm tracking-[0.28em]' },
    lg: { icon: 54, text: 'text-base tracking-[0.3em]' },
    hero: { icon: 72, text: 'text-lg tracking-[0.32em]' },
  };

  const currentSize = sizeMap[size];

  return (
    <div
      className={`inline-flex items-center ${
        layout === 'vertical' ? 'flex-col text-center gap-1.5' : 'gap-2.5'
      } select-none ${className}`}
    >
      {/* Vector Mark SVG */}
      <svg
        width={currentSize.icon}
        height={currentSize.icon}
        viewBox="0 0 100 86"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-200 hover:scale-105"
      >
        {/* Soft Background Plate */}
        <rect width="100" height="86" rx="18" fill="#FFFFFF" />

        {/* ==========================================
            TWO OVERLAPPING CAPSULES
            Capsule 1: Royal Blue (#1E4ED8)
            Capsule 2: Vibrant Green (#22C55E)
            ========================================== */}
        <g id="capsules">
          {/* Blue Capsule (-24 deg) */}
          <g transform="rotate(-24 43 32)">
            <rect x="25" y="24" width="36" height="16" rx="8" fill="#1E4ED8" />
            <line x1="43" y1="24" x2="43" y2="40" stroke="#FFFFFF" strokeWidth="1.2" strokeOpacity="0.75" />
            <path d="M 29 27 Q 38 25 41 27" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.6" />
          </g>

          {/* Green Capsule (+24 deg, overlapping) */}
          <g transform="rotate(24 57 32)">
            <rect x="39" y="24" width="36" height="16" rx="8" fill="#22C55E" />
            <line x1="57" y1="24" x2="57" y2="40" stroke="#FFFFFF" strokeWidth="1.2" strokeOpacity="0.75" />
            <path d="M 61 27 Q 70 25 73 27" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.6" />
          </g>

          {/* ==========================================
              SMALL CALENDAR ICON MERGED INTO CAPSULES
              ========================================== */}
          <g id="calendar-icon" transform="translate(42, 22)">
            {/* White Calendar base */}
            <rect x="0" y="2" width="16" height="15" rx="3" fill="#FFFFFF" stroke="#1B2B4B" strokeWidth="1.2" />
            {/* Blue Header Bar */}
            <path d="M 0.5 6.5 L 15.5 6.5" stroke="#1E4ED8" strokeWidth="1.8" strokeLinecap="round" />
            {/* Twin Ring Pins */}
            <rect x="3" y="0.5" width="1.6" height="3" rx="0.8" fill="#1B2B4B" />
            <rect x="11.4" y="0.5" width="1.6" height="3" rx="0.8" fill="#1B2B4B" />
            {/* Grid dots */}
            <circle cx="4" cy="9.8" r="0.9" fill="#1E4ED8" />
            <circle cx="8" cy="9.8" r="0.9" fill="#22C55E" />
            <circle cx="12" cy="9.8" r="0.9" fill="#1E4ED8" />
            <circle cx="4" cy="13" r="0.9" fill="#22C55E" />
            <circle cx="8" cy="13" r="0.9" fill="#1E4ED8" />
            <circle cx="12" cy="13" r="0.9" fill="#22C55E" />
          </g>
        </g>

        {/* ==========================================
            TWO ROYAL BLUE (#1E4ED8) CUPPED HANDS
            ========================================== */}
        <g id="cupped-hands">
          {/* Left Cupped Hand */}
          <path
            d="M 17 48
               C 16 54, 20 60, 27 64
               C 34 68, 43 70, 53 67
               C 55 66, 56 64, 54 62
               C 53 60, 50 61, 48 61
               C 39 63, 32 62, 26 58
               C 22 55, 19 51, 19 47
               C 19 44, 17 44, 17 48 Z"
            fill="#1E4ED8"
          />
          <path
            d="M 23 44
               C 23 49, 29 53, 37 55
               C 39 56, 40 53, 38 52
               C 32 50, 27 47, 27 43
               C 27 41, 23 41, 23 44 Z"
            fill="#1E4ED8"
            opacity="0.85"
          />

          {/* Right Cupped Hand */}
          <path
            d="M 83 48
               C 84 54, 80 60, 73 64
               C 66 68, 57 70, 47 67
               C 45 66, 44 64, 46 62
               C 47 60, 50 61, 52 61
               C 61 63, 68 62, 74 58
               C 78 55, 81 51, 81 47
               C 81 44, 83 44, 83 48 Z"
            fill="#1E4ED8"
          />
          <path
            d="M 77 44
               C 77 49, 71 53, 63 55
               C 61 56, 60 53, 62 52
               C 68 50, 73 47, 73 43
               C 73 41, 77 41, 77 44 Z"
            fill="#1E4ED8"
            opacity="0.85"
          />
        </g>
      </svg>

      {/* Typography: "MEDIBOOK" in thin navy (#1B2B4B) sans-serif */}
      {showText && (
        <span
          className={`font-light text-[#1B2B4B] uppercase font-sans ${currentSize.text} leading-none`}
          style={{ letterSpacing: '0.28em' }}
        >
          MEDIBOOK
        </span>
      )}
    </div>
  );
};
