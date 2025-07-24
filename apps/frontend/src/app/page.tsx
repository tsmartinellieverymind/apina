"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Shield, Users, User } from "lucide-react"
import { ModeToggle } from "@/components/global/mode-toggle"

export default function Home() {
  const router = useRouter()

  // Mock function - em produção seria baseado na autenticação real
  const getUserRole = () => {
    // Por enquanto retorna null para mostrar a página de seleção
    return null // "admin" | "usuario" | "cliente" | null
  }

  const userRole = getUserRole()

  useEffect(() => {
    // Se o usuário já estiver autenticado, redirecionar para o dashboard apropriado
    if (userRole) {
      router.push(`/${userRole}/dashboard`)
    }
  }, [userRole, router])

  const handleRoleSelection = (role: string) => {
    // Em produção, isso seria um processo de login/autenticação
    router.push(`/${role}/dashboard`)
  }

  if (userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Redirecionando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Theme Toggle - Fixed position */}
      <div className="fixed top-4 right-4">
        <ModeToggle />
      </div>

      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-2">Bem-vindo ao Apina</h1>
          <p className="text-xl text-muted-foreground">
            Plataforma de comunicação e gestão de clientes
          </p>
        </div>

        {/* Role Selection */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleRoleSelection('admin')}>
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle>Administrador</CardTitle>
              <CardDescription>
                Acesso total à plataforma
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2 mb-6">
                <li>• Gerenciar todos os usuários</li>
                <li>• Visualizar todos os clientes</li>
                <li>• Relatórios completos</li>
                <li>• Configurações do sistema</li>
              </ul>
              <Button className="w-full" variant="outline">
                Entrar como Admin
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleRoleSelection('usuario')}>
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle>Usuário</CardTitle>
              <CardDescription>
                Acesso aos recursos do plano
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2 mb-6">
                <li>• Gerenciar seus clientes</li>
                <li>• Enviar mensagens</li>
                <li>• Relatórios do seu negócio</li>
                <li>• Configurações pessoais</li>
              </ul>
              <Button className="w-full" variant="outline">
                Entrar como Usuário
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleRoleSelection('cliente')}>
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle>Cliente</CardTitle>
              <CardDescription>
                Usuário final da plataforma
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2 mb-6">
                <li>• Visualizar suas mensagens</li>
                <li>• Enviar mensagens</li>
                <li>• Histórico de conversas</li>
                <li>• Perfil pessoal</li>
              </ul>
              <Button className="w-full" variant="outline">
                Entrar como Cliente
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            Esta é uma demonstração do sistema. Em produção, haveria autenticação real.
          </p>
        </div>
      </div>
    </div>
  )
}