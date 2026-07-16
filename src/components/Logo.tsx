import { logoSrc, type LogoType, type LogoVariant } from "@/lib/branding";

/**
 * Logo de LiveMoments. Por defecto renderiza el lockup horizontal (mark + wordmark).
 *
 * - variant="dark"  → para fondos claros (texto/mark oscuro-dorado)
 * - variant="light" → para fondos oscuros (texto/mark claro)
 * - type: "horizontal" (navbar, headers), "vertical" (splash, presentaciones),
 *         "mark" (favicon, avatar, watermark chico), "wordmark" (solo texto)
 */
export function LiveMomentsLogo({
  className = "",
  variant = "dark",
  type = "horizontal",
}: {
  className?: string;
  variant?: LogoVariant;
  type?: LogoType;
}) {
  return (
    <img
      src={logoSrc(type, variant)}
      alt="LiveMoments"
      className={`w-auto object-contain ${className}`}
      draggable={false}
    />
  );
}
