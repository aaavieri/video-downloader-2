import { app, BrowserWindow, nativeTheme, ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import cheerio from 'cheerio'
import fetch from 'electron-fetch'

try {
  if (process.platform === 'win32' && nativeTheme.shouldUseDarkColors === true) {
    require('fs').unlinkSync(require('path').join(app.getPath('userData'), 'DevTools Extensions'))
  }
} catch (_) { }

/**
 * Set `__statics` path to static files in production;
 * The reason we are setting it here is that the path needs to be evaluated at runtime
 */
if (process.env.PROD) {
  global.__statics = __dirname
}

let mainWindow

function createWindow () {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    useContentSize: true,
    webPreferences: {
      // Change from /quasar.conf.js > electron > nodeIntegration;
      // More info: https://quasar.dev/quasar-cli/developing-electron-apps/node-integration
      nodeIntegration: process.env.QUASAR_NODE_INTEGRATION,
      nodeIntegrationInWorker: process.env.QUASAR_NODE_INTEGRATION,

      // More info: /quasar-cli/developing-electron-apps/electron-preload-script
      // preload: path.resolve(__dirname, 'electron-preload.js')
    }
  })

  mainWindow.loadURL(process.env.APP_URL)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

ipcMain.on('downloadFile', async (event, { url, index }) => {
  const { sender } = event
  const response = await fetch(url)
  const pageContent = await response.text()
  const $ = cheerio.load(pageContent)
  const video = $('video')
  if (!video) {
    return
  }
  const videoSrc = video.attr('src')
  const [, fileName] = videoSrc.match(/\/([-\w]+\.mp4)\?/)
  // Save variable to know progress
  let receivedBytes = 0
  let totalBytes = 0
  let percentage = 0

  const videoRes = await fetch(videoSrc)
  totalBytes = parseInt(videoRes.headers.get('content-length'))

  const fileFolder = `./${dateFormat('mmdd', new Date())}`
  const filePath = `${fileFolder}/${fileName}`
  if (!fs.existsSync(fileFolder)) {
    fs.mkdirSync(fileFolder)
  }
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
  const out = fs.createWriteStream(filePath)
  out.on('error', error => {
    console.log(error)
    sender.send('downloadFail', { error, index })
  })
  out.on('finish', () => {
    console.log('finished')
    sender.send('downloadComplete', { filePath: path.resolve(filePath), fileFolder: path.resolve(fileFolder), index })
  })
  videoRes.body.on('data', chunk => {
    receivedBytes += chunk.length
    const newPercentage = Math.round((receivedBytes * 100) / totalBytes)
    if (percentage !== newPercentage) {
      percentage = newPercentage
      sender.send('downloading', { percentage, index })
    }
  })
  videoRes.body.pipe(out)
})

function dateFormat (fmt, date) {
  let ret
  const opt = {
    'Y+': date.getFullYear().toString(),
    'm+': (date.getMonth() + 1).toString(),
    'd+': date.getDate().toString(),
    'H+': date.getHours().toString(),
    'M+': date.getMinutes().toString(),
    'S+': date.getSeconds().toString()
    // 有其他格式化字符需求可以继续添加，必须转化成字符串
  }
  for (const k in opt) {
    ret = new RegExp('(' + k + ')').exec(fmt)
    if (ret) {
      fmt = fmt.replace(ret[1], (ret[1].length === 1) ? (opt[k]) : (opt[k].padStart(ret[1].length, '0')))
    }
  }
  return fmt
}
