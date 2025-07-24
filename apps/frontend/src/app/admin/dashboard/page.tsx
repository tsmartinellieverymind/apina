"use client"

import { StatsCard } from "@/components/private/shared"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Users, Building2, MessageSquare, Shield, TrendingUp, Activity, Plus, Settings } from "lucide-react"

export default function AdminDashboard() {
  // Mock data específico para admin
  const adminStats = [
    {
      title: "Total de Usuários",
      value: "156",
      description: "Usuários cadastrados na plataforma",
      icon: <Users className="h-4 w-4" />,
      trend: {
        value: 12,
        label: "vs mês anterior",
        isPositive: true
      }
    },
    {
      title: "Total de Clientes",
      value: "2,847",
      description: "Clientes finais ativos",
      icon: <Building2 className="h-4 w-4" />,
      trend: {
        value: 18,
        label: "vs mês anterior",
        isPositive: true
      }
    },
    {
      title: "Mensagens Processadas",
      value: "45,231",
      description: "Total de mensagens hoje",
      icon: <MessageSquare className="h-4 w-4" />,
      trend: {
        value: 8,
        label: "vs ontem",
        isPositive: true
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

  const recentUsers = [
    {
      id: 1,
      name: "João Silva",
      email: "joao@empresa.com",
      role: "usuario",
      status: "ativo",
      createdAt: "2 horas atrás"
    },
    {
      id: 2,
      name: "Maria Santos",
      email: "maria@startup.com",
      role: "usuario",
      status: "ativo",
      createdAt: "5 horas atrás"
    },
    {
      id: 3,
      name: "Pedro Costa",
      email: "pedro@tech.com",
      role: "usuario",
      status: "pendente",
      createdAt: "1 dia atrás"
    }
  ]

  const systemAlerts = [
    {
      id: 1,
      type: "warning",
      message: "Uso de CPU acima de 80% no servidor principal",
      time: "5 min atrás"
    },
    {
      id: 2,
      type: "info",
      message: "Backup automático concluído com sucesso",
      time: "1 hora atrás"
    },
    {
      id: 3,
      type: "error",
      message: "Falha temporária no webhook do WhatsApp",
      time: "2 horas atrás"
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Painel Administrativo</h1>
          <p className="text-muted-foreground">Visão geral completa da plataforma</p>
        </div>
        <div className="flex space-x-2">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo Usuário
          </Button>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {adminStats.map((stat, index) => (
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
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Users */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Usuários Recentes</CardTitle>
            <CardDescription>
              Últimos usuários cadastrados na plataforma
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={user.status === "ativo" ? "default" : "secondary"}>
                      {user.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{user.createdAt}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Alertas do Sistema</CardTitle>
            <CardDescription>
              Monitoramento e notificações importantes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {systemAlerts.map((alert) => (
              <div key={alert.id} className="flex items-start space-x-3">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  alert.type === 'error' ? 'bg-red-500' :
                  alert.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                }`} />
                <div className="flex-1">
                  <p className="text-sm">{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{alert.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* System Overview */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recursos do Sistema</CardTitle>
            <CardDescription>Uso atual dos recursos do servidor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>CPU</span>
                <span>78%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '78%' }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Memória</span>
                <span>45%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '45%' }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Armazenamento</span>
                <span>62%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '62%' }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estatísticas de Uso</CardTitle>
            <CardDescription>Métricas de utilização da plataforma</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Usuários Online</span>
              <Badge variant="outline">127</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Mensagens/Hora</span>
              <Badge variant="outline">1,234</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">API Calls/Min</span>
              <Badge variant="outline">456</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Webhooks Ativos</span>
              <Badge variant="outline">89</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}