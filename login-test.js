const puppeteer = require('puppeteer');
var clear       = require('clear');


clear();

browse();

async function browse() {
  height = 1000
  width = 1600
  const browser = await puppeteer.launch({headless: false});
  const page = await browser.newPage();
  await page.setViewport({width, height})

  const {targetInfos: [{targetId}]} = await browser._connection.send(
    'Target.getTargets'
  );

  // Tab window.
  const {windowId} = await browser._connection.send(
    'Browser.getWindowForTarget',
    {targetId}
  );


  await browser._connection.send('Browser.setWindowBounds', {
    bounds: {height, width},
    windowId
  })
  await page.goto('https://www.pinterest.com/')
  await page.click('body > div:nth-child(3) > div > div > div > div > div:nth-child(4) > div > div:nth-child(2) > button') // Log in Button
  await page.waitFor(500);
  await page.click('#email')
  await page.waitFor(500);
  await page.keyboard.type('pinterestdownloader@gmail.com')
  await page.waitFor(500);
  await page.click('#password')
  await page.waitFor(500);
  await page.keyboard.type('downloader!')
  await page.waitFor(500);
  await page.click('body > div.App.AppBase.Module > div > div.mainContainer > div > div > div > div > div > div > div:nth-child(2) > form > button')
  await page.waitForNavigation();
  await page.waitFor(2000);
  browser.close()
}
