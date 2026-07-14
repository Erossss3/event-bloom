import logoDark from "@/assets/branding/logo-dark.png";

export function LiveMomentsLogo({
  className = "",
}: {
  className?: string;
}) {
  return (
    <img
      src={logoDark}
      alt="LiveMoments"
      className={className}
      draggable={false}
    />
  );
}