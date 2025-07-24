"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";

// Adiciona um atraso para garantir que o tema esteja carregado
export function ModeToggle() {
  const [mounted, setMounted] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const { theme, setTheme, systemTheme } = useTheme();
  
  // Efeito para garantir que o componente está montado no cliente
  useEffect(() => {
    setIsClient(true);
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);
  
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  // Se não for cliente, retornar um botão vazio
  if (!isClient) {
    return (
      <Button 
        variant="ghost" 
        size="icon"
        className="text-muted-foreground hover:text-foreground"
        aria-label="Carregando tema"
      >
        <div className="h-[1.2rem] w-[1.2rem]" />
      </Button>
    );
  }

  // Se não estiver montado, retornar um botão de carregamento
  if (!mounted) {
    return (
      <Button 
        variant="ghost" 
        size="icon"
        className="text-muted-foreground hover:text-foreground"
        aria-label="Carregando tema"
      >
        <div className="h-[1.2rem] w-[1.2rem] animate-pulse rounded-full bg-muted" />
      </Button>
    );
  }

  const currentTheme = theme === 'system' ? systemTheme : theme;
  const tooltipText = currentTheme === 'dark' ? 'Tema claro' : 'Tema escuro';
  const ariaLabel = currentTheme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={toggleTheme}
          className="text-muted-foreground hover:text-foreground"
          aria-label={ariaLabel}
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Alternar tema</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
}