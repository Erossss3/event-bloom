import { CountdownTimer } from "@/components/CountdownTimer";

type Props = {
  open: boolean;
  target: string;
};

export function LiveLockDialog({ open, target }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Fondo oscuro + blur */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />

      {/* Modal */}
      <div className="relative flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-3xl border bg-card p-8 text-center shadow-2xl">
          <h1 className="font-display text-4xl">LiveMoments</h1>

          <p className="mt-3 text-lg font-medium">
            La experiencia del evento estará disponible muy pronto.
          </p>

          <p className="mt-2 text-muted-foreground">
            Se habilitará automáticamente 20 minutos antes del inicio.
          </p>

          <div className="mt-8">
            <CountdownTimer target={target} />
          </div>
        </div>
      </div>
    </div>
  );
}