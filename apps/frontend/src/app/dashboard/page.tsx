"use client"

import { DashboardLayout, StatsCard } from "@/components/private/shared"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, MessageSquare, TrendingUp, Activity } from "lucide-react"

export default function DashboardPage() {
  // Mock data - em produção viria de uma API
  const stats = [
    {
      title: "Total de Usuários",
      value: "2,350",
      description: "Usuários ativos na plataforma",
      icon: <Users className="h-4 w-4" />,
      trend: {
        value: 12,
        label: "vs mês anterior",
        isPositive: true
      }
    },
    {
      title: "Mensagens Enviadas",
      value: "12,234",
      description: "Mensagens processadas hoje",
      icon: <MessageSquare className="h-4 w-4" />,
      trend: {
        value: 8,
        label: "vs ontem",
        isPositive: true
      }
    },
    {
      title: "Taxa de Conversão",
      value: "68.2%",
      description: "Conversões este mês",
      icon: <TrendingUp className="h-4 w-4" />,
      trend: {
        value: -2.1,
        label: "vs mês anterior",
        isPositive: false
      }
    },
    {
      title: "Uptime do Sistema",
      value: "99.9%",
      description: "Disponibilidade nos últimos 30 dias",
      icon: <Activity className="h-4 w-4" />,
      trend: {
        value: 0.1,
        label: "vs mês anterior",
        isPositive: true
      }
    }
  ]

  const recentActivity = [
    {
      id: 1,
      user: "João Silva",
      action: "criou um novo cliente",
      time: "2 minutos atrás"
    },
    {
      id: 2,
      user: "Maria Santos",
      action: "enviou uma mensagem",
      time: "5 minutos atrás"
    },
    {
      id: 3,
      user: "Pedro Costa",
      action: "atualizou configurações",
      time: "10 minutos atrás"
    },
    {
      id: 4,
      user: "Ana Oliveira",
      action: "gerou relatório mensal",
      time: "15 minutos atrás"
    }
  ]

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <StatsCard
              key={index}
              title={stat.title}
              value={stat.value}
              description={stat.description}
              icon={stat.icon}
              trend={stat.trend}
            />
          ))}
        </div>

        {/* Content Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Recent Activity */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Atividade Recente</CardTitle>
              <CardDescription>
                Últimas ações realizadas na plataforma
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-4">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        <span className="font-semibold">{activity.user}</span>{" "}
                        {activity.action}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
              <CardDescription>
                Acesso rápido às funcionalidades principais
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <button className="w-full p-3 text-left rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <div className="font-medium text-sm">Criar Usuário</div>
                <div className="text-xs text-muted-foreground">
                  Adicionar novo usuário ao sistema
                </div>
              </button>
              <button className="w-full p-3 text-left rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <div className="font-medium text-sm">Enviar Mensagem</div>
                <div className="text-xs text-muted-foreground">
                  Enviar mensagem para clientes
                </div>
              </button>
              <button className="w-full p-3 text-left rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <div className="font-medium text-sm">Ver Relatórios</div>
                <div className="text-xs text-muted-foreground">
                  Acessar relatórios detalhados
                </div>
              </button>
            </CardContent>
          </Card>
        </div>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle>Status do Sistema</CardTitle>
            <CardDescription>
              Monitoramento em tempo real dos serviços
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <div>
                  <p className="text-sm font-medium">API Principal</p>
                  <p className="text-xs text-muted-foreground">Operacional</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <div>
                  <p className="text-sm font-medium">Banco de Dados</p>
                  <p className="text-xs text-muted-foreground">Operacional</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                <div>
                  <p className="text-sm font-medium">Webhook Service</p>
                  <p className="text-xs text-muted-foreground">Degradado</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}