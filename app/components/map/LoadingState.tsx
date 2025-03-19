'use client';

import React from 'react';

const LoadingState = () => {
  return (
    <div className="w-full h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <div className="text-lg text-gray-600">Loading map...</div>
      </div>
    </div>
  );
};

export default LoadingState; 