"use client"

import { StatsCard } from "@/components/private/shared"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Clock, CheckCircle, AlertCircle, Send, History, User } from "lucide-react"

export default function ClienteDashboard() {
  // Mock data específico para cliente
  const clientStats = [
    {
      title: "Mensagens Enviadas",
      value: "127",
      description: "Total de mensagens enviadas",
      icon: <MessageSquare className="h-4 w-4" />,
      trend: {
        value: 15,
        label: "vs semana anterior",
        isPositive: true
      }
    },
    {
      title: "Mensagens Recebidas",
      value: "89",
      description: "Respostas recebidas",
      icon: <MessageSquare className="h-4 w-4" />,
      trend: {
        value: 8,
        label: "vs semana anterior",
        isPositive: true
      }
    },
    {
      title: "Tempo de Resposta",
      value: "1.8min",
      description: "Tempo médio de resposta",
      icon: <Clock className="h-4 w-4" />,
      trend: {
        value: -12,
        label: "vs semana anterior",
        isPositive: true
      }
    },
    {
      title: "Taxa de Entrega",
      value: "98.5%",
      description: "Mensagens entregues com sucesso",
      icon: <CheckCircle className="h-4 w-4" />,
      trend: {
        value: 2.1,
        label: "vs semana anterior",
        isPositive: true
      }
    }
  ]

  const conversationHistory = [
    {
      id: 1,
      message: "Olá! Gostaria de saber sobre os produtos disponíveis.",
      type: "sent",
      time: "10:30",
      status: "entregue"
    },
    {
      id: 2,
      message: "Olá! Temos vários produtos disponíveis. Qual categoria te interessa?",
      type: "received",
      time: "10:32",
      status: "lida"
    },
    {
      id: 3,
      message: "Estou interessado em produtos eletrônicos.",
      type: "sent",
      time: "10:35",
      status: "entregue"
    },
    {
      id: 4,
      message: "Perfeito! Temos smartphones, notebooks e acessórios. Vou enviar o catálogo.",
      type: "received",
      time: "10:37",
      status: "lida"
    }
  ]

  const quickActions = [
    {
      title: "Nova Mensagem",
      description: "Enviar uma nova mensagem",
      icon: <Send className="h-5 w-5" />,
      action: "send-message"
    },
    {
      title: "Histórico",
      description: "Ver histórico completo",
      icon: <History className="h-5 w-5" />,
      action: "view-history"
    },
    {
      title: "Meu Perfil",
      description: "Atualizar informações",
      icon: <User className="h-5 w-5" />,
      action: "edit-profile"
    }
  ]

  const notifications = [
    {
      id: 1,
      type: "info",
      message: "Nova mensagem recebida",
      time: "2 min atrás"
    },
    {
      id: 2,
      type: "success",
      message: "Mensagem entregue com sucesso",
      time: "5 min atrás"
    },
    {
      id: 3,
      type: "warning",
      message: "Mensagem pendente de entrega",
      time: "10 min atrás"
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Meu Painel</h1>
          <p className="text-muted-foreground">Acompanhe suas conversas e mensagens</p>
        </div>
        <Button>
          <Send className="h-4 w-4 mr-2" />
          Nova Mensagem
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {clientStats.map((stat, index) => (
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
        {/* Conversation History */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Conversa Recente</CardTitle>
            <CardDescription>
              Suas últimas mensagens trocadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {conversationHistory.map((msg) => (
                <div key={msg.id} className={`flex ${msg.type === 'sent' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] p-3 rounded-lg ${
                    msg.type === 'sent' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  }`}>
                    <p className="text-sm">{msg.message}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs opacity-70">{msg.time}</span>
                      {msg.type === 'sent' && (
                        <Badge variant="secondary" className="text-xs">
                          {msg.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex space-x-2">
                <input 
                  type="text" 
                  placeholder="Digite sua mensagem..."
                  className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <Button size="sm">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {quickActions.map((action, index) => (
                <Button 
                  key={index}
                  variant="outline" 
                  className="w-full justify-start h-auto p-4"
                >
                  <div className="flex items-center space-x-3">
                    {action.icon}
                    <div className="text-left">
                      <p className="font-medium text-sm">{action.title}</p>
                      <p className="text-xs text-muted-foreground">{action.description}</p>
                    </div>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle>Notificações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {notifications.map((notification) => (
                <div key={notification.id} className="flex items-start space-x-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    notification.type === 'success' ? 'bg-green-500' :
                    notification.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm">{notification.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Message Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Status das Mensagens</CardTitle>
          <CardDescription>
            Visão geral do status das suas mensagens
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <div>
                <p className="text-sm font-medium">Entregues</p>
                <p className="text-2xl font-bold">125</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              <div>
                <p className="text-sm font-medium">Lidas</p>
                <p className="text-2xl font-bold">89</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-yellow-500 rounded-full" />
              <div>
                <p className="text-sm font-medium">Pendentes</p>
                <p className="text-2xl font-bold">2</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <div>
                <p className="text-sm font-medium">Falharam</p>
                <p className="text-2xl font-bold">0</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}