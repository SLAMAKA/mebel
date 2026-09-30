import { useEffect, useState } from 'react'
import { MiniPage } from './mini/page'
import { PedestalPage, WardrobePage } from './pages'
import { ShoePage } from './shoe/page'

const routes = [
  { path: '/', name: 'Шкаф' },
  { path: '/mini', name: 'Мини' },
  { path: '/shoe', name: 'Обувница' },
  { path: '/pedestal', name: 'Тумба' },
] as const

function readPath() {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  if (raw === '/mini' || raw === '/shoe' || raw === '/pedestal') return raw
  return '/'
}

function ProductNav({ path }: { path: string }) {
  return (
    <nav className="product-nav" aria-label="Изделия">
      {routes.map((item) => (
        <a
          key={item.path}
          href={`#${item.path === '/' ? '/' : item.path}`}
          className={path === item.path ? 'product-link on' : 'product-link'}
        >
          {item.name}
        </a>
      ))}
    </nav>
  )
}

export default function App() {
  const [path, setPath] = useState(readPath)

  useEffect(() => {
    const onHash = () => setPath(readPath())
    window.addEventListener('hashchange', onHash)
    if (!window.location.hash) window.location.hash = '#/'
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <div className="shell">
      <ProductNav path={path} />
      {path === '/mini'
        ? <MiniPage />
        : path === '/shoe'
          ? <ShoePage />
          : path === '/pedestal'
            ? <PedestalPage />
            : <WardrobePage />}
    </div>
  )
}
