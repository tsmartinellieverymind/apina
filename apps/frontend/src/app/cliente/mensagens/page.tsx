"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Paperclip, Mic, Phone, Video, MoreVertical, CheckCheck, Check } from "lucide-react"

export default function ClienteMensagensPage() {
  const [message, setMessage] = useState("")

  // Mock data - conversa do cliente com o sistema
  const messages = [
    {
      id: "1",
      type: "received",
      content: "Olá! Sou a Jaqueline da Ibiunet. Como posso te ajudar hoje?",
      time: "09:00",
      status: "read"
    },
    {
      id: "2",
      type: "sent",
      content: "Oi! Preciso agendar uma visita técnica",
      time: "09:01",
      status: "read"
    },
    {
      id: "3",
      type: "received",
      content: "Perfeito! Para localizar suas informações, pode me informar seu CPF?",
      time: "09:01",
      status: "read"
    },
    {
      id: "4",
      type: "sent",
      content: "123.456.789-00",
      time: "09:02",
      status: "read"
    },
    {
      id: "5",
      type: "received",
      content: "✅ Cadastro localizado, João Silva.\n\nEncontrei 1 OS aberta:\n• 12345 - Instalação de Internet\n\nTenho uma sugestão de agendamento: Quinta-feira, 25/01/2024 pela manhã para sua visita de Instalação de Internet. Confirma esse agendamento?",
      time: "09:03",
      status: "read"
    },
    {
      id: "6",
      type: "sent",
      content: "Pode ser, mas prefiro à tarde",
      time: "09:05",
      status: "delivered"
    },
    {
      id: "7",
      type: "received",
      content: "Sem problemas! Verificando disponibilidade para quinta-feira à tarde...",
      time: "09:05",
      status: "read"
    }
  ]

  const handleSendMessage = () => {
    if (message.trim()) {
      // Aqui seria enviado para o backend
      console.log("Enviando mensagem:", message)
      setMessage("")
    }
  }

  const getMessageStatus = (status: string) => {
    switch (status) {
      case "sent":
        return <Check className="h-3 w-3 text-muted-foreground" />
      case "delivered":
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />
      case "read":
        return <CheckCheck className="h-3 w-3 text-blue-500" />
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* Header */}
      <Card className="rounded-b-none border-b-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  J
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">Jaqueline - Ibiunet</CardTitle>
                <CardDescription className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                  Online - Assistente Virtual
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm">
                <Phone className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Video className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Messages */}
      <Card className="flex-1 rounded-none border-t-0 border-b-0">
        <CardContent className="p-0 h-full">
          <ScrollArea className="h-full p-4">
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.type === 'sent' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] p-3 rounded-lg ${
                      msg.type === 'sent'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <div className={`flex items-center justify-end mt-2 space-x-1 ${
                      msg.type === 'sent' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    }`}>
                      <span className="text-xs">{msg.time}</span>
                      {msg.type === 'sent' && getMessageStatus(msg.status)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Input */}
      <Card className="rounded-t-none border-t-0">
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm">
              <Paperclip className="h-4 w-4" />
            </Button>
            <div className="flex-1 relative">
              <Input
                placeholder="Digite sua mensagem..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="pr-10"
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2"
              >
                <Mic className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={handleSendMessage} disabled={!message.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={() => setMessage("Preciso reagendar")}>
              Reagendar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMessage("Qual o status da minha OS?")}>
              Status da OS
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMessage("Cancelar agendamento")}>
              Cancelar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMessage("Falar com atendente")}>
              Atendente Humano
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status Info */}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Minha OS Atual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">OS #12345</div>
            <p className="text-sm text-muted-foreground">Instalação de Internet</p>
            <Badge variant="outline" className="mt-1">Em Agendamento</Badge>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Próximo Agendamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">25/01/2024</div>
            <p className="text-sm text-muted-foreground">Quinta-feira, Tarde</p>
            <Badge variant="secondary" className="mt-1">Confirmando</Badge>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Atendimento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">Automático</div>
            <p className="text-sm text-muted-foreground">Jaqueline - IA</p>
            <Badge variant="default" className="mt-1">Online</Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}