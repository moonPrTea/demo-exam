import type {
  Config,
  ConfigInput,
  Dataset,
  Domain,
  Random,
  Row,
  SourceData,
} from './types.js';
import {random, integer, pick, shuffle} from './random.js';
import {toCsv} from './csv.js';

export const GENERATOR_VERSION = 1;
export const domains: Domain[] = [
  {
    id: 'retail',
    name: 'Торговля',
    subtitle: 'Документы и их позиции',
    color: 'violet',
    icon: 'bag',
    grain: 'Одна строка - одна позиция заказа.',
    description:
      'Небольшой магазин товаров для дома. Заказ содержит несколько позиций; цена продажи фиксируется на момент заказа.',
  },
  {
    id: 'library',
    name: 'Библиотека',
    subtitle: 'Экземпляры и выдачи',
    color: 'green',
    icon: 'book',
    grain: 'Одна строка - одна выдача конкретного экземпляра книги.',
    description:
      'Библиотека выдаёт физические экземпляры книг. Одно издание может иметь несколько авторов и несколько экземпляров.',
  },
  {
    id: 'courses',
    name: 'Учебный центр',
    subtitle: 'Курсы и зачисления',
    color: 'orange',
    icon: 'layers',
    grain: 'Одна строка - одно зачисление слушателя на поток курса.',
    description:
      'Учебный центр запускает потоки курсов. Поток ведёт один преподаватель; слушатель может учиться на разных потоках.',
  },
];
const names = [
  'Анна Миронова',
  'Илья Волков',
  'Мария Соколова',
  'Денис Орлов',
  'Алина Белова',
  'Павел Лебедев',
  'София Ким',
  'Марк Морозов',
  'Елена Зотова',
  'Иван Ли',
];
const cities = ['Казань', 'Тула', 'Пермь', 'Москва'];
const date = (n: number) =>
  new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10);
const clean = (value: unknown) =>
  String(value).replaceAll('\u00a0', ' ').trim();
const money = (cents: number) => (cents / 100).toFixed(2);

export function normalizeConfig(input: ConfigInput = {}): Config {
  const config = {
    domain: input.domain ?? 'retail',
    seed: String(input.seed ?? 'FORMA-01'),
    size: Number(input.size ?? 60),
    difficulty: input.difficulty ?? 'basic',
  };
  if (!domains.some(d => d.id === config.domain))
    throw new Error('Неизвестная предметная область.');
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(config.seed))
    throw new Error(
      'Код варианта: 1–40 латинских букв, цифр, дефисов или подчёркиваний.',
    );
  if (!Number.isInteger(config.size) || config.size < 20 || config.size > 500)
    throw new Error('Количество строк должно быть от 20 до 500.');
  if (
    typeof config.difficulty !== 'string' ||
    !['basic', 'advanced'].includes(config.difficulty)
  )
    throw new Error('Неизвестная сложность.');
  return config as Config;
}

function retail(rng: Random, count: number): SourceData {
  const categories = ['Освещение', 'Хранение', 'Текстиль', 'Посуда'];
  const products = Array.from({length: 16}, (_, i) => ({
    code: `00${100 + i * 3}`,
    name:
      ['Лампа «Линия»', 'Контейнер, большой', 'Плед «Дом»', 'Кружка "Утро"'][
        i % 4
      ] + ` ${i + 1}`,
    category: categories[i % 4],
    supplier: ['ООО «Север»', 'Мастерская «Лён»', 'Дом и свет'][i % 3],
    price: 19900 + i * 1375,
  }));
  const rows: Row[] = [];
  let document = 0;
  while (rows.length < count) {
    const id = 101 + document++ * 3;
    const client = integer(rng, 0, 11);
    const day = date(integer(rng, 0, 89));
    const status = pick(rng, ['Новый', 'Выдан', 'Отменён']);
    const selected = shuffle(rng, products).slice(
      0,
      Math.min(integer(rng, 1, 4), count - rows.length),
    );
    selected.forEach((p, index) =>
      rows.push({
        order_id: id,
        order_date: day,
        client_code: `C${100 + client * 7}`,
        client_name: names[client % names.length],
        city: cities[client % 4],
        status,
        line_no: index + 1,
        product_code: p.code,
        product_name: p.name,
        category: p.category,
        supplier: p.supplier,
        quantity: integer(rng, 1, 6),
        unit_price: money(p.price - integer(rng, 0, 5) * 100),
      }),
    );
  }
  return {
    rows,
    rules: [
      'order_id однозначно определяет дату, клиента и статус заказа.',
      'client_code определяет клиента и город. ФИО не является уникальным ключом.',
      'product_code определяет наименование, категорию и поставщика. Разные коды могут иметь похожие названия.',
      'line_no уникален только внутри одного заказа. unit_price - историческая цена позиции, не текущая цена товара.',
    ],
    questions: [
      'Почему order_id не может быть единственным ключом исходной строки?',
      'Где должна храниться историческая цена и почему?',
    ],
    categorical: 'category',
    numeric: 'quantity',
    time: 'order_date',
    distinct: 'order_id',
  };
}

function library(rng: Random, count: number): SourceData {
  const titles = [
    'Алгоритмы без спешки',
    'Город, люди и данные',
    'Основы SQL',
    'Практика «C#»',
    'История дизайна',
    'Математика вокруг',
    'Мир растений',
    'Архитектура систем',
  ];
  const rows = Array.from({length: count}, (_, i) => {
    const copy = integer(rng, 0, 23);
    const book = copy % titles.length;
    const reader = integer(rng, 0, 11);
    return {
      loan_id: 1001 + i * 3,
      loan_date: date(Math.floor(i / 24) * 25 + copy),
      reader_code: `R${100 + reader * 7}`,
      reader_name: names[reader % names.length],
      city: cities[reader % 4],
      copy_code: `00${400 + copy}`,
      shelf: `Зал ${(copy % 3) + 1}`,
      book_code: `B${10 + book * 7}`,
      book_title: titles[book],
      publisher: ['Сфера', 'Маяк', 'Лист'][book % 3],
      authors: book % 2 ? 'Ирина Лескова | Олег Грин' : 'Николай Светлов',
      genre: ['Технологии', 'История', 'Наука', 'Искусство'][book % 4],
      days: integer(rng, 7, 21),
      status: pick(rng, ['Возвращена', 'На руках', 'Просрочена']),
    };
  });
  const last = new Map<string, number>();
  for (const row of rows) {
    const start = last.get(row.copy_code) ?? integer(rng, 0, 12);
    row.loan_date = date(start);
    last.set(row.copy_code, start + row.days + 1);
  }
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (latest.has(row.copy_code))
      latest.get(row.copy_code)!.status = 'Возвращена';
    latest.set(row.copy_code, row);
  }
  return {
    rows,
    rules: [
      'loan_id определяет одну выдачу. Один экземпляр может выдаваться повторно в разные даты.',
      'copy_code определяет физический экземпляр, его издание (book_code) и полку.',
      'book_code определяет название, издательство, жанр и набор авторов. Авторы разделены знаком |; автор может участвовать в нескольких изданиях.',
      'reader_code определяет читателя и город; полное имя не является уникальным ключом. days - срок конкретной выдачи.',
      'Все имена авторов в этом учебном варианте однозначно идентифицируют автора; в реальных данных это нужно проверять отдельно.',
    ],
    questions: [
      'Чем издание отличается от физического экземпляра?',
      'Как представить нескольких авторов без списка внутри одной ячейки?',
    ],
    categorical: 'genre',
    numeric: 'days',
    time: 'loan_date',
    distinct: 'reader_code',
  };
}

function courses(rng: Random, count: number): SourceData {
  const courses = [
    'SQL с нуля',
    'C# и события',
    'Анализ данных',
    'Проектирование БД',
    'Основы тестирования',
    'Дизайн интерфейсов',
  ];
  const pairs = shuffle(
    rng,
    Array.from({length: 600}, (_, i) => [Math.floor(i / 20), i % 20]),
  ).slice(0, count);
  const rows = pairs.map(([student, cohort], i) => {
    const course = cohort % 6;
    const teacher = cohort % 5;
    return {
      enrollment_id: 201 + i * 7,
      enrollment_date: date(integer(rng, 0, 89)),
      student_code: `S${100 + student * 3}`,
      student_name: names[student % names.length],
      city: cities[student % 4],
      cohort_code: `G${10 + cohort * 3}`,
      course_code: `K${100 + course * 7}`,
      course_title: courses[course],
      direction: ['Разработка', 'Аналитика', 'Тестирование'][course % 3],
      teacher_code: `T${10 + teacher * 3}`,
      teacher_name: names[(teacher + 3) % names.length],
      hours: 24 + course * 8,
      fee: money(900000 + course * 130000),
      status: pick(rng, ['Учится', 'Завершил', 'Отчислен']),
    };
  });
  return {
    rows,
    rules: [
      'enrollment_id определяет зачисление. Пара student_code + cohort_code уникальна.',
      'student_code определяет слушателя и город; полное имя не является уникальным ключом.',
      'cohort_code определяет поток, его курс и преподавателя. У одного курса может быть несколько потоков.',
      'course_code определяет название курса, направление и количество часов. teacher_code определяет преподавателя.',
      'fee - стоимость конкретного зачисления; status относится к зачислению, а не к слушателю в целом.',
    ],
    questions: [
      'Почему курс и его поток - разные сущности?',
      'Где должен находиться статус обучения, если слушатель посещает несколько потоков?',
    ],
    categorical: 'direction',
    numeric: 'hours',
    time: 'enrollment_date',
    distinct: 'student_code',
  };
}

export function generateDataset(input: ConfigInput): Dataset {
  const config = normalizeConfig(input);
  const rng = random(
    `${GENERATOR_VERSION}:${config.domain}:${config.seed}:${config.size}:${config.difficulty}`,
  );
  const domain = domains.find(d => d.id === config.domain)!;
  const data = {retail, library, courses}[config.domain](rng, config.size);
  const category = pick(rng, [
    ...new Set(data.rows.map(r => r[data.categorical])),
  ]);
  const status = pick(rng, [...new Set(data.rows.map(r => r.status))]);
  const threshold = Number(pick(rng, data.rows)[data.numeric]);
  const start = pick(rng, data.rows)[data.time];
  const tasks = [
    {
      id: 'filter',
      prompt: `Сколько исходных строк имеют ${data.categorical} = «${category}» и ${data.numeric} >= ${threshold}?`,
      answer: data.rows.filter(
        r =>
          r[data.categorical] === category &&
          Number(r[data.numeric]) >= threshold,
      ).length,
      explanation:
        'Оба условия применяются одновременно (И / AND), граница включена.',
    },
    {
      id: 'distinct',
      prompt: `Сколько различных значений ${data.distinct} встречается в строках со status = «${status}»?`,
      answer: new Set(
        data.rows.filter(r => r.status === status).map(r => r[data.distinct]),
      ).size,
      explanation: `Сначала фильтрация по статусу, затем удаление повторов по ${data.distinct}. Считаются разные идентификаторы, не строки.`,
    },
    {
      id: 'aggregate',
      prompt: `Найди сумму ${data.numeric} по исходным строкам, где ${data.time} >= ${start} (включительно).`,
      answer: data.rows
        .filter(r => r[data.time] >= start)
        .reduce((sum, r) => sum + Number(r[data.numeric]), 0),
      explanation: `Проверяется сумма значений исходных строк, включая повторы, а не сумма по справочнику. Дата ${start} входит в интервал.`,
    },
  ];
  if (config.difficulty === 'advanced') {
    data.rows = data.rows.map((row, i) => ({
      ...row,
      [data.categorical]:
        i % 7 === 0 ? ` ${row[data.categorical]}\u00a0` : row[data.categorical],
    }));
    data.rules.push(
      `В поле ${data.categorical} возможны крайние обычные и неразрывные пробелы. Удали только эти пробелы до выборок и поиска FK; регистр и внутренние пробелы сохраняй.`,
    );
  }
  return {
    version: GENERATOR_VERSION,
    config,
    domain,
    ...data,
    tasks,
    headers: Object.keys(data.rows[0]),
  };
}

export const checklist = [
  'Объясняю смысл строки, сущности и зависимости',
  'Выделил таблицы, назначил устойчивые PK и FK',
  'Проверил дубликаты ключей и отсутствующих родителей',
  'Экспортировал по одному CSV на таблицу и проверил импорт',
];

export function assignment(dataset: Dataset) {
  return `# ${dataset.domain.name} - вариант ${dataset.config.seed}\n\nГенератор v${dataset.version}. Все записи вымышлены.\n\n${dataset.domain.description}\n${dataset.domain.grain}\n\n## Условия\n\n${dataset.rules.map(x => `- ${x}`).join('\n')}\n\n## Задание\n\nСамостоятельно выдели сущности и связи, приведи данные к 3НФ, назначь PK/FK. Сохрани рабочую книгу .ods и отдельный CSV для каждой таблицы. Не ограничивайся удалением повторов. Объясни свои решения.\n\n## Выборки\n\nВыполни в Calc или напиши SQL после создания БД. В приложении проверяются только числовые результаты, не текст SQL.\n\n${dataset.tasks.map((x, i) => `${i + 1}. ${x.prompt}`).join('\n')}\n\n## Вопросы для объяснения\n\n${dataset.questions.map(x => `- ${x}`).join('\n')}\n\n## Самопроверка\n\n${checklist.map(x => `- [ ] ${x}`).join('\n')}\n\nЧек-лист не является автоматической оценкой нормализации или официальной оценкой экзамена.\n`;
}

export function exportFiles(config: ConfigInput, delimiter = ';') {
  const dataset = generateDataset(config);
  return [
    {
      name: 'source.csv',
      content: toCsv(dataset.headers, dataset.rows, delimiter),
    },
    {
      name: 'assignment.md',
      content:
        assignment(dataset) +
        `\n## Импорт CSV\n\nUTF-8 с BOM, разделитель «${delimiter}», первая строка - заголовки, кавычки - двойные. Идентификаторы с ведущими нулями импортируй как текст. Пустые поля не подменяй нулями.\n`,
    },
    {
      name: 'variant.json',
      content: JSON.stringify(
        {generatorVersion: GENERATOR_VERSION, ...dataset.config, delimiter},
        null,
        2,
      ),
    },
  ];
}

export function gradeTasks(dataset: Dataset, answers: Record<string, unknown>) {
  return dataset.tasks.map(task => {
    const raw = String(answers[task.id] ?? '').trim();
    return {
      ...task,
      submitted: raw,
      correct: /^\d+$/.test(raw) && Number(raw) === task.answer,
    };
  });
}

export {clean};
