import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';
import { TextDecoder } from 'util';

const prisma = new PrismaClient();
const DEFAULT_PASSWORD_HASH =
  '$2b$10$Vh6qsdX.yQAOi84GB7cjEuNdzyX0O58NDPux1wQgrJWhC9DMp3/ta'; // password123

type LegacyRoute = {
  id: number;
  title: string;
  city: string;
  days: number;
  desc: string;
  lat: number;
  lng: number;
  theme: string;
  tags: string[];
};

type LiveEventSeed = {
  city: string;
  title: string;
  description: string;
  category: string;
  date: string;
  tags: string[];
  link?: string;
  lat?: number;
  lng?: number;
};

const decoder = new TextDecoder('utf-8');
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY ?? '';
const UNSPLASH_ENABLED = Boolean(UNSPLASH_ACCESS_KEY && process.env.ENABLE_UNSPLASH !== 'false');
const UNSPLASH_ENDPOINT = 'https://api.unsplash.com/photos/random';
const unsplashCache = new Map<string, string[]>();
const UNSPLASH_CACHE_FILE = path.resolve(
  __dirname,
  '..',
  '..',
  'prisma',
  'data',
  'unsplash-cache.json',
);
let unsplashCacheDirty = false;
const fetchFn: typeof fetch | undefined = (globalThis as any).fetch;
const IMAGE_MANIFEST_FILE = path.resolve(__dirname, '..', '..', 'prisma', 'data', 'images.json');

const FALLBACK_CITY_IMAGE_COUNT = 7;
const FALLBACK_ROUTE_IMAGE_COUNT = 7;

type ImageManifest = {
  baseUrl?: string;
  cities?: Record<string, ImageEntry>;
  routes?: Record<string, ImageEntry>;
};

type ImageEntry = string[] | ImageEntryConfig;

type ImageEntryConfig = {
  files?: string[];
  slug?: string;
  prefix?: string;
  baseUrl?: string;
  count?: number;
  startIndex?: number;
  ext?: string;
  pad?: number;
};

let imageManifest: ImageManifest | null = null;

const TAG_HINTS = [
  {
    tag: 'культура',
    hint: 'Заранее бронируйте билеты в крупные музеи — так сэкономите время в очередях.',
  },
  {
    tag: 'история',
    hint: 'Возьмите короткий аудиогид по ключевым объектам, чтобы быстрее вникнуть в контекст.',
  },
  {
    tag: 'арт',
    hint: 'Проверяйте расписание временных выставок и pop-up пространств: они делают поездку особенной.',
  },
  {
    tag: 'семья',
    hint: 'Чередуйте активные и спокойные занятия — детям важно оставаться в комфортном ритме.',
  },
  {
    tag: 'детям',
    hint: 'Уточните, можно ли брать перекус и воду — в детских центрах это не всегда очевидно.',
  },
  {
    tag: 'еда',
    hint: 'Популярные гастрономические точки бронируйте заранее — вечерние столики разбирают за сутки.',
  },
  {
    tag: 'локальное',
    hint: 'Попросите рекомендации у местных бариста и гидов — так находят уютные места без толпы.',
  },
  {
    tag: 'развлечения',
    hint: 'Проверяйте афишу площадок — нередко в поездку попадают уникальные концерты и шоу.',
  },
  {
    tag: 'музыка',
    hint: 'Если любите живые выступления, уточните расписание заранее и бронируйте билеты онлайн.',
  },
  {
    tag: 'природа',
    hint: 'Сверьтесь с прогнозом и возьмите дополнительные слои одежды — на смотровых может быть прохладно.',
  },
  {
    tag: 'активный отдых',
    hint: 'Возьмите удобную обувь и бутылку воды — активности часто проходят на открытом воздухе.',
  },
  {
    tag: 'морепродукты',
    hint: 'Самые свежие уловы приходят утром: загляните на рыбный рынок или сделайте бронь на ранний ужин.',
  },
];

const EXTRA_ROUTES: LegacyRoute[] = [
  {
    id: 901,
    title: 'Казань: мечети и татарская кухня',
    city: 'Казань',
    days: 2,
    desc: 'Кремль, набережные Кабана, поездка на остров-Град Свияжск и дегустации чак-чака и эчпочмаков.',
    lat: 55.7963,
    lng: 49.1088,
    theme: 'История и национальный колорит',
    tags: ['история', 'еда', 'культура'],
  },
  {
    id: 902,
    title: 'Сочи: море и горы за уикенд',
    city: 'Сочи',
    days: 3,
    desc: 'Пляжи Имеретинки, прогулка по набережной, подъём на Роза Пик и вечер в хинкальной на Красной Поляне.',
    lat: 43.5855,
    lng: 39.7231,
    theme: 'Море и горы',
    tags: ['природа', 'активный отдых', 'еда'],
  },
  {
    id: 903,
    title: 'Владивосток: дальневосточный драйв',
    city: 'Владивосток',
    days: 2,
    desc: 'Видовые мосты, бухта Золотой Рог, прогулки по набережной и знакомство с дальневосточными морепродуктами.',
    lat: 43.1332,
    lng: 131.9113,
    theme: 'Город у моря',
    tags: ['морепродукты', 'история', 'локальное'],
  },
  {
    id: 904,
    title: 'Калининград: европейский weekend',
    city: 'Калининград',
    days: 2,
    desc: 'Кафедральный собор, Рыбная деревня, замки Восточной Пруссии и янтарные мастерские на побережье.',
    lat: 54.7104,
    lng: 20.4522,
    theme: 'Балтика и старый город',
    tags: ['культура', 'история', 'локальное'],
  },
  {
    id: 905,
    title: 'Алтай: короткий трек к озёрам',
    city: 'Горно-Алтайск',
    days: 4,
    desc: 'Чуйский тракт, водопады Каракола, конная прогулка и баня с видом на кедровые леса.',
    lat: 51.9584,
    lng: 85.9606,
    theme: 'Алтайские маршруты',
    tags: ['природа', 'активный отдых'],
  },
];

type CityMeta = {
  lat: number;
  lng: number;
};

const DEFAULT_COORDS: CityMeta = { lat: 55.7512, lng: 37.6184 };

const CITY_COORDS: Record<string, CityMeta> = {
  Москва: { lat: 55.7512, lng: 37.6184 },
  'Санкт-Петербург': { lat: 59.9311, lng: 30.3609 },
  Архангельск: { lat: 64.5399, lng: 40.515 },
  Астрахань: { lat: 46.3476, lng: 48.0336 },
  Белгород: { lat: 50.5954, lng: 36.5873 },
  Чебоксары: { lat: 56.1439, lng: 47.2489 },
  Чита: { lat: 52.034, lng: 113.4995 },
  'Горно-Алтайск': { lat: 51.9584, lng: 85.96 },
  Иркутск: { lat: 52.2871, lng: 104.281 },
  Иваново: { lat: 56.9995, lng: 40.9728 },
  Ижевск: { lat: 56.8527, lng: 53.2114 },
  Калининград: { lat: 54.7104, lng: 20.4522 },
  Казань: { lat: 55.7963, lng: 49.1088 },
  Хабаровск: { lat: 48.4808, lng: 135.0928 },
  'Комсомольск-на-Амуре': { lat: 50.5503, lng: 137.0096 },
  Краснодар: { lat: 45.0355, lng: 38.9753 },
  Красноярск: { lat: 56.0152, lng: 92.8932 },
  Курск: { lat: 51.7307, lng: 36.1939 },
  Липецк: { lat: 52.61, lng: 39.5942 },
  Магадан: { lat: 59.568, lng: 150.8085 },
  Мурманск: { lat: 68.9585, lng: 33.0827 },
  'Нижний Новгород': { lat: 56.3269, lng: 44.0059 },
  Новосибирск: { lat: 55.0084, lng: 82.9357 },
  Омск: { lat: 54.9885, lng: 73.3242 },
  Орёл: { lat: 52.971, lng: 36.0699 },
  Пермь: { lat: 58.0105, lng: 56.2502 },
  Петрозаводск: { lat: 61.7876, lng: 34.3717 },
  Псков: { lat: 57.8193, lng: 28.3318 },
  'Ростов-на-Дону': { lat: 47.2357, lng: 39.7015 },
  Рязань: { lat: 54.6296, lng: 39.7411 },
  Самара: { lat: 53.2415, lng: 50.2212 },
  Саратов: { lat: 51.5336, lng: 46.0343 },
  Смоленск: { lat: 54.7826, lng: 32.0453 },
  Сочи: { lat: 43.5855, lng: 39.7231 },
  Шуя: { lat: 56.8486, lng: 41.3709 },
  Суздаль: { lat: 56.4164, lng: 40.4526 },
  Тамбов: { lat: 52.7212, lng: 41.4523 },
  Тула: { lat: 54.1961, lng: 37.6186 },
  Тверь: { lat: 56.8596, lng: 35.9119 },
  Уфа: { lat: 54.7388, lng: 55.9721 },
  'Великий Новгород': { lat: 58.5229, lng: 31.2697 },
  Владимир: { lat: 56.1291, lng: 40.4066 },
  Владивосток: { lat: 43.1198, lng: 131.8869 },
  Волгоград: { lat: 48.708, lng: 44.5133 },
  Вологда: { lat: 59.2205, lng: 39.8915 },
  Якутск: { lat: 62.0355, lng: 129.6755 },
  Ярославль: { lat: 57.6261, lng: 39.8845 },
  Екатеринбург: { lat: 56.8389, lng: 60.6057 },
};

type RouteBlueprint = {
  title: string;
  theme: string;
  tags: string[];
  days: number;
  desc(city: string): string;
};

const ROUTE_BLUEPRINTS: RouteBlueprint[] = [
  {
    title: 'классика центра',
    theme: 'История и локальная культура',
    tags: ['культура', 'история', 'локальное'],
    days: 2,
    desc: (city) =>
      `Знакомство с историческим центром ${city}: главные площади, набережные, смотровые и локальные рынки.`,
  },
  {
    title: 'гастрономический уикенд',
    theme: 'Вкус города',
    tags: ['еда', 'локальное', 'развлечения'],
    days: 2,
    desc: (city) =>
      `Лучшие кофейни, гастромаркеты и локальные бары ${city}: дегустации, фермерские продукты и вечер на набережной.`,
  },
  {
    title: 'активный день',
    theme: 'Природа и прогулки',
    tags: ['природа', 'активный отдых'],
    days: 1,
    desc: (city) =>
      `Маршрут для тех, кто хочет больше движения: парки, видовые маршруты и прогулки по окрестностям ${city}.`,
  },
  {
    title: 'семейный отдых',
    theme: 'Баланс и мягкий темп',
    tags: ['семья', 'детям', 'культура'],
    days: 2,
    desc: (city) =>
      `Подборка для семейного путешествия по ${city}: интерактивные музеи, тихие парки и уютные кафе.`,
  },
];
const LIVE_EVENTS: LiveEventSeed[] = [
  {
    city: 'Казань',
    title: 'Ночная экскурсия по Кремлю',
    description: 'Авторский маршрут с подсветкой, рассказы о ханстве и чаепитием после прогулки.',
    category: 'Экскурсия',
    date: '2025-07-15T19:00:00.000Z',
    tags: ['история', 'вечер'],
    link: 'https://events.example.com/kazan-night',
    lat: 55.7999,
    lng: 49.1063,
  },
  {
    city: 'Сочи',
    title: 'SUP at sunrise',
    description: 'Утренний SUP-тур по акватории Имеретинского порта с инструкторами и горячим чаем после заплыва.',
    category: 'Активный отдых',
    date: '2025-08-02T04:30:00.000Z',
    tags: ['море', 'спорт'],
    link: 'https://events.example.com/sochi-sup',
    lat: 43.4085,
    lng: 39.9483,
  },
  {
    city: 'Владивосток',
    title: 'Дальневосточный фуд-тур',
    description: 'Экспресс-знакомство с рыбными рядами, дегустация крабов и мастер-класс по локальным соусам.',
    category: 'Еда',
    date: '2025-09-10T07:00:00.000Z',
    tags: ['морепродукты', 'локальное'],
    link: 'https://events.example.com/vladivostok-food',
    lat: 43.1166,
    lng: 131.8893,
  },
  {
    city: 'Калининград',
    title: 'Органные вечера в соборе',
    description: 'Концерт местных музыкантов и видеоарт в Кафедральном соборе с обзором истории инструмента.',
    category: 'Музыка',
    date: '2025-06-25T17:30:00.000Z',
    tags: ['музыка'],
    link: 'https://events.example.com/kaliningrad-organ',
    lat: 54.7106,
    lng: 20.5102,
  },
  {
    city: 'Горно-Алтайск',
    title: 'Трек к водопаду Учар',
    description: 'Дневной поход с гидом, переправа через Катунь и пикник на смотровой площадке.',
    category: 'Природа',
    date: '2025-07-20T06:00:00.000Z',
    tags: ['природа', 'активный отдых'],
    link: 'https://events.example.com/altay-uchar',
    lat: 51.9333,
    lng: 86.0833,
  },
];

let autoRouteId = 2000;

function buildAutoRoutes(
  city: string,
  meta: CityMeta = DEFAULT_COORDS,
  startIndex = 0,
  count = ROUTE_BLUEPRINTS.length,
): LegacyRoute[] {
  const routes: LegacyRoute[] = [];
  for (let i = 0; i < count; i++) {
    const blueprint = ROUTE_BLUEPRINTS[(startIndex + i) % ROUTE_BLUEPRINTS.length];
    routes.push({
      id: autoRouteId++,
      city,
      title: `${city}: ${blueprint.title}`,
      days: blueprint.days,
      desc: blueprint.desc(city),
      lat: meta.lat,
      lng: meta.lng,
      theme: blueprint.theme,
      tags: blueprint.tags,
    } as LegacyRoute);
  }
  return routes;
}

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const url of urls) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    ordered.push(url);
  }
  return ordered;
}

function sliceCityImages(images: string[], route: LegacyRoute, count: number) {
  if (!images.length) return [];
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const index = (route.id + i) % images.length;
    result.push(images[index]);
  }
  return uniqueUrls(result);
}

async function fetchUnsplashImages(
  query: string,
  count = 1,
  orientation: 'landscape' | 'portrait' | 'squarish' = 'landscape',
): Promise<string[]> {
  if (!UNSPLASH_ENABLED || typeof fetchFn !== 'function') return [];
  const normalized = query.trim();
  if (!normalized) return [];
  const clamped = Math.min(Math.max(count, 1), 30);
  const cacheKey = `${normalized}|${orientation}|${clamped}`;
  const cached = unsplashCache.get(cacheKey);
  if (cached) return cached;

  const url = new URL(UNSPLASH_ENDPOINT);
  url.searchParams.set('query', normalized);
  url.searchParams.set('count', clamped.toString());
  url.searchParams.set('orientation', orientation);
  url.searchParams.set('content_filter', 'high');

  try {
    const response = await fetchFn(url.toString(), {
      headers: {
        Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        'Accept-Version': 'v1',
      },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => response.statusText);
      console.warn('Unsplash request failed:', response.status, body);
      return [];
    }

    const payload = await response.json();
    const items = Array.isArray(payload) ? payload : [payload];
    const urls = items
      .map((item: any) => item?.urls?.regular || item?.urls?.full || item?.urls?.raw)
      .filter((value: string | undefined): value is string => Boolean(value));
    const result = uniqueUrls(urls);
    if (result.length) {
      unsplashCache.set(cacheKey, result);
      unsplashCacheDirty = true;
    }
    return result;
  } catch (error) {
    console.warn('Unsplash fetch error for query', normalized, error);
    return [];
  }
}

function buildCitySummary(name: string, sample: LegacyRoute) {
  return `${name}: ${sample.theme}. ${sample.desc}`;
}

function buildCityImages(index: number, count = FALLBACK_CITY_IMAGE_COUNT) {
  const base = index + 1;
  return Array.from({ length: count }, (_, idx) => `https://images.example.com/cities/${base}-${idx + 1}.jpg`);
}

function buildRouteImages(routeId: number, count = FALLBACK_ROUTE_IMAGE_COUNT) {
  return Array.from({ length: count }, (_, idx) => `https://images.example.com/routes/${routeId}-${idx + 1}.jpg`);
}

async function loadCityImages(name: string, index: number, count = FALLBACK_CITY_IMAGE_COUNT) {
  const manual = getCityImagesFromManifest(name, count);
  if (manual.length) return manual;
  const fallback = buildCityImages(index, count);
  const remote = await fetchUnsplashImages(`${name} city skyline`, count, 'landscape');
  if (!remote.length) return fallback;
  return uniqueUrls([...remote, ...fallback]).slice(0, count);
}

async function loadRouteImages(route: LegacyRoute, cityImages: string[], count = FALLBACK_ROUTE_IMAGE_COUNT) {
  const manual = getRouteImagesFromManifest(route.title, count);
  if (manual.length) return manual;
  const distributed = sliceCityImages(cityImages, route, count);
  const fallback = uniqueUrls([...distributed, ...buildRouteImages(route.id, count)]).slice(0, count);
  if (!UNSPLASH_ENABLED) return fallback;
  const query = `${route.title} ${route.city}`;
  const remote = await fetchUnsplashImages(query, count, 'landscape');
  if (!remote.length) return fallback;
  return uniqueUrls([...remote, ...fallback]).slice(0, count);
}

async function loadLegacyRoutes(): Promise<LegacyRoute[]> {
  const filePath = path.resolve(__dirname, '..', '..', 'prisma', 'data', 'routes.json');
  const file = await fs.readFile(filePath);
  return JSON.parse(decoder.decode(file)) as LegacyRoute[];
}

function buildItinerary(route: LegacyRoute): Prisma.InputJsonValue {
  const segments = Math.max(1, Math.min(route.days, 5));
  const sentences = route.desc
    .split('.')
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return Array.from({ length: segments }, (_, idx) => ({
    day: idx + 1,
    title: `День ${idx + 1}`,
    stops: [
      {
        name: route.title,
        note: sentences[idx] ?? sentences[0] ?? route.theme,
      },
    ],
  }));
}

async function seedFromLegacy() {
  await loadImageManifest();
  await loadUnsplashCache();
  const baseRoutes = await loadLegacyRoutes();
  const legacyRoutes = [...baseRoutes, ...EXTRA_ROUTES];
  const routeCounts = new Map<string, number>();
  for (const route of legacyRoutes) {
    const name = route.city.trim();
    routeCounts.set(name, (routeCounts.get(name) ?? 0) + 1);
  }
  const manifestCities = Object.keys(imageManifest?.cities ?? {});
  for (const city of manifestCities) {
    const existing = routeCounts.get(city) ?? 0;
    if (existing >= ROUTE_BLUEPRINTS.length) continue;
    const toAdd = ROUTE_BLUEPRINTS.length - existing;
    const meta = CITY_COORDS[city] ?? DEFAULT_COORDS;
    const generated = buildAutoRoutes(city, meta, existing, toAdd);
    legacyRoutes.push(...generated);
    routeCounts.set(city, existing + generated.length);
  }
  const grouped = new Map<string, LegacyRoute[]>();

  for (const route of legacyRoutes) {
    const name = route.city.trim();
    if (!grouped.has(name)) grouped.set(name, []);
    grouped.get(name)!.push(route);
  }

  await prisma.savedRoute.deleteMany();
  await prisma.liveEvent.deleteMany();
  await prisma.routeLike.deleteMany();
  await prisma.tagHint.deleteMany();
  await prisma.route.deleteMany();
  await prisma.city.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.createMany({
    data: [
      {
        email: 'demo@travel.local',
        password: DEFAULT_PASSWORD_HASH,
        name: 'Demo User',
        avatarUrl: 'https://images.example.com/avatars/demo.jpg',
      },
      {
        email: 'explorer@travel.local',
        password: DEFAULT_PASSWORD_HASH,
        name: 'Explorer',
        avatarUrl: 'https://images.example.com/avatars/explorer.jpg',
      },
    ],
  });

  const demoUser = await prisma.user.findFirstOrThrow({ where: { email: 'demo@travel.local' } });
  const explorerUser = await prisma.user.findFirstOrThrow({ where: { email: 'explorer@travel.local' } });

  let index = 0;
  const cityRecords = new Map<string, { id: number; images: string[] }>();
  const createdRouteIds: number[] = [];

  for (const [name, routes] of grouped.entries()) {
    const cityImages = await loadCityImages(name, index);
    const city = await prisma.city.create({
      data: {
        name,
        summary: buildCitySummary(name, routes[0]),
        images: cityImages,
      },
    });
    cityRecords.set(name, { id: city.id, images: cityImages });
    index++;

    for (const route of routes) {
      const routeImages = await loadRouteImages(route, cityImages);
      const created = await prisma.route.create({
        data: {
          id: route.id,
          title: route.title,
          cityId: city.id,
          authorId: route.id % 2 === 0 ? demoUser.id : explorerUser.id,
          days: route.days,
          desc: route.desc,
          theme: route.theme,
          tags: route.tags,
          images: routeImages,
          itinerary: buildItinerary(route),
        },
      });
      createdRouteIds.push(created.id);
    }
  }

  const sampleLikes = createdRouteIds.slice(0, 20);
  for (const id of sampleLikes) {
    await prisma.routeLike.create({
      data: {
        routeId: id,
        userId: id % 2 === 0 ? demoUser.id : explorerUser.id,
      },
    });
  }

  const sampleSaved = createdRouteIds.slice(5, 30);
  for (const id of sampleSaved) {
    await prisma.savedRoute.create({
      data: {
        routeId: id,
        userId: id % 2 === 0 ? explorerUser.id : demoUser.id,
      },
    });
  }

  await prisma.tagHint.createMany({
    data: TAG_HINTS,
    skipDuplicates: true,
  });

  const liveEventPayload = LIVE_EVENTS.flatMap((event) => {
    const city = cityRecords.get(event.city);
    if (!city) {
      console.warn(`Пропускаем событие "${event.title}" — нет города ${event.city}`);
      return [];
    }
    return [
      {
        cityId: city.id,
        title: event.title,
        description: event.description,
        category: event.category,
        date: new Date(event.date),
        tags: event.tags,
        link: event.link,
        lat: event.lat,
        lng: event.lng,
      },
    ];
  });

  if (liveEventPayload.length) {
    await prisma.liveEvent.createMany({ data: liveEventPayload });
  }
}

async function loadImageManifest() {
  if (imageManifest) return;
  try {
    const raw = await fs.readFile(IMAGE_MANIFEST_FILE, 'utf8');
    imageManifest = JSON.parse(raw) as ImageManifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('Не удалось загрузить images.json:', error);
    }
    imageManifest = { cities: {}, routes: {} };
  }
}

function getCityImagesFromManifest(name: string, count: number) {
  if (!imageManifest?.cities) return [];
  return resolveManifestEntry(imageManifest.cities[name], name, count, {
    prefix: 'cities',
    fallbackCount: FALLBACK_CITY_IMAGE_COUNT,
  });
}

function getRouteImagesFromManifest(title: string, count: number) {
  if (!imageManifest?.routes) return [];
  return resolveManifestEntry(imageManifest.routes[title], title, count, {
    prefix: 'routes',
    fallbackCount: FALLBACK_ROUTE_IMAGE_COUNT,
  });
}

type ResolveOptions = {
  prefix: string;
  fallbackCount: number;
};

function resolveManifestEntry(
  entry: ImageEntry | undefined,
  key: string,
  desiredCount: number,
  options: ResolveOptions,
) {
  if (!entry) return [];
  if (Array.isArray(entry)) {
    return uniqueUrls(entry).slice(0, desiredCount);
  }

  const files = entry.files?.length
    ? entry.files.map((file) => ensureAbsoluteUrl(file, entry.baseUrl))
    : buildUrlsFromConfig(entry, key, options);
  return uniqueUrls(files).slice(0, desiredCount);
}

function buildUrlsFromConfig(config: ImageEntryConfig, key: string, options: ResolveOptions) {
  const base = ensureBaseUrl(config.baseUrl);
  const slug = config.slug;
  if (!base || !slug) {
    console.warn(`images.json: пропущены baseUrl или slug для "${key}"`);
    return [];
  }

  const prefix = config.prefix ?? options.prefix;
  const ext = config.ext ?? 'jpg';
  const start = config.startIndex ?? 1;
  const count = config.count ?? options.fallbackCount;
  const pad = config.pad ?? 0;

  return Array.from({ length: count }, (_, idx) => {
    const suffix = (start + idx).toString().padStart(pad, '0');
    const pathPart = `${prefix}/${slug}_${suffix}.${ext}`.replace(/\/{2,}/g, '/');
    return `${base}/${pathPart}`.replace(/([^:]\/)\/+/g, '$1');
  });
}

function ensureAbsoluteUrl(url: string, overrideBase?: string) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const base = ensureBaseUrl(overrideBase);
  if (!base) {
    console.warn('images.json: отсутствует baseUrl для относительного пути', url);
    return url;
  }
  return `${base}/${url.replace(/^\/+/, '')}`;
}

function ensureBaseUrl(override?: string) {
  const fromConfig = override ?? imageManifest?.baseUrl;
  const fromEnv = process.env.IMAGE_CDN_BASE;
  const base = fromConfig || fromEnv;
  return base ? base.replace(/\/+$/, '') : '';
}

async function loadUnsplashCache() {
  try {
    const raw = await fs.readFile(UNSPLASH_CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const [key, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) continue;
      const cleaned = value.filter((url): url is string => typeof url === 'string' && url.length > 0);
      if (cleaned.length) {
        unsplashCache.set(key, cleaned);
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('Не удалось загрузить кэш Unsplash:', error);
    }
  }
}

async function saveUnsplashCache() {
  if (!unsplashCacheDirty) return;
  const payload = Object.fromEntries(
    [...unsplashCache.entries()].map(([key, urls]) => [key, uniqueUrls(urls)]),
  );
  await fs.writeFile(UNSPLASH_CACHE_FILE, JSON.stringify(payload, null, 2), 'utf8');
  unsplashCacheDirty = false;
}

async function main() {
  await seedFromLegacy();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await saveUnsplashCache();
    } catch (error) {
      console.warn('Не удалось сохранить кэш Unsplash:', error);
    }
    await prisma.$disconnect();
  });
