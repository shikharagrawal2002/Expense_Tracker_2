import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { MobileNav } from '@/components/layout/mobile-nav'

export function AppLayout() {
  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto px-4 py-5 lg:px-8 lg:py-7 pb-20 lg:pb-7">
          <Outlet />
        </main>
      </div>
      <MobileNav />
    </div>
  )
}
