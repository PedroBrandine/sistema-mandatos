import { AlertCircle, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export interface ErroInlineProps {
  titulo?: string;
  mensagem: string;
  onRetry?: () => void;
}

/**
 * Mensagem de erro persistente (não auto-esconde, ao contrário do toast) com
 * botão opcional de retry -- cobre o fetch inicial falho que nenhuma tela
 * trata hoje de forma visível.
 */
export function ErroInline({
  titulo = "Não foi possível carregar",
  mensagem,
  onRetry,
}: ErroInlineProps) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>{titulo}</AlertTitle>
      <AlertDescription>
        <p>{mensagem}</p>
        {onRetry ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={onRetry}
          >
            <RefreshCw className="size-4" />
            Tentar novamente
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
