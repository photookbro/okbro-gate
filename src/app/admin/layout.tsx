import type { Metadata } from 'next'
import { AdminShell } from './admin-shell'

export const metadata: Metadata = {
  title: '관리자',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
