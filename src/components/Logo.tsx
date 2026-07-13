import type { SVGProps } from "react";

export function LiveMomentsMark({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <defs>
        <linearGradient id="lm-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F2D08A" />
          <stop offset="1" stopColor="#C39A55" />
        </linearGradient>
      </defs>

      {/* Círculo dorado premium */}
      <circle
        cx="24"
        cy="24"
        r="22"
        fill="url(#lm-gold)"
      />

      {/* Estrella principal elegante */}
      <path
        d="M24 11
          L27.2 19.2
          L36 20
          L29.3 25.5
          L31.5 34
          L24 29
          L16.5 34
          L18.7 25.5
          L12 20
          L20.8 19.2
          Z"
        fill="#FFFFFF"
      />

      {/* Brillo pequeño junto a la estrella */}
      <path
        d="M35.5 10
          L36.5 12.5
          L39 13.5
          L36.5 14.5
          L35.5 17
          L34.5 14.5
          L32 13.5
          L34.5 12.5
          Z"
        fill="#FFFFFF"
        opacity="0.95"
      />
      </svg>
  );
}

export function LiveMomentsLogo({
  className = "",
  variant = "dark",
}: {
  className?: string;
  variant?: "dark" | "light";
}) {
  const text = variant === "dark" ? "text-foreground" : "text-white";

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LiveMomentsMark className="h-8 w-8" />

      <span className={`font-display text-xl leading-none tracking-tight ${text}`}>
        Live<span className="text-gold">Moments</span>
      </span>
    </span>
  );
}
