import logoDark from "@/assets/branding/logo-dark.png";
import logoLight from "@/assets/branding/logo-light.png";

export function LiveMomentsLogo({
  className = "",
  variant = "dark",
}: {
  className?: string;
  variant?: "dark" | "light";
}) {
  return (
    <img
      src={variant === "dark" ? logoDark : logoLight}
      alt="LiveMoments"
      className={`w-auto object-contain ${className}`}
      draggable={false}
    />
  );
}