"use client";

import { useRouter } from "next/navigation";

type Props = { onReintentar?: () => void };

export function BotonReintentar({ onReintentar }: Props) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="boton-secundario"
      onClick={() => {
        onReintentar?.();
        router.refresh();
      }}
    >
      Reintentar
    </button>
  );
}
