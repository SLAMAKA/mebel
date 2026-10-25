import { useRef, useState } from 'react'
import type { OrderInput, OrderSnapshot } from './snapshot'

export async function sendOrder(body: OrderInput): Promise<OrderSnapshot> {
  let res: Response
  try {
    res = await fetch('/api/order', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Сервер заказа не ответил')
  }
  const text = await res.text()
  if (!res.ok) throw new Error(text || 'Не удалось зафиксировать заказ')
  return JSON.parse(text) as OrderSnapshot
}

export function useOrder() {
  const [orderNote, setOrderNote] = useState('')
  const [ordering, setOrdering] = useState(false)
  const busy = useRef(false)

  async function order(body: OrderInput) {
    if (busy.current) return
    busy.current = true
    setOrdering(true)
    setOrderNote('Считаю заказ…')
    try {
      const snap = await sendOrder(body)
      const size = snap.config as { width: number; height: number; depth: number }
      setOrderNote(`Заказ ${snap.id} · ${size.width}×${size.height}×${size.depth} мм`)
    } catch (error) {
      setOrderNote(error instanceof Error ? error.message : 'Не удалось зафиксировать заказ')
    } finally {
      busy.current = false
      setOrdering(false)
    }
  }

  return { orderNote, ordering, order }
}
