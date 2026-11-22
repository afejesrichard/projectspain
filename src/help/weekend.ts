import type { HelpEntry } from './types'

// Help for the Weekend module. Ships in the module's chunk.

export const weekendHelp = {
  'weekend.alerts': {
    title: 'Figyelmeztetések',
    body: [
      'Az időjárás a hétvégi listától független: egy külön feladat minden reggel ellenőrzi a Meteocat, az AEMET és a Protecció Civil figyelmeztetéseit (eső, szél, hideg, hó, tenger, tűz) és Barcelona városi értesítéseit, és elmenti a mai és a következő két nap előrejelzését. A hét bármely napján friss.',
      'A sáv alatt a három nap látszik: hőmérséklet, rövid előrejelzés, eső esélye és széllökés. A zöld pont azt jelenti, hogy arra a napra nincs figyelmeztetés; a borostyán, hogy van. A sávra koppintva látszanak a figyelmeztetések részletei, az utolsó ellenőrzés ideje és a hivatalos oldalak.',
      'A csütörtöki programátnézés már nem néz időjárást: egyetlen forrás van, a reggeli ellenőrzés. Ha az több napig nem futott le, a sáv szürke ponttal jelzi, hogy nincs friss adat. Indulás előtt azért érdemes ránézni a Meteocatra.',
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
      'Minden csütörtök este egy ütemezett Claude-feladat átnézi a következő péntek–vasárnap programjait Barcelonában és autóval nagyjából 1 óra 15 percen belül, és ide menti őket. Nem csak a gyerekprogramok oldalait nézi, hanem a város általános programajánlóit, a vásárok és piacok naptárát, a negyedek ünnepeit és az otthon környékét is. A programok leírása abban a nyelvben marad, ahogy a forrásokból összeállt.',
      { heading: 'Mi kerül be' },
      'Csak dátumhoz kötött vagy időszakos programok: fesztiválok, vásárok, előadások, foglalkozások, időszaki kiállítások. Ide tartoznak a nem kifejezetten gyerekeknek szóló városi programok is, ahová családdal jó elmenni: karácsonyi vásárok, kézműves és termelői piacok, bolhapiacok, negyedünnepek (festa major), felvonulások, fényfestések. Az állandó látnivalók (parkok, állatkert, akvárium, szokásos múzeumlátogatás) és a minden héten megtartott piacok kimaradnak.',
      { heading: 'Több hétig tartó programok' },
      'Ami több héten át tart (például egy karácsonyi vásár), az minden hétvégén szerepel, amíg nyitva van, nem csak a megnyitó hetében. A leírás végén ott a zárás napja.',
      { heading: 'Szűrők' },
      'A nap és a terület szűrője ezen az eszközön megmarad a következő megnyitásig.',
      { heading: 'Ha elavult' },
      'Ha a csütörtöki átnézés nem futott le, az előző hétvége listája látszik „Elavult” jelöléssel.',
    ],
  },
} satisfies Record<string, HelpEntry>
