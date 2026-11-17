/**
 * Russian Name Declension Engine
 * Handles standard Russian masculine and feminine names in Genitive and Dative cases.
 */

const IRREGULAR_NAMES: Record<string, { genitive: string; dative: string; accusative: string }> = {
  'павел': { genitive: 'Павла', dative: 'Павлу', accusative: 'Павла' },
  'лев': { genitive: 'Льва', dative: 'Льву', accusative: 'Льва' },
  'петр': { genitive: 'Петра', dative: 'Петру', accusative: 'Петра' },
  'пётр': { genitive: 'Петра', dative: 'Петру', accusative: 'Петра' },
  'илья': { genitive: 'Ильи', dative: 'Илье', accusative: 'Илью' },
};

/**
 * Genitive case: "для кого?" (Подарок для Олега, для Лены, для Димы, для Ани)
 */
export function getGenitiveName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  if (IRREGULAR_NAMES[lower]) {
    return IRREGULAR_NAMES[lower].genitive;
  }

  const lastChar = lower.slice(-1);
  const secondLast = lower.length > 1 ? lower.slice(-2, -1) : '';

  // Female/Male ending in -а
  if (lastChar === 'а') {
    if (['г', 'к', 'х', 'ж', 'ч', 'ш', 'щ'].includes(secondLast)) {
      return trimmed.slice(0, -1) + 'и';
    }
    return trimmed.slice(0, -1) + 'ы';
  }

  // Female/Male ending in -я (Аня -> Ани, Катя -> Кати)
  if (lastChar === 'я') {
    return trimmed.slice(0, -1) + 'и';
  }

  // Soft sign -ь (Игорь -> Игоря)
  if (lastChar === 'ь') {
    return trimmed.slice(0, -1) + 'я';
  }

  // Ending in -й (Сергей -> Сергея, Андрей -> Андрея)
  if (lastChar === 'й') {
    return trimmed.slice(0, -1) + 'я';
  }

  // Standard masculine consonant ending (Олег -> Олега, Максим -> Максима)
  const consonants = 'бвгджзклмнпрстфхцчшщ';
  if (consonants.includes(lastChar)) {
    return trimmed + 'а';
  }

  return trimmed;
}

/**
 * Dative case: "кому?" (Дарят Олегу, Лене, Диме, Ане, Игорю)
 */
export function getDativeName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  if (IRREGULAR_NAMES[lower]) {
    return IRREGULAR_NAMES[lower].dative;
  }

  const lastChar = lower.slice(-1);

  // Ending in -а or -я (Лена -> Лене, Аня -> Ане, Дима -> Диме, Миша -> Мише)
  if (lastChar === 'а' || lastChar === 'я') {
    return trimmed.slice(0, -1) + 'е';
  }

  // Ending in -ь (Игорь -> Игорю)
  if (lastChar === 'ь') {
    return trimmed.slice(0, -1) + 'ю';
  }

  // Ending in -й (Сергей -> Сергею, Андрей -> Андрею)
  if (lastChar === 'й') {
    return trimmed.slice(0, -1) + 'ю';
  }

  // Masculine consonant ending (Олег -> Олегу)
  const consonants = 'бвгджзклмнпрстфхцчшщ';
  if (consonants.includes(lastChar)) {
    return trimmed + 'у';
  }

  return trimmed;
}

/**
 * Accusative case: "кого?"
 */
export function getAccusativeName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  if (IRREGULAR_NAMES[lower]) {
    return IRREGULAR_NAMES[lower].accusative;
  }

  const lastChar = lower.slice(-1);

  if (lastChar === 'а') {
    return trimmed.slice(0, -1) + 'у';
  }
  if (lastChar === 'я') {
    return trimmed.slice(0, -1) + 'ю';
  }

  return getGenitiveName(name);
}
