import type { HelpEntry } from './types'

// Help for the Weekend module. Ships in the module's chunk.

export const weekendHelp = {
  'weekend.alerts': {
    title: 'Figyelmeztetések',
    body: [
      'A heti átnézés csütörtök este ellenőrzi a Meteocat, az AEMET és a Protecció Civil figyelmeztetéseit (eső, szél, hideg, hó, tenger, tűz), és Barcelona városi értesítéseit.',
      'A zöld pont azt jelenti, hogy a hétvégére nincs aktív figyelmeztetés; a borostyán, hogy van. A sávra koppintva látszanak a részletek és a hivatalos oldalak. Indulás reggelén érdemes újra megnézni a Meteocatot.',
    ],
  },
  'weekend.free': {
    title: 'Ingyenes programok',
    body: [
      'Jegy nélkül látogatható, vagy előzetes regisztrációval ingyenes. A lista a legközelebbivel kezdődik.',
      'A távolság hozzávetőleges közúti kilométer otthonról; az idő hétvégi autós vagy városon belül metrós, gyalogos menetidő.',
    ],
  },
  'weekend.paid': {
    title: 'Fizetős programok',
    body: [
      'Jegyes vagy belépős programok, a legközelebbivel kezdve. Az ár a forrás szerinti, tájékoztató jellegű.',
      'Az „Ellenőrizd” címke azt jelzi, hogy a forrás nem erősítette meg teljesen az idei dátumokat: indulás előtt nyisd meg a program oldalát.',
    ],
  },
  guide: {
    title: 'Hétvége: így működik',
    body: [
      { heading: 'Honnan jön' },
      'Minden csütörtök este egy ütemezett Claude-feladat átnézi a következő péntek–vasárnap családi programjait Barcelonában és autóval nagyjából 1 óra 15 percen belül, és ide menti őket. A programok leírása abban a nyelvben marad, ahogy a forrásokból összeállt.',
      { heading: 'Mi kerül be' },
      'Csak dátumhoz kötött vagy időszakos programok: fesztiválok, vásárok, előadások, foglalkozások, időszaki kiállítások. Az állandó látnivalók (parkok, állatkert, akvárium, szokásos múzeumlátogatás) kimaradnak.',
      { heading: 'Szűrők' },
      'A nap és a terület szűrője ezen az eszközön megmarad a következő megnyitásig.',
      { heading: 'Ha elavult' },
      'Ha a csütörtöki átnézés nem futott le, az előző hétvége listája látszik „Elavult” jelöléssel.',
    ],
  },
} satisfies Record<string, HelpEntry>
