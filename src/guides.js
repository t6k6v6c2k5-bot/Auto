// Статьи-гайды для покупателя (uk / ru / en): отвечают на частые поисковые запросы и ведут к проверке и инструментам.
// Тексты намеренно без названий источников данных; только проверяемые общие факты.
export const GUIDES = ['check-by-vin', 'decode-vin', 'where-is-vin', 'recalls', 'odometer', 'us-car', 'buy-checklist'];
export const GUIDE_DATE = { published: '2026-10-27', modified: '2026-10-27' };
// инструмент, на который ведёт статья
export const GUIDE_TOOL = { 'check-by-vin': 'vin', 'decode-vin': 'vin', 'where-is-vin': 'vin', recalls: 'vin', odometer: 'mileage', 'us-car': 'customs', 'buy-checklist': 'checklist' };

export const GG = {
  uk: {
    hub_t: 'Гайди покупцю б/в авто: перевірка за VIN, пробіг, авто зі США | VINScope',
    hub_h: 'Гайди для покупця авто',
    hub_p: 'Короткі й перевірені інструкції: як читати VIN, де його шукати, як виявити скручений пробіг і на що дивитися при купівлі авто з-за кордону.',
    all: 'Усі гайди', related: 'Читайте також', read: 'Читати', min: 'хв читання', cta_h: 'Перевірте авто зараз', cta_p: 'Введіть VIN або держномер — розшук, історія реєстрацій, відкличні кампанії та оцінка ризику безкоштовно.', tool_btn: 'Відкрити інструмент', back: 'Усі гайди',
    a: {
      'check-by-vin': { t: 'Як перевірити авто за VIN-кодом перед покупкою', h: 'Як перевірити авто за VIN-кодом перед покупкою', lead: 'VIN — «паспорт» кузова. За ним можна дізнатися, що за авто насправді, чи не в розшуку воно і чи збігається історія з тим, що розповідає продавець.', min: 4, s: [
        ['Крок 1. Звірте VIN у трьох місцях', 'Перепишіть VIN з лобового скла, зі стійки дверей водія та з документів на авто. Усі три номери мають збігатися до символу. Якщо є сліди перебивання, затерті чи наклеєні таблички — відмовтеся від купівлі.'],
        ['Крок 2. Розшифруйте VIN', 'Розшифровка показує марку, модель, рік та країну виробництва. Якщо в оголошенні заявлено інше, ніж каже VIN, це привід поставити продавцю прямі питання. Контрольну цифру VIN також можна перевірити — неправильна сума означає помилку або підробку.'],
        ['Крок 3. Перевірте розшук і реєстрації', 'Перевірте, чи немає авто в базі розшуку, і подивіться історію реєстрацій: скільки було змін, чи є «прогалини» та різкі зміни регіону. Часта зміна власників за короткий час — тривожний сигнал.'],
        ['Крок 4. Перегляньте відкличні кампанії та аукціонну історію', 'Відкличні кампанії — це дефекти безпеки, які виробник усуває безкоштовно. Для авто з-за кордону корисно також знати, чи не продавалося воно на аукціоні після ДТП: це видно за фото лотів і позначками про пошкодження.'],
        ['Що робити далі', 'Перевірка за VIN не замінює огляд: після неї обов’язково поїдьте на діагностику та перевірте товщину лакофарбового покриття. Якщо щось не сходиться — просіть продавця пояснити, а не поспішайте з завдатком.']] },
      'decode-vin': { t: 'Розшифровка VIN-коду: що означає кожен символ', h: 'Розшифровка VIN: що означає кожен із 17 символів', lead: 'VIN складається з 17 символів латиниці та цифр. Кожна група символів має своє значення — за ними можна «прочитати» авто ще до огляду.', min: 4, s: [
        ['Загальна будова', 'VIN не містить літер I, O та Q — їх легко сплутати з 1 та 0. Стандарт (ISO 3779) ділить код на три частини: 1–3 символи — виробник, 4–9 — опис авто, 10–17 — ідентифікатор конкретного екземпляра.'],
        ['Символи 1–3: код виробника (WMI)', 'Перший символ зазвичай позначає регіон (наприклад, W — Німеччина, J — Японія, 1, 4 та 5 — США, X — Росія, Y6 — Україна), далі йдуть країна й виробник. За цими трьома символами визначають марку.'],
        ['Символи 4–9: опис авто', 'Тут виробник кодує модель, кузов, двигун і комплектацію. Кожен виробник використовує власну схему. У США дев’ятий символ — контрольна цифра: її обчислюють за формулою з решти символів, тому помилка чи підробка зазвичай виявляється.'],
        ['Символи 10–17: рік, завод, серійний номер', 'Десятий символ — модельний рік (літери A–Y та цифри 1–9, цикл 30 років, тому однакова літера може означати 1986 або 2016). Одинадцятий — завод-виробник, а останні шість — порядковий номер авто на конвеєрі.'],
        ['Практичний висновок', 'Розшифровка завжди має збігатися з документами та оголошенням. Спробуйте нашу безкоштовну розшифровку — вона також підсвічує недійсну контрольну цифру.']] },
      'where-is-vin': { t: 'Де знайти VIN-код на авто: 5 місць', h: 'Де знайти VIN-код на авто', lead: 'VIN дублюється в кількох місцях. Усі позначення мають збігатися: розбіжність — привід відмовитися від угоди.', min: 3, s: [
        ['Лобове скло', 'Найпростіше місце: нижній лівий кут лобового скла з боку водія, табличка читається ззовні. Перевірте, що вона не переклеєна та не має слідів втручання.'],
        ['Стійка дверей водія', 'На стійці або торці дверей водія є наклейка або табличка з VIN і даними виробника. Така ж табличка є на багатьох авто з боку пасажира.'],
        ['Моторний відсік', 'VIN вибито або нанесено на щиток моторного відсіку та, на деяких моделях, на стійки амортизаторів. Це дуже важливе місце: тут зазвичай перебивають номер.'],
        ['Кузов і підлога', 'На багатьох авто VIN вибито на кузові або рамі: під пасажирським сидінням, у ніші запасного колеса або на лонжероні. Розташування залежить від моделі.'],
        ['Документи', 'VIN вказано у свідоцтві про реєстрацію, договорі купівлі-продажу, страховому полісі та сервісній книжці. Порівняйте їх із табличками на авто.']] },
      recalls: { t: 'Відкличні кампанії авто: що це і як перевірити за VIN', h: 'Відкличні кампанії: що це і як перевірити за VIN', lead: 'Відкличні кампанії — це офіційні заходи виробника, коли в серії авто знайдено дефект безпеки. Усунення зазвичай безкоштовне, але власник має про нього дізнатися.', min: 3, s: [
        ['Що таке відкличні кампанії', 'Якщо виробник або регулятор виявляє дефект, який може вплинути на безпеку (подушки безпеки, гальма, паливна система, проводка), оголошується відкликання. Власникам пропонують безкоштовно усунути проблему в офіційному сервісі.'],
        ['Чому це важливо для покупця', 'Попередній власник міг не знати про кампанію або проігнорувати її. Купуючи авто, ви отримуєте його проблему. Перевірка за VIN допомагає з’ясувати, чи була відкличка на конкретне авто і чи треба доробка.'],
        ['Як перевірити', 'Введіть VIN у перевірку — ми покажемо відомі відкличні кампанії для цієї моделі та року, а також скарги й рейтинг безпеки, якщо вони є. Для європейських і американських авто покриття найповніше; для сильно «сірих» моделей даних може бути менше.'],
        ['Що робити, якщо кампанія є', 'Зверніться до офіційного дилера: уточніть, чи виконано роботи за цим VIN. Іноді дилер у вашій країні може відмовити, якщо авто не продавалося офіційно, — тоді враховуйте ризик у ціні.']] },
      odometer: { t: 'Скручений пробіг: як виявити за 5 ознак', h: 'Скручений пробіг: як його виявити', lead: 'Скручений одометр — найпоширеніший обман при продажі б/в авто. Повністю гарантувати нічого не можна, але його можна помітити за сукупністю ознак.', min: 4, s: [
        ['Порівняйте пробіг із віком', 'Типовий пробіг для приватного авто — приблизно 10–20 тис. км на рік. Якщо у 10-річного авто заявлено 60 тис. км, це можливо, але потребує підтверджень. Наш калькулятор допоможе швидко оцінити середній річний пробіг.'],
        ['Огляньте зношення', 'Кермо, педалі, обшивка водійського сидіння, кнопки, ручка КПП. Якщо вони «убиті» на авто з малим пробігом — це червоний прапорець. Перевірте й нові деталі: свіже кермо чи накладки на педалі — привід питати чому.'],
        ['Шукайте документальні докази', 'Сервісна книжка зі штампами, чеки, історія техоглядів, записи з попередніх оголошень. Різке падіння пробігу між записами — ознака втручання.'],
        ['Діагностика', 'Багато сучасних авто зберігають пробіг у кількох блоках. Діагностика на сервісі може виявити розбіжність між одометром, блоком двигуна та іншими модулями.'],
        ['Не покладайтеся на одну ознаку', 'Жодна ознака не доводить скручування сама по собі. Але якщо їх кілька — не купуйте без незалежної діагностики.']] },
      'us-car': { t: 'Авто зі США: на що дивитись при купівлі', h: 'Авто зі США: на що звернути увагу', lead: 'Авто з аукціонів США часто привабливі за ціною, але мають свої ризики: серйозні пошкодження, повені та «збірні» кузови.', min: 5, s: [
        ['Перевірте історію за VIN', 'Передусім — розшифровка та історія аукціонних лотів: подивіться фото лотів до та після ремонту, пошкодження, пробіг під час продажу. Такі дані входять до розширеного звіту для VIN зі США.'],
        ['Статус пошкодження', 'Усе, що описано як «salvage», «flood» чи «total loss», означає значні ушкодження. Авто можуть відновлювати, але якість ремонту різна. Оцінюйте масштаб пошкоджень і вартість ремонту, а не лише ціну авто.'],
        ['Огляд перед покупкою', 'Перевірте геометрію кузова, товщину фарби, стан шасі та підвісок, наявність слідів води, подушок безпеки. Окремо слід перевірити електрику: після повені вона виходить з ладу не одразу.'],
        ['Вартість розмитнення', 'До ціни авто додаються доставка, мито, акциз та ПДВ. Скористайтеся калькулятором розмитнення, щоб приблизно оцінити витрати, але остаточну суму завжди уточнюйте в митного брокера.'],
        ['Перевірте відкличні кампанії', 'Американські авто можуть мати відкличні кампанії, які офіційно не виконувалися в Україні. Знайте про це заздалегідь.']] },
      'buy-checklist': { t: 'Чек-лист огляду авто перед купівлею', h: 'Чек-лист огляду авто перед купівлею', lead: 'Короткий порядок дій для покупця: від документів до тест-драйву. Використовуйте інтерактивний чек-лист і відмічайте пункти на ходу.', min: 4, s: [
        ['Документи', 'Перевірте особу продавця та його право на продаж, VIN у документах і на авто. Переконайтеся, що немає обтяжень та розшуку. Не купуйте за довіреністю, якщо не впевнені в законності схеми.'],
        ['Кузов і салон', 'Огляньте зазори між панелями, колір і товщину фарби, сліди ремонту. У салоні перевірте всі кнопки, подушки безпеки та запахи вологи.'],
        ['Двигун та підвіска', 'Холодний запуск, відсутність стуків і диму, рівень і колір рідин. Під час тест-драйву зверніть увагу на гальма, КПП та поведінку підвіски на нерівностях.'],
        ['Діагностика і незалежна експертиза', 'Поїдьте на СТО на свій вибір (не рекомендований продавцем). Діагностика та підйомник дадуть більше інформації, ніж огляд на вулиці.'],
        ['Угода', 'Укладайте договір у сервісному центрі МВС. Не передавайте гроші до оформлення, а після — тільки з підписаними документами.']] },
    },
  },
  ru: {
    hub_t: 'Гайды покупателю б/у авто: проверка по VIN, пробег, авто из США | VINScope',
    hub_h: 'Гайды для покупателя авто',
    hub_p: 'Короткие и проверенные инструкции: как читать VIN, где его искать, как выявить скрученный пробег и на что смотреть при покупке авто из-за границы.',
    all: 'Все гайды', related: 'Читайте также', read: 'Читать', min: 'мин чтения', cta_h: 'Проверьте авто сейчас', cta_p: 'Введите VIN или госномер — розыск, история регистраций, отзывные кампании и оценка риска бесплатно.', tool_btn: 'Открыть инструмент', back: 'Все гайды',
    a: {
      'check-by-vin': { t: 'Как проверить авто по VIN-коду перед покупкой', h: 'Как проверить авто по VIN-коду перед покупкой', lead: 'VIN — «паспорт» кузова. По нему можно узнать, что за авто на самом деле, не в розыске ли оно и совпадает ли история с рассказом продавца.', min: 4, s: [
        ['Шаг 1. Сверьте VIN в трёх местах', 'Перепишите VIN с лобового стекла, со стойки двери водителя и из документов. Все три номера должны совпадать до символа. Если есть следы перебивки, затёртые или наклеенные таблички — откажитесь от покупки.'],
        ['Шаг 2. Расшифруйте VIN', 'Расшифровка показывает марку, модель, год и страну производства. Если в объявлении заявлено другое, это повод задать продавцу прямые вопросы. Контрольную цифру VIN тоже можно проверить — неверная сумма означает ошибку или подделку.'],
        ['Шаг 3. Проверьте розыск и регистрации', 'Проверьте, нет ли авто в базе розыска, и посмотрите историю регистраций: сколько было смен, есть ли «пропуски» и резкие смены региона. Частая смена владельцев за короткое время — тревожный сигнал.'],
        ['Шаг 4. Посмотрите отзывные кампании и аукционную историю', 'Отзывные кампании — это дефекты безопасности, которые производитель устраняет бесплатно. Для авто из-за границы полезно знать, не продавалось ли оно на аукционе после ДТП: это видно по фото лотов и пометкам о повреждениях.'],
        ['Что делать дальше', 'Проверка по VIN не заменяет осмотр: после неё обязательно съездите на диагностику и проверьте толщину лакокрасочного покрытия. Если что-то не сходится — просите продавца объяснить и не спешите с задатком.']] },
      'decode-vin': { t: 'Расшифровка VIN-кода: что означает каждый символ', h: 'Расшифровка VIN: что означает каждый из 17 символов', lead: 'VIN состоит из 17 символов латиницы и цифр. Каждая группа имеет своё значение — по ним можно «прочитать» авто ещё до осмотра.', min: 4, s: [
        ['Общее устройство', 'В VIN нет букв I, O и Q — их легко спутать с 1 и 0. Стандарт (ISO 3779) делит код на три части: 1–3 символы — производитель, 4–9 — описание авто, 10–17 — идентификатор конкретного экземпляра.'],
        ['Символы 1–3: код производителя (WMI)', 'Первый символ обычно обозначает регион (например, W — Германия, J — Япония, 1, 4 и 5 — США, X — Россия, Y6 — Украина), далее идут страна и производитель. По этим трём символам определяют марку.'],
        ['Символы 4–9: описание авто', 'Здесь производитель кодирует модель, кузов, двигатель и комплектацию. Каждый производитель использует собственную схему. В США девятый символ — контрольная цифра: её считают по формуле из остальных символов, поэтому ошибка или подделка обычно выявляется.'],
        ['Символы 10–17: год, завод, серийный номер', 'Десятый символ — модельный год (буквы A–Y и цифры 1–9, цикл 30 лет, поэтому одна и та же буква может означать 1986 или 2016). Одиннадцатый — завод-изготовитель, а последние шесть — порядковый номер авто на конвейере.'],
        ['Практический вывод', 'Расшифровка всегда должна совпадать с документами и объявлением. Попробуйте нашу бесплатную расшифровку — она также подсвечивает недействительную контрольную цифру.']] },
      'where-is-vin': { t: 'Где найти VIN-код на авто: 5 мест', h: 'Где найти VIN-код на авто', lead: 'VIN дублируется в нескольких местах. Все обозначения должны совпадать: расхождение — повод отказаться от сделки.', min: 3, s: [
        ['Лобовое стекло', 'Проще всего: нижний левый угол лобового стекла со стороны водителя, табличка читается снаружи. Убедитесь, что она не переклеена и не имеет следов вмешательства.'],
        ['Стойка двери водителя', 'На стойке или торце двери водителя есть наклейка или табличка с VIN и данными производителя. Такая же табличка есть на многих авто со стороны пассажира.'],
        ['Моторный отсек', 'VIN выбит или нанесён на щиток моторного отсека и, на некоторых моделях, на стойки амортизаторов. Это очень важное место: здесь обычно перебивают номер.'],
        ['Кузов и пол', 'На многих авто VIN выбит на кузове или раме: под пассажирским сиденьем, в нише запасного колеса или на лонжероне. Расположение зависит от модели.'],
        ['Документы', 'VIN указан в свидетельстве о регистрации, договоре купли-продажи, страховом полисе и сервисной книжке. Сравните их с табличками на авто.']] },
      recalls: { t: 'Отзывные кампании авто: что это и как проверить по VIN', h: 'Отзывные кампании: что это и как проверить по VIN', lead: 'Отзывные кампании — это официальные меры производителя, когда в серии авто найден дефект безопасности. Устранение обычно бесплатное, но владелец должен о нём узнать.', min: 3, s: [
        ['Что такое отзывные кампании', 'Если производитель или регулятор обнаруживает дефект, который может повлиять на безопасность (подушки, тормоза, топливная система, проводка), объявляется отзыв. Владельцам предлагают бесплатно устранить проблему в официальном сервисе.'],
        ['Почему это важно покупателю', 'Прежний владелец мог не знать о кампании или проигнорировать её. Покупая авто, вы получаете его проблему. Проверка по VIN помогает выяснить, была ли отзывная кампания на конкретное авто и нужна ли доработка.'],
        ['Как проверить', 'Введите VIN в проверку — мы покажем известные отзывные кампании для этой модели и года, а также жалобы и рейтинг безопасности, если они есть. Для европейских и американских авто покрытие наиболее полное; для сильно «серых» моделей данных может быть меньше.'],
        ['Что делать, если кампания есть', 'Обратитесь к официальному дилеру: уточните, выполнены ли работы по этому VIN. Иногда дилер в вашей стране может отказать, если авто не продавалось официально, — тогда учитывайте риск в цене.']] },
      odometer: { t: 'Скрученный пробег: как выявить по 5 признакам', h: 'Скрученный пробег: как его выявить', lead: 'Скрученный одометр — самый распространённый обман при продаже б/у авто. Полностью гарантировать ничего нельзя, но его можно заметить по совокупности признаков.', min: 4, s: [
        ['Сравните пробег с возрастом', 'Типичный пробег для частного авто — примерно 10–20 тыс. км в год. Если у 10-летнего авто заявлено 60 тыс. км, это возможно, но требует подтверждений. Наш калькулятор поможет быстро оценить средний годовой пробег.'],
        ['Осмотрите износ', 'Руль, педали, обивка водительского сиденья, кнопки, ручка КПП. Если они «убиты» на авто с малым пробегом — это красный флаг. Проверьте и новые детали: свежий руль или накладки на педали — повод спросить почему.'],
        ['Ищите документальные доказательства', 'Сервисная книжка со штампами, чеки, история техосмотров, записи из прошлых объявлений. Резкое падение пробега между записями — признак вмешательства.'],
        ['Диагностика', 'Многие современные авто хранят пробег в нескольких блоках. Диагностика на сервисе может выявить расхождение между одометром, блоком двигателя и другими модулями.'],
        ['Не полагайтесь на один признак', 'Ни один признак сам по себе не доказывает скрутку. Но если их несколько — не покупайте без независимой диагностики.']] },
      'us-car': { t: 'Авто из США: на что смотреть при покупке', h: 'Авто из США: на что обратить внимание', lead: 'Авто с аукционов США часто привлекательны по цене, но имеют свои риски: серьёзные повреждения, наводнения и «сборные» кузова.', min: 5, s: [
        ['Проверьте историю по VIN', 'Прежде всего — расшифровка и история аукционных лотов: посмотрите фото лотов до и после ремонта, повреждения, пробег при продаже. Такие данные входят в расширенный отчёт для VIN из США.'],
        ['Статус повреждения', 'Всё, что описано как «salvage», «flood» или «total loss», означает значительные повреждения. Авто могут восстанавливать, но качество ремонта разное. Оценивайте масштаб повреждений и стоимость ремонта, а не только цену авто.'],
        ['Осмотр перед покупкой', 'Проверьте геометрию кузова, толщину краски, состояние шасси и подвесок, следы воды, подушки безопасности. Отдельно проверьте электрику: после наводнения она выходит из строя не сразу.'],
        ['Стоимость растаможки', 'К цене авто добавляются доставка, пошлина, акциз и НДС. Воспользуйтесь калькулятором растаможки, чтобы примерно оценить расходы, но окончательную сумму всегда уточняйте у таможенного брокера.'],
        ['Проверьте отзывные кампании', 'Американские авто могут иметь отзывные кампании, которые официально не выполнялись в Украине. Знайте об этом заранее.']] },
      'buy-checklist': { t: 'Чек-лист осмотра авто перед покупкой', h: 'Чек-лист осмотра авто перед покупкой', lead: 'Краткий порядок действий для покупателя: от документов до тест-драйва. Используйте интерактивный чек-лист и отмечайте пункты на ходу.', min: 4, s: [
        ['Документы', 'Проверьте личность продавца и его право на продажу, VIN в документах и на авто. Убедитесь, что нет обременений и розыска. Не покупайте по доверенности, если не уверены в законности схемы.'],
        ['Кузов и салон', 'Осмотрите зазоры между панелями, цвет и толщину краски, следы ремонта. В салоне проверьте все кнопки, подушки безопасности и запахи влаги.'],
        ['Двигатель и подвеска', 'Холодный запуск, отсутствие стуков и дыма, уровень и цвет жидкостей. Во время тест-драйва обратите внимание на тормоза, КПП и поведение подвески на неровностях.'],
        ['Диагностика и независимая экспертиза', 'Поезжайте на СТО по своему выбору (не рекомендованное продавцом). Диагностика и подъёмник дадут больше информации, чем осмотр на улице.'],
        ['Сделка', 'Заключайте договор в сервисном центре МВД. Не передавайте деньги до оформления, а после — только с подписанными документами.']] },
    },
  },
  en: {
    hub_t: 'Used car buyer guides: VIN check, mileage, cars from the US | VINScope',
    hub_h: 'Used car buyer guides',
    hub_p: 'Short, practical guides: how to read a VIN, where to find it, how to spot rolled-back mileage and what to check when buying a car from abroad.',
    all: 'All guides', related: 'Related guides', read: 'Read', min: 'min read', cta_h: 'Check a car now', cta_p: 'Enter a VIN or plate — wanted-vehicle check, registration history, recalls and a risk score, free.', tool_btn: 'Open the tool', back: 'All guides',
    a: {
      'check-by-vin': { t: 'How to check a car by VIN before buying', h: 'How to check a car by VIN before buying', lead: 'The VIN is the car’s ID. It tells you what the car really is, whether it is reported stolen and whether its history matches what the seller says.', min: 4, s: [
        ['Step 1. Match the VIN in three places', 'Copy the VIN from the windscreen, the driver-side door pillar and the paperwork. All three must match character for character. Walk away if a plate looks re-stamped, scratched or glued on.'],
        ['Step 2. Decode the VIN', 'Decoding shows the make, model, year and country of origin. If the listing claims something different, ask the seller directly. You can also verify the check digit — a wrong sum means a typo or a forgery.'],
        ['Step 3. Check wanted status and registrations', 'See whether the car is in the wanted-vehicle database and review the registration history: how many changes, gaps and sudden region changes. Many owners in a short time is a warning sign.'],
        ['Step 4. Look at recalls and auction history', 'Recalls are safety defects the manufacturer fixes for free. For imported cars it also helps to know whether the car was sold at auction after a crash: auction photos and damage notes show it.'],
        ['What next', 'A VIN check does not replace an inspection: afterwards get a diagnostic scan and measure the paint thickness. If something doesn’t add up, ask the seller to explain and don’t rush a deposit.']] },
      'decode-vin': { t: 'VIN decoder: what every character means', h: 'VIN decoder: what each of the 17 characters means', lead: 'A VIN has 17 letters and digits. Each group means something, so you can “read” the car before you see it.', min: 4, s: [
        ['Overall structure', 'A VIN never contains the letters I, O or Q — they are too easy to confuse with 1 and 0. The standard (ISO 3779) splits the code into three parts: characters 1–3 identify the manufacturer, 4–9 describe the car, 10–17 identify the individual vehicle.'],
        ['Characters 1–3: manufacturer code (WMI)', 'The first character usually shows the region (for example W — Germany, J — Japan, 1, 4 and 5 — the USA, X — Russia, Y6 — Ukraine), followed by the country and the maker. These three characters identify the brand.'],
        ['Characters 4–9: vehicle descriptor', 'The maker encodes model, body, engine and trim here, each with its own scheme. In North America the ninth character is a check digit calculated from the others, so typos and forgeries are usually caught.'],
        ['Characters 10–17: year, plant, serial number', 'The tenth character is the model year (letters A–Y and digits 1–9, a 30-year cycle, so the same letter can mean 1986 or 2016). The eleventh is the assembly plant, and the last six are the production serial number.'],
        ['In practice', 'The decoded data should always match the paperwork and the listing. Try our free decoder — it also flags an invalid check digit.']] },
      'where-is-vin': { t: 'Where to find the VIN on a car: 5 places', h: 'Where to find the VIN on a car', lead: 'The VIN is repeated in several places. They must all match: a mismatch is a reason to walk away.', min: 3, s: [
        ['Windscreen', 'The easiest spot: the lower left corner of the windscreen on the driver’s side, readable from outside. Check that the plate is not re-glued and shows no signs of tampering.'],
        ['Driver’s door pillar', 'A sticker or plate on the pillar or door edge shows the VIN and manufacturer data. Many cars carry the same plate on the passenger side.'],
        ['Engine bay', 'The VIN is stamped or printed on the bulkhead and, on some models, on the strut towers. This is an important spot because it is where numbers are usually tampered with.'],
        ['Body and floor', 'On many cars the VIN is stamped into the body or frame: under the passenger seat, in the spare-wheel well or on a side member. The position depends on the model.'],
        ['Paperwork', 'The VIN appears on the registration certificate, the sale contract, the insurance policy and the service book. Compare them with the plates on the car.']] },
      recalls: { t: 'Car recalls: what they are and how to check by VIN', h: 'Car recalls: what they are and how to check by VIN', lead: 'A recall is an official action by the manufacturer when a safety defect is found in a model run. The fix is usually free, but the owner has to find out about it.', min: 3, s: [
        ['What a recall is', 'When a manufacturer or regulator finds a defect that may affect safety (airbags, brakes, fuel system, wiring), a recall is announced. Owners are offered a free repair at an authorised service centre.'],
        ['Why it matters to a buyer', 'The previous owner may not have known about a recall or ignored it. When you buy the car, you inherit the problem. A VIN check shows whether a recall applies to that specific car.'],
        ['How to check', 'Enter the VIN into our check — we show known recalls for that model and year, plus complaints and safety ratings where available. Coverage is best for European and American cars; for heavily “grey” models there may be less data.'],
        ['If there is a recall', 'Contact an authorised dealer and ask whether the work has been done for this VIN. Sometimes a dealer in your country may refuse if the car was not sold officially — factor that risk into the price.']] },
      odometer: { t: 'Rolled-back mileage: 5 signs to spot it', h: 'Rolled-back mileage: how to spot it', lead: 'Odometer fraud is the most common trick in used-car sales. Nothing is a guarantee, but a combination of signs usually gives it away.', min: 4, s: [
        ['Compare mileage with age', 'A typical private car covers roughly 10,000–20,000 km a year. A 10-year-old car showing 60,000 km is possible but needs proof. Our calculator quickly estimates the average yearly mileage.'],
        ['Inspect the wear', 'Steering wheel, pedals, driver’s seat bolster, buttons and gear knob. If they look worn on a “low-mileage” car, that is a red flag. New parts such as a fresh steering wheel or pedal covers also deserve a question.'],
        ['Look for paper evidence', 'A stamped service book, receipts, inspection history and earlier listings. A sudden drop in mileage between records points to tampering.'],
        ['Diagnostics', 'Many modern cars store mileage in several modules. A scan at a workshop can reveal a mismatch between the instrument cluster, the engine control unit and other modules.'],
        ['Don’t rely on one sign', 'No single sign proves tampering. But if several appear together, don’t buy without an independent diagnostic.']] },
      'us-car': { t: 'Buying a car from the US: what to check', h: 'Buying a car from the US: what to check', lead: 'Cars from US auctions are often cheap but carry risks: serious damage, flood history and rebuilt bodies.', min: 5, s: [
        ['Check the VIN history', 'Start with the decode and the auction lot history: look at lot photos before and after repair, damage notes and the odometer at sale. This data is part of the extended report for US VINs.'],
        ['Damage status', 'Anything described as “salvage”, “flood” or “total loss” means significant damage. Such cars can be repaired, but the quality varies. Weigh the extent of the damage and the cost of repair, not only the price.'],
        ['Inspect before buying', 'Check body geometry, paint thickness, chassis and suspension, signs of water and airbags. Test the electrics separately: after a flood they often fail later, not at once.'],
        ['Import cost', 'Shipping, duty, excise and VAT are added to the price. Use the import-duty calculator for a rough estimate, and always confirm the final amount with a customs broker.'],
        ['Check recalls', 'US cars may have recalls that were never officially carried out in Ukraine. Know about them in advance.']] },
      'buy-checklist': { t: 'Used car inspection checklist', h: 'Used car inspection checklist before buying', lead: 'A short plan for the buyer, from paperwork to the test drive. Use the interactive checklist and tick items as you go.', min: 4, s: [
        ['Paperwork', 'Verify the seller’s identity and right to sell, and the VIN on the papers and on the car. Make sure there are no liens or wanted flags. Avoid buying on a power of attorney unless you are sure the scheme is legal.'],
        ['Body and interior', 'Look at panel gaps, paint colour and thickness, and repair traces. Inside, test every button, check the airbags and sniff for damp.'],
        ['Engine and suspension', 'Cold start, no knocks or smoke, fluid levels and colour. On the test drive, pay attention to the brakes, gearbox and how the suspension handles bumps.'],
        ['Diagnostics and independent inspection', 'Take the car to a workshop you choose, not one the seller recommends. A scan and a lift give more information than a roadside look.'],
        ['The deal', 'Sign the contract at an official service centre. Don’t hand over money before the paperwork, and afterwards only against signed documents.']] },
    },
  },
};
