'use client'

import type { ReactNode } from "react"

import { useAuthContext } from "../_auth/auth-context"
import { GlobalMessagesProvider } from "../_contexts/global-messages-context"
import { OfflineProvider } from "../_contexts/offline-context"
import { QuotaProvider } from "../_contexts/quota-context"
import { GlobalBannerArea } from "./global-banner-area"
import { MobileNav } from "./mobile-nav"
import { SidebarNav } from "./sidebar-nav"
import { TopBar } from "./top-bar"

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { user } = useAuthContext()

  // AuthGate guarantees that user is non-null in the authenticated branch,
  // but we keep this guard as a safety net.
  if (!user) {
    return null
  }

  return (
    <OfflineProvider>
      <GlobalMessagesProvider>
        <QuotaProvider>
          <div className="flex min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
            <SidebarNav />
            <div className="flex min-h-screen flex-1 flex-col">
              <TopBar />
              <GlobalBannerArea />
              <main className="flex-1 px-4 py-4 pb-16 md:px-8 md:pb-8">
                {children}
              </main>
            </div>
            <MobileNav />
          </div>
        </QuotaProvider>
      </GlobalMessagesProvider>
    </OfflineProvider>
  )
}

