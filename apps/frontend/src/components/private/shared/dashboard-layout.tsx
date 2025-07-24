"use client"

import { ReactNode } from "react"
import { Sidebar } from "./sidebar"
import { Header } from "./header"

interface DashboardLayoutProps {
  children: ReactNode
  title?: string
  showSearch?: boolean
  className?: string
}

export function DashboardLayout({ 
  children, 
  title, 
  showSearch = true,
  className 
}: DashboardLayoutProps) {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header title={title} showSearch={showSearch} />
        
        {/* Page Content */}
        <main className={`flex-1 overflow-y-auto p-6 ${className}`}>
          {children}
        </main>
      </div>
    </div>
  )
}