import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import AuthProviderClient from '@/lib/auth-provider-client'
import './globals.css'

export const metadata: Metadata = {
  title: 'Noise Monitor',
  description: 'Noise Monitor - 異音検出モニタリングシステム',
  generator: 'v0.dev',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body><AuthProviderClient>{children}</AuthProviderClient></body>
    </html>
  )
}
