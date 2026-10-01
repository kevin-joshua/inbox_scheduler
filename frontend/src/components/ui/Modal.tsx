'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showHeader?: boolean;
}

export function Modal({ isOpen, onClose, title, children, size = 'md', showHeader = true }: ModalProps) {
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-[#202522]/10 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div className={`relative bg-white rounded-lg shadow-xl ${sizeClasses[size]} w-full mx-4 max-h-[90vh] overflow-y-auto`}>
        {showHeader && <div className="flex items-center justify-between p-4 border-b border-[#e6ece8]">
          <h2 className="text-xl font-semibold text-[#202522]">{title}</h2>
          <button onClick={onClose} className="text-[#9aa49f] hover:text-[#202522]">✕</button>
        </div>}
        {children}
      </div>
    </div>,
    document.body
  );
}
