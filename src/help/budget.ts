import type { HelpEntry } from './types'

// Help for the Budget module (receipts for now). Ships in the module's chunk.

export const budgetHelp = {
  'receipts.list': {
    title: 'Nyugták',
    body: [
      'A lista a kiválasztott időszak és a keresés nyugtáit mutatja, a nyugta saját helyi dátuma szerint.',
      'A fejléc összege a látható nyugták végösszegeinek összege, pénznemenként. Ennél több elemzés itt nincs: kategóriák, ÁFA és kereskedők szerinti bontást Claude készít az exportált fájlból.',
      'Az Export a kiválasztott időszak nyugtáit tölti le egy XML fájlba, pontosan úgy, ahogy importálva lettek. A „Mind” nézetben nem aktív: előbb válassz időszakot.',
    ],
  },
  'receipts.import': {
    title: 'Nyugta importálása',
    body: [
      'A nyugtáról készült fotót Claude alakítja át nyugta-XML-lé. Ezt a fájlt töltsd fel itt, vagy illeszd be a szövegét.',
      'Importálás előtt az app minden nyugtát ellenőriz:',
      {
        list: [
          'Hibás szerkezetű nyugta nem kerül be, az okát kiírja.',
          'Ha a tételek összege nem egyezik a nyomtatott végösszeggel, figyelmeztet. Ilyenkor csak akkor importálja, ha bejelölöd az „importálás mindenképp” lehetőséget.',
          'Ha azonos adószámú (NIF) és nyugtaszámú nyugta már van, alapból kihagyja, de választhatod az importálást.',
          'Azonos azonosítójú nyugta soha nem kerül be kétszer.',
        ],
      },
      'A nyugta tartalmát az app nem módosítja: pontosan azt tárolja és exportálja, amit kapott.',
    ],
  },
  'receipt.badges': {
    title: 'Forrás és megbízhatóság',
    body: [
      'A forrás azt mutatja, miből készült a nyugta: photo (fotó), text (leírás vagy beillesztett szöveg), manual (kézi bevitel).',
      'A megbízhatóság (high, medium, low) azt, mennyire biztos a teljes nyugta adata. Ami nem a papírról lett leolvasva, hanem kikövetkeztetve, azt a nyugta maga is jelöli.',
    ],
  },
  'receipt.warnings': {
    title: 'Figyelmeztetések',
    body: [
      'Ezek az importáláskor talált eltérések, jellemzően számolási különbségek a tételek és a végösszeg között. A nyugta ennek ellenére bekerült, mert importáláskor jóváhagytátok.',
    ],
  },
  guide: {
    title: 'Nyugták: a folyamat',
    body: [
      { heading: '1. Fotó' },
      'Fotózd le a nyugtát, és küldd el Claude-nak.',
      { heading: '2. Nyugta-XML' },
      'Claude elkészíti belőle a nyugta-XML fájlt: tételek, kategóriák, ÁFA, és egy ellenőrzés, hogy az összeg stimmel-e.',
      { heading: '3. Import' },
      'Itt, a Nyugták nézetben az Import gombbal töltsd fel. Az app ellenőrzi, és jelzi, ha valami nem stimmel vagy a nyugta már megvan.',
      { heading: '4. Export és elemzés' },
      'Válassz időszakot, exportáld, és a fájlt add oda Claude-nak elemzésre.',
    ],
  },
} satisfies Record<string, HelpEntry>
