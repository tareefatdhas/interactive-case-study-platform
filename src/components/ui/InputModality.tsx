'use client';

import { useEffect } from 'react';

export default function InputModality() {
  useEffect(() => {
    const root = document.documentElement;

    const usePointer = () => {
      root.dataset.inputModality = 'pointer';
    };

    const useKeyboard = (event: KeyboardEvent) => {
      if (event.metaKey || event.altKey || event.ctrlKey) return;
      root.dataset.inputModality = 'keyboard';
    };

    root.dataset.inputModality = 'keyboard';
    window.addEventListener('pointerdown', usePointer, true);
    window.addEventListener('keydown', useKeyboard, true);

    return () => {
      window.removeEventListener('pointerdown', usePointer, true);
      window.removeEventListener('keydown', useKeyboard, true);
      delete root.dataset.inputModality;
    };
  }, []);

  return null;
}
