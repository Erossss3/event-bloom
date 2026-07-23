import { createFileRoute, Link, useParams, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { ArrowLeft, Download, FileSpreadsheet, Printer, Users, LayoutGrid, Armchair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { TablesGrid } from "@/components/organizer/TablesGrid";
import { GuestSeatingList } from "@/components/organizer/GuestSeatingList";
import { TablesPrintView } from "@/components/organizer/TablesPrintView";
import { partySize, formatDietaryRestrictions, type RsvpForTables } from "@/lib/tables";

export const Route = createFileRoute("/_authenticated/app/events/$id/tables")({
  // Misma validación explícita que app.events.$id.tsx: esta ruta muestra
  // datos de invitados y RSVPs, así que no alcanza con que RLS permita
  // leer el evento (necesario para el flujo público) — acá exigimos
  // ownership real antes de renderizar.
  loader: async ({ params }) => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) throw notFound();

    const { data, error } = await supabase
      .from("events")
      .select("id")
      .eq("id", params.id)
      .eq("owner_id", userData.user.id)
      .maybeSingle();

    if (error || !data) throw notFound();
  },
  head: () => ({ meta: [{ title: "Mesas — LiveMoments" }] }),
  component: EventTablesPage,
});

function EventTablesPage() {
  const { id } = useParams({ from: "/_authenticated/app/events/$id/tables" });
  const [focusTableId, setFocusTableId] = useState<string | null>(null);

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["event-tables-header", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("id, title, slug").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: tables = [] } = useQuery({
    queryKey: ["event-tables", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_tables")
        .select("*")
        .eq("event_id", id)
        .order("number", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: rsvps = [] } = useQuery({
    queryKey: ["event-rsvps-tables", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("id, full_name, status, adults, children, table_id, dietary, dietary_items, note")
        .eq("event_id", id);
      if (error) throw error;
      return data as RsvpForTables[];
    },
  });

  const summary = useMemo(() => {
    const confirmed = rsvps.filter((r) => r.status === "confirmed");
    const totalGuests = confirmed.reduce((t, r) => t + partySize(r), 0);
    const totalCapacity = tables.reduce((t, x) => t + x.capacity, 0);
    const seated = confirmed.filter((r) => r.table_id).reduce((t, r) => t + partySize(r), 0);
    return {
      tableCount: tables.length,
      totalCapacity,
      seated,
      unseated: totalGuests - seated,
      totalGuests,
    };
  }, [tables, rsvps]);

  // Orden y contenido COMPARTIDOS por PDF, Excel e impresión (TablesPrintView) —
  // las tres salidas de la consolidación de exportaciones (ex "Confirmaciones",
  // eliminada de la pantalla del evento) deben mostrar exactamente la misma
  // información, agrupada por mesa.
  function sortedTablesWithGuests() {
    const confirmed = rsvps.filter((r) => r.status === "confirmed");
    const sorted = tables.slice().sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name));
    return {
      sorted,
      byTable: sorted.map((t) => ({ table: t, guests: confirmed.filter((r) => r.table_id === t.id) })),
      unassigned: confirmed.filter((r) => !r.table_id),
    };
  }

  function exportPDF() {
    if (tables.length === 0) {
      toast.error("Todavía no hay mesas creadas");
      return;
    }
    const { byTable, unassigned } = sortedTablesWithGuests();
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginBottom = 20;
    let y = 18;

    function ensureSpace(next: number) {
      if (y + next > pageHeight - marginBottom) {
        doc.addPage();
        y = 18;
      }
    }

    function line(text: string, { x = 14, size = 10, bold = false, gap = 6 }: { x?: number; size?: number; bold?: boolean; gap?: number } = {}) {
      ensureSpace(gap);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.text(text, x, y);
      y += gap;
    }

    function renderGuest(g: RsvpForTables) {
      line(`• ${g.full_name}`, { x: 18, size: 11, bold: true, gap: 6 });
      line(`Adultos: ${g.adults ?? 0}`, { x: 24, size: 9, gap: 5 });
      line(`Niños: ${g.children ?? 0}`, { x: 24, size: 9, gap: 5 });
      line("Restricciones alimentarias:", { x: 24, size: 9, gap: 5 });
      formatDietaryRestrictions(g).forEach((r) => line(`- ${r}`, { x: 30, size: 9, gap: 5 }));
      if (g.note?.trim()) {
        line(`Observaciones: ${g.note.trim()}`, { x: 24, size: 9, gap: 5 });
      }
      y += 2;
    }

    line("LiveMoments — Distribución de mesas", { size: 16, bold: true, gap: 9 });
    line(event?.title ?? "Evento", { size: 11, gap: 10 });

    byTable.forEach(({ table: t, guests }) => {
      ensureSpace(12);
      line(t.number != null ? `Mesa ${t.number} — ${t.name}` : t.name, { size: 13, bold: true, gap: 8 });
      if (guests.length === 0) {
        line("Sin invitados asignados", { x: 18, size: 9, gap: 8 });
      } else {
        guests.forEach(renderGuest);
      }
      y += 4;
    });

    if (unassigned.length > 0) {
      ensureSpace(12);
      line(`Sin mesa asignada (${unassigned.length})`, { size: 13, bold: true, gap: 8 });
      unassigned.forEach(renderGuest);
    }

    doc.save(`${event?.slug ?? "evento"}-mesas.pdf`);
  }

  function exportExcel() {
    if (tables.length === 0) {
      toast.error("Todavía no hay mesas creadas");
      return;
    }
    const { byTable, unassigned } = sortedTablesWithGuests();

    // Una fila por invitado, columnas exactas pedidas para la consolidación
    // de exportaciones — mismo shape que muestran el PDF y la impresión.
    const rows: Record<string, string | number>[] = [];
    function pushRow(mesa: string | number, nombreMesa: string, g: RsvpForTables) {
      rows.push({
        Mesa: mesa,
        "Nombre de la mesa": nombreMesa,
        Invitado: g.full_name,
        Adultos: g.adults ?? 0,
        Niños: g.children ?? 0,
        "Restricciones alimentarias": formatDietaryRestrictions(g).join(", "),
        Observaciones: g.note?.trim() ?? "",
      });
    }

    byTable.forEach(({ table: t, guests }) => {
      guests.forEach((g) => pushRow(t.number ?? "", t.name, g));
    });
    unassigned.forEach((g) => pushRow("", "Sin mesa asignada", g));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mesas");
    XLSX.writeFile(wb, `${event?.slug ?? "evento"}-mesas.xlsx`);
  }

  if (eventLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <div className="h-4 w-32 animate-pulse rounded-full bg-muted/40" />
        <div className="mt-4 h-10 w-64 animate-pulse rounded-lg bg-muted/40" />
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl border bg-muted/40" />
          ))}
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl border bg-muted/40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <div className="print:hidden">
        <Link to="/app/events/$id" params={{ id }} search={{ qr: false }} className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          <ArrowLeft className="h-4 w-4" /> Volver al evento
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl">Gestor de mesas</h1>
            <p className="text-sm text-muted-foreground">{event?.title}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
            <Button variant="outline" className="rounded-full" onClick={exportExcel}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" className="rounded-full" onClick={exportPDF}>
              <Download className="mr-2 h-4 w-4" /> PDF
            </Button>
          </div>
        </div>

        {/* Resumen */}
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border bg-card p-4 shadow-soft">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground"><LayoutGrid className="h-3.5 w-3.5" /> Mesas</div>
            <div className="mt-1 font-display text-2xl">{summary.tableCount}</div>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-soft">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground"><Armchair className="h-3.5 w-3.5" /> Capacidad</div>
            <div className="mt-1 font-display text-2xl">{summary.totalCapacity}</div>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-soft">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground"><Users className="h-3.5 w-3.5" /> Sentados</div>
            <div className="mt-1 font-display text-2xl">{summary.seated}</div>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-soft">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Sin mesa</div>
            <div className={`mt-1 font-display text-2xl ${summary.unseated > 0 ? "text-gold" : ""}`}>{summary.unseated}</div>
          </div>
        </div>

        {/* Distribución de mesas */}
        <section className="mt-8">
          <TablesGrid eventId={id} tables={tables} rsvps={rsvps} onSelectTable={setFocusTableId} />
        </section>

        {/* Asignación de invitados */}
        <section className="mt-10">
          <h2 className="font-display text-2xl">Invitados</h2>
          <p className="text-sm text-muted-foreground">Buscá un invitado o filtrá por mesa para asignarlo.</p>
          <div className="mt-4">
            <GuestSeatingList eventId={id} tables={tables} rsvps={rsvps} focusTableId={focusTableId} />
          </div>
        </section>
      </div>

      <TablesPrintView eventTitle={event?.title ?? "Evento"} tables={tables} rsvps={rsvps} />
    </div>
  );
}
