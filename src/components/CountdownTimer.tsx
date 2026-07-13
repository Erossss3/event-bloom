import { useEffect, useState } from "react";

export function CountdownTimer({ target }: { target: string }) {
  const [diff, setDiff] = useState(() => new Date(target).getTime() - Date.now());
  useEffect(() => {
    const t = setInterval(() => setDiff(new Date(target).getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);

  if (diff <= 0) {
    return <p className="mt-3 font-display text-3xl">¡El evento está en marcha!</p>;
  }

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  return (
    <div className="mt-3 grid grid-cols-4 gap-3">
      {[
        { v: days, l: "días" },
        { v: hours, l: "horas" },
        { v: minutes, l: "min" },
        { v: seconds, l: "seg" },
      ].map((x) => (
        <div key={x.l} className="rounded-2xl bg-card/60 p-3 text-center backdrop-blur">
          <div className="font-display text-3xl tabular-nums">{String(x.v).padStart(2, "0")}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{x.l}</div>
        </div>
      ))}
    </div>
  );
}
