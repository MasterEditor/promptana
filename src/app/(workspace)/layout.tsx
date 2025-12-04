import type { ReactNode } from "react"

import { AuthGate } from "./_components/auth-gate"

export default function WorkspaceLayout({
  children,
}: {
  children: ReactNode
}) {
  return <AuthGate>{children}</AuthGate>
}


