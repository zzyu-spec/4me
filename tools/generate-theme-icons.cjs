// Generate install icons from the app's own CSS leaf mark (not from personal photos).
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const root = path.resolve(__dirname, '..');
  fs.mkdirSync(path.join(root, 'icons'), { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(process.env.HARUGYEOL_TEST_URL || 'http://127.0.0.1:8001');
  for (const theme of ['rose', 'sage', 'lavender', 'sky', 'butter', 'mono']) {
    for (const size of [192, 512]) {
      await page.setViewportSize({ width: size, height: size });
      await page.evaluate(({ theme, size }) => {
        state.themeColor = theme; state.appearance = 'light'; applyTheme();
        document.body.innerHTML = '<div class="logo" aria-label="하루결"></div>';
        document.body.style.cssText = 'margin:0;padding:0;overflow:hidden';
        const logo = document.querySelector('.logo');
        logo.style.cssText = `position:absolute;left:0;top:0;transform-origin:top left;transform:scale(${size / 46});box-shadow:none`;
      }, { theme, size });
      await page.screenshot({ path: path.join(root, 'icons', `${theme}-${size}.png`) });
    }
    const manifest = {
      id: './index.html', name: '하루결', short_name: '하루결', start_url: './index.html', scope: './',
      display: 'standalone', background_color: '#f7f3ee', theme_color: '#b77d72', lang: 'ko',
      icons: [192, 512].map(size => ({ src: `icons/${theme}-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' }))
    };
    const colors = { rose: ['#f7f3ee', '#b77d72'], sage: ['#f3f6f1', '#789681'], lavender: ['#f5f2f9', '#9284b5'], sky: ['#f1f6f7', '#6f9eaf'], butter: ['#f8f6ed', '#b49a52'], mono: ['#f4f4f2', '#777777'] };
    [manifest.background_color, manifest.theme_color] = colors[theme];
    fs.writeFileSync(path.join(root, `manifest-${theme}.json`), JSON.stringify(manifest, null, 2) + '\n');
  }
  await browser.close();
  console.log('Generated six theme manifests and 192/512px leaf icons');
})().catch(error => { console.error(error); process.exit(1); });
