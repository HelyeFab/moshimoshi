import React from 'react';
import MoshimoshiLogo from './MoshimoshiLogo';

const Logo = () => {
  return (
    <div className="flex items-center gap-2">
      <MoshimoshiLogo 
        size="small" 
        variant="compact"
        showRomaji={true}
        className="text-gray-900 dark:text-white"
      />
    </div>
  );
};

export default Logo;
