const { useAuthenticatedUI } = require('./test-ui-auth.cjs');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await useAuthenticatedUI(page); await page.goto(process.env.HARUGYEOL_TEST_URL || 'http://127.0.0.1:8001');
  for (const width of [320, 390, 760]) {
    await page.setViewportSize({ width, height: 850 });
    assert.equal(await page.locator('#nav').evaluate(el => getComputedStyle(el).position), 'fixed');
    const nav = await page.locator('#nav').boundingBox();
    assert(nav.x >= 0 && nav.x + nav.width <= width && nav.y + nav.height <= 850);
    const buttons = await page.locator('#nav button').all();
    assert.equal(buttons.length, 6);
    for (const button of buttons) {
      const rect = await button.boundingBox();
      assert(rect.width >= 44 && rect.height >= 44);
      assert.equal(rect.y, (await buttons[0].boundingBox()).y);
      assert(await button.locator('svg').isVisible());
    }
    await page.locator('#nav [data-view="timeline"] svg').click();
    assert.equal(await page.locator('#nav [aria-current="page"]').getAttribute('data-view'), 'timeline');
    await page.locator('#nav [data-view="home"]').click();
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    assert.equal(await page.locator('.footer').count(),0);
    const content=await page.locator('#main').boundingBox();
    assert(content.y+content.height<=nav.y);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await page.setViewportSize({ width: 390, height: 850 });
  await page.evaluate(() => {
    state.navOrder = ['journal', 'routines', 'todos', 'timeline', 'calendar', 'home'];
    state.themeColor = 'sage'; save(); render();
  });
  assert.equal(await page.locator('#nav button').first().getAttribute('data-view'), 'journal');
  await page.locator('#nav [data-view="journal"]').click();
  const color = await page.locator('#nav .active').evaluate(el => getComputedStyle(el).color);
  assert.equal(color, 'rgb(120, 150, 129)');
  await page.screenshot({ path: '/workspace/harugyeol-tools/mobile-bottom-nav.png', fullPage: false });
  await page.locator('[data-action="openSettings"]').click();
  assert(Number(await page.locator('#modal').evaluate(el => getComputedStyle(el).zIndex)) > Number(await page.locator('#nav').evaluate(el => getComputedStyle(el).zIndex)));
  await page.locator('#modal').click({position:{x:2,y:2}});
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.equal(await page.locator('#nav').evaluate(el => getComputedStyle(el).position), 'static');
  assert(!await page.locator('#nav svg').first().isVisible());
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('PASS fixed mobile navigation, six touch targets, active state, SVG navigation, custom order/theme, footer clearance, modal layer, desktop layout; no JS errors');
})().catch(error => { console.error(error); process.exit(1); });
