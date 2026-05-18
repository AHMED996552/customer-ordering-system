import React from 'react';

export const Spinner: React.FC = () => {
  return (
    <div
      role="status"
      className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};
