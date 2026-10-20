import React from 'react';

interface MaterialIconProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Clean Material Symbols Outlined Icon component
 * Used in action buttons and interactive controls across the portal.
 */
export const MaterialIcon: React.FC<MaterialIconProps> = ({
  name,
  className = '',
  style,
}) => {
  return (
    <span
      className={`material-symbols-outlined select-none inline-flex items-center justify-center align-middle ${className}`}
      style={{
        fontVariationSettings: "'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24",
        fontSize: 'inherit',
        lineHeight: 1,
        ...style,
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
};
