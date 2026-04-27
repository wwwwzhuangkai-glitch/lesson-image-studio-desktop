const { app, BrowserWindow, dialog } = require('electron')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const http = require('node:http')
const net = require('node:net')
const path = require('node:path')

let backendProcess = null
let frontendServer = null
let isQuitting = false

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}

function getBackendExecutablePath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend', 'lesson-image-studio-backend.exe')
  }
  return path.join(app.getAppPath(), '..', 'backend', 'dist', 'lesson-image-studio-backend.exe')
}

function waitForBackend(port) {
  const deadline = Date.now() + 30000

  return new Promise((resolve, reject) => {
    const poll = () => {
      const request = http.get(`http://127.0.0.1:${port}/api/settings`, (response) => {
        response.resume()
        if (response.statusCode && response.statusCode < 500) {
          resolve()
          return
        }
        retry()
      })

      request.on('error', retry)
      request.setTimeout(1000, () => {
        request.destroy()
        retry()
      })
    }

    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error('Backend did not become ready in time.'))
        return
      }
      setTimeout(poll, 500)
    }

    poll()
  })
}

async function startBackend() {
  const port = await getFreePort()
  const executablePath = getBackendExecutablePath()
  const dataDir = path.join(app.getPath('userData'), 'data')

  if (!fs.existsSync(executablePath)) {
    throw new Error(`Backend executable was not found: ${executablePath}`)
  }

  fs.mkdirSync(dataDir, { recursive: true })
  backendProcess = spawn(executablePath, [], {
    env: {
      ...process.env,
      LESSON_IMAGE_STUDIO_AUTO_MIGRATE: '1',
      LESSON_IMAGE_STUDIO_DATA_DIR: dataDir,
      LESSON_IMAGE_STUDIO_PORT: String(port),
    },
    stdio: 'ignore',
    windowsHide: true,
  })

  backendProcess.once('exit', () => {
    backendProcess = null
    if (!isQuitting) {
      app.quit()
    }
  })

  await waitForBackend(port)
  return port
}

function proxyToBackend(request, response, backendPort) {
  const targetUrl = new URL(request.url, `http://127.0.0.1:${backendPort}`)
  const proxyRequest = http.request(
    {
      hostname: '127.0.0.1',
      port: backendPort,
      path: `${targetUrl.pathname}${targetUrl.search}`,
      method: request.method,
      headers: {
        ...request.headers,
        host: `127.0.0.1:${backendPort}`,
      },
    },
    (proxyResponse) => {
      response.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers)
      proxyResponse.pipe(response)
    },
  )

  proxyRequest.on('error', () => {
    response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('Backend is unavailable.')
  })

  request.pipe(proxyRequest)
}

function serveStatic(request, response, distDir) {
  const requestUrl = new URL(request.url, 'http://127.0.0.1')
  const pathname = requestUrl.pathname === '/' ? '/index.html' : decodeURIComponent(requestUrl.pathname)
  const rootDir = path.resolve(distDir)
  const relativePath = pathname.replace(/^\/+/, '')
  const candidatePath = path.resolve(rootDir, relativePath)

  if (candidatePath !== rootDir && !candidatePath.startsWith(`${rootDir}${path.sep}`)) {
    response.writeHead(403)
    response.end()
    return
  }

  const filePath = fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()
    ? candidatePath
    : path.join(distDir, 'index.html')
  const extension = path.extname(filePath)

  response.writeHead(200, { 'content-type': mimeTypes[extension] || 'application/octet-stream' })
  fs.createReadStream(filePath).pipe(response)
}

async function startFrontendServer(backendPort) {
  const port = await getFreePort()
  const distDir = path.join(app.getAppPath(), 'dist')

  frontendServer = http.createServer((request, response) => {
    const requestUrl = new URL(request.url, 'http://127.0.0.1')
    if (requestUrl.pathname.startsWith('/api') || requestUrl.pathname.startsWith('/files')) {
      proxyToBackend(request, response, backendPort)
      return
    }

    serveStatic(request, response, distDir)
  })

  await new Promise((resolve, reject) => {
    frontendServer.once('error', reject)
    frontendServer.listen(port, '127.0.0.1', resolve)
  })

  return port
}

async function createWindow() {
  const backendPort = await startBackend()
  const frontendPort = await startFrontendServer(backendPort)
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  window.setMenuBarVisibility(false)
  window.once('ready-to-show', () => window.show())
  await window.loadURL(`http://127.0.0.1:${frontendPort}`)
}

app.whenReady().then(() => {
  createWindow().catch((error) => {
    dialog.showErrorBox('Lesson Image Studio 启动失败', error instanceof Error ? error.message : String(error))
    app.quit()
  })
})

app.on('before-quit', () => {
  isQuitting = true
  if (frontendServer) {
    frontendServer.close()
  }
  if (backendProcess) {
    backendProcess.kill()
  }
})

app.on('window-all-closed', () => {
  app.quit()
})
