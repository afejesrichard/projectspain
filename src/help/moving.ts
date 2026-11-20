import type { HelpEntry } from './types'

// Help for the Moving module (inventory, boxes). Ships in the module's chunk.

export const movingHelp = {
  'item.publish': {
    title: 'Publikus oldal',
    body: [
      'Bekapcsolva a tárgy megjelenik a publikus katalógusban, amit a megosztott linkkel bárki megnyithat, belépés nélkül.',
      'A katalógus a fotókat és a tárgy adatait mutatja. A privát jegyzetek soha nem kerülnek ki.',
      'Csak eladó és ingyen elvihető tárgy tehető publikussá.',
    ],
  },
  'item.box': {
    title: 'Doboz',
    body: [
      'Csak a Visszük tárgyakat lehet dobozba tenni, és csak olyan dobozba, ami se nincs lezárva, se nincs kicsomagolva.',
      'Ha a tárgyat később eladóra, ingyen elvihetőre vagy kidobandóra állítod, magától kikerül a dobozból.',
    ],
  },
  'box.number': {
    title: 'A doboz száma',
    body: [
      'A szám az, amit filccel a dobozra írtatok. Ha eltér, a ceruzával írd át arra, ami a dobozon áll: a benne lévő tárgyak követik az új számot.',
      'Foglalt számra nem lehet átszámozni. Ilyenkor előbb a másik dobozt számozd át.',
    ],
  },
  'box.sealed': {
    title: 'Lezárva',
    body: [
      'Leragasztva, több nem kerül bele. A tárgyak dobozválasztója a lezárt dobozokat nem kínálja fel.',
    ],
  },
  'box.unpacked': {
    title: 'Kicsomagolva',
    body: [
      'Az új helyen minden kikerült belőle. A kicsomagolt dobozokat és a bennük lévő tárgyakat a Dobozok és a Leltár lista alapból elrejti, a szűrőgombbal előhozhatók.',
      'Kicsomagolt dobozt a tartalmával együtt ki lehet üríteni az adatlap alján: a doboz és a benne nyilvántartott tárgyak törlődnek.',
    ],
  },
  'box.items': {
    title: 'Becsomagolt tárgyak',
    body: [
      'Tárgyat a leltárban, egy Visszük tárgy adatlapján lehet ebbe a dobozba tenni, a Doboz résznél.',
    ],
  },
  guide: {
    title: 'Költözés: így működik',
    body: [
      { heading: 'Leltár' },
      'Minden tárgy kap egy besorolást, ez dönti el, mi lesz vele:',
      {
        list: [
          'Visszük: jön velünk, dobozba tehető.',
          'Eladó: árat kaphat, és megjelenhet a publikus oldalon.',
          'Ingyen elvihető: elajándékozzuk; a jegyzetben érdemes rögzíteni, kinek ígértük.',
          'Kidob: nem jön, nem is adjuk tovább.',
        ],
      },
      'Az állapot (Elérhető, Lefoglalva, Elment) az eladó és elajándékozott tárgyak sorsát követi.',
      { heading: 'Dobozok' },
      'Hozz létre egy dobozt, írd a számát a dobozra, és fotózd le, ami belekerül. Ha leragasztottátok, kapcsold Lezártra; az új helyen, ha kiürült, Kicsomagoltra.',
      { heading: 'Publikus link' },
      'A menüben és az Áttekintésen lévő gomb a publikus katalógus linkjét másolja. Csak a publikusra kapcsolt tárgyak látszanak rajta.',
    ],
  },
} satisfies Record<string, HelpEntry>
