import fs from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Connect, type Plugin, type ViteDevServer } from 'vite'

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function orderApi(): Plugin {
  return {
    name: 'order-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleOrder(server, req, res, next)
      })
    },
  }
}

async function handleOrder(
  server: ViteDevServer,
  req: IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction,
) {
  const url = (req.url ?? '').split('?')[0]
  if (url !== '/api/order' && !url.startsWith('/api/order/')) {
    next()
    return
  }
  try {
    if (req.method === 'GET' && url.startsWith('/api/order/')) {
      const id = decodeURIComponent(url.slice('/api/order/'.length))
      const file = orderFile(server.config.root, id)
      if (!file || !fs.existsSync(file)) {
        res.statusCode = 404
        res.end('Нет такого заказа')
        return
      }
      res.setHeader('content-type', 'application/json; charset=utf-8')
      res.end(fs.readFileSync(file))
      return
    }
    if (req.method === 'POST' && url === '/api/order') {
      const raw = await readBody(req)
      let body: unknown
      try {
        body = JSON.parse(raw)
      } catch {
        throw new Error('Заказ не читается')
      }
      const mod = await server.ssrLoadModule('/src/order/snapshot.ts') as {
        lockOrder: (input: unknown) => { id: string }
      }
      const snap = mod.lockOrder(body)
      const dir = path.join(server.config.root, 'data', 'orders')
      fs.mkdirSync(dir, { recursive: true })
      const file = path.join(dir, `${snap.id}.json`)
      fs.writeFileSync(file, JSON.stringify(snap, null, 2))
      res.setHeader('content-type', 'application/json; charset=utf-8')
      res.end(JSON.stringify(snap))
      return
    }
    res.statusCode = 404
    res.end('Нет такого заказа')
  } catch (error) {
    res.statusCode = 400
    res.end(error instanceof Error ? error.message : 'Не удалось зафиксировать заказ')
  }
}

function orderFile(root: string, id: string) {
  if (!/^order-[0-9a-f-]+$/i.test(id)) return null
  return path.join(root, 'data', 'orders', `${id}.json`)
}

export default defineConfig({
  plugins: [react(), orderApi()],
  server: {
    allowedHosts: ['.ts.net'],
  },
})
