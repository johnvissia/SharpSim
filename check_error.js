const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:9002/login');

  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await page.type('input[type="password"]', 'john');
  await page.click('button[type="submit"]');

  await new Promise(r => setTimeout(r, 5000));

  await page.screenshot({ path: 'screenshot.png' });
  
  // Also dump console logs
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await browser.close();
})();
