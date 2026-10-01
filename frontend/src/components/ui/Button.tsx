import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const baseStyles = 'rounded-lg font-medium transition-colors focus:outline-none focus:ring-2';
  
  const variantStyles = {
    primary: 'bg-[#5cc79b] text-white hover:bg-[#48b687] focus:ring-[#5cc79b]',
    secondary: 'bg-[#edf3f0] text-[#53605a] hover:bg-[#e3ebe7] focus:ring-[#a9cdbd]',
    danger: 'bg-[#fff2f1] text-[#da6b64] border border-[#f5cfcc] hover:bg-[#ffe8e5] focus:ring-[#efb2ae]',
    outline: 'bg-white border border-[#b6e3d0] text-[#31936a] hover:bg-[#f0fbf6] focus:ring-[#93d7bb]',
  };
  
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
