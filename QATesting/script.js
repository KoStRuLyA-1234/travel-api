const puppeteer = require('puppeteer');
const path = require('path');

const FRONT_URL = process.env.FRONT_URL || 'http://localhost:4200';
const VIEWPORT = { width: 1280, height: 720 };
const launchOpts = { headless: false, slowMo: 100, defaultViewport: VIEWPORT };

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function findByText(page, text) {
  const needle = (text || '').toLowerCase();
  return page.evaluate((n) => document.body.innerText.toLowerCase().includes(n), needle);
}

async function getButtonByText(page, variants = []) {
  const elements = await page.$$('button, [role="button"]');
  for (const el of elements) {
    const label = ((await page.evaluate((el2) => el2.textContent || '', el)) || '').toLowerCase();
    if (variants.some((v) => label.includes(v.toLowerCase()))) {
      return el;
    }
  }
  return null;
}

async function screenshot(page, filename) {
  await page.screenshot({ path: path.join(__dirname, filename), fullPage: true });
}

async function testMainPageLayout() {
  const browser = await puppeteer.launch(launchOpts);
  const page = await browser.newPage();
  try {
    await page.goto(`${FRONT_URL}/`, { waitUntil: 'networkidle0' });

    const titleFound =
      (await findByText(page, 'находите готовые маршруты')) ||
      (await findByText(page, 'маршруты')) ||
      (await findByText(page, 'travel app')) ||
      (await findByText(page, 'travel'));
    if (!titleFound) console.log('Главная: заголовок не найден');

    const menuFound =
      (await findByText(page, 'маршруты')) ||
      (await findByText(page, 'вход')) ||
      (await findByText(page, 'выйти')) ||
      (await findByText(page, 'лента')) ||
      (await findByText(page, 'карта')) ||
      (await findByText(page, 'поиск'));
    if (!menuFound) console.log('Главная: меню/ссылки не найдены');

    const ctaFound =
      (await findByText(page, 'показать маршруты')) ||
      (await findByText(page, 'далее')) ||
      (await findByText(page, 'начать')) ||
      (await findByText(page, 'продолжить'));
    if (!ctaFound) console.log('Главная: кнопка/CTA не найдена');

    await screenshot(page, 'main-page.png');
    console.log('Main page layout: проверено');
  } catch (e) {
    console.error('Main page layout: ошибка', e.message);
  } finally {
    await browser.close();
  }
}

async function testRoutesPageLayout() {
  const browser = await puppeteer.launch(launchOpts);
  const page = await browser.newPage();
  try {
    await page.goto(`${FRONT_URL}/routes`, { waitUntil: 'networkidle0' });

    const titleFound =
      (await findByText(page, 'маршруты')) ||
      (await findByText(page, 'маршруты по')) ||
      (await findByText(page, 'routes'));
    if (!titleFound) console.log('Маршруты: заголовок не найден');

    const cardFound =
      (await findByText(page, 'подробнее')) ||
      (await findByText(page, 'сохранить маршрут')) ||
      (await findByText(page, 'сохранить')) ||
      (await findByText(page, 'день')) ||
      (await findByText(page, 'дня'));
    if (!cardFound) console.log('Маршруты: карточки/список не найдены');

    await screenshot(page, 'routes-page.png');
    console.log('Routes page layout: проверено');
  } catch (e) {
    console.error('Routes page layout: ошибка', e.message);
  } finally {
    await browser.close();
  }
}

async function testLoginPageLayout() {
  const browser = await puppeteer.launch(launchOpts);
  const page = await browser.newPage();
  try {
    await page.goto(`${FRONT_URL}/login`, { waitUntil: 'networkidle0' });

    const titleFound =
      (await findByText(page, 'вход')) ||
      (await findByText(page, 'sign in')) ||
      (await findByText(page, 'login'));
    if (!titleFound) console.log('Логин: заголовок не найден');

    const inputs = await page.$$('input');
    if (inputs.length < 2) console.log('Логин: поля ввода не найдены или меньше двух');

    const submitBtn = await getButtonByText(page, ['войти', 'continue', 'login']);
    if (!submitBtn) console.log('Логин: кнопка входа не найдена');

    await screenshot(page, 'login-page.png');
    console.log('Login page layout: проверено');
  } catch (e) {
    console.error('Login page layout: ошибка', e.message);
  } finally {
    await browser.close();
  }
}

async function login(page, username, password) {
  await page.goto(`${FRONT_URL}/login`, { waitUntil: 'networkidle0' });
  const inputs = await page.$$('input');
  const submitBtn = await getButtonByText(page, ['войти', 'continue', 'login']);
  if (inputs.length < 2 || !submitBtn) {
    console.log('TODO: уточнить селекторы для формы логина');
    return false;
  }
  const [loginInput, passInput] = inputs;
  await loginInput.click({ clickCount: 3 });
  await loginInput.type(username || '');
  await passInput.click({ clickCount: 3 });
  await passInput.type(password || '');
  await submitBtn.click();
  await sleep(2000);
  return true;
}

async function testLoginCases() {
  const browser = await puppeteer.launch(launchOpts);
  const page = await browser.newPage();
  try {
    // Кейс 1: пустые данные
    const ok1 = await login(page, '', '');
    await screenshot(page, 'login-case1.png');
    if (!ok1) {
      console.log('Тест-кейс 1: селекторы формы не найдены');
    } else {
      const err1 =
        (await findByText(page, 'ошибка')) ||
        (await findByText(page, 'required')) ||
        (await findByText(page, 'не заполнено'));
      console.log(err1 ? 'Тест-кейс 1 пройден (пустые данные, ошибка показана)' : 'Тест-кейс 1: нет сообщения об ошибке');
    }

    // Кейс 2: неверные данные
    const ok2 = await login(page, 'wrong@example.com', 'wrongpass');
    await screenshot(page, 'login-case2.png');
    if (!ok2) {
      console.log('Тест-кейс 2: селекторы формы не найдены');
    } else {
      const err2 =
        (await findByText(page, 'невер')) ||
        (await findByText(page, 'invalid')) ||
        (await findByText(page, 'ошибка'));
      console.log(err2 ? 'Тест-кейс 2 пройден (неверные данные, ошибка показана)' : 'Тест-кейс 2: нет сообщения об ошибке');
    }

    // Кейс 3: корректные данные — замените на реальные
    const ok3 = await login(page, 'demo@travel.local', 'password123'); // TODO: заменить на реальную пару
    await sleep(2000);
    await screenshot(page, 'login-case3.png');
    if (!ok3) {
      console.log('Тест-кейс 3: селекторы формы не найдены');
    } else {
      const ok = (await findByText(page, 'нет бронирований')) || (await findByText(page, 'личный кабинет')) || (await findByText(page, 'welcome'));
      console.log(ok ? 'Тест-кейс 3 пройден (корректный вход успешен)' : 'Тест-кейс 3: не видно успешного входа');
    }
  } catch (e) {
    console.error('Login cases: ошибка', e.message);
  } finally {
    await browser.close();
  }
}

async function runAllTests() {
  try {
    await testMainPageLayout();
    await testRoutesPageLayout();
    await testLoginPageLayout();
    await testLoginCases();
  } catch (e) {
    console.error('Общий сбой в runAllTests:', e.message);
  }
}

runAllTests().catch((e) => console.error('Фатальная ошибка запуска тестов:', e.message));
