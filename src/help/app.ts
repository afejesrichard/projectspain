import type { HelpEntry } from './types'

// Help for screens outside any module (welcome, shell).

export const appHelp = {
  'welcome.identity': {
    title: 'Ki használja ezt az eszközt?',
    body: [
      'A választás azt dönti el, kinek a nevén jelennek meg a jegyzetek és a jóváhagyások erről az eszközről. Nem jelszó, és nem korlátoz semmit.',
      'Később bármikor átválthatsz a menüben, a „Most én” résznél.',
    ],
  },
} satisfies Record<string, HelpEntry>
