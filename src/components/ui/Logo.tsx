import React from 'react';

const Logo = () => {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">
        も
      </div>
      <span className="text-2xl font-bold text-gray-900 dark:text-white">
        MoshiMoshi
      </span>
    </div>
  );
};

export default Logo;
