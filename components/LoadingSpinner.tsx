
import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 my-8">
      <div className="w-12 h-12 border-4 border-t-sky-400 border-r-sky-400 border-slate-600 rounded-full animate-spin"></div>
      <p className="text-slate-400">Brewing your perfect day...</p>
    </div>
  );
};

export default LoadingSpinner;
