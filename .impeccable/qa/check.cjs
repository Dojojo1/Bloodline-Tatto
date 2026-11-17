const { chromium } = require('playwright-core');
const path = require('node:path');

async function inspect(page, width, height, name) {
  await page.setViewportSize({ width, height });
  await page.goto('file:///C:/Users/Dojojo/Desktop/lucia/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(__dirname, '..', 'review', `${name}-viewport.png`) });
  await page.screenshot({ path: path.join(__dirname, '..', 'review', `${name}.png`), fullPage: true });
  return page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    title: document.title,
    headings: [...document.querySelectorAll('h1, h2')].map((h) => h.textContent.trim()),
    brokenImages: [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src),
    gsapLoaded: Boolean(window.gsap),
    heroHeight: Math.round(document.querySelector('.hero').getBoundingClientRect().height),
    gatewayTop: Math.round(document.querySelector('.gateway').getBoundingClientRect().top)
  }));
}

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const desktop = await inspect(page, 1440, 900, 'desktop');
  const tablet = await inspect(page, 768, 1024, 'tablet');
  const mobile = await inspect(page, 390, 844, 'mobile');
  await page.locator('#sur-mesure').screenshot({ path: path.join(__dirname, '..', 'review', 'rp-form-mobile.png') });
  await page.locator('.menu-toggle').click();
  const menuOpen = await page.locator('.menu-toggle').getAttribute('aria-expanded');
  await page.waitForTimeout(260);
  const firstMenuLinkFocused = await page.locator('.primary-nav a').first().evaluate((element) => document.activeElement === element);
  const backgroundInert = await page.locator('main').evaluate((element) => element.inert);
  await page.locator('.primary-nav a').last().focus();
  await page.keyboard.press('Tab');
  const focusWrappedToMenuButton = await page.locator('.menu-toggle').evaluate((element) => document.activeElement === element);
  await page.locator('.primary-nav a[href="#sur-mesure"]').click();
  const menuClosed = await page.locator('.menu-toggle').getAttribute('aria-expanded');
  const backgroundRestored = await page.locator('main').evaluate((element) => !element.inert);
  await page.locator('#rp-name').fill('Alex Moreau');
  await page.locator('#project-type').selectOption('Projet de groupe');
  const groupVisible = await page.locator('#group-size-field').isVisible();
  await page.locator('#group-size').fill('3');
  await page.locator('#tattoo-choice').selectOption('Création unique proposée par le tatoueur');
  await page.locator('#project-placement').fill('Avant-bras');
  await page.locator('.form-button').click();
  const status = await page.locator('#form-status').textContent();
  const copiedRequest = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  await page.locator('#project-type').selectOption('Projet personnel');
  const groupHiddenForPersonal = await page.locator('#group-size-field').isHidden();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const reducedMotionVisible = await page.locator('.hero-logo').isVisible();
  await page.locator('#management-button').click();
  const managementMessageVisible = await page.locator('#management-status').isVisible();

  const configuredPage = await browser.newPage();
  await configuredPage.addInitScript(() => {
    Object.defineProperty(window, 'BLOODLINE_CONTENT', {
      configurable: true,
      set(value) {
        value.hero.brand = 'Marque de test';
        value.navigation[1].label = 'Styles de test';
        value.sectionOrder = ['salon', 'styles', 'artistes', 'realisations', 'sur-mesure'];
        value.sections.styles.items[0].title = 'Motif de test';
        value.theme.redBright = '#00ff00';
        this.configuredContent = value;
      },
      get() { return this.configuredContent; }
    });
  });
  await configuredPage.goto('file:///C:/Users/Dojojo/Desktop/lucia/index.html', { waitUntil: 'domcontentloaded' });
  const contentConfigurationWorks = await configuredPage.evaluate(() => ({
    hero: document.querySelector('.hero-brand').textContent,
    nav: document.querySelector('.primary-nav a:nth-child(2)').textContent,
    firstSection: document.querySelector('main > section:nth-child(2)').id,
    firstStyle: document.querySelector('.style-panel h3').textContent,
    accent: document.documentElement.style.getPropertyValue('--red-bright')
  }));
  console.log(JSON.stringify({ desktop, tablet, mobile, menuOpen, firstMenuLinkFocused, backgroundInert, focusWrappedToMenuButton, menuClosed, backgroundRestored, groupVisible, groupHiddenForPersonal, status, copiedRequest, reducedMotionVisible, managementMessageVisible, contentConfigurationWorks, errors }, null, 2));
  await browser.close();
})().catch((error) => { console.error(error); process.exitCode = 1; });
