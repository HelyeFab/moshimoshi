'use client';

interface MoshimoshiLogoProps {
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  animated?: boolean;
  className?: string;
  variant?: 'inline' | 'stacked' | 'compact';
  showRomaji?: boolean;
}

const sizeConfig = {
  small: {
    japaneseFontSize: '1.25rem',
    romajiFontSize: '0.625rem',
    spacing: '0.125rem',
  },
  medium: {
    japaneseFontSize: '2rem',
    romajiFontSize: '0.875rem',
    spacing: '0.25rem',
  },
  large: {
    japaneseFontSize: '3.5rem',
    romajiFontSize: '1.25rem',
    spacing: '0.5rem',
  },
  xlarge: {
    japaneseFontSize: '5.5rem',
    romajiFontSize: '1.75rem',
    spacing: '0.75rem',
  },
};

export default function MoshimoshiLogo({
  size = 'medium',
  animated = false,
  className = '',
  variant = 'inline',
  showRomaji = true,
}: MoshimoshiLogoProps) {
  const config = sizeConfig[size];

  // Compact variant for navbars - horizontal layout with romaji beside
  if (variant === 'compact') {
    return (
      <div 
        className={`inline-flex items-baseline gap-2 ${className}`}
      >
        <span
          className="font-bold text-primary-500 dark:text-primary-400"
          style={{
            fontFamily: 'var(--font-family-logo-japanese)',
            fontSize: config.japaneseFontSize,
            lineHeight: 1,
            letterSpacing: '0.05em',
          }}
        >
          もしもし
        </span>
        {showRomaji && (
          <span
            className="font-medium text-gray-500 dark:text-gray-400 opacity-70"
            style={{
              fontSize: config.romajiFontSize,
              lineHeight: 1,
              letterSpacing: '0.1em',
              textTransform: 'lowercase',
            }}
          >
            moshimoshi
          </span>
        )}
      </div>
    );
  }

  // Stacked variant - vertical layout
  if (variant === 'stacked') {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <span
          className="font-bold text-primary-500 dark:text-primary-400"
          style={{
            fontFamily: 'var(--font-family-logo-japanese)',
            fontSize: config.japaneseFontSize,
            lineHeight: 1,
            letterSpacing: '0.05em',
          }}
        >
          もしもし
        </span>
        {showRomaji && (
          <span
            className="font-medium text-gray-500 dark:text-gray-400 opacity-70 mt-1"
            style={{
              fontSize: config.romajiFontSize,
              lineHeight: 1,
              letterSpacing: '0.1em',
              textTransform: 'lowercase',
            }}
          >
            moshimoshi
          </span>
        )}
      </div>
    );
  }

  // Default inline variant - vertical with romaji below
  return (
    <div 
      className={`inline-flex flex-col items-start leading-none ${className}`}
    >
      <span
        className="font-bold text-primary-500 dark:text-primary-400"
        style={{
          fontFamily: 'var(--font-family-logo-japanese)',
          fontSize: config.japaneseFontSize,
          lineHeight: 1,
          letterSpacing: '0.05em',
        }}
      >
        もしもし
      </span>
      {showRomaji && (
        <span
          className="font-medium text-gray-500 dark:text-gray-400 opacity-70"
          style={{
            fontSize: config.romajiFontSize,
            lineHeight: 1,
            marginTop: config.spacing,
            letterSpacing: '0.1em',
            textTransform: 'lowercase',
          }}
        >
          moshimoshi
        </span>
      )}
    </div>
  );
}

// Hero version for landing pages with gradient and animation
export function MoshimoshiLogoHero({
  animated = true,
  className = '',
  showRomaji = true,
}: {
  animated?: boolean;
  className?: string;
  showRomaji?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <h1 
        className="font-black bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600 bg-clip-text text-transparent inline-flex items-center"
        style={{
          fontFamily: 'var(--font-family-logo-japanese)',
          fontSize: 'clamp(3rem, 8vw, 6rem)',
          lineHeight: 1,
          letterSpacing: '0.05em',
          filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))',
        }}
      >
        {animated ? (
          <>
            <span className="animate-fade-in">も</span>
            <span className="animate-fade-in" style={{ animationDelay: '100ms' }}>し</span>
            <span className="animate-fade-in" style={{ animationDelay: '200ms' }}>も</span>
            <span className="animate-fade-in" style={{ animationDelay: '300ms' }}>し</span>
          </>
        ) : (
          'もしもし'
        )}
      </h1>
      {showRomaji && (
        <span
          className="font-medium text-gray-500 dark:text-gray-400 opacity-70 mt-2"
          style={{
            fontSize: 'clamp(0.875rem, 2vw, 1.5rem)',
            lineHeight: 1,
            letterSpacing: '0.15em',
            textTransform: 'lowercase',
          }}
        >
          moshimoshi
        </span>
      )}
    </div>
  );
}

export { MoshimoshiLogo };