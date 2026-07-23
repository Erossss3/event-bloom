import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Users, UserX } from "lucide-react";
import { toast } from "sonner";
import { type EventTable, type RsvpForTables, partySize, occupiedSeats, getErrorMessage } from "@/lib/tables";
import type { Database } from "@/integrations/supabase/types";

const NO_TABLE = "__none__";

export function GuestSeatingList({
  eventId,
  tables,
  rsvps,
  focusTableId,
}: {
  eventId: string;
  tables: EventTable[];
  rsvps: RsvpForTables[];
  focusTableId?: string | null;
}) {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [filterTable, setFilterTable] = useState<string>(focusTableId ?? "all");

  const tableName = (id: string | null) => tables.find((t) => t.id === id)?.name ?? null;

  const assign = useMutation({
    mutationFn: async ({ rsvpId, tableId }: { rsvpId: string; tableId: string | null }) => {
      const rsvp = rsvps.find((r) => r.id === rsvpId);
      if (tableId && rsvp) {
        const table = tables.find((t) => t.id === tableId);
        if (table) {
          const already = occupiedSeats(tableId, rsvps);
          const size = partySize(rsvp);
          if (already + size > table.capacity) {
            throw new Error(`"${table.name}" no tiene lugar suficiente (libres: ${Math.max(0, table.capacity - already)}, necesita ${size}).`);
          }
        }
      }
      // "dietary_items" en el tipo "Update" generado
      // (integrations/supabase/types.ts) quedó sin "?" por un desfasaje de
      // generación de tipos preexistente (todas las demás columnas de esta
      // tabla sí lo tienen) — no se puede corregir sin regenerar types.ts
      // contra la base real. Cast mínimo y acotado únicamente a este
      // payload, no afecta ningún otro uso de "rsvps".
      const { error } = await supabase
        .from("rsvps")
        .update({ table_id: tableId } as unknown as Database["public"]["Tables"]["rsvps"]["Update"])
        .eq("id", rsvpId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-rsvps-tables", eventId] });
    },
    onError: (e) => toast.error(getErrorMessage(e, "No se pudo asignar la mesa")),
  });

  const confirmed = useMemo(
    () => rsvps.filter((r) => r.status === "confirmed"),
    [rsvps]
  );

  const filtered = useMemo(() => {
    return confirmed.filter((r) => {
      if (query.trim() && !r.full_name.toLowerCase().includes(query.trim().toLowerCase())) return false;
      if (filterTable === "unassigned" && r.table_id) return false;
      if (filterTable !== "all" && filterTable !== "unassigned" && r.table_id !== filterTable) return false;
      return true;
    });
  }, [confirmed, query, filterTable]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar invitado por nombre…"
            className="pl-9"
          />
        </div>
        <Select value={filterTable} onValueChange={setFilterTable}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Filtrar por mesa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los invitados</SelectItem>
            <SelectItem value="unassigned">Sin mesa asignada</SelectItem>
            {tables.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {confirmed.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed bg-cream/40 p-8 text-center">
          <Users className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Todavía no hay invitados confirmados para sentar.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed bg-cream/40 p-8 text-center">
          <UserX className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No encontramos invitados con ese filtro.</p>
        </div>
      ) : (
        <ul className="mt-5 divide-y rounded-2xl border">
          {filtered.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium">{r.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {partySize(r)} {partySize(r) === 1 ? "persona" : "personas"}
                  {r.table_id && <> · Mesa: <span className="text-foreground">{tableName(r.table_id)}</span></>}
                </p>
              </div>
              <Select
                value={r.table_id ?? NO_TABLE}
                onValueChange={(v) => assign.mutate({ rsvpId: r.id, tableId: v === NO_TABLE ? null : v })}
              >
                <SelectTrigger className="sm:w-56">
                  <SelectValue placeholder="Sin mesa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TABLE}>Sin mesa asignada</SelectItem>
                  {tables.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
