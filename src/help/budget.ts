import type { HelpEntry } from './types'

// Help for the Budget module. Ships in the module's chunk.

export const budgetHelp = {
  'month.projection': {
    title: 'Hogyan számol a várható összeg?',
    body: [
      'A „várható hónap végén” azt mutatja, hová jut a hónap, ha a hátralévő napok a terv szerint mennek:',
      {
        list: [
          'A fix és egyenetlen sorok (lakbér, rezsi, egyszeri tételek, menza) a keretük és az eddigi költés közül a nagyobbal zárnak.',
          'Egy előfizetés a nyugtája szerinti összeggel számít, ha van nyugtája; ha nincs, a terhelés napjától a teljes összeggel. A hónap végére mind beszámít.',
          'Az ütemezett mindennapi sorok a hónap saját tempója és a keret tempója közti átlaggal folytatódnak. Minél később járunk a hónapban, annál többet számít a saját tempó.',
          'Az utazási tartalék a tartalék és a tényleges foglalás közül a nagyobbal zár.',
        ],
      },
      'A „valószínűleg” sáv azt mutatja, mennyit ingadozik a mindennapi költés napról napra ebben a hónapban. Egy hét adat után jelenik meg, és a váratlan egyszeri kiadásokat nem fedi le.',
      'A szín a nettó fizetéshez mér: zöld, ha alatta marad; sárga, ha száz eurón belül van; piros, ha fölé megy.',
    ],
  },
  'month.left': {
    title: 'Hátralévő keret',
    body: ['A teljes havi keret mínusz az eddigi költés, a már terhelt előfizetésekkel együtt. Negatív, ha a hónap már túllépte a keretet.'],
  },
  'month.rate': {
    title: 'Mindennapi napi átlag',
    body: [
      'A mindennapi sorok (élelmiszer, háztartás, italok, étterem, gyerekek, közlekedés, szabadidő, gyógyszertár) eddigi költése osztva az eltelt napokkal.',
      'Mellette az, amennyit a mindennapi keret naponta enged. Pirosra vált, ha az átlag 15%-kal fölötte jár.',
    ],
  },
  'month.subs': {
    title: 'Előfizetések',
    body: [
      'Ha egy előfizetésnek van nyugtája a hónapban, a nyugta tényleges összege számít a saját során (forintnál az árfolyamkülönbség is látszik), és nem kerül az Egyéb sorba is. Ha nincs nyugtája, a beállított terhelési napjától a teljes összegével számít elköltöttnek. A szám az eddig terhelteket mutatja, mellette az összes havi előfizetést.',
    ],
  },
  'month.headroom': {
    title: 'Mozgástér a nettó fizetéshez',
    body: [
      'A nettó fizetés mínusz a teljes havi keret, az utazási tartalékkal együtt. Ez a terv mozgástere, nem a tényleges költésé: negatív, ha már maga a keret is több a fizetésnél.',
    ],
  },
  'month.lines': {
    title: 'Sorok',
    body: [
      'Minden sor a havi keretét és az eddig elköltött összeget mutatja. A sáv a felhasználás arányában telik, és pirosra vált, ha a sor túllépte a keretét.',
      'Egy sorra koppintva látszik, hogyan állt össze a keret, és mely nyugták számítanak bele.',
      'Hogy egy nyugta tétele melyik sorba kerül, azt a tétel kategóriája dönti el. A forintos és a dolláros nyugták a hónap saját forint-, illetve dollárárfolyamán számítanak át. Amelyik pénznemhez nincs árfolyam, az a nyugta egyik összegbe sem számít bele, és a hónap nézet jelzi.',
    ],
  },
  'month.running': {
    title: 'Halmozott költés',
    body: [
      'A naponta összeadódó költés a havi keretig húzott egyenes mellett. A lakbér a hónap elején jön, ezért a görbe magasan indul, és jó esetben az egyenes alá laposodik.',
      'A görbe csak a rögzített nyugtákat számolja, a nyugtával rögzített előfizetésekkel együtt; a nyugta nélküli előfizetések a fenti összesítőkben vannak benne.',
    ],
  },
  'month.everyday': {
    title: 'Mindennapi költés naponta',
    body: ['A mindennapi sorok napi összege. A szaggatott vonal az, amennyit a mindennapi keret naponta enged.'],
  },
  'lines.settings': {
    title: 'A hónap alapadatai',
    body: [
      'A nettó fizetéshez mér a hónap színe és a mozgástér.',
      'A forint árfolyama azt adja meg, hány euró egy forint, a dolláré azt, hány euró egy dollár (a kártya árfolyama): ezeken számítanak át a forintos és a dolláros nyugták ebben a hónapban. Új hónap indításakor mindkettő átmásolódik.',
    ],
  },
  'lines.models': {
    title: 'Számítási módok',
    body: [
      {
        list: [
          'Fix: a keret és az eddigi költés közül a nagyobbal zár (lakbér, rezsi, egyszeri tételek).',
          'Egyenetlen: ugyanígy zár, de nagyobb, ritkább tételekből áll (például a menza).',
          'Ütemezett: a hónap tempója és a keret tempója közti átlaggal folytatódik (élelmiszer, közlekedés).',
          'Előfizetés: ha van nyugtája, annak összegével számít; ha nincs, a terhelés napjától a teljes összeg elköltöttnek számít.',
        ],
      },
    ],
  },
  'lines.start': {
    title: 'Új hónap indítása',
    body: [
      'Átmásolja ennek a hónapnak a sorait, nettó fizetését és árfolyamát a következő hónapba. Utána csak azt kell átírni, ami változik, például a kéthavonta érkező vízszámlát.',
    ],
  },
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
    title: 'Költségvetés: így működik',
    body: [
      { heading: 'Hónap' },
      'A hónap nézet a havi keretet veti össze azzal, amit a nyugták és az előfizetések eddig elköltöttek, és megbecsüli, hová jut a hónap vége.',
      'Ebben a modulban nincsenek külön összegek bevíve: minden szám a nyugtákból és a Sorok nézetben beállított keretekből jön.',
      { heading: 'Nyugták' },
      'Fotózd le a nyugtát, és küldd el Claude-nak. Claude elkészíti belőle a nyugta-XML-t, amit a Nyugták nézetben az Import gombbal töltesz fel. Az app ellenőrzi, és jelzi, ha valami nem stimmel vagy a nyugta már megvan.',
      { heading: 'Sorok' },
      'Itt állítható minden sor kerete, számítási módja és az indoklása, valamint a hónap nettó fizetése és árfolyama. A „Következő hónap indítása” átmásolja a hónapot, hogy csak a változásokat kelljen átírni.',
      { heading: 'Elemzés' },
      'Mélyebb elemzéshez (kategóriák, ÁFA, kereskedők) válassz időszakot a Nyugták nézetben, exportáld, és a fájlt add oda Claude-nak.',
    ],
  },
} satisfies Record<string, HelpEntry>
