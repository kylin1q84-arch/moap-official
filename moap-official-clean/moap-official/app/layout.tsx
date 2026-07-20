import type { Metadata } from 'next'
import './globals.css'

// MOAP is an authenticated, database-backed application.
// Render routes at request time instead of prerendering them during `next build`.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'MOAP Official',
  description: '五人麻将联赛官方数据平台',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
