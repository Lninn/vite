#!/usr/bin/env node
// createServer：创建服务的方法，目前所有的入口都是在这个方法里面创建的
const { createServer } = require('../dist/server')
// 命令行参数处理，直接获取到命令行输入的参数，如果有
const argv = require('minimist')(process.argv.slice(2))

// 目前有两个参数
// 分别是 port 和 cwd
// port 表示服务启动的端口
// cwd 表示当前服务的启动路径

// 如果输入了参数，处理一下 cwd 字段的值
if (argv._.length) {
  argv.cwd = require('path').resolve(process.cwd(), argv._[0])
}

// 将参数传入 createServer 方法中启动服务
createServer(argv)
