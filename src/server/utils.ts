import fs from 'fs'
import { ServerResponse } from 'http'

// 封装了原生 http 的 res 响应对象
// 提供了简单的 string Buffer 响应，可以指定 mime 类型
export function send(
  res: ServerResponse,
  source: string | Buffer,
  mime: string
) {
  res.setHeader('Content-Type', mime)
  res.end(source)
}

// 直接发送 js 文件
// source 是要发送的文件内容
export function sendJS(res: ServerResponse, source: string | Buffer) {
  send(res, source, 'application/javascript')
}

// 直接发送 js 文件，但是以 http 流的形式发送
// filename 是要发送的文件名
export function sendJSStream(res: ServerResponse, filename: string) {
  res.setHeader('Content-Type', 'application/javascript')
  const stream = fs.createReadStream(filename)
  stream.on('open', () => {
    stream.pipe(res)
  })
  stream.on('error', (err) => {
    res.end(err)
  })
}
