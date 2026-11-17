import { getGenitiveName, getDativeName, getAccusativeName } from '../server/declension';

console.log('🧪 Starting Russian Name Declension Test Suite...');

const testCases = [
  { name: 'Олег', genitive: 'Олега', dative: 'Олегу' },
  { name: 'Лена', genitive: 'Лены', dative: 'Лене' },
  { name: 'Дима', genitive: 'Димы', dative: 'Диме' },
  { name: 'Аня', genitive: 'Ани', dative: 'Ане' },
  { name: 'Миша', genitive: 'Миши', dative: 'Мише' },
  { name: 'Катя', genitive: 'Кати', dative: 'Кате' },
  { name: 'Игорь', genitive: 'Игоря', dative: 'Игорю' },
  { name: 'Сергей', genitive: 'Сергея', dative: 'Сергею' },
  { name: 'Ольга', genitive: 'Ольги', dative: 'Ольге' },
  { name: 'Павел', genitive: 'Павла', dative: 'Павлу' },
  { name: 'Илья', genitive: 'Ильи', dative: 'Илье' },
];

testCases.forEach(({ name, genitive, dative }) => {
  const genResult = getGenitiveName(name);
  if (genResult !== genitive) {
    throw new Error(`Genitive failed for ${name}: expected "${genitive}", got "${genResult}"`);
  }

  const datResult = getDativeName(name);
  if (datResult !== dative) {
    throw new Error(`Dative failed for ${name}: expected "${dative}", got "${datResult}"`);
  }
});

console.log('✅ ALL RUSSIAN NAME DECLENSION TESTS PASSED 100%!');
