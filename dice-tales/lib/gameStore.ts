import { useState, useCallback } from 'react';
import type { Character, Adventure } from './gameData';

const CHARACTERS_KEY = 'trpg_characters';
const ADVENTURES_KEY = 'trpg_adventures';

function loadFromStorage<T>(key: string, fallback: T[]): T[] {
  if (typeof window === 'undefined') return fallback;
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}

export function useGameStore() {
  const [characters, setCharacters] = useState<Character[]>(() => loadFromStorage(CHARACTERS_KEY, []));
  const [adventures, setAdventures] = useState<Adventure[]>(() => loadFromStorage(ADVENTURES_KEY, []));

  const addCharacter = useCallback((char: Character) => {
    setCharacters(prev => {
      const next = [...prev, char];
      saveToStorage(CHARACTERS_KEY, next);
      return next;
    });
  }, []);

  const addAdventure = useCallback((adv: Adventure) => {
    setAdventures(prev => {
      const next = [...prev, adv];
      saveToStorage(ADVENTURES_KEY, next);
      return next;
    });
  }, []);

  const updateAdventure = useCallback((id: string, updates: Partial<Adventure>) => {
    setAdventures(prev => {
      const next = prev.map(a => a.id === id ? { ...a, ...updates } : a);
      saveToStorage(ADVENTURES_KEY, next);
      return next;
    });
  }, []);

  const updateCharacter = useCallback((id: string, updates: Partial<Character>) => {
    setCharacters(prev => {
      const next = prev.map(c => c.id === id ? { ...c, ...updates } : c);
      saveToStorage(CHARACTERS_KEY, next);
      return next;
    });
  }, []);

  const isNewUser = characters.length === 0 && adventures.length === 0;

  return { characters, adventures, addCharacter, addAdventure, updateAdventure, updateCharacter, isNewUser };
}
