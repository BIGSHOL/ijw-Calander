import React from 'react';

export const VideoLoading = ({ className = 'h-64' }: { className?: string }) => (
  <div className={`w-full flex items-center justify-center bg-white ${className}`}>
    <video autoPlay muted loop playsInline className="w-full h-full object-contain">
      <source src="/LoadingPage2.mp4" type="video/mp4" />
    </video>
  </div>
);
