import { PropsWithChildren } from 'react'

export default function AppLayout({ children }: PropsWithChildren<{
  user: {
    id: string
    name: string
    email: string
    avatar: string
  }
  onLogout: () => Promise<void>
}>) {
  return children
}
