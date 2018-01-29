#! /usr/bin/env node

var fs          = require("fs-extra");
var request     = require('request');
var now         = require("performance-now")
var chalk       = require('chalk');
var clear       = require('clear');
var ora         = require('ora');
var figlet      = require('figlet');
var inquirer    = require('inquirer');
const puppeteer = require('puppeteer');

var itemsBeingProcessed = 0;
var fileQueue = [];
var maxItems =  10
var counter = 0
var responses = {}

var status = {}

var t0 = now(), t1 = 0

clear();
console.log(
  chalk.red(
    figlet.textSync('Pinterest Downloader', { horizontalLayout: 'default' })
  )
);

getTopic()

function getTopic(callback) {
  var questions = [
    {
      name: 'topics',
      type: 'input',
      default: 'dubuffet',
      message: 'Enter topics seperated by commas',
      validate: function( value ) {
        if (value.length) {
          return true;
        } else {
          return 'Please enter a topic';
        }
      }
    },
  ];

  inquirer.prompt(questions).then(getLocation)
}

function getLocation(answers){
  let arr = answers.topics.split(',')
  responses.topics = []

  arr.forEach( (topic, index) => {
    topic = topic.trim()
    if (topic.length != '') responses.topics.push(topic)
  })

  let manyTopics = responses.topics.length !== 1
  let defaultLoc = !manyTopics ? './' + responses.topics[0].replace(/ /g,'') + '/' : './images/'

  var questions = [
    {
      name: "itemType",
      message: "Scrape using Pins or Boards?",
      type: "list",
      choices: ["Pins", "Boards"]
    },
    {
      name: 'numBoards',
      type: 'input',
      message: 'How many boards do you want to scrape?',
      default: 3,
      when: function ( answers ) {
        return answers.itemType == "Boards"
      },
      validate: function( value ) {
        var isValid = !Number.isNaN(value);
        return isValid || "This should be an integer number!";
      }
    },
    {
      name: 'maxImages',
      type: 'input',
      message: 'How many images do you want to download?',
      default: 10,
      when: function ( answers ) {
        return answers.itemType == "Pins"
      },
      validate: function( value ) {
        var isValid = !Number.isNaN(value);
        return isValid || "This should be an integer number!";
      }
    },
    {
      name: 'location',
      type: 'input',
      message: 'Enter location to save',
      default: defaultLoc, // './' + responses.topics[0] + '/',
      validate: function( value ) {
        if (value.length) {
          return true;
        } else {
          return 'Please enter a location';
        }
      }
    },
    {
      message: "Create folders for each topic?",
      type: "confirm",
      name: "useFolders",
      default: manyTopics
    },
    {
      message: "Display scraping with Chrome?",
      type: "confirm",
      name: "headless",
      default: false
    },
  ];

  inquirer.prompt(questions).then(function(){
    responses = {...responses, ...arguments[0]} // responses.location = arguments[0].location
    if (!response.maxImages) response.maxImages = 10
    responses.length = responses.maxImages * responses.topics.length
    initDownload()
  })
}

function initDownload(){
  let topics = [];
  responses.topics.forEach( (name) => {
    let topic = {}
    topic.name = name.replace(/^\s+|\s+$/g,"")
    topic.page = "https://www.pinterest.com/search/pins/?q=" + topic.name.replace(/ /g,'%20')
    topic.location = responses.location
    if (responses.useFolders && responses.topics.length > 1) topic.location += '/' + topic.name.replace(/ /g,'') + '/'
    if (topic.name !== '') topics.push(topic)
    fs.ensureDirSync(topic.location);
    if (!fs.existsSync(topic.location)){
      fs.mkdirSync(topic.location);
    }
  })

  status.topics = ora({text: 'Scraping Topic Info', spinner: 'dots2'}).start()

  var browseObj, broswer, page

  asyncForEach(topics, async (topic, index) => {
    if (!browseObj) {
      browseObj = await startBrowser()
      browser = browseObj.browser
      page = browseObj.page
    }
    await browse(topic, page)
    if (index == topics.length - 1) browser.close();
  })
}

async function startBrowser() {
  let height = 1000
  let width = 1600
  const browser = await puppeteer.launch({headless: !responses.headless});
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

  if (responses.itemType == "Board") {
    await logIn(page)
  }

  return {browser, page}
}

async function browse(topic, page) {
  let topicUrl = encodeURIComponent(topic.name)

  await page.goto(topic.page)
  await page.waitFor(1000);

  if (topic.useBoards) {
    let sel = body > div:nth-child(3) > div > div:nth-child(1) > div > div > div.appContent > div > div.boardPageContentWrapper > div.ReactBoardHeader > div.boardHeaderWrapper.py2.desktopHeader > div > div > div.belowBoardNameContainer > div > div._0._3i._2m._jp > div:nth-child(1) > span._st._ss._su._sl._5j._sm._sq._nk._nl._nm._nn
    var numPins = page.evaluate(() => document.querySelector(sel).textContent);
  }

  let artworks = []
  for (i = 1; i <= responses.maxImages; i++){
    let pinSel = 'body > div.App.AppBase.Module > div.appContent > div.mainContainer > div > div > div > div > div:nth-child(2) > div > div > div > div:nth-child(' + i + ') > div > div.GrowthUnauthPinImage > a > img'
    let boardSel = 'body > div:nth-child(3) > div > div:nth-child(1) > div > div > div.appContent > div > div.SearchPage > div > div > div > div:nth-child(' + i ')'

    let sel = topic.useBoards ? boardSel : pinSel

    let artwork = await page.evaluate((i, sel) => {
      let data = {}
      let item = document.querySelector(sel) //('div.GrowthUnauthPin_brioPin')
      data.imgSrc = item ? item.getAttribute('src').replace(/236x/, 'originals') : ''
      data.title = item ? item.getAttribute('alt') : ''
      return data
    }, i, sel)
    if (i % 20 == 0) {
      await page.hover(sel)
      await page.waitFor(1500)
    }
    processImage(artwork, topic)
    artworks.push(artwork)
}
  return artworks
}

async function logIn(page){
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
}

function processImage(artwork, topic) {
  if (itemsBeingProcessed > maxItems) {
    fileQueue.push(artwork);
    return;
  }

  itemsBeingProcessed += 1;
  saveImage(artwork, topic)
}

function saveImage(artwork, topic){
  let link = artwork.imgSrc
  let name = artwork.title
  let folder = topic.location || './'

  name = name.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '').trim()
  if (name.length > 20) name = name.slice(0,40).replace(/\s/g,'')

  let stream = fs.createWriteStream(folder + name + '.jpg')

  if (link) {
    request(link).on('error', function(err) {
      console.log(err)
    })
    .pipe(stream);
  }
  else {
    counter++
    finishImage(topic)
  }
  stream.on('finish', () => {
    counter++
    finishImage(topic)
    if (counter == responses.length) {
      status.downloading.succeed()
      ora("Complete").succeed()
      t1 = now()
      let secs = ((t1-t0)/1000).toFixed(1)
      console.log("Output took " + secs + " seconds ( " + secs/60 + " minutes)")
    }
  })

}

function finishImage(topic) {
  itemsBeingProcessed -= 1;
  if (!status.downloading)  {
    status.topics.succeed()
    status.downloading = ora("Downloading Images...").start()
  }
  status.downloading.text = `Processed ${counter} of ${responses.length} total | Topic: ${topic.name}` // process.stdout.write(`\rprocessed ${counter} of ${responses.length} total / working on ... ${topic.name} `)
  if (itemsBeingProcessed <= maxItems && fileQueue.length > 0) {
    processImage(fileQueue.shift(), topic);
  }
}

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array)
  }
}
