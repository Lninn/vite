import { promises as fs } from 'fs'
import path from 'path'
import http, { Server } from 'http'
import url from 'url'
import WebSocket from 'ws'
import serve from 'serve-handler'
import { vueMiddleware } from './vueCompiler'
import { resolveModule } from './moduleResolver'
import { createFileWatcher } from './watcher'
import { sendJS } from './utils'
import { rewrite } from './moduleRewriter'

// 服务配置类型声明
// 目前有两个可以配置的选项，分别是 port 和 cwd
export interface ServerConfig {
  port?: number
  cwd?: string
}

// 入口方法，在这里创建一个服务
// 默认的端口是 3000，启动路径是当前的工作路径
export async function createServer({
  port = 3000,
  cwd = process.cwd()
}: ServerConfig = {}): Promise<Server> {
  // 读取客户端需要运行的代码源码内容
  const hmrClientCode = await fs.readFile(
    path.resolve(__dirname, '../client/client.js')
  )

  // 创建一个 http 服务 server，根据请求的 pathname 进行不同的处理
  const server = http.createServer(async (req, res) => {
    const pathname = url.parse(req.url!).pathname!

    // 1 请求 hmr client 代码，直接返回上面读取好的内容
    if (pathname === '/__hmrClient') {
      return sendJS(res, hmrClientCode)

      // 2 请求 库/模块 代码
    } else if (pathname.startsWith('/__modules/')) {
      return resolveModule(pathname.replace('/__modules/', ''), cwd, res)

      // 3 请求 vue 的单文件
    } else if (pathname.endsWith('.vue')) {
      return vueMiddleware(cwd, req, res)

      // 4 请求单独的 js 文件
    } else if (pathname.endsWith('.js')) {
      const filename = path.join(cwd, pathname.slice(1))
      try {
        const content = await fs.readFile(filename, 'utf-8')
        return sendJS(res, rewrite(content))
      } catch (e) {
        if (e.code === 'ENOENT') {
          // fallthrough to serve-handler
        } else {
          console.error(e)
        }
      }
    }

    // 5 其他情况，直接返回 html 文件
    serve(req, res, {
      public: cwd ? path.relative(process.cwd(), cwd) : '/',
      rewrites: [{ source: '**', destination: '/index.html' }]
    })
  })

  // 根据上面的 HTTP server 创建有一个 socket server
  const wss = new WebSocket.Server({ server })
  // 存储所有的 client socket server
  const sockets = new Set<WebSocket>()

  // 处理 socket 的链接
  wss.on('connection', (socket) => {
    sockets.add(socket)
    socket.send(JSON.stringify({ type: 'connected' }))
    socket.on('close', () => {
      sockets.delete(socket)
    })
  })

  // 处理 socket 的报错
  wss.on('error', (e: Error & { code: string }) => {
    if (e.code !== 'EADDRINUSE') {
      console.error(e)
    }
  })

  // 执行 createFileWatcher 方法，创建一个文件监听的机制
  // 当检测到有文件或文件的内容改变的时候，把改动的 payload 通知到所有链接到
  // socket server 的 client socket
  createFileWatcher(cwd, (payload) =>
    sockets.forEach((s) => s.send(JSON.stringify(payload)))
  )

  return new Promise((resolve, reject) => {
    server.on('error', (e: Error & { code: string }) => {
      if (e.code === 'EADDRINUSE') {
        console.log(`port ${port} is in use, trying another one...`)
        setTimeout(() => {
          server.close()
          server.listen(++port)
        }, 100)
      } else {
        console.error(e)
        reject(e)
      }
    })

    server.on('listening', () => {
      console.log(`Running at http://localhost:${port}`)
      resolve(server)
    })

    server.listen(port)
  })
}
