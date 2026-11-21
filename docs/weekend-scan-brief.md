# Weekend scan brief

The instructions of the scheduled task "Weekly family weekend screen
(Barcelona)" (Thu 18:47 Madrid). The task itself holds the live copy; this file
is the versioned one. A task's instructions can only be changed from the
conversation the task posts into, so to apply a change: open that conversation
and ask it to replace its instructions with the block below.

No personal data here (`PRIV-01`): the home address is read from
`app_settings` at run time and never appears in a search query.

## Why it reads the way it does

The first version only swept the kids' agendas, so it missed general-public
city events that a family would plainly go to. The Fira de Nadal de la Sagrada
Família (opened Sat 21 Nov 2026, a short walk from home) was the case that
showed it: it is listed in the city guide as a fair, not as a children's
activity, and it opened on the Saturday rather than running all weekend. The
brief now names seven search passes that all have to be done, carries
multi-week events forward from the previous screen, and asks the run to say
which passes came back empty.

## Instructions

```text
This weekly screen is saved into the Project Spain app's Supabase database (project id tclxgoydthnnzqkoqzek) and shown in the app's Weekend screen. The Family Weekend Barcelona artifact and its scratch HTML file are retired: do not edit, republish or read them.

Load the Supabase tools and WebSearch with ToolSearch. Read the home address with Supabase execute_sql: select value from public.app_settings where key = 'home'. Distances and travel times are measured from that address. Never put the address itself into a web search; search by neighbourhood or venue name instead.

Also read the previous screen: select weekend_from, items from public.weekend_screens order by weekend_from desc limit 1. Any item there that runs for several weeks (a Christmas fair, a light trail, a festival, a temporary exhibition) must be re-checked and kept for as long as it is still running. A five-week fair is listed on all five weekends, not only the one it opened on.

WHAT TO SCREEN. Things worth going out for as a family with small children on the coming Friday, Saturday and Sunday, in Barcelona and up to about 1h15 by car from home. This is NOT limited to events labelled "for kids". A general-public city event counts whenever a family would enjoy walking through it: Christmas fairs and markets, neighbourhood festes majors, street and craft fairs, food and produce markets, flea and design markets, parades, giants and correfocs, light shows, traditional and seasonal celebrations, open days. Include an event if it runs on at least one of the three days, including events that OPEN during the weekend (a fair starting on the Saturday belongs in this screen, so read start dates carefully) and events that began earlier and are still on.

Include ONLY dated or time-limited programs. Never list permanent attractions that are always there (parks, zoo, aquarium, regular museum visits, recurring free-museum days, plain hikes or rack railways), and never list a market that simply runs every week all year. Drop past events.

HOW TO SEARCH. Use WebSearch (direct page fetches are usually blocked), with the exact weekend dates in Catalan or Spanish in the queries. Do every one of these passes; do not stop after the kids' agendas:
1. Kids' agendas: barcelona.cat with-children agenda, criar.cat weekend list, totnens, sortirambnens, escapadaambnens, socpetit, beteve "que fer amb nens".
2. City-wide general agenda: guia.barcelona.cat, barcelona.cat/capdesetmana (including its fairs section), Time Out "el cap de setmana ideal", beteve agenda, surtdecasa Barcelona, quedeque.barcelona.
3. Fairs and markets: beteve "mercats del cap de setmana", Time Out "fires arreu de Catalunya del cap de setmana", firescatalanes.cat weekend roundup, festacatalunya.cat, plus a direct query such as "fires i mercats Barcelona cap de setmana <dates>".
4. Festes majors and popular culture: barcelona.cat festes majors calendar, barcelona.cat/culturapopular, quedeque.barcelona, for any neighbourhood festival overlapping the weekend.
5. Seasonal calendar: ask what the city traditionally has on at this time of year and check each by name for this year's dates. Late November to early January: barcelona.cat/nadal, the Christmas fairs (Sagrada Familia, Santa Llucia at the Cathedral, Port Vell, Fira de Reis on Gran Via, district fairs), Christmas lights and their switch-on, Sant Pau lights, Poble Espanyol, Placa de Catalunya programme, Festival de la Infancia, Kings' arrival and cavalcade. Then through the year: Tres Tombs (January), Santa Eulalia and Llum BCN (February), Carnival, Sant Medir, Sant Jordi (23 April), Fira de Sant Ponc (May), Corpus and l'ou com balla, Sant Joan, the summer festes majors (Gracia, Sants), La Diada, La Merce (September), 48h Open House (October), Castanyada and autumn fairs.
6. Near home: work out which neighbourhoods and main squares lie within about 3 km of the home address and search them by name for this weekend (fairs, markets, festes, activities in the squares and civic centres). Anything within walking distance deserves a place even if it is modest.
7. Day trips: Garraf, Maresme, Valles, Montseny, Montserrat, Osona, Girona, Tarragona, Baix Llobregat, Penedes: fairs, festivals and seasonal events worth the drive.

When sources disagree on dates, prefer the official listing (barcelona.cat, the town hall or the organiser) and say so in the description. Set "verify": true only when this year's dates could not be confirmed by an official or clearly current source. Aim for a full picture rather than a short list: typically 10 to 20 items, nearest ones never left out.

WARNINGS. Check Meteocat, AEMET and Proteccio Civil for active or forecast warnings for the weekend (rain, wind, cold, snow, sea state, fire, INUNCAT/VENTCAT/NEUCAT/PROCICAT) and any Barcelona municipal alerts (for example parks closed for wind). If a warning affects outdoor fairs or markets, say so in the alert.

SAVE with ONE Supabase execute_sql call: select public.weekend_save($wk${...}$wk$::jsonb); where the JSON is: {"weekend_from":"YYYY-MM-DD" (the Friday), "weekend_to":"YYYY-MM-DD" (the Sunday), "next_screen":"YYYY-MM-DD" (next Thursday), "alert_status":"ok" or "warn", "alert_title": one sentence, "alerts":[{"level":"ok"|"warn"|"info","tag":"Weather"|"Warning"|"Ended"|"Heads-up"|..., "text": one or two sentences, "note": optional short source or advice}], "items":[{"name", "type":"free"|"paid" (a fair or market with free entry is "free"), "zone":"city" (inside Barcelona) or "trip", "km": number (approximate road km from home), "time": e.g. "20 min walk", "L2 metro, 15 min", "45 min drive", "days": subset of ["Fri","Sat","Sun"], "where": venue and area, "desc": one to three sentences, with opening hours and, for multi-week events, the end date, "ages": e.g. "All ages", "3+", "0-12", "price": for paid items e.g. "from €10", "verify": true when this year's dates are not fully confirmed, "link": direct https event page (the official page when there is one), "maps": a Google Maps search query for the venue}]} Write the content in English. Running it again for the same weekend replaces that weekend's row. If the call fails with WEEKEND_BAD_..., the message names the problem (for WEEKEND_BAD_ITEM, the item's name): fix that part and call again. Do not write to any other table.

Confirm the save with: select weekend_current()->'screen'->>'weekend_from' as weekend, jsonb_array_length(weekend_current()->'screen'->'items') as items;

Reply with a 3-line summary of the highlights and any alerts, plus one line naming which of the seven search passes found nothing. If the save failed after retrying, say so plainly with the error. No em-dashes.
```
