"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Search, MessageSquare, Phone, Clock, Filter, Play, Settings } from "lucide-react"
import Link from "next/link"

export default function AdminMensagensPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedChat, setSelectedChat] = useState<string | null>(null)

  // Mock data - em produção viria da API
  const chats = [
    {
      id: "1",
      clienteNome: "João Silva",
      clientePhone: "+5511999887766",
      usuarioResponsavel: "Maria Santos",
      lastMessage: "Obrigado pelo agendamento!",
      lastMessageTime: "10:30",
      unreadCount: 0,
      status: "finalizado",
      intent: "confirmar_agendamento",
      osId: "12345"
    },
    {
      id: "2",
      clienteNome: "Ana Costa",
      clientePhone: "+5511888776655",
      usuarioResponsavel: "Pedro Lima",
      lastMessage: "Preciso reagendar minha visita",
      lastMessageTime: "09:45",
      unreadCount: 2,
      status: "ativo",
      intent: "agendar_data",
      osId: "12346"
    },
    {
      id: "3",
      clienteNome: "Carlos Oliveira",
      clientePhone: "+5511777665544",
      usuarioResponsavel: "Ana Ferreira",
      lastMessage: "Qual meu CPF mesmo?",
      lastMessageTime: "08:20",
      unreadCount: 1,
      status: "aguardando",
      intent: "extrair_cpf",
      osId: null
    },
    {
      id: "4",
      clienteNome: "Mariana Santos",
      clientePhone: "+5511666554433",
      usuarioResponsavel: "João Pereira",
      lastMessage: "Sistema funcionando perfeitamente",
      lastMessageTime: "Ontem",
      unreadCount: 0,
      status: "finalizado",
      intent: "finalizado",
      osId: "12347"
    }
  ]

  const filteredChats = chats.filter(chat =>
    chat.clienteNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.clientePhone.includes(searchTerm) ||
    chat.usuarioResponsavel.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ativo": return "bg-green-500"
      case "aguardando": return "bg-yellow-500"
      case "finalizado": return "bg-gray-500"
      default: return "bg-blue-500"
    }
  }

  const getIntentBadge = (intent: string) => {
    const intentMap: { [key: string]: { label: string; variant: "default" | "secondary" | "destructive" | "outline" } } = {
      "extrair_cpf": { label: "Aguardando CPF", variant: "outline" },
      "agendar_data": { label: "Agendando", variant: "default" },
      "confirmar_agendamento": { label: "Confirmando", variant: "secondary" },
      "finalizado": { label: "Finalizado", variant: "secondary" }
    }
    
    const config = intentMap[intent] || { label: intent, variant: "outline" }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Mensagens - Admin</h1>
          <p className="text-muted-foreground">Monitore todas as conversas do sistema</p>
        </div>
        <div className="flex space-x-2">
          <Link href="/admin/playground">
            <Button variant="outline">
              <Play className="h-4 w-4 mr-2" />
              Playground
            </Button>
          </Link>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Chats</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{chats.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chats Ativos</CardTitle>
            <div className="w-2 h-2 bg-green-500 rounded-full" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{chats.filter(c => c.status === 'ativo').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguardando</CardTitle>
            <div className="w-2 h-2 bg-yellow-500 rounded-full" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{chats.filter(c => c.status === 'aguardando').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Não Lidas</CardTitle>
            <div className="w-2 h-2 bg-red-500 rounded-full" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{chats.reduce((acc, chat) => acc + chat.unreadCount, 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chat List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Conversas</CardTitle>
            <CardDescription>
              Todas as conversas do sistema
            </CardDescription>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar por nome, telefone ou usuário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              {filteredChats.map((chat, index) => (
                <div key={chat.id}>
                  <div
                    className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedChat === chat.id ? 'bg-muted' : ''
                    }`}
                    onClick={() => setSelectedChat(chat.id)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {chat.clienteNome.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full ${getStatusColor(chat.status)}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate">{chat.clienteNome}</p>
                          <div className="flex items-center space-x-1">
                            {chat.unreadCount > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                {chat.unreadCount}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">{chat.lastMessageTime}</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">
                          <Phone className="inline h-3 w-3 mr-1" />
                          {chat.clientePhone}
                        </p>
                        <p className="text-xs text-muted-foreground mb-2">
                          Usuário: {chat.usuarioResponsavel}
                        </p>
                        <p className="text-sm text-muted-foreground truncate mb-2">
                          {chat.lastMessage}
                        </p>
                        <div className="flex items-center justify-between">
                          {getIntentBadge(chat.intent)}
                          {chat.osId && (
                            <Badge variant="outline" className="text-xs">
                              OS: {chat.osId}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  {index < filteredChats.length - 1 && <Separator />}
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Detail */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {selectedChat ? 
                `Conversa com ${filteredChats.find(c => c.id === selectedChat)?.clienteNome}` : 
                'Selecione uma conversa'
              }
            </CardTitle>
            {selectedChat && (
              <CardDescription>
                Visualização completa da conversa e controles administrativos
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {selectedChat ? (
              <div className="space-y-4">
                {/* Chat Info */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">Cliente:</span>
                      <span>{filteredChats.find(c => c.id === selectedChat)?.clienteNome}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Telefone:</span>
                      <span>{filteredChats.find(c => c.id === selectedChat)?.clientePhone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Usuário Responsável:</span>
                      <span>{filteredChats.find(c => c.id === selectedChat)?.usuarioResponsavel}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Status:</span>
                      <Badge variant="outline">{filteredChats.find(c => c.id === selectedChat)?.status}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Intent Atual:</span>
                      {getIntentBadge(filteredChats.find(c => c.id === selectedChat)?.intent || '')}
                    </div>
                  </div>
                </div>

                {/* Placeholder for chat messages */}
                <div className="border rounded-lg p-4 h-96 bg-muted/20">
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Histórico de mensagens será exibido aqui</p>
                      <p className="text-sm mt-2">Integração com backend em desenvolvimento</p>
                    </div>
                  </div>
                </div>

                {/* Admin Actions */}
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm">
                    Intervir na Conversa
                  </Button>
                  <Button variant="outline" size="sm">
                    Transferir Usuário
                  </Button>
                  <Button variant="outline" size="sm">
                    Ver Histórico Completo
                  </Button>
                  <Button variant="outline" size="sm">
                    Exportar Conversa
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-96 text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecione uma conversa para visualizar detalhes</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}