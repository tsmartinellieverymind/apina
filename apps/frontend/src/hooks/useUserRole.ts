"use client"

import { usePathname } from "next/navigation"

export function useUserRole() {
  const pathname = usePathname()
  
  // Detectar role baseado na URL
  if (pathname.startsWith('/admin')) {
    return 'admin'
  } else if (pathname.startsWith('/usuario')) {
    return 'usuario'
  } else if (pathname.startsWith('/cliente')) {
    return 'cliente'
  }
  
  // Fallback para dashboard genérico
  return 'admin'
}

export type UserRole = 'admin' | 'usuario' | 'cliente'