import React from 'react';

interface SevenX7LogoProps {
  size?: 'xs' | 'small' | 'medium' | 'large';
  isWelcome?: boolean;
  onNewsClick?: () => void;
}

const SevenX7Logo: React.FC<SevenX7LogoProps> = ({ size = 'small', isWelcome = false, onNewsClick }) => {
  
  const getTextSize = () => {
      switch(size) {
          case 'xs': return 'text-[10px]';
          case 'small': return 'text-xs';
          case 'medium': return 'text-xl';
          case 'large': return 'text-4xl';
          default: return 'text-xs';
      }
  };

  const isLarge = size === 'large';
  const textSizeClass = getTextSize();
  
  // X needs to be significantly larger and bolder to act as the overlay anchor
  const xSizeClass = isLarge ? 'text-6xl' : size === 'medium' ? 'text-3xl' : size === 'xs' ? 'text-sm' : 'text-xl';
  
  // Precise negative margins to force the 'X' to overlay the 'n' in Seven and the '7'
  // Using em-based or pixel-based negative margins tailored to the size
  const getOverlapMargin = () => {
    switch(size) {
      case 'large': return 'mx-[-14px]';
      case 'medium': return 'mx-[-7px]';
      case 'xs': return 'mx-[-2px]';
      default: return 'mx-[-4px]';
    }
  };

  const marginClass = getOverlapMargin();

  return (
    <div className="group flex items-center justify-center font-display select-none leading-none h-fit">
      
      {/* SEVEN */}
      <span 
        className={`${textSizeClass} text-black font-black uppercase leading-none z-0`}
        style={{ letterSpacing: '-0.02em' }}
      >
        Seven
      </span>

      {/* X - The Overlaying Element */}
      <div 
        className={`relative flex items-center justify-center ${xSizeClass} leading-none ${marginClass} z-10 transition-transform group-hover:scale-110 duration-300`} 
        onClick={onNewsClick}
        style={{ cursor: onNewsClick ? 'pointer' : 'default' }}
      >
         <span 
            className="text-black font-black inline-block leading-none" 
            style={{ 
              fontFamily: 'Inter, sans-serif', 
              fontWeight: 1000,
              fontSize: '1.25em',
              // Subtle white outline (stroke) to create depth when overlaying 'n' and '7'
              filter: 'drop-shadow(1px 0 0 white) drop-shadow(-1px 0 0 white) drop-shadow(0 1px 0 white) drop-shadow(0 -1px 0 white)'
            }}
         >
            X
         </span>
      </div>

      {/* 7 */}
      <span 
        className={`${textSizeClass} text-black font-black uppercase leading-none z-0`}
        style={{ letterSpacing: '-0.02em' }}
      >
        7
      </span>

    </div>
  );
};

export default SevenX7Logo;
