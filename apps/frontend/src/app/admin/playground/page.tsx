"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Send, Play, RotateCcw, Settings, Code, MessageSquare, Zap, Copy } from "lucide-react"

export default function AdminPlaygroundPage() {
  const [message, setMessage] = useState("")
  const [selectedAgent, setSelectedAgent] = useState("agent_os")
  const [selectedIntent, setSelectedIntent] = useState("")
  const [testPhone, setTestPhone] = useState("+5511999887766")
  const [conversation, setConversation] = useState<Array<{id: string, type: 'sent' | 'received', content: string, time: string, intent?: string}>>([])

  // Mock data baseado no backend analisado
  const agents = [
    { id: "agent_os", name: "Jaqueline - OS", description: "Agente especializado em agendamento de OS" }
  ]

  const intents = [
    { id: "inicio", name: "Início", description: "Iniciar conversa" },
    { id: "extrair_cpf", name: "Extrair CPF", description: "Solicitar e validar CPF" },
    { id: "escolher_os", name: "Escolher OS", description: "Selecionar ordem de serviço" },
    { id: "agendar_data", name: "Agendar Data", description: "Definir data do agendamento" },
    { id: "extrair_data", name: "Extrair Data", description: "Interpretar data da mensagem" },
    { id: "extrair_hora", name: "Extrair Hora", description: "Interpretar período (manhã/tarde)" },
    { id: "confirmar_agendamento", name: "Confirmar Agendamento", description: "Confirmar o agendamento" },
    { id: "finalizado", name: "Finalizado", description: "Conversa finalizada" },
    { id: "aleatorio", name: "Aleatório", description: "Mensagem fora do contexto" }
  ]

  const testScenarios = [
    {
      name: "Fluxo Completo - Agendamento",
      description: "Simula um agendamento completo do início ao fim",
      messages: [
        "Olá, preciso agendar uma visita",
        "123.456.789-00",
        "Quero a primeira OS",
        "Pode ser amanhã de manhã",
        "Confirmo"
      ]
    },
    {
      name: "Cliente Sem CPF",
      description: "Cliente que não sabe o CPF",
      messages: [
        "Oi, quero agendar",
        "Não sei meu CPF",
        "Como faço para descobrir?"
      ]
    },
    {
      name: "Reagendamento",
      description: "Cliente quer reagendar uma OS existente",
      messages: [
        "Preciso reagendar minha visita",
        "123.456.789-00",
        "Quero mudar para tarde",
        "Pode ser sexta-feira?"
      ]
    }
  ]

  const handleSendMessage = async () => {
    if (!message.trim()) return

    const newMessage = {
      id: Date.now().toString(),
      type: 'sent' as const,
      content: message,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }

    setConversation(prev => [...prev, newMessage])
    setMessage("")

    // Simular resposta do backend
    setTimeout(() => {
      const response = {
        id: (Date.now() + 1).toString(),
        type: 'received' as const,
        content: generateMockResponse(message),
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        intent: detectMockIntent(message)
      }
      setConversation(prev => [...prev, response])
    }, 1000)
  }

  const generateMockResponse = (userMessage: string): string => {
    const msg = userMessage.toLowerCase()
    
    if (msg.includes('cpf') || /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/.test(msg)) {
      return "✅ Cadastro localizado, João Silva.\n\nEncontrei 1 OS aberta:\n• 12345 - Instalação de Internet\n\nTenho uma sugestão de agendamento: Quinta-feira, 25/01/2024 pela manhã. Confirma?"
    }
    
    if (msg.includes('agendar') || msg.includes('visita')) {
      return "Perfeito! Para localizar suas informações, pode me informar seu CPF?"
    }
    
    if (msg.includes('manhã') || msg.includes('tarde') || msg.includes('amanhã')) {
      return "Verificando disponibilidade... Encontrei horário disponível! Confirma o agendamento para quinta-feira, 25/01/2024 pela tarde?"
    }
    
    if (msg.includes('confirmo') || msg.includes('sim') || msg.includes('ok')) {
      return "🎉 Agendamento confirmado!\n\n📅 Data: Quinta-feira, 25/01/2024\n⏰ Período: Tarde (13h às 17h)\n🔧 Serviço: Instalação de Internet\n📋 OS: #12345\n\nVocê receberá uma confirmação por SMS. Obrigada!"
    }
    
    return "Olá! Sou a Jaqueline da Ibiunet. Como posso te ajudar hoje?"
  }

  const detectMockIntent = (message: string): string => {
    const msg = message.toLowerCase()
    
    if (/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/.test(msg)) return "extrair_cpf"
    if (msg.includes('agendar')) return "agendar_data"
    if (msg.includes('manhã') || msg.includes('tarde')) return "extrair_hora"
    if (msg.includes('confirmo') || msg.includes('sim')) return "confirmar_agendamento"
    
    return "aleatorio"
  }

  const runTestScenario = async (scenario: typeof testScenarios[0]) => {
    setConversation([])
    
    for (let i = 0; i < scenario.messages.length; i++) {
      setTimeout(() => {
        const message = scenario.messages[i]
        setMessage(message)
        setTimeout(() => {
          handleSendMessage()
        }, 500)
      }, i * 3000)
    }
  }

  const clearConversation = () => {
    setConversation([])
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Playground - Admin</h1>
          <p className="text-muted-foreground">Teste e desenvolva o sistema de IA conversacional</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </Button>
          <Button variant="outline">
            <Code className="h-4 w-4 mr-2" />
            API Docs
          </Button>
        </div>
      </div>

      <Tabs defaultValue="chat" className="space-y-6">
        <TabsList>
          <TabsTrigger value="chat">Chat de Teste</TabsTrigger>
          <TabsTrigger value="scenarios">Cenários</TabsTrigger>
          <TabsTrigger value="intents">Intents</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Controls */}
            <Card>
              <CardHeader>
                <CardTitle>Controles de Teste</CardTitle>
                <CardDescription>Configure os parâmetros do teste</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Agente</label>
                  <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map(agent => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Telefone de Teste</label>
                  <Input
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="+5511999887766"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Intent Forçada (Opcional)</label>
                  <Select value={selectedIntent} onValueChange={setSelectedIntent}>
                    <SelectTrigger>
                      <SelectValue placeholder="Detecção automática" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Detecção automática</SelectItem>
                      {intents.map(intent => (
                        <SelectItem key={intent.id} value={intent.id}>
                          {intent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Button onClick={clearConversation} variant="outline" className="w-full">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Limpar Conversa
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Chat */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Simulador de Chat</CardTitle>
                <CardDescription>
                  Teste a IA conversacional em tempo real
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Messages */}
                <ScrollArea className="h-96 border rounded-lg p-4">
                  {conversation.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Inicie uma conversa para testar o sistema</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {conversation.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.type === 'sent' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] p-3 rounded-lg ${
                              msg.type === 'sent'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            <div className="flex items-center justify-between mt-2">
                              <span className={`text-xs ${
                                msg.type === 'sent' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                              }`}>
                                {msg.time}
                              </span>
                              {msg.intent && (
                                <Badge variant="outline" className="text-xs">
                                  {msg.intent}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {/* Input */}
                <div className="flex space-x-2">
                  <Textarea
                    placeholder="Digite sua mensagem de teste..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                    className="min-h-[60px]"
                  />
                  <Button onClick={handleSendMessage} disabled={!message.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="scenarios" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {testScenarios.map((scenario, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-lg">{scenario.name}</CardTitle>
                  <CardDescription>{scenario.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    <p className="text-sm font-medium">Mensagens:</p>
                    {scenario.messages.map((msg, i) => (
                      <div key={i} className="text-xs bg-muted p-2 rounded">
                        {i + 1}. {msg}
                      </div>
                    ))}
                  </div>
                  <Button onClick={() => runTestScenario(scenario)} className="w-full">
                    <Play className="h-4 w-4 mr-2" />
                    Executar Cenário
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="intents" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {intents.map((intent) => (
              <Card key={intent.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{intent.name}</CardTitle>
                  <CardDescription>{intent.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Badge variant="outline">{intent.id}</Badge>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => setSelectedIntent(intent.id)}
                    >
                      Testar Intent
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Sistema</CardTitle>
              <CardDescription>
                Configure parâmetros do backend e IA
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">URL do Backend</label>
                  <Input defaultValue="http://localhost:5000" />
                </div>
                <div>
                  <label className="text-sm font-medium">Timeout (ms)</label>
                  <Input defaultValue="5000" type="number" />
                </div>
                <div>
                  <label className="text-sm font-medium">Modelo OpenAI</label>
                  <Select defaultValue="gpt-4o-mini">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Temperature</label>
                  <Input defaultValue="0.3" type="number" step="0.1" min="0" max="1" />
                </div>
              </div>
              
              <Separator />
              
              <div className="flex space-x-2">
                <Button>Salvar Configurações</Button>
                <Button variant="outline">Testar Conexão</Button>
                <Button variant="outline">
                  <Copy className="h-4 w-4 mr-2" />
                  Exportar Config
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}