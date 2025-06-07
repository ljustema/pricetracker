'use client';

import React from 'react';

interface NumberDisplayProps {
  value: number;
  className?: string;
}

export default function NumberDisplay({ value, className = '' }: NumberDisplayProps) {
  return (
    <span className={className}>
      {value.toLocaleString()}
    </span>
  );
}
