import React, { useEffect, useState, useId } from 'react';

interface MovingBorderLinesProps {
  cardRef: React.RefObject<HTMLDivElement | null>;
}

export const MovingBorderLines: React.FC<MovingBorderLinesProps> = ({ cardRef }) => {
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const uniqueId = useId().replace(/[^a-zA-Z0-9]/g, '_');

  useEffect(() => {
    const updateDims = () => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setDimensions({ width: rect.width, height: rect.height });
        }
      }
    };

    updateDims();

    if (!cardRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    ro.observe(cardRef.current);
    window.addEventListener('resize', updateDims);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateDims);
    };
  }, [cardRef]);

  if (dimensions.width === 0 || dimensions.height === 0) {
    return null;
  }

  const W = dimensions.width;
  const H = dimensions.height;
  const R = 24; // matches rounded-3xl corner radius
  const strokeWidth = 1.25; // Thin, refined laser-sharp line
  const inset = strokeWidth / 2; // Inset so stroke sits precisely along the card edge

  const x = inset;
  const y = inset;
  const w = W - 2 * inset;
  const h = H - 2 * inset;
  const r = Math.max(0, Math.min(R - inset, w / 2, h / 2));

  // Normalized pathLength for mathematically seamless, jitter-free looping
  const PATH_LENGTH = 1000;
  // Moving line length: smooth visible streak (26% of card perimeter)
  const lineLength = 260;
  const gapLength = PATH_LENGTH - lineLength;
  const dashArray = `${lineLength} ${gapLength}`;

  // Clockwise Path starting exactly at TOP CENTER: (W / 2, y)
  const centerX = W / 2;
  const pathD = [
    `M ${centerX} ${y}`,
    `L ${x + w - r} ${y}`,
    `A ${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `L ${x + w} ${y + h - r}`,
    `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `L ${x + r} ${y + h}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `L ${x} ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    `L ${centerX} ${y}`,
    'Z',
  ].join(' ');

  // Animation duration: 8.5s for graceful, silky smooth movement
  const animDuration = 8.5;

  // Scoped keyframe names
  const keyframesName1 = `pursuitLine1_${uniqueId}`;
  const keyframesName2 = `pursuitLine2_${uniqueId}`;

  // Gradient IDs
  const gradId1 = `borderGrad1_${uniqueId}`;
  const gradId2 = `borderGrad2_${uniqueId}`;

  return (
    <>
      <style>{`
        @keyframes ${keyframesName1} {
          0% {
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dashoffset: -${PATH_LENGTH};
          }
        }
        @keyframes ${keyframesName2} {
          0% {
            stroke-dashoffset: -${PATH_LENGTH / 2};
          }
          100% {
            stroke-dashoffset: -${PATH_LENGTH * 1.5};
          }
        }
        .pursuit-line-1-${uniqueId} {
          animation: ${keyframesName1} ${animDuration}s linear infinite;
          will-change: stroke-dashoffset;
        }
        .pursuit-line-2-${uniqueId} {
          animation: ${keyframesName2} ${animDuration}s linear infinite;
          will-change: stroke-dashoffset;
        }
      `}</style>

      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible"
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ pointerEvents: 'none' }}
      >
        <defs>
          {/* Gradient 1: Smooth Violet -> Fuchsia -> Pink -> Cyan */}
          <linearGradient id={gradId1} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="35%" stopColor="#d946ef" />
            <stop offset="70%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>

          {/* Gradient 2: Smooth Pink -> Violet -> Emerald -> Cyan */}
          <linearGradient id={gradId2} x1="100%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="35%" stopColor="#8b5cf6" />
            <stop offset="70%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>

          {/* Smooth delicate glow filter */}
          <filter id={`glow_${uniqueId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Soft Ambient Glow Layer Line 1 */}
        <path
          d={pathD}
          pathLength={PATH_LENGTH}
          fill="none"
          stroke={`url(#${gradId1})`}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={dashArray}
          className={`pursuit-line-1-${uniqueId}`}
          opacity={0.35}
          filter={`url(#glow_${uniqueId})`}
        />

        {/* Crisp Smooth Thin Line 1 */}
        <path
          d={pathD}
          pathLength={PATH_LENGTH}
          fill="none"
          stroke={`url(#${gradId1})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={dashArray}
          className={`pursuit-line-1-${uniqueId}`}
          opacity={0.95}
        />

        {/* Soft Ambient Glow Layer Line 2 */}
        <path
          d={pathD}
          pathLength={PATH_LENGTH}
          fill="none"
          stroke={`url(#${gradId2})`}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={dashArray}
          className={`pursuit-line-2-${uniqueId}`}
          opacity={0.35}
          filter={`url(#glow_${uniqueId})`}
        />

        {/* Crisp Smooth Thin Line 2 */}
        <path
          d={pathD}
          pathLength={PATH_LENGTH}
          fill="none"
          stroke={`url(#${gradId2})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={dashArray}
          className={`pursuit-line-2-${uniqueId}`}
          opacity={0.95}
        />
      </svg>
    </>
  );
};
