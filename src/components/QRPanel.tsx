import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";

export function QRPanel({ url, title }: { url: string; title: string }) {
  const svgRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  function downloadPNG() {
    const canvas = canvasRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `qr-${title}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function downloadSVG() {
    const svg = svgRef.current?.querySelector("svg");
    if (!svg) return;
    const src = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([src], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.download = `qr-${title}.svg`;
    link.href = URL.createObjectURL(blob);
    link.click();
  }

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `Sumate a ${title}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado");
      }
    } catch { /* cancelado */ }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr] justify-item-center">
      <div className="mx-auto rounded-3xl border bg-white p-8 shadow-elegant">
        <div ref={canvasRef} className="hidden"><QRCodeCanvas value={url} size={512} includeMargin /></div>
        <div ref={svgRef}>
          <QRCodeSVG value={url} size={280} includeMargin bgColor="#ffffff" fgColor="#1a1508" />
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-2xl border bg-cream/50 p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">URL del evento</p>
          <p className="mt-1 break-all font-mono text-sm">{url}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={downloadPNG} className="rounded-full bg-gradient-gold text-primary-foreground">
            <Download className="mr-2 h-4 w-4" /> PNG
          </Button>
          <Button variant="outline" onClick={downloadSVG} className="rounded-full">
            <Download className="mr-2 h-4 w-4" /> SVG
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="rounded-full">
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
          <Button variant="outline" onClick={share} className="rounded-full">
            <Share2 className="mr-2 h-4 w-4" /> Compartir
          </Button>
        </div>
      </div>
    </div>
  );
}
