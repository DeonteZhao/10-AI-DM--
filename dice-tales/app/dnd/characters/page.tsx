"use client";

import { Suspense } from 'react';
import { CharacterSelectContent } from '@/components/CharacterSelectContent';

export default function DndCharactersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[var(--ink-color)] opacity-50 font-huiwen text-xl font-bold tracking-widest">LOADING...</div>}>
      <CharacterSelectContent type="dnd" />
    </Suspense>
  );
}
