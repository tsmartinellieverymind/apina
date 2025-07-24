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
import { Send, Play, RotateCcw, MessageSquare, Zap, HelpCircle } from "lucide-react"

export default function UsuarioPlaygroundPage() {
    const [message, setMessage] = useState("")
    const [testPhone, setTestPhone] = useState("+5511999887766")
    const [conversation, setConversation] = useState<Array<{ id: string, type: 'sent' | 'received', content: string, time: string, intent?: string }>>([])

    const testScenarios = [
        {
            name: "Novo Cliente - Primeiro Agendamento",
            description: "Cliente novo fazendo primeiro agendamento",
            messages: [
                "Olá, preciso agendar uma instalação",
                "123.456.789-00",
                "Quero a OS de instalação",
                "Pode ser amanhã de manhã",
                "Confirmo"
            ]
        },
        {
            name: "Cliente Reagendando",
            description: "Cliente existente quer reagendar",
            messages: [
                "Preciso reagendar minha visita",
                "111.222.333-44",
                "Quero mudar para tarde",
                "Sexta-feira serve?",
                "Perfeito, confirmo"
            ]
        },
        {
            name: "Cliente com Dúvidas",
            description: "Cliente com dúvidas sobre o processo",
            messages: [
                "Oi, como funciona o agendamento?",
                "Preciso estar em casa?",
                "Quanto tempo demora?",
                "Ok, quero agendar então",
                "555.666.777-88"
            ]
        }
    ]

    const quickMessages = [
        "Olá, preciso agendar uma visita",
        "Quero reagendar minha OS",
        "Qual o status do meu agendamento?",
        "Preciso cancelar o agendamento",
        "Como funciona o processo?",
        "Tenho uma emergência",
        "Não consigo estar em casa no horário marcado"
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
            return "✅ Cadastro localizado, Maria Silva.\n\nEncontrei 2 OS abertas:\n• 12345 - Instalação de Internet\n• 12346 - Manutenção Técnica\n\nQual OS você gostaria de agendar?"
        }

        if (msg.includes('agendar') || msg.includes('visita')) {
            return "Perfeito! Para localizar suas informações, pode me informar seu CPF?"
        }

        if (msg.includes('reagendar')) {
            return "Claro! Vou te ajudar a reagendar. Primeiro, preciso do seu CPF para localizar o agendamento atual."
        }

        if (msg.includes('manhã') || msg.includes('tarde') || msg.includes('amanhã')) {
            return "Verificando disponibilidade... Encontrei horário disponível! Confirma o agendamento para quinta-feira, 25/01/2024 pela tarde?"
        }

        if (msg.includes('confirmo') || msg.includes('sim') || msg.includes('ok')) {
            return "🎉 Agendamento confirmado!\n\n📅 Data: Quinta-feira, 25/01/2024\n⏰ Período: Tarde (13h às 17h)\n🔧 Serviço: Instalação de Internet\n📋 OS: #12345\n\nVocê receberá uma confirmação por SMS. Obrigada!"
        }

        if (msg.includes('como funciona') || msg.includes('dúvida')) {
            return "Claro! O processo é simples:\n\n1️⃣ Informe seu CPF\n2️⃣ Escolha a OS que deseja agendar\n3️⃣ Selecione data e horário\n4️⃣ Confirme o agendamento\n\nPosso te ajudar a começar?"
        }

        return "Olá! Sou a Jaqueline da Ibiunet. Como posso te ajudar hoje?"
    }

    const detectMockIntent = (message: string): string => {
        const msg = message.toLowerCase()

        if (/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/.test(msg)) return "extrair_cpf"
        if (msg.includes('agendar')) return "agendar_data"
        if (msg.includes('reagendar')) return "agendar_data"
        if (msg.includes('manhã') || msg.includes('tarde')) return "extrair_hora"
        if (msg.includes('confirmo') || msg.includes('sim')) return "confirmar_agendamento"
        if (msg.includes('como funciona')) return "help"

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

    const useQuickMessage = (quickMsg: string) => {
        setMessage(quickMsg)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Playground de Testes</h1>
                    <p className="text-muted-foreground">Teste como seus clientes interagem com o sistema</p>
                </div>
                <Button variant="outline">
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Como Usar
                </Button>
            </div>

            <Tabs defaultValue="chat" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="chat">Simulador</TabsTrigger>
                    <TabsTrigger value="scenarios">Cenários de Teste</TabsTrigger>
                    <TabsTrigger value="tips">Dicas</TabsTrigger>
                </TabsList>

                <TabsContent value="chat" className="space-y-6">
                    <div className="grid gap-6 lg:grid-cols-4">
                        {/* Quick Actions */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Ações Rápidas</CardTitle>
                                <CardDescription>Mensagens comuns dos clientes</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {quickMessages.map((quickMsg, index) => (
                                    <Button
                                        key={index}
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-left justify-start h-auto p-2"
                                        onClick={() => useQuickMessage(quickMsg)}
                                    >
                                        <span className="text-xs">{quickMsg}</span>
                                    </Button>
                                ))}

                                <Separator className="my-4" />

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Telefone de Teste</label>
                                    <Input
                                        value={testPhone}
                                        onChange={(e) => setTestPhone(e.target.value)}
                                        placeholder="+5511999887766"
                                        className="text-sm"
                                    />
                                </div>

                                <Button onClick={clearConversation} variant="outline" className="w-full">
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                    Nova Conversa
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Chat Simulator */}
                        <Card className="lg:col-span-3">
                            <CardHeader>
                                <CardTitle>Simulador de Conversa</CardTitle>
                                <CardDescription>
                                    Veja como seus clientes interagem com a Jaqueline
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Messages */}
                                <ScrollArea className="h-96 border rounded-lg p-4 bg-muted/20">
                                    {conversation.length === 0 ? (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">
                                            <div className="text-center">
                                                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                                <p>Inicie uma conversa para ver como funciona</p>
                                                <p className="text-sm mt-2">Use as ações rápidas ou digite uma mensagem</p>
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
                                                        className={`max-w-[80%] p-3 rounded-lg ${msg.type === 'sent'
                                                            ? 'bg-primary text-primary-foreground'
                                                            : 'bg-background border'
                                                            }`}
                                                    >
                                                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                                        <div className="flex items-center justify-between mt-2">
                                                            <span className={`text-xs ${msg.type === 'sent' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                                                }`}>
                                                                {msg.time}
                                                            </span>
                                                            {msg.intent && (
                                                                <Badge variant="secondary" className="text-xs">
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
                                        placeholder="Digite como se fosse seu cliente..."
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
                                        <p className="text-sm font-medium">Fluxo de mensagens:</p>
                                        {scenario.messages.map((msg, i) => (
                                            <div key={i} className="text-xs bg-muted p-2 rounded">
                                                {i + 1}. {msg}
                                            </div>
                                        ))}
                                    </div>
                                    <Button onClick={() => runTestScenario(scenario)} className="w-full">
                                        <Play className="h-4 w-4 mr-2" />
                                        Testar Cenário
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="tips" className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Como Usar o Playground</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <h4 className="font-medium">1. Teste Mensagens Comuns</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Use as ações rápidas para testar como seus clientes normalmente iniciam conversas.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="font-medium">2. Execute Cenários Completos</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Os cenários simulam fluxos completos de agendamento para identificar possíveis problemas.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="font-medium">3. Observe as Intents</h4>
                                    <p className="text-sm text-muted-foreground">
                                        As badges mostram qual intenção o sistema detectou em cada mensagem.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Dicas de Teste</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <h4 className="font-medium">✅ Teste Diferentes Formas</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Clientes podem dizer a mesma coisa de formas diferentes. Teste variações.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="font-medium">✅ Simule Erros</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Teste CPFs inválidos, datas impossíveis, mensagens confusas.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="font-medium">✅ Verifique Fluxos</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Certifique-se de que o cliente consegue completar o agendamento facilmente.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Exemplos de Mensagens para Testar</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <h4 className="font-medium mb-2">Mensagens Claras</h4>
                                    <div className="space-y-1 text-sm">
                                        <div className="bg-muted p-2 rounded">"Preciso agendar uma instalação"</div>
                                        <div className="bg-muted p-2 rounded">"Meu CPF é 123.456.789-00"</div>
                                        <div className="bg-muted p-2 rounded">"Pode ser amanhã de manhã"</div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-medium mb-2">Mensagens Confusas</h4>
                                    <div className="space-y-1 text-sm">
                                        <div className="bg-muted p-2 rounded">"Oi, tudo bem? Então, é sobre aquele negócio lá"</div>
                                        <div className="bg-muted p-2 rounded">"123456789"</div>
                                        <div className="bg-muted p-2 rounded">"Qualquer hora serve"</div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}