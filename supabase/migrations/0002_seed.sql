-- Seed data for the Manifest app (10 items, 50 tasks across six phases).
-- Re-runnable: on conflict do nothing.

insert into public.items
  (id, name, cover, photos, disposition, price_huf, status, published, awaiting, stamped, proposed_by, private_note, description)
values
  (1,  'Szürke lenvászon kanapé',        'kanapé — nappali',   '["a","b"]',     'sell',  85000,  'available', true,  false, true,  null,      null,                                        'Háromszemélyes, alig használt, levehető huzattal.'),
  (2,  'Tölgyfa étkezőasztal',           'étkezőasztal',       '["a","b","c"]', 'sell',  120000, 'available', true,  true,  false, 'Dorka',   null,                                        'Tömör tölgy, hat személyes, kis karcolással a lapon.'),
  (3,  'Billy könyvespolc',              'könyvespolc',        '["a"]',         'give',  null,   'available', true,  false, true,  null,      null,                                        'Fehér, öt polcos, jó állapotban.'),
  (4,  'Téli kabátok (6 db-os doboz)',   'kabátos doboz',      '["a","b"]',     'throw', null,   'available', false, true,  false, 'Richard', null,                                        null),
  (5,  'Kávégép',                        'kávégép',            '["a","b"]',     'sell',  45000,  'reserved',  true,  false, true,  null,      null,                                        'Automata, tejhabosítóval, nemrég vízkőtelenítve.'),
  (6,  'Olvasólámpa',                    'olvasólámpa',        '["a"]',         'keep',  null,   'available', false, false, true,  null,      null,                                        null),
  (7,  'Gyerekbiciklik (pár)',           'két gyerekbicikli',  '["a","b"]',     'give',  null,   'available', true,  true,  false, 'Dorka',   'A szomszéd Nagy családnak ígérve.',          '4–7 éveseknek, kis kopással.'),
  (8,  'Állítható magasságú asztal',     'állóasztal',         '["a","b"]',     'sell',  60000,  'available', true,  false, true,  null,      null,                                        'Elektromos emelés, memóriagombokkal.'),
  (9,  'Társasjáték-csomag',             'társasjátékok',      '["a"]',         'give',  null,   'available', true,  false, true,  null,      'Dorka unokatestvérének félretéve.',          'Nyolc családi társas, hiánytalanul.'),
  (10, 'Lantlevelű fikusz',              'fikusz',             '["a"]',         'keep',  null,   'available', false, false, true,  null,      null,                                        null)
on conflict (id) do nothing;

select setval(pg_get_serial_sequence('public.items','id'), (select max(id) from public.items));

insert into public.tasks (id, title, phase, assignee, due, priority, done) values
  (101,'Lakcímváltozás bejelentése','Ügyintézés','Richard','2026-08-01','high',true),
  (102,'Postai átirányítás kérése','Ügyintézés','Dorka','2026-08-05','normal',true),
  (103,'Új háziorvos keresése','Ügyintézés','Both',null,'normal',true),
  (104,'Okmányirodai időpont','Ügyintézés','Richard','2026-08-10','normal',false),
  (105,'Biztosítások átírása','Ügyintézés','Dorka',null,'low',false),
  (111,'Bérleti szerződés aláírása','Lakhatás','Both','2026-07-20','high',true),
  (112,'Kaució átutalása','Lakhatás','Richard','2026-07-22','high',true),
  (113,'Közüzemi mérőállások leolvasása','Lakhatás','Dorka',null,'normal',true),
  (114,'Internet átvitele','Lakhatás','Richard','2026-08-15','normal',true),
  (115,'Régi lakás átadása','Lakhatás','Both','2026-08-28','high',true),
  (116,'Kulcsok átvétele','Lakhatás','Dorka','2026-08-25','normal',true),
  (117,'Takarítás beütemezése','Lakhatás','Dorka',null,'low',false),
  (118,'Költöztetőcég egyeztetése','Lakhatás','Richard','2026-08-20','high',false),
  (121,'Iskolai átjelentkezés','Iskola','Dorka','2026-08-18','high',true),
  (122,'Régi iskola értesítése','Iskola','Dorka',null,'normal',true),
  (123,'Tanszerlista beszerzése','Iskola','Both','2026-08-24','normal',false),
  (124,'Új busz-útvonal kipróbálása','Iskola','Richard',null,'low',false),
  (131,'Banki cím frissítése','Pénzügyek','Richard',null,'normal',true),
  (132,'Költözési költségvetés','Pénzügyek','Both','2026-07-18','high',true),
  (133,'Régi előfizetések lemondása','Pénzügyek','Dorka',null,'normal',true),
  (134,'Kaució visszaigénylése','Pénzügyek','Richard','2026-09-01','normal',true),
  (135,'Eladott holmik bevételének követése','Pénzügyek','Both',null,'low',false),
  (136,'Rezsi végszámla rendezése','Pénzügyek','Dorka','2026-08-30','normal',false),
  (141,'Nappali becsomagolása','Csomagolás','Both',null,'normal',true),
  (142,'Konyha becsomagolása','Csomagolás','Dorka',null,'normal',true),
  (143,'Könyvek dobozolása','Csomagolás','Richard',null,'low',true),
  (144,'Hálószoba becsomagolása','Csomagolás','Both',null,'normal',true),
  (145,'Dobozok felcímkézése','Csomagolás','Richard',null,'normal',true),
  (146,'Törékeny tárgyak becsomagolása','Csomagolás','Dorka',null,'high',true),
  (147,'Ruhák bőröndbe','Csomagolás','Dorka',null,'low',true),
  (148,'Gyerekszoba becsomagolása','Csomagolás','Both',null,'normal',true),
  (149,'Elektronikai kábelek rendezése','Csomagolás','Richard',null,'low',true),
  (150,'Fürdőszoba becsomagolása','Csomagolás','Dorka',null,'normal',true),
  (151,'Erkélyi növények előkészítése','Csomagolás','Both',null,'low',true),
  (152,'Előszoba becsomagolása','Csomagolás','Richard',null,'normal',true),
  (153,'Kamra kiürítése','Csomagolás','Dorka','2026-08-26','normal',false),
  (154,'Garázs átnézése','Csomagolás','Richard','2026-08-27','normal',false),
  (155,'Első éjszaka doboz összeállítása','Csomagolás','Both','2026-08-28','high',false),
  (156,'Takarítószerek külön csomag','Csomagolás','Dorka',null,'low',false),
  (157,'Bútorok szétszerelése','Csomagolás','Richard','2026-08-29','normal',false),
  (158,'Hűtő kiolvasztása','Csomagolás','Dorka','2026-08-30','normal',false),
  (159,'Padlás átnézése','Csomagolás','Both',null,'low',false),
  (160,'Utolsó szemétkihordás','Csomagolás','Richard','2026-08-31','low',false),
  (171,'Barátok értesítése az új címről','Általános','Both',null,'low',true),
  (172,'Költözési checklist megosztása','Általános','Richard',null,'low',true),
  (173,'Új környék feltérképezése','Általános','Both',null,'low',true),
  (174,'Csomagolóanyag beszerzése','Általános','Richard',null,'normal',true),
  (175,'Adományozó pont megkeresése','Általános','Dorka',null,'low',true),
  (176,'Búcsúvacsora a szomszédokkal','Általános','Both',null,'low',true),
  (177,'Fotók a régi lakásról','Általános','Dorka',null,'low',true)
on conflict (id) do nothing;

select setval(pg_get_serial_sequence('public.tasks','id'), (select max(id) from public.tasks));
