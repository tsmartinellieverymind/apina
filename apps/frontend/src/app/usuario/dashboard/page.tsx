"use client"

import { StatsCard } from "@/components/private/shared"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Users, MessageSquare, TrendingUp, Clock, Plus, Settings, UserPlus } from "lucide-react"

export default function UsuarioDashboard() {
  // Mock data específico para usuário
  const userStats = [
    {
      title: "Meus Clientes",
      value: "24",
      description: "Clientes ativos no seu plano",
      icon: <Users className="h-4 w-4" />,
      trend: {
        value: 8,
        label: "vs mês anterior",
        isPositive: true
      }
    },
    {
      title: "Mensagens Enviadas",
      value: "1,234",
      description: "Mensagens processadas hoje",
      icon: <MessageSquare className="h-4 w-4" />,
      trend: {
        value: 12,
        label: "vs ontem",
        isPositive: true
      }
    },
    {
      title: "Taxa de Resposta",
      value: "89.2%",
      description: "Taxa de resposta dos clientes",
      icon: <TrendingUp className="h-4 w-4" />,
      trend: {
        value: 3.1,
        label: "vs semana anterior",
        isPositive: true
      }
    },
    {
      title: "Tempo Médio",
      value: "2.3min",
      description: "Tempo médio de resposta",
      icon: <Clock className="h-4 w-4" />,
      trend: {
        value: -15,
        label: "vs mês anterior",
        isPositive: true
      }
    }
  ]

  const myClients = [
    {
      id: 1,
      name: "Ana Silva",
      email: "ana@cliente.com",
      status: "ativo",
      lastActivity: "2 min atrás",
      messages: 45
    },
    {
      id: 2,
      name: "Carlos Santos",
      email: "carlos@empresa.com",
      status: "ativo",
      lastActivity: "15 min atrás",
      messages: 23
    },
    {
      id: 3,
      name: "Mariana Costa",
      email: "mariana@negocio.com",
      status: "inativo",
      lastActivity: "2 horas atrás",
      messages: 12
    },
    {
      id: 4,
      name: "Roberto Lima",
      email: "roberto@loja.com",
      status: "ativo",
      lastActivity: "30 min atrás",
      messages: 67
    }
  ]

  const planInfo = {
    name: "Plano Profissional",
    maxClients: 50,
    currentClients: 24,
    maxMessages: 10000,
    currentMessages: 7234,
    expiresAt: "15 de Fev, 2025"
  }

  const recentMessages = [
    {
      id: 1,
      client: "Ana Silva",
      message: "Obrigada pelo atendimento!",
      time: "2 min atrás",
      type: "received"
    },
    {
      id: 2,
      client: "Carlos Santos",
      message: "Preciso de ajuda com o pedido",
      time: "15 min atrás",
      type: "received"
    },
    {
      id: 3,
      client: "Roberto Lima",
      message: "Produto entregue com sucesso",
      time: "30 min atrás",
      type: "sent"
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Meu Dashboard</h1>
          <p className="text-muted-foreground">Gerencie seus clientes e mensagens</p>
        </div>
        <div className="flex space-x-2">
          <Button>
            <UserPlus className="h-4 w-4 mr-2" />
            Novo Cliente
          </Button>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {userStats.map((stat, index) => (
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

      {/* Plan Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Uso do Plano - {planInfo.name}</CardTitle>
          <CardDescription>
            Acompanhe o uso dos recursos do seu plano atual
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Clientes</span>
                <span>{planInfo.currentClients}/{planInfo.maxClients}</span>
              </div>
              <Progress value={(planInfo.currentClients / planInfo.maxClients) * 100} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Mensagens (mês)</span>
                <span>{planInfo.currentMessages.toLocaleString()}/{planInfo.maxMessages.toLocaleString()}</span>
              </div>
              <Progress value={(planInfo.currentMessages / planInfo.maxMessages) * 100} />
            </div>
          </div>
          <div className="flex justify-between items-center pt-4 border-t">
            <span className="text-sm text-muted-foreground">
              Plano expira em: {planInfo.expiresAt}
            </span>
            <Button variant="outline" size="sm">
              Renovar Plano
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* My Clients */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Meus Clientes</CardTitle>
            <CardDescription>
              Lista dos seus clientes ativos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {myClients.map((client) => (
                <div key={client.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{client.name}</p>
                      <p className="text-sm text-muted-foreground">{client.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">{client.messages} msgs</p>
                      <p className="text-xs text-muted-foreground">{client.lastActivity}</p>
                    </div>
                    <Badge variant={client.status === "ativo" ? "default" : "secondary"}>
                      {client.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Messages */}
        <Card>
          <CardHeader>
            <CardTitle>Mensagens Recentes</CardTitle>
            <CardDescription>
              Últimas interações com clientes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentMessages.map((msg) => (
              <div key={msg.id} className="flex items-start space-x-3">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  msg.type === 'received' ? 'bg-blue-500' : 'bg-green-500'
                }`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{msg.client}</p>
                  <p className="text-sm text-muted-foreground">{msg.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{msg.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
          <CardDescription>
            Acesso rápido às funcionalidades principais
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button variant="outline" className="h-20 flex flex-col space-y-2">
              <MessageSquare className="h-6 w-6" />
              <span>Enviar Mensagem</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col space-y-2">
              <UserPlus className="h-6 w-6" />
              <span>Adicionar Cliente</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col space-y-2">
              <TrendingUp className="h-6 w-6" />
              <span>Ver Relatórios</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}