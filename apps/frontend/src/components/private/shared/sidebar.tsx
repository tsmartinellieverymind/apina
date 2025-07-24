"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useUserRole } from "@/hooks/useUserRole"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Home,
  Users,
  Settings,
  BarChart3,
  MessageSquare,
  Bell,
  ChevronLeft,
  ChevronRight,
  User,
  Shield,
  Building2
} from "lucide-react"

interface SidebarProps {
  className?: string
}

// Função para gerar menu baseado no role do usuário
const getMenuItems = (userRole: string) => {
  const baseUrl = `/${userRole}`
  
  const commonItems = [
    {
      title: "Dashboard",
      href: `${baseUrl}/dashboard`,
      icon: Home,
      roles: ["admin", "usuario", "cliente"]
    },
    {
      title: "Mensagens",
      href: `${baseUrl}/mensagens`,
      icon: MessageSquare,
      roles: ["admin", "usuario", "cliente"]
    },
    {
      title: "Notificações",
      href: `${baseUrl}/notificacoes`,
      icon: Bell,
      roles: ["admin", "usuario", "cliente"]
    },
    {
      title: "Configurações",
      href: `${baseUrl}/configuracoes`,
      icon: Settings,
      roles: ["admin", "usuario", "cliente"]
    }
  ]

  const adminItems = [
    {
      title: "Usuários",
      href: `${baseUrl}/usuarios`,
      icon: Users,
      roles: ["admin"]
    },
    {
      title: "Todos os Clientes",
      href: `${baseUrl}/clientes`,
      icon: Building2,
      roles: ["admin"]
    },
    {
      title: "Relatórios",
      href: `${baseUrl}/relatorios`,
      icon: BarChart3,
      roles: ["admin"]
    },
    {
      title: "Playground",
      href: `${baseUrl}/playground`,
      icon: Settings,
      roles: ["admin"]
    }
  ]

  const usuarioItems = [
    {
      title: "Meus Clientes",
      href: `${baseUrl}/clientes`,
      icon: Building2,
      roles: ["usuario"]
    },
    {
      title: "Relatórios",
      href: `${baseUrl}/relatorios`,
      icon: BarChart3,
      roles: ["usuario"]
    },
    {
      title: "Playground",
      href: `${baseUrl}/playground`,
      icon: Settings,
      roles: ["usuario"]
    }
  ]

  if (userRole === 'admin') {
    return [...commonItems.slice(0, 1), ...adminItems, ...commonItems.slice(1)]
  } else if (userRole === 'usuario') {
    return [...commonItems.slice(0, 1), ...usuarioItems, ...commonItems.slice(1)]
  } else {
    return commonItems
  }
}

export function Sidebar({ className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()
  
  // Detectar role baseado na URL atual
  const userRole = useUserRole()

  const menuItems = getMenuItems(userRole)
  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(userRole)
  )

  return (
    <div className={cn(
      "relative flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
      isCollapsed ? "w-16" : "w-64",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-sidebar-primary-foreground" />
            </div>
            <span className="font-semibold text-sidebar-foreground">Apina</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8 p-0 text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-sidebar-accent rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-sidebar-accent-foreground" />
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                João Silva
              </p>
              <p className="text-xs text-sidebar-foreground/60 capitalize">
                {userRole}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start h-10 px-3",
                    isActive 
                      ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isCollapsed && "px-2"
                  )}
                >
                  <Icon className={cn("h-4 w-4", !isCollapsed && "mr-3")} />
                  {!isCollapsed && (
                    <span className="truncate">{item.title}</span>
                  )}
                </Button>
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-center">
          {!isCollapsed && (
            <p className="text-xs text-sidebar-foreground/60">
              v1.0.0
            </p>
          )}
        </div>
      </div>
    </div>
  )
}