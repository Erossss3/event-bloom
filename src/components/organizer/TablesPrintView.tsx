import { type EventTable, type RsvpForTables, partySize, occupiedSeats, formatDietaryRestrictions } from "@/lib/tables";

/** Misma agrupación e información que exportPDF()/exportExcel() en
 * app.events.$id.tables.tsx (consolidación de exportaciones: PDF, Excel e
 * impresión deben mostrar exactamente lo mismo) — acá como HTML con clases
 * "print:" para que se vea igual al imprimir, en vez de generarse con jsPDF. */
export function TablesPrintView({
  eventTitle,
  tables,
  rsvps,
}: {
  eventTitle: string;
  tables: EventTable[];
  rsvps: RsvpForTables[];
}) {
  const confirmed = rsvps.filter((r) => r.status === "confirmed");
  const unassigned = confirmed.filter((r) => !r.table_id);

  function GuestDetail({ g }: { g: RsvpForTables }) {
    return (
      <li className="break-inside-avoid border-t py-2 text-sm">
        <div className="flex items-baseline justify-between">
          <span className="font-medium">{g.full_name}</span>
          <span className="text-muted-foreground">{partySize(g)} {partySize(g) === 1 ? "persona" : "personas"}</span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          Adultos: {g.adults ?? 0} · Niños: {g.children ?? 0}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          Restricciones alimentarias: {formatDietaryRestrictions(g).join(", ")}
        </div>
        {g.note?.trim() && (
          <div className="mt-0.5 text-xs text-muted-foreground">Observaciones: {g.note.trim()}</div>
        )}
      </li>
    );
  }

  return (
    <div className="hidden print:block print:p-8">
      <h1 className="font-display text-2xl">LiveMoments — Distribución de mesas</h1>
      <p className="mt-1 text-sm text-muted-foreground">{eventTitle}</p>

      <div className="mt-6 space-y-6">
        {tables
          .slice()
          .sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name))
          .map((t) => {
            const guests = confirmed.filter((r) => r.table_id === t.id);
            const occ = occupiedSeats(t.id, rsvps);
            return (
              <div key={t.id} className="break-inside-avoid border-b pb-4">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-display text-lg">
                    {t.number != null ? `Mesa ${t.number} — ` : ""}{t.name}
                  </h2>
                  <span className="text-sm text-muted-foreground">{occ} / {t.capacity} personas</span>
                </div>
                {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                {guests.length === 0 ? (
                  <p className="mt-2 text-sm italic text-muted-foreground">Sin invitados asignados</p>
                ) : (
                  <ul className="mt-2">
                    {guests.map((g) => <GuestDetail key={g.id} g={g} />)}
                  </ul>
                )}
              </div>
            );
          })}
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg">Sin mesa asignada ({unassigned.length})</h2>
        {unassigned.length === 0 ? (
          <p className="mt-2 text-sm italic text-muted-foreground">Todos los invitados confirmados tienen mesa.</p>
        ) : (
          <ul className="mt-2">
            {unassigned.map((g) => <GuestDetail key={g.id} g={g} />)}
          </ul>
        )}
      </div>
    </div>
  );
}
