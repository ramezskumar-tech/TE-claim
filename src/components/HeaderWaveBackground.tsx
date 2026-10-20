import React, { useMemo } from 'react';

/**
 * HeaderWaveBackground
 * 
 * Recreates the exact deep royal blue background with luminous flowing
 * cyan and electric blue harmonic contour wave ribbons from the user's reference image (az.jpg).
 */
export const HeaderWaveBackground: React.FC = () => {
  // Wave System 1: Primary Undulating Ribbon (Left crest -> trough -> towering right crest)
  const waveSystem1 = useMemo(() => {
    const paths: { d: string; strokeWidth: number; opacity: number }[] = [];
    for (let i = 0; i < 32; i++) {
      const t = i / 31.0;
      const y0 = 160 + i * 2.3;
      const cp1x = 90 + i * 1.5, cp1y = 45 + i * 2.8;
      const cp2x = 230 + i * 1.8, cp2y = 55 + i * 3.0;
      const p1x = 370 + i * 1.4, p1y = 120 + i * 2.1;
      const cp3x = 510 + i * 1.1, cp3y = 195 + i * 1.2;
      const cp4x = 680 + i * 1.2, cp4y = 185 + i * 1.0;
      const p2x = 860 + i * 1.0, p2y = 138 + i * 1.2;
      const cp5x = 1060 + i * 1.5, cp5y = 12 + i * 3.8;
      const cp6x = 1300 + i * 2.0, cp6y = 18 + i * 4.0;
      const p3x = 1600, p3y = 148 + i * 2.2;

      const strokeWidth = 0.85 + (1.0 - Math.abs(t - 0.5) * 2) * 0.4;
      let op = 0.25 + (1.0 - Math.abs(t - 0.5) * 1.4) * 0.55;
      op = Math.max(0.18, Math.min(0.85, op));

      paths.push({
        d: `M 0 ${y0.toFixed(1)} C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1x.toFixed(1)} ${p1y.toFixed(1)} C ${cp3x.toFixed(1)} ${cp3y.toFixed(1)}, ${cp4x.toFixed(1)} ${cp4y.toFixed(1)}, ${p2x.toFixed(1)} ${p2y.toFixed(1)} C ${cp5x.toFixed(1)} ${cp5y.toFixed(1)}, ${cp6x.toFixed(1)} ${cp6y.toFixed(1)}, ${p3x} ${p3y.toFixed(1)}`,
        strokeWidth,
        opacity: op,
      });
    }
    return paths;
  }, []);

  // Wave System 2: Harmonic Intersecting Ribbon (Cross-diagonal frequencies)
  const waveSystem2 = useMemo(() => {
    const paths: { d: string; strokeWidth: number; opacity: number }[] = [];
    for (let i = 0; i < 26; i++) {
      const t = i / 25.0;
      const y0 = 205 + i * 1.4;
      const cp1x = 180 + i * 1.2, cp1y = 175 + i * 1.6;
      const cp2x = 400 + i * 1.4, cp2y = 135 + i * 1.9;
      const p1x = 640 + i * 1.2, p1y = 110 + i * 2.1;
      const cp3x = 860 + i * 1.0, cp3y = 95 + i * 2.4;
      const cp4x = 1100 + i * 1.3, cp4y = 125 + i * 2.1;
      const p2x = 1330 + i * 1.2, p2y = 155 + i * 1.8;
      const cp5x = 1440 + i * 1.0, cp5y = 170 + i * 1.5;
      const cp6x = 1520 + i * 0.8, cp6y = 185 + i * 1.2;
      const p3x = 1600, p3y = 200 + i * 1.2;

      const strokeWidth = 0.8 + (1.0 - Math.abs(t - 0.5) * 2) * 0.35;
      let op = 0.2 + (1.0 - Math.abs(t - 0.4) * 1.5) * 0.5;
      op = Math.max(0.15, Math.min(0.75, op));

      paths.push({
        d: `M 0 ${y0.toFixed(1)} C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1x.toFixed(1)} ${p1y.toFixed(1)} C ${cp3x.toFixed(1)} ${cp3y.toFixed(1)}, ${cp4x.toFixed(1)} ${cp4y.toFixed(1)}, ${p2x.toFixed(1)} ${p2y.toFixed(1)} C ${cp5x.toFixed(1)} ${cp5y.toFixed(1)}, ${cp6x.toFixed(1)} ${cp6y.toFixed(1)}, ${p3x} ${p3y.toFixed(1)}`,
        strokeWidth,
        opacity: op,
      });
    }
    return paths;
  }, []);

  // Wave System 3: Lower Anchor Waves (Subtle base grounding flow)
  const waveSystem3 = useMemo(() => {
    const paths: { d: string; strokeWidth: number; opacity: number }[] = [];
    for (let i = 0; i < 16; i++) {
      const t = i / 15.0;
      const y0 = 220 + i * 1.0;
      const cp1x = 260 + i * 1.0, cp1y = 200 + i * 1.2;
      const cp2x = 620 + i * 1.2, cp2y = 180 + i * 1.5;
      const p1x = 920 + i * 1.0, p1y = 172 + i * 1.6;
      const cp3x = 1180 + i * 1.2, cp3y = 168 + i * 1.8;
      const cp4x = 1400 + i * 1.0, cp4y = 188 + i * 1.8;
      const p2x = 1600, p2y = 212 + i * 1.6;

      paths.push({
        d: `M 0 ${y0.toFixed(1)} C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1x.toFixed(1)} ${p1y.toFixed(1)} C ${cp3x.toFixed(1)} ${cp3y.toFixed(1)}, ${cp4x.toFixed(1)} ${cp4y.toFixed(1)}, ${p2x} ${p2y.toFixed(1)}`,
        strokeWidth: 0.75,
        opacity: 0.15 + t * 0.3,
      });
    }
    return paths;
  }, []);

  return (
    <div 
      className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none z-0"
      style={{
        background: 'radial-gradient(ellipse 90% 130% at 55% 40%, #0d2787 0%, #081a63 35%, #030c45 75%, #010626 100%)',
      }}
      aria-hidden="true"
    >
      <svg 
        className="w-full h-full object-cover select-none pointer-events-none" 
        viewBox="0 0 1600 240" 
        preserveAspectRatio="xMidYMid slice" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Linear Gradient for Wave System 1 (Cyan to Royal Blue to Electric Sky) */}
          <linearGradient id="waveGradCyan" x1="0%" y1="30%" x2="100%" y2="70%">
            <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.35" />
            <stop offset="18%" stopColor="#00d2ff" stopOpacity="0.75" />
            <stop offset="45%" stopColor="#2563eb" stopOpacity="0.6" />
            <stop offset="75%" stopColor="#38bdf8" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#1e40af" stopOpacity="0.3" />
          </linearGradient>

          {/* Linear Gradient for Wave System 2 (Luminous Electric Blue to Deep Azure) */}
          <linearGradient id="waveGradElectric" x1="0%" y1="80%" x2="100%" y2="20%">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.2" />
            <stop offset="30%" stopColor="#38bdf8" stopOpacity="0.7" />
            <stop offset="60%" stopColor="#60a5fa" stopOpacity="0.8" />
            <stop offset="90%" stopColor="#0284c7" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.2" />
          </linearGradient>

          {/* Linear Gradient for Wave System 3 (Subtle Base Foundation) */}
          <linearGradient id="waveGradBase" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Ambient atmospheric highlights */}
        <ellipse cx="920" cy="100" rx="550" ry="180" fill="#1e40af" opacity="0.22" />
        <ellipse cx="300" cy="80" rx="350" ry="120" fill="#0284c7" opacity="0.15" />

        {/* Wave System 1: Primary Undulating Ribbon */}
        <g stroke="url(#waveGradCyan)">
          {waveSystem1.map((p, idx) => (
            <path key={`w1-${idx}`} d={p.d} strokeWidth={p.strokeWidth} strokeOpacity={p.opacity} />
          ))}
        </g>

        {/* Wave System 2: Harmonic Intersecting Ribbon */}
        <g stroke="url(#waveGradElectric)">
          {waveSystem2.map((p, idx) => (
            <path key={`w2-${idx}`} d={p.d} strokeWidth={p.strokeWidth} strokeOpacity={p.opacity} />
          ))}
        </g>

        {/* Wave System 3: Lower Anchor Waves */}
        <g stroke="url(#waveGradBase)">
          {waveSystem3.map((p, idx) => (
            <path key={`w3-${idx}`} d={p.d} strokeWidth={p.strokeWidth} strokeOpacity={p.opacity} />
          ))}
        </g>
      </svg>

      {/* Top subtle highlight shimmer edge */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

      {/* Bottom border edge glow */}
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-blue-900/40 via-cyan-400/35 to-blue-900/40" />
    </div>
  );
};
