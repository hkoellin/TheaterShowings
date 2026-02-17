import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NYC Screenings',
  description: 'Independent cinema showtimes across New York City',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
