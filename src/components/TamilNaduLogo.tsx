import React, { useState } from 'react';

interface TamilNaduLogoProps {
  className?: string;
  alt?: string;
  glow?: boolean;
}

export const TamilNaduLogo: React.FC<TamilNaduLogoProps> = ({
  className = 'w-full h-full object-contain',
  alt = 'Government of Tamil Nadu Logo',
  glow = true,
}) => {
  const [errorStage, setErrorStage] = useState<number>(0);
  const combinedClassName = glow
    ? `${className} drop-shadow-[0_0_7px_rgba(255,255,255,0.75)] filter`
    : className;

  // Stage 0: Supabase portal_assets NM.png
  // Stage 1: Local cached asset (/NM.png)
  // Stage 2: Fallback to tn_gov_logo.1.png
  // Stage 3: Inline SVG Temple Gopuram & Ashoka Seal
  const supabaseLogoUrl = 'https://vqiejbhtwnarvshxvkhg.supabase.co/storage/v1/object/public/portal_assets/NM.png';
  const localUrl = '/NM.png';
  const fallbackUrl = 'https://vqiejbhtwnarvshxvkhg.supabase.co/storage/v1/object/public/portal_assets/tn_gov_logo.1.png';

  if (errorStage >= 3) {
    return (
      <svg
        viewBox="0 0 200 200"
        className={combinedClassName}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label={alt}
      >
        {/* Outer Circular Rim */}
        <circle cx="100" cy="100" r="94" fill="#FEF3C7" stroke="#92400E" strokeWidth="6" />
        <circle cx="100" cy="100" r="84" fill="#FFFFFF" stroke="#D97706" strokeWidth="2" strokeDasharray="4 2" />

        {/* Indian Flag Tricolor Accent Arc */}
        <path d="M 30 100 A 70 70 0 0 1 170 100" stroke="#EA580C" strokeWidth="5" fill="none" />
        <path d="M 30 100 A 70 70 0 0 0 170 100" stroke="#16A34A" strokeWidth="5" fill="none" />

        {/* Tamil Nadu Srivilliputhur Andal Temple Gopuram */}
        <path
          d="M 68 135 L 74 65 L 86 42 L 100 26 L 114 42 L 126 65 L 132 135 Z"
          fill="#D97706"
          stroke="#78350F"
          strokeWidth="2"
        />
        {/* Gopuram Kalasams (Top Finials) */}
        <circle cx="100" cy="22" r="3.5" fill="#B45309" />
        <circle cx="93" cy="24" r="2.5" fill="#B45309" />
        <circle cx="107" cy="24" r="2.5" fill="#B45309" />

        {/* Gopuram Tier Levels */}
        <line x1="72" y1="75" x2="128" y2="75" stroke="#78350F" strokeWidth="2" />
        <line x1="76" y1="90" x2="124" y2="90" stroke="#78350F" strokeWidth="2" />
        <line x1="80" y1="105" x2="120" y2="105" stroke="#78350F" strokeWidth="2" />
        <line x1="84" y1="120" x2="116" y2="120" stroke="#78350F" strokeWidth="2" />

        {/* Temple Door Portal */}
        <path d="M 92 135 L 92 118 Q 100 114 108 118 L 108 135 Z" fill="#78350F" />

        {/* Ashoka Lion Capital (Center Emblem) */}
        <rect x="91" y="80" width="18" height="18" rx="2" fill="#F59E0B" stroke="#78350F" strokeWidth="1.5" />
        <circle cx="100" cy="89" r="6" fill="#1E3A8A" />
        <circle cx="100" cy="89" r="2" fill="#FFFFFF" />

        {/* Tamil Inscription: தமிழ்நாடு அரசு */}
        <path id="textPathTop" d="M 38 78 A 66 66 0 0 1 162 78" fill="none" />
        <text fontSize="11" fontWeight="bold" fill="#78350F" textAnchor="middle">
          <textPath href="#textPathTop" startOffset="50%">
            தமிழ்நாடு அரசு
          </textPath>
        </text>

        {/* Motto: வாய்மையே வெல்லும் */}
        <rect x="62" y="145" width="76" height="15" rx="3" fill="#92400E" />
        <text x="100" y="156" fontSize="8" fontWeight="bold" fill="#FFFFFF" textAnchor="middle">
          வாய்மையே வெல்லும்
        </text>
      </svg>
    );
  }

  const currentSrc = errorStage === 0 ? supabaseLogoUrl : errorStage === 1 ? localUrl : fallbackUrl;

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={combinedClassName}
      onError={() => {
        setErrorStage((prev) => prev + 1);
      }}
    />
  );
};
