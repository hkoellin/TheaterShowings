import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NYC Theater Showtimes',
  description: 'Aggregated film showtimes from independent NYC theaters',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  )
}
