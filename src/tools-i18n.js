// Тексты раздела «Инструменты» (uk / ru / en). Отдельно от i18n.js, чтобы не раздувать основной словарь.
const REG_UK = {
  AA: 'м. Київ', AB: 'Вінницька обл.', AC: 'Волинська обл.', AE: 'Дніпропетровська обл.', AH: 'Донецька обл.', AI: 'Київська обл.', AK: 'АР Крим',
  AM: 'Житомирська обл.', AO: 'Закарпатська обл.', AP: 'Запорізька обл.', AT: 'Івано-Франківська обл.', AX: 'Харківська обл.', BA: 'Кіровоградська обл.',
  BB: 'Луганська обл.', BC: 'Львівська обл.', BE: 'Миколаївська обл.', BH: 'Одеська обл.', BI: 'Полтавська обл.', BK: 'Рівненська обл.', BM: 'Сумська обл.',
  BO: 'Тернопільська обл.', BT: 'Херсонська обл.', BX: 'Хмельницька обл.', CA: 'Черкаська обл.', CB: 'Чернігівська обл.', CE: 'Чернівецька обл.', CH: 'м. Севастополь',
};
const REG_RU = {
  AA: 'г. Киев', AB: 'Винницкая обл.', AC: 'Волынская обл.', AE: 'Днепропетровская обл.', AH: 'Донецкая обл.', AI: 'Киевская обл.', AK: 'АР Крым',
  AM: 'Житомирская обл.', AO: 'Закарпатская обл.', AP: 'Запорожская обл.', AT: 'Ивано-Франковская обл.', AX: 'Харьковская обл.', BA: 'Кировоградская обл.',
  BB: 'Луганская обл.', BC: 'Львовская обл.', BE: 'Николаевская обл.', BH: 'Одесская обл.', BI: 'Полтавская обл.', BK: 'Ровенская обл.', BM: 'Сумская обл.',
  BO: 'Тернопольская обл.', BT: 'Херсонская обл.', BX: 'Хмельницкая обл.', CA: 'Черкасская обл.', CB: 'Черниговская обл.', CE: 'Черновицкая обл.', CH: 'г. Севастополь',
};
const REG_EN = {
  AA: 'Kyiv city', AB: 'Vinnytsia region', AC: 'Volyn region', AE: 'Dnipropetrovsk region', AH: 'Donetsk region', AI: 'Kyiv region', AK: 'Crimea',
  AM: 'Zhytomyr region', AO: 'Zakarpattia region', AP: 'Zaporizhzhia region', AT: 'Ivano-Frankivsk region', AX: 'Kharkiv region', BA: 'Kirovohrad region',
  BB: 'Luhansk region', BC: 'Lviv region', BE: 'Mykolaiv region', BH: 'Odesa region', BI: 'Poltava region', BK: 'Rivne region', BM: 'Sumy region',
  BO: 'Ternopil region', BT: 'Kherson region', BX: 'Khmelnytskyi region', CA: 'Cherkasy region', CB: 'Chernihiv region', CE: 'Chernivtsi region', CH: 'Sevastopol city',
};

export const TOOLS = ['vin', 'customs', 'plate', 'mileage', 'fuel', 'checklist'];

export const TT = {
  uk: {
    nav: 'Інструменти', hub_t: 'Безкоштовні інструменти для покупця авто | VINScope', hub_h: 'Інструменти покупця', hub_p: 'Усе, що треба порахувати й перевірити перед купівлею авто. Безкоштовно, без реєстрації, працює одразу в браузері.',
    open: 'Відкрити', decode: 'Розшифрувати', back: 'Усі інструменти', calc: 'Порахувати', reset: 'Скинути', result: 'Результат', est: 'Орієнтовний розрахунок. Остаточну суму визначає митниця.',
    home_h: 'Інструменти покупця в одному місці', home_p: 'Перевірка — лише початок. Порахуйте розмитнення, розшифруйте номер і VIN, оцініть пробіг і пройдіть чек-лист огляду.',
    diff_h: 'Чим VINScope відрізняється', diff: [
      ['Базова перевірка безкоштовна', 'Розшук, історія реєстрацій, відкличні кампанії й Risk Score — без оплати й реєстрації.'],
      ['Лише офіційні дані', 'Державні реєстри України й Європи та бази виробників. Дата актуальності — у кожному розділі звіту.'],
      ['Українські реєстри 2013–2026', 'Понад 23 млн записів держреєстру, пошук і за VIN, і за держномером, навіть для архівів без VIN.'],
      ['Чесно про прогалини', 'Якщо даних немає — ми так і пишемо. Без вигаданих оцінок, відгуків і «знайдено 0 проблем».'],
      ['Приватність', 'Не збираємо дані власників. Запити зберігаються 90 днів і лише для статистики.'],
      ['Інструменти для покупця', 'Калькулятор розмитнення за курсом НБУ, розшифровка VIN і номерів, оцінка пробігу, чек-лист огляду.'],
    ],
    t: {
      vin: ['Розшифровка VIN', 'Що означає кожен символ: виробник, рік, контрольна цифра, серійний номер.'],
      customs: ['Калькулятор розмитнення', 'Мито, акциз і ПДВ за поточним курсом НБУ для бензину, дизеля, гібрида й електро.'],
      plate: ['Регіон за номером', 'Звідки авто за кодом номерного знака і як перевірити його історію.'],
      mileage: ['Чи реальний пробіг', 'Порівняйте пробіг із середнім для віку авто й побачте, чи варто насторожитися.'],
      fuel: ['Витрати на пальне', 'Скільки коштуватиме пальне на місяць і рік з вашим пробігом.'],
      checklist: ['Чек-лист огляду', '30 пунктів, які варто перевірити на огляді. Прогрес зберігається на вашому пристрої.'],
    },
    vin_ph: 'Введіть VIN (17 символів)', vin_wmi: 'Виробник (WMI)', vin_vds: 'Опис моделі (VDS)', vin_check: 'Контрольна цифра', vin_year: 'Модельний рік', vin_plant: 'Код заводу', vin_serial: 'Серійний номер', vin_region: 'Регіон виробництва',
    vin_ok: 'збігається', vin_bad: 'не збігається (для авто з Північної Америки це ознака помилки або підробки)', vin_na: 'не перевіряється для цього регіону', vin_full: 'Повна перевірка цього VIN',
    vin_err: 'VIN має містити 17 символів: латинські літери й цифри, без I, O, Q.',
    vin_regions: { A: 'Африка', J: 'Азія (Японія)', K: 'Азія (Корея)', L: 'Азія (Китай)', M: 'Азія (Індія, Індонезія, Таїланд)', N: 'Азія (Туреччина, Іран)', P: 'Азія', R: 'Азія (Тайвань, ОАЕ)', S: 'Європа (Велика Британія)', T: 'Європа (Чехія, Угорщина, Швейцарія)', U: 'Європа (Румунія, Данія)', V: 'Європа (Франція, Іспанія, Австрія)', W: 'Європа (Німеччина)', X: 'Європа (Росія, Нідерланди)', Y: 'Європа (Швеція, Фінляндія, Бельгія, Україна)', Z: 'Європа (Італія)', 1: 'Північна Америка (США)', 4: 'Північна Америка (США)', 5: 'Північна Америка (США)', 2: 'Північна Америка (Канада)', 3: 'Північна Америка (Мексика)', 6: 'Океанія (Австралія)', 7: 'Океанія (Нова Зеландія)', 8: 'Південна Америка', 9: 'Південна Америка (Бразилія)' },
    cu_price: 'Вартість авто, €', cu_year: 'Рік випуску', cu_fuel: 'Тип двигуна', cu_cc: 'Об’єм двигуна, см³', cu_kwh: 'Ємність батареї, кВт·год', cu_eu: 'Авто походженням з ЄС (сертифікат EUR.1): мито 0%',
    cu_fuels: { petrol: 'Бензин / газ', diesel: 'Дизель', hybrid: 'Гібрид', electric: 'Електро' },
    cu_duty: 'Ввізне мито', cu_excise: 'Акциз', cu_vat: 'ПДВ 20%', cu_total: 'Разом до сплати', cu_full: 'Вартість авто з розмитненням', cu_rate: 'Курс НБУ: 1 € = {r} ₴ на {d}', cu_rate_na: 'Курс НБУ недоступний — суми в євро.',
    cu_note: 'Акциз: ставка × об’єм/1000 × коефіцієнт віку (від 1 до 15). Бензин: 50 € до 3000 см³, 100 € понад. Дизель: 75 € до 3500 см³, 150 € понад. Гібрид: 100 €. Електро: 1 € за кВт·год. Для електромобілів мито 0%, але з 2026 року ПДВ 20% сплачується; пільги змінюються, перевірте актуальні. Окремо при першій реєстрації сплачується збір до Пенсійного фонду (3–5%).', cu_age: 'Коефіцієнт віку',
    pl_ph: 'Номер, напр. AA1234BB', pl_region: 'Регіон реєстрації', pl_unknown: 'Код {c} не входить до основних регіональних кодів (2004–2020). Це може бути новий код, транзитний, службовий чи іноземний номер.', pl_fmt: 'Формат', pl_std: 'стандартний номер (2 літери, 4 цифри, 2 літери)', pl_other: 'нестандартний формат', pl_check: 'Перевірити історію цього номера', pl_note: 'Код регіону показує, де авто реєстрували, а не де живе власник: після перереєстрації номер може зберегтися.', pl_err: 'Введіть номер: щонайменше 2 літери й цифри.',
    mi_year: 'Рік випуску', mi_km: 'Пробіг, км', mi_avg: 'У середньому на рік', mi_norm: 'Типово для України: 12–20 тис. км на рік', mi_low: 'Пробіг помітно нижчий за типовий. Буває у «другого авто», але це й найчастіша ознака скручування. Перевірте сервісну історію й знос салону, керма, педалей.', mi_ok: 'Пробіг у межах типового.', mi_high: 'Пробіг вищий за типовий: можливо, авто працювало в таксі чи доставці. Зверніть увагу на підвіску, КПП і двигун.', mi_err: 'Вкажіть рік і пробіг.',
    fu_cons: 'Витрата, л/100 км', fu_km: 'Пробіг на місяць, км', fu_price: 'Ціна пального, ₴/л', fu_month: 'На місяць', fu_year: 'На рік', fu_err: 'Заповніть усі поля.',
    ck_done: 'Перевірено {n} з {t}', ck_reset: 'Почати заново', ck_note: 'Прогрес зберігається лише у вашому браузері.',
    ck: [
      ['Документи', ['VIN у документах збігається з VIN на кузові та під лобовим склом', 'Продавець — власник за техпаспортом або має довіреність', 'Перевірено розшук і реєстраційну історію на VINScope', 'Немає застави й арешту (реєстр обтяжень, нотаріус)', 'Сервісна книжка або чеки з датами й пробігом']],
      ['Кузов', ['Однаковий колір і блиск усіх деталей при денному світлі', 'Рівні зазори між дверима, капотом і крилами', 'Немає слідів зварювання й нової фарби на болтах кріплення', 'Немає іржі на порогах, арках і дні', 'Скло з однаковим маркуванням і роком випуску']],
      ['Салон', ['Знос керма, педалей і сидіння відповідає пробігу', 'Немає запаху вологи й слідів води під килимками', 'Усі подушки безпеки: лампа гасне після запуску', 'Працюють кондиціонер, склопідйомники, мультимедіа', 'Ремені безпеки витягуються й фіксуються']],
      ['Двигун і КПП', ['Холодний запуск без стуків і диму', 'Немає підтікань масла й антифризу', 'Масло без емульсії, антифриз без масляної плівки', 'Перемикання передач без ривків і затримок', 'Комп’ютерна діагностика без помилок']],
      ['Ходова й гальма', ['Авто не тягне вбік на рівній дорозі', 'Немає стуків на нерівностях', 'Рівномірний знос шин', 'Гальма без вібрації й скрипу', 'Кермо без люфтів']],
      ['Наостанок', ['Тест-драйв на різних швидкостях', 'Огляд на СТО або підйомнику', 'Договір купівлі-продажу в сервісному центрі або в нотаріуса', 'Розрахунок безготівково або через сейф банку', 'Полис ОСЦПВ оформлений до виїзду']],
    ],
  },
  ru: {
    nav: 'Инструменты', hub_t: 'Бесплатные инструменты для покупателя авто | VINScope', hub_h: 'Инструменты покупателя', hub_p: 'Всё, что нужно посчитать и проверить перед покупкой авто. Бесплатно, без регистрации, работает сразу в браузере.',
    open: 'Открыть', decode: 'Расшифровать', back: 'Все инструменты', calc: 'Посчитать', reset: 'Сбросить', result: 'Результат', est: 'Ориентировочный расчёт. Окончательную сумму определяет таможня.',
    home_h: 'Инструменты покупателя в одном месте', home_p: 'Проверка — только начало. Посчитайте растаможку, расшифруйте номер и VIN, оцените пробег и пройдите чек-лист осмотра.',
    diff_h: 'Чем VINScope отличается', diff: [
      ['Базовая проверка бесплатна', 'Розыск, история регистраций, отзывные кампании и Risk Score — без оплаты и регистрации.'],
      ['Только официальные данные', 'Государственные реестры Украины и Европы и базы производителей. Дата актуальности — в каждом разделе отчёта.'],
      ['Украинские реестры 2013–2026', 'Более 23 млн записей госреестра, поиск и по VIN, и по госномеру, даже для архивов без VIN.'],
      ['Честно о пробелах', 'Если данных нет — так и пишем. Без выдуманных оценок, отзывов и «найдено 0 проблем».'],
      ['Приватность', 'Не собираем данные владельцев. Запросы хранятся 90 дней и только для статистики.'],
      ['Инструменты для покупателя', 'Калькулятор растаможки по курсу НБУ, расшифровка VIN и номеров, оценка пробега, чек-лист осмотра.'],
    ],
    t: {
      vin: ['Расшифровка VIN', 'Что значит каждый символ: производитель, год, контрольная цифра, серийный номер.'],
      customs: ['Калькулятор растаможки', 'Пошлина, акциз и НДС по текущему курсу НБУ для бензина, дизеля, гибрида и электро.'],
      plate: ['Регион по номеру', 'Откуда авто по коду номерного знака и как проверить его историю.'],
      mileage: ['Реален ли пробег', 'Сравните пробег со средним для возраста авто и узнайте, стоит ли насторожиться.'],
      fuel: ['Расходы на топливо', 'Сколько будет стоить топливо в месяц и год с вашим пробегом.'],
      checklist: ['Чек-лист осмотра', '30 пунктов, которые стоит проверить на осмотре. Прогресс сохраняется на вашем устройстве.'],
    },
    vin_ph: 'Введите VIN (17 символов)', vin_wmi: 'Производитель (WMI)', vin_vds: 'Описание модели (VDS)', vin_check: 'Контрольная цифра', vin_year: 'Модельный год', vin_plant: 'Код завода', vin_serial: 'Серийный номер', vin_region: 'Регион производства',
    vin_ok: 'совпадает', vin_bad: 'не совпадает (для авто из Северной Америки это признак ошибки или подделки)', vin_na: 'не проверяется для этого региона', vin_full: 'Полная проверка этого VIN',
    vin_err: 'VIN должен содержать 17 символов: латинские буквы и цифры, без I, O, Q.',
    vin_regions: { A: 'Африка', J: 'Азия (Япония)', K: 'Азия (Корея)', L: 'Азия (Китай)', M: 'Азия (Индия, Индонезия, Таиланд)', N: 'Азия (Турция, Иран)', P: 'Азия', R: 'Азия (Тайвань, ОАЭ)', S: 'Европа (Великобритания)', T: 'Европа (Чехия, Венгрия, Швейцария)', U: 'Европа (Румыния, Дания)', V: 'Европа (Франция, Испания, Австрия)', W: 'Европа (Германия)', X: 'Европа (Россия, Нидерланды)', Y: 'Европа (Швеция, Финляндия, Бельгия, Украина)', Z: 'Европа (Италия)', 1: 'Северная Америка (США)', 4: 'Северная Америка (США)', 5: 'Северная Америка (США)', 2: 'Северная Америка (Канада)', 3: 'Северная Америка (Мексика)', 6: 'Океания (Австралия)', 7: 'Океания (Новая Зеландия)', 8: 'Южная Америка', 9: 'Южная Америка (Бразилия)' },
    cu_price: 'Стоимость авто, €', cu_year: 'Год выпуска', cu_fuel: 'Тип двигателя', cu_cc: 'Объём двигателя, см³', cu_kwh: 'Ёмкость батареи, кВт·ч', cu_eu: 'Авто происхождением из ЕС (сертификат EUR.1): пошлина 0%',
    cu_fuels: { petrol: 'Бензин / газ', diesel: 'Дизель', hybrid: 'Гибрид', electric: 'Электро' },
    cu_duty: 'Ввозная пошлина', cu_excise: 'Акциз', cu_vat: 'НДС 20%', cu_total: 'Итого к оплате', cu_full: 'Стоимость авто с растаможкой', cu_rate: 'Курс НБУ: 1 € = {r} ₴ на {d}', cu_rate_na: 'Курс НБУ недоступен — суммы в евро.',
    cu_note: 'Акциз: ставка × объём/1000 × коэффициент возраста (от 1 до 15). Бензин: 50 € до 3000 см³, 100 € свыше. Дизель: 75 € до 3500 см³, 150 € свыше. Гибрид: 100 €. Электро: 1 € за кВт·ч. Для электромобилей пошлина 0%, но с 2026 года уплачивается НДС 20%; льготы меняются, проверьте актуальные. Отдельно при первой регистрации платится сбор в Пенсионный фонд (3–5%).', cu_age: 'Коэффициент возраста',
    pl_ph: 'Номер, напр. AA1234BB', pl_region: 'Регион регистрации', pl_unknown: 'Код {c} не входит в основные региональные коды (2004–2020). Это может быть новый код, транзитный, служебный или иностранный номер.', pl_fmt: 'Формат', pl_std: 'стандартный номер (2 буквы, 4 цифры, 2 буквы)', pl_other: 'нестандартный формат', pl_check: 'Проверить историю этого номера', pl_note: 'Код региона показывает, где авто регистрировали, а не где живёт владелец: после перерегистрации номер может сохраниться.', pl_err: 'Введите номер: минимум 2 буквы и цифры.',
    mi_year: 'Год выпуска', mi_km: 'Пробег, км', mi_avg: 'В среднем в год', mi_norm: 'Типично для Украины: 12–20 тыс. км в год', mi_low: 'Пробег заметно ниже типичного. Бывает у «второго авто», но это и самый частый признак скрутки. Проверьте сервисную историю и износ салона, руля, педалей.', mi_ok: 'Пробег в пределах типичного.', mi_high: 'Пробег выше типичного: возможно, авто работало в такси или доставке. Обратите внимание на подвеску, КПП и двигатель.', mi_err: 'Укажите год и пробег.',
    fu_cons: 'Расход, л/100 км', fu_km: 'Пробег в месяц, км', fu_price: 'Цена топлива, ₴/л', fu_month: 'В месяц', fu_year: 'В год', fu_err: 'Заполните все поля.',
    ck_done: 'Проверено {n} из {t}', ck_reset: 'Начать заново', ck_note: 'Прогресс сохраняется только в вашем браузере.',
    ck: [
      ['Документы', ['VIN в документах совпадает с VIN на кузове и под лобовым стеклом', 'Продавец — владелец по техпаспорту или есть доверенность', 'Проверены розыск и история регистраций на VINScope', 'Нет залога и ареста (реестр обременений, нотариус)', 'Сервисная книжка или чеки с датами и пробегом']],
      ['Кузов', ['Одинаковый цвет и блеск всех деталей при дневном свете', 'Ровные зазоры между дверями, капотом и крыльями', 'Нет следов сварки и свежей краски на болтах крепления', 'Нет ржавчины на порогах, арках и днище', 'Стёкла с одинаковой маркировкой и годом выпуска']],
      ['Салон', ['Износ руля, педалей и сиденья соответствует пробегу', 'Нет запаха сырости и следов воды под ковриками', 'Все подушки безопасности: лампа гаснет после запуска', 'Работают кондиционер, стеклоподъёмники, мультимедиа', 'Ремни безопасности вытягиваются и фиксируются']],
      ['Двигатель и КПП', ['Холодный запуск без стуков и дыма', 'Нет подтёков масла и антифриза', 'Масло без эмульсии, антифриз без масляной плёнки', 'Переключения передач без рывков и задержек', 'Компьютерная диагностика без ошибок']],
      ['Ходовая и тормоза', ['Авто не тянет в сторону на ровной дороге', 'Нет стуков на неровностях', 'Равномерный износ шин', 'Тормоза без вибрации и скрипа', 'Руль без люфтов']],
      ['Напоследок', ['Тест-драйв на разных скоростях', 'Осмотр на СТО или подъёмнике', 'Договор купли-продажи в сервисном центре или у нотариуса', 'Расчёт безналично или через сейф банка', 'Полис ОСАГО оформлен до выезда']],
    ],
  },
  en: {
    nav: 'Tools', hub_t: 'Free tools for used car buyers | VINScope', hub_h: 'Buyer tools', hub_p: 'Everything to calculate and check before buying a car. Free, no sign-up, works right in your browser.',
    open: 'Open', decode: 'Decode', back: 'All tools', calc: 'Calculate', reset: 'Reset', result: 'Result', est: 'Estimate only. Customs sets the final amount.',
    home_h: 'Buyer tools in one place', home_p: 'A check is only the start. Estimate import duties, decode a plate and VIN, sanity-check mileage and walk through an inspection checklist.',
    diff_h: 'How VINScope is different', diff: [
      ['The basic check is free', 'Wanted list, Ukrainian registration history, recalls and Risk Score with no payment or sign-up.'],
      ['Official data only', 'Government registers of Ukraine and Europe plus manufacturer databases. Each report section shows how current it is.'],
      ['Ukrainian registers 2013–2026', 'Over 23 million registry records, searchable by VIN and plate, even for archives without VINs.'],
      ['Honest about gaps', 'If there is no data, we say so. No invented scores, reviews or “0 problems found”.'],
      ['Privacy', 'We do not collect owner data. Queries are kept for 90 days for statistics only.'],
      ['Tools for buyers', 'Import duty calculator at the NBU rate, VIN and plate decoders, mileage check, inspection checklist.'],
    ],
    t: {
      vin: ['VIN decoder', 'What each character means: manufacturer, year, check digit, serial number.'],
      customs: ['Import duty calculator', 'Duty, excise and VAT at the current NBU rate for petrol, diesel, hybrid and electric.'],
      plate: ['Region by plate', 'Where a car was registered from its plate code, and how to check its history.'],
      mileage: ['Is the mileage real?', 'Compare mileage with the typical figure for the car’s age.'],
      fuel: ['Fuel costs', 'What fuel will cost per month and per year at your mileage.'],
      checklist: ['Inspection checklist', '30 things to check at a viewing. Progress is saved on your device.'],
    },
    vin_ph: 'Enter a VIN (17 characters)', vin_wmi: 'Manufacturer (WMI)', vin_vds: 'Vehicle descriptor (VDS)', vin_check: 'Check digit', vin_year: 'Model year', vin_plant: 'Plant code', vin_serial: 'Serial number', vin_region: 'Region of manufacture',
    vin_ok: 'valid', vin_bad: 'does not match (for North American cars this suggests a typo or a fake VIN)', vin_na: 'not used in this region', vin_full: 'Full check of this VIN',
    vin_err: 'A VIN has 17 characters: Latin letters and digits, no I, O or Q.',
    vin_regions: { A: 'Africa', J: 'Asia (Japan)', K: 'Asia (Korea)', L: 'Asia (China)', M: 'Asia (India, Indonesia, Thailand)', N: 'Asia (Turkey, Iran)', P: 'Asia', R: 'Asia (Taiwan, UAE)', S: 'Europe (UK)', T: 'Europe (Czechia, Hungary, Switzerland)', U: 'Europe (Romania, Denmark)', V: 'Europe (France, Spain, Austria)', W: 'Europe (Germany)', X: 'Europe (Russia, Netherlands)', Y: 'Europe (Sweden, Finland, Belgium, Ukraine)', Z: 'Europe (Italy)', 1: 'North America (USA)', 4: 'North America (USA)', 5: 'North America (USA)', 2: 'North America (Canada)', 3: 'North America (Mexico)', 6: 'Oceania (Australia)', 7: 'Oceania (New Zealand)', 8: 'South America', 9: 'South America (Brazil)' },
    cu_price: 'Car price, €', cu_year: 'Year of manufacture', cu_fuel: 'Engine type', cu_cc: 'Engine size, cm³', cu_kwh: 'Battery capacity, kWh', cu_eu: 'EU-origin car (EUR.1 certificate): 0% duty',
    cu_fuels: { petrol: 'Petrol / LPG', diesel: 'Diesel', hybrid: 'Hybrid', electric: 'Electric' },
    cu_duty: 'Import duty', cu_excise: 'Excise', cu_vat: 'VAT 20%', cu_total: 'Total payable', cu_full: 'Car price incl. customs', cu_rate: 'NBU rate: €1 = {r} UAH on {d}', cu_rate_na: 'NBU rate unavailable, amounts in euros.',
    cu_note: 'Excise: rate × engine size/1000 × age factor (1 to 15). Petrol: €50 up to 3000 cm³, €100 above. Diesel: €75 up to 3500 cm³, €150 above. Hybrid: €100. Electric: €1 per kWh. Electric cars pay 0% duty but 20% VAT from 2026; the rules change, check the current ones. A Pension Fund fee (3–5%) is paid separately at first registration.', cu_age: 'Age factor',
    pl_ph: 'Plate, e.g. AA1234BB', pl_region: 'Region of registration', pl_unknown: 'Code {c} is not one of the main regional codes (2004–2020). It may be a newer code, a transit, official or foreign plate.', pl_fmt: 'Format', pl_std: 'standard plate (2 letters, 4 digits, 2 letters)', pl_other: 'non-standard format', pl_check: 'Check this plate’s history', pl_note: 'The region code shows where the car was registered, not where the owner lives: plates can be kept after re-registration.', pl_err: 'Enter a plate: at least 2 letters and digits.',
    mi_year: 'Year of manufacture', mi_km: 'Mileage, km', mi_avg: 'Average per year', mi_norm: 'Typical in Ukraine: 12–20 thousand km per year', mi_low: 'Mileage is well below typical. This happens with a second car, but it is also the most common sign of rollback. Check the service history and wear of the seat, wheel and pedals.', mi_ok: 'Mileage is within the typical range.', mi_high: 'Mileage is above typical: the car may have been used as a taxi or for deliveries. Check the suspension, gearbox and engine.', mi_err: 'Enter the year and mileage.',
    fu_cons: 'Consumption, L/100 km', fu_km: 'Distance per month, km', fu_price: 'Fuel price, UAH/L', fu_month: 'Per month', fu_year: 'Per year', fu_err: 'Fill in all fields.',
    ck_done: '{n} of {t} checked', ck_reset: 'Start over', ck_note: 'Progress is saved only in your browser.',
    ck: [
      ['Documents', ['VIN in the papers matches the body and windscreen VIN', 'Seller is the registered owner or has a power of attorney', 'Wanted list and registration history checked on VINScope', 'No pledge or arrest (encumbrance register, notary)', 'Service book or receipts with dates and mileage']],
      ['Body', ['Same colour and gloss on all panels in daylight', 'Even gaps around doors, bonnet and wings', 'No welding marks or fresh paint on mounting bolts', 'No rust on sills, arches and underbody', 'All glass has matching markings and year']],
      ['Interior', ['Wear of wheel, pedals and seat matches the mileage', 'No damp smell or water marks under the mats', 'Airbag warning light goes out after start', 'A/C, windows and infotainment work', 'Seat belts pull out and lock']],
      ['Engine and gearbox', ['Cold start without knocks or smoke', 'No oil or coolant leaks', 'No emulsion in oil, no oil film in coolant', 'Smooth gear changes without jerks or delays', 'Diagnostic scan without errors']],
      ['Suspension and brakes', ['Car does not pull to one side', 'No knocks over bumps', 'Even tyre wear', 'Brakes without vibration or squeal', 'No play in the steering']],
      ['Finally', ['Test drive at different speeds', 'Inspection at a garage or on a lift', 'Sale contract at a service centre or notary', 'Cashless payment or bank safe deposit', 'Motor insurance (OSCPV) arranged before driving away']],
    ],
  },
};
TT.uk.regions = REG_UK; TT.ru.regions = REG_RU; TT.en.regions = REG_EN;

// «Как обманывают при покупке авто»: схема, как проверить и инструмент для проверки
TT.uk.nojs = 'Для роботи інструмента потрібен увімкнений JavaScript.'; TT.ru.nojs = 'Для работы инструмента нужен включённый JavaScript.'; TT.en.nojs = 'This tool needs JavaScript to be enabled.';
TT.uk.scam_h = 'Як обманюють при купівлі авто й як це перевірити'; TT.uk.scam_how = 'Як перевірити';
TT.uk.scams = [
  ['Скручений пробіг', 'Авто «омолоджують» на 100–200 тис. км, щоб продати дорожче.', 'Порівняйте пробіг із віком авто, знос керма, педалей і сидіння та сервісну історію.', '/tools/mileage', 'Чи реальний пробіг'],
  ['Утоплене чи «тотальне» авто з США', 'Машини після повені або серйозної аварії ремонтують і продають як цілі.', 'Розшифруйте VIN: країна виробництва, відклики. Шукайте сліди води та іржі під килимками й у багажнику.', '/tools/vin', 'Розшифровка VIN'],
  ['Авто в розшуку або «двійник»', 'Викрадене авто з перебитим VIN або з номерами іншої машини.', 'Звірте VIN на кузові, під лобовим склом і в документах та перевірте розшук.', '/wanted', 'Перевірити розшук'],
  ['Застава або арешт', 'Продають авто в заставі банку чи під арештом — після купівлі його можуть забрати.', 'Попросіть витяг про відсутність обтяжень і оформлюйте угоду в сервісному центрі або в нотаріуса.', '/tools/checklist', 'Чек-лист огляду'],
  ['«Щойно пригнане» авто', 'Приховують, що авто давно в Україні й змінило кількох власників.', 'Подивіться історію реєстрацій: дату першої реєстрації й кількість змін власника.', '/', 'Перевірити за VIN'],
  ['Завдаток за «бронь»', 'Просять передоплату, щоб «притримати» авто, і зникають.', 'Не платіть до огляду. Розраховуйтеся безготівково після підписання договору.', '/tools/checklist', 'Чек-лист огляду'],
];
TT.ru.scam_h = 'Как обманывают при покупке авто и как это проверить'; TT.ru.scam_how = 'Как проверить';
TT.ru.scams = [
  ['Скрученный пробег', 'Авто «омолаживают» на 100–200 тыс. км, чтобы продать дороже.', 'Сравните пробег с возрастом авто, износ руля, педалей и сиденья и сервисную историю.', '/tools/mileage', 'Реален ли пробег'],
  ['Утопленное или «тотальное» авто из США', 'Машины после наводнения или серьёзной аварии ремонтируют и продают как целые.', 'Расшифруйте VIN: страна производства, отзывы. Ищите следы воды и ржавчины под ковриками и в багажнике.', '/tools/vin', 'Расшифровка VIN'],
  ['Авто в розыске или «двойник»', 'Угнанное авто с перебитым VIN или с номерами другой машины.', 'Сверьте VIN на кузове, под лобовым стеклом и в документах и проверьте розыск.', '/wanted', 'Проверить розыск'],
  ['Залог или арест', 'Продают авто в залоге у банка или под арестом — после покупки его могут забрать.', 'Попросите выписку об отсутствии обременений и оформляйте сделку в сервисном центре или у нотариуса.', '/tools/checklist', 'Чек-лист осмотра'],
  ['«Только что пригнанное» авто', 'Скрывают, что авто давно в Украине и сменило нескольких владельцев.', 'Посмотрите историю регистраций: дату первой регистрации и число смен владельца.', '/', 'Проверить по VIN'],
  ['Задаток за «бронь»', 'Просят предоплату, чтобы «придержать» авто, и исчезают.', 'Не платите до осмотра. Рассчитывайтесь безналично после подписания договора.', '/tools/checklist', 'Чек-лист осмотра'],
];
TT.en.scam_h = 'How buyers get cheated and how to check'; TT.en.scam_how = 'How to check';
TT.en.scams = [
  ['Rolled-back mileage', 'The odometer is wound back by 100–200 thousand km to raise the price.', 'Compare mileage with the car’s age, check wear on the wheel, pedals and seat, and the service history.', '/tools/mileage', 'Is the mileage real?'],
  ['Flooded or written-off US car', 'Cars after floods or major crashes are repaired and sold as clean.', 'Decode the VIN: country of manufacture, recalls. Look for water marks and rust under the mats and in the boot.', '/tools/vin', 'VIN decoder'],
  ['Stolen car or “clone”', 'A stolen car with a re-stamped VIN or another car’s plates.', 'Match the VIN on the body, under the windscreen and in the papers, and check the wanted list.', '/wanted', 'Wanted check'],
  ['Pledged or seized car', 'A car under a bank pledge or arrest can be taken away after you buy it.', 'Ask for proof of no encumbrances and sign the deal at a service centre or notary.', '/tools/checklist', 'Inspection checklist'],
  ['“Just imported” car', 'The seller hides that the car has been in Ukraine for years with several owners.', 'Check the registration history: first registration date and number of owner changes.', '/', 'Check by VIN'],
  ['Deposit to “reserve” the car', 'You are asked to prepay to “hold” the car, then the seller disappears.', 'Pay nothing before the viewing. Pay by bank transfer after signing the contract.', '/tools/checklist', 'Inspection checklist'],
];
