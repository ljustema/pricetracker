'use client';

import React from 'react';

interface NumberDisplayProps {
  value: number | null | undefined;
  className?: string;
}

export default function NumberDisplay({ value, className = '' }: NumberDisplayProps) {
  return (
    <span className={className}>
      {(value || 0).toLocaleString()}
    </span>
  );
}
