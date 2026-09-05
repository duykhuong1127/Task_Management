import React from 'react';
import logoImg from './logo.jpg';

interface PhongPhuLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const PhongPhuLogo: React.FC<PhongPhuLogoProps> = ({ className = '', size = 'md' }) => {
  const heightClass =
    size === 'sm' ? 'h-8' : size === 'lg' ? 'h-12' : 'h-9 sm:h-10';

  return (
    <div
      className={`inline-flex items-center justify-center overflow-hidden rounded-md border border-[#333] bg-transparent select-none shrink-0 ${heightClass} ${className}`}
      title="CTY CP Dệt Gia Dụng Phong Phú"
    >
      <img
        src={logoImg}
        alt="CTY CP Dệt Gia Dụng Phong Phú"
        className="h-full w-auto max-h-full object-contain rounded"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

