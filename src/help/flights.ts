import type { HelpEntry, HelpMap } from './types'
import { camp, campReturns, fmtDay, fmtShort, upcomingHolidays, windows, type FareSettings } from '../lib/fares'

// Help for the Flights module. Ships in the module's chunk. Two entries are
// computed from today's date: the holiday lists and the camp rule.

export const flightsHelp = {
  'flights.days': (today: string): HelpEntry => ({
    title: 'Szabadnapok',
    body: [
      { heading: 'Család (Barcelona)' },
      'Péntek, hétvége, a spanyol és katalán ünnepek, valamint a La Merced. A legjobb élő utat ezek közül választja a tábla, ha van ilyen.',
      { list: upcomingHolidays(today, 'ES').map(([d, n]) => `${fmtDay(d)} · ${n}`) },
      { heading: 'Nagyszülők (Magyarország)' },
      'A magyar munkaszüneti napok; az ő hosszú hétvégéik adják a nagyszülői táblát. A hídnapokat évente rendelet állapítja meg: keddi vagy csütörtöki ünnepnél a szomszéd szombat gyakran munkanap.',
      { list: upcomingHolidays(today, 'HU').map(([d, n]) => `${fmtDay(d)} · ${n}`) },
    ],
  }),
  'flights.camp': (args: { today: string; settings: FareSettings }): HelpEntry => {
    const w = windows(args.today, args.settings).find((x) => x.key === 'summer')!
    const c = w.camp ?? camp(+args.today.slice(0, 4))
    const rets = campReturns(c)
    return {
      title: 'Tábor szabály',
      body: [
        `A tábor hete hétfő ${fmtShort(c.start)} – vasárnap ${fmtShort(c.end)}. Egy nyári út akkor számít, ha az indulás legkésőbb ${fmtDay(c.latestOut)}, a hazaút vasárnap vagy hétfő (soha szombat) ${fmtDay(c.end)}-tól, és az út legfeljebb 14 napos.`,
        `Lehetséges hazautak: ${rets.map(fmtDay).join(', ')}. Az utolsó csak akkor jó, ha ${fmtDay(c.latestOut)} az indulás.`,
        'A vasárnap esti járatok a hét legdrágábbjai; egy hétfő reggeli hazaút gyakran ülésenként 15–30 euróval olcsóbb, ami egy szabadnapot ér meg.',
        'Július eleje még az augusztusi csúcs és a budapesti Forma–1 előtt van. Március–áprilisban, a tavaszi akciókban érdemes venni.',
      ],
    }
  },
  'flights.family': {
    title: 'Családi tábla',
    body: [
      'A riasztás a család teljes árán fut: a gyerekek is teljes ülést fizetnek a Ryanairen és a Wizz Airen. Ha csak a felnőtt ár ismert, a teljes ár annak a többszöröse, „becsült” jelöléssel.',
      'A „legjobb élő út” azokat részesíti előnyben, ahol mindkét járat szabadnapra esik (pénteken, hétvégén vagy katalán ünnepen; a tábor utáni hétfői hazaút is rendben van).',
      'A hétvégi mesterlövész bármelyik sima hétvégét figyeli a következő 11 hónapban: indulás csütörtökön, pénteken vagy szombaton, haza vasárnap vagy hétfőn, 2–4 éjszakával. Itt a legolcsóbb hétvége nyer, akkor is, ha csütörtököt vagy hétfőt érint (ezt a kártya jelzi). Csak 25%-os átlag alatti árnál riaszt; alatta a többi átlag alatti hétvége áll, hétvégénként a legolcsóbb. Az ünnepi és tábori hétvégék a saját ablakukban maradnak.',
      'Amíg egy ablakban nincs 5 rögzített út, az átlag egy kezdő becslést kever bele. Egy út akkor élő, ha az elmúlt 7 napban látták és még nem indult el. A 16 napnál hosszabb családi utak nem számítanak.',
    ],
  },
  'flights.supers': {
    title: 'Szuper ajánlatok',
    body: [
      'Ezek szándékosan figyelmen kívül hagyják a munkanaptárat: egy ekkora kedvezmény megérhet egy szabadnapot.',
      'Minden utat a saját ablaka átlagához mér (karácsony, húsvét, tábor vagy normál dátumok). Csak a legalább 3 hét múlva induló, legalább 35%-kal olcsóbb családi utak kerülnek ide, a hét bármely napjára: így marad idő szabadságot kérni.',
    ],
  },
  'flights.grandparents': {
    title: 'Nagyszülői tábla',
    body: [
      'A hosszú hétvégék a magyar munkanaptárt követik. Egy látogatás akkor számít, ha az előző este vagy az első szabadnapon érkeznek, az utolsó vagy utolsó előtti napon mennek haza, így nem kell szabadságot kivenniük, és legalább 2 éjszakát töltenek itt. Az egy éjszakás látogatás (például szombat este be, vasárnap hajnalban ki) itt sem számít.',
      'A járatok ideje is számít, hogy a napok tényleg együtt teljenek. Az előző esti érkezés a legjobb; ha az első szabadnapon jönnek, 12:30-ig le kell szállniuk. A 12:30 előtt induló hazaút nem számít, mert elviszi az utolsó napot. A tábla azt az utat választja, amelyik a hosszú hétvége utolsó napján, este (17:00-tól) indul haza; ha ilyen nincs, az utolsó nap délutánja, majd az előző nap következik, és a kártya jelzi, miből enged.',
      'A hétvégi mesterlövész minden sima hétvégét figyel, de csak legalább 2 éjszakás látogatást: csütörtökön vagy pénteken, vagy szombaton 12:30-ig érkeznek, vasárnap vagy hétfőn mennek haza, lehetőleg este, 12:30 előtt soha. Csak 25%-os átlag alatti árnál jelez.',
      'A hosszú hétvégék átlaga az összes rögzített hosszú hétvégés látogatásból számol, mert egy-egy hétvégére ritkán gyűlik 5 adat.',
    ],
  },
  'flights.tiers': {
    title: 'Mikor vegyük?',
    body: [
      {
        list: [
          'Hibásár-zóna: legalább 50%-kal az átlag alatt. Minden ülést most. A fapados jegyek azonnal kiállításra kerülnek, ezek szinte mindig érvényesek maradnak.',
          'Erős vétel: 25–50%-kal alatta. A hétvégi mesterlövészek (családi és nagyszülői) is itt jeleznek. Ünnepi és tábori dátumra ritkán jön vissza.',
          'Átlag alatt: 0–25%. Ünnepi, tábori és hosszú hétvégés dátumra érdemes venni; a sima hétvégék a mesterlövészre várnak.',
          'Átlagon vagy fölötte: várj, a keresések tovább figyelik.',
        ],
      },
    ],
  },
  'flights.log': {
    title: 'Napló',
    body: [
      'Minden rögzített út, a legújabb elöl. A „keresés” címke az automatikus keresés találatait jelöli; az első keresés egyirányú járatai nyers adatként maradnak, az átlagba nem számítanak.',
      'Kézzel rögzített útnál add meg mindkét járat árát összesen egy felnőttre, és ha tudod, az egész társaság árát is. A dátumokból az app maga sorolja be az ablakba.',
    ],
  },
  guide: {
    title: 'Repjegy: terepkönyv',
    body: [
      { heading: 'Az útvonal' },
      'Közvetlen járatot csak a Ryanair és a Wizz Air üzemeltet, mindkettő a BCN T2-ről. Mindkét légitársaság járatonként áraz, a retúr nem ad kedvezményt: keresd mindkét irányt mindkét cégnél, és párosítsd a legolcsóbbat.',
      'A jegyek árkategóriákban fogynak: az ár akkor esik, amikor a légitársaság akciós helyeket enged ki, nem a sütik törlésétől.',
      { heading: 'Családdal' },
      'A Ryanair és a Wizz Air csak a 2 év alatti, ölben utazó csecsemőt engedményezi; a nagyobb gyerekek teljes ülést fizetnek. Mindig a teljes társasággal keress: az olcsó kategóriában gyakran csak 1–3 hely maradt.',
      'Ha az olcsó kategória elfogy, két foglalás (1 felnőtt + 1 gyerek) még megszerezheti az utolsó olcsó helyeket.',
      'Ryanair: az egyik felnőtt ülőhelyet vesz (járatonként kb. 4–10 euró), mellé a 12 év alatti gyerekek ingyen ülnek. Wizz Air: a 14 év alatti gyerek felnőtt mellett ül; fizetés előtt nézd meg az ülésdíjat. A babakocsi és a gyerekülés mindkettőn ingyenes.',
      { heading: 'Mesterlövész' },
      'A villámakciók (Wizz) és helyakciók (Ryanair) hétköznap nyílnak és 24–48 óráig tartanak: ha jön a riasztás, aznap foglalj. A péntek délelőtti és déli indulás gyakran a hétvége legolcsóbb helye, és két teljes éjszakát ad. A csendes hónapok a legjobbak: január közepétől március közepéig, november, és szeptember vége–október a hosszú hétvégéken kívül.',
      { heading: 'Budapest felől' },
      'A nagyszülők útját érdemes Budapest indulással és forintban keresni: a magyar piacról gyakran kicsit olcsóbb, és magyar kártyával átváltás nélkül fizethető. Hosszú hétvége előtti este (munka után) gyakran olcsóbb, mint az első nap reggele.',
      'A mindkét országban szabad napok a legjobb látogatások: ezeket korán érdemes lefoglalni.',
      { heading: 'Kedvezmények' },
      'A Wizz Discount Club utasonként és járatonként kb. 10 eurót von le. A Wizz villámakciók (gyakran 20–40%) 24–48 óráig tartanak; iratkozzatok fel a Wizz és Ryanair hírlevélre BCN, a nagyszülők BUD otthoni reptérrel. A Ryanair akciói Black Friday hetére, januárra és késő tavaszra esnek.',
      { heading: 'Pénznem' },
      'Hasonlítsd össze a BUD → BCN járatot a Wizzen forintban és euróban. Fizess átváltási díj nélküli kártyával, és mindig utasítsd el a légitársaság saját átváltását (DCC): 3–5%-ba kerül. A valódi hibás árak ezen az útvonalon többnyire pénznem- vagy akcióhibák.',
      { heading: 'Eszközök' },
      'Google Flights ártracking a pontos dátumpárokra, csak közvetlen járattal; a Ryanair Fare Finder és a Wizz menetrend napi legolcsóbb naptárakhoz. Hibás árakat a Viajeros Piratas, a Secret Flying és a Jack’s Flight Club tesz közzé percekkel a megjelenésük után: foglalj először, ne kérdezd a légitársaságot, és hitelkártyával fizess.',
      { heading: 'Honnan jönnek az adatok' },
      'Hétfőn és csütörtökön 19:47-kor egy ütemezett keresés rögzíti az új utakat; kézzel is rögzíthetsz. Foglalás előtt mindig ellenőrizd az árat a légitársaság oldalán.',
    ],
  },
} satisfies HelpMap
