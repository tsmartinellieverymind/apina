import { DashboardLayout } from "@/components/private/shared"

export default function ClienteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DashboardLayout>
      {children}
    </DashboardLayout>
  )
}