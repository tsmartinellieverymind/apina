import { DashboardLayout } from "@/components/private/shared"

export default function UsuarioLayout({
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