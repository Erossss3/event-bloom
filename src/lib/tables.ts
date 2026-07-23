import type { Tables, Database } from "@/integrations/supabase/types";

export type EventTable = Tables<"event_tables">;

export type DietaryItem = { name: string; quantity: number };

export type RsvpForTables = {
  id: string;
  full_name: string;
  status: Database["public"]["Enums"]["rsvp_status"];
  adults: number;
  children: number;
  table_id: string | null;
  dietary: string | null;
  /** Columna jsonb de "rsvps" — un arreglo de {name, quantity} con el
   * detalle estructurado de restricciones dentro de ese mismo grupo
   * (ej. 2 adultos donde 1 es vegetariano). Puede venir con cualquier
   * forma desde la base (columna jsonb sin esquema), por eso se valida
   * con parseDietaryItems() en vez de asumir el tipo. */
  dietary_items: unknown;
  /** Observaciones libres del invitado (columna "note" de "rsvps"). */
  note: string | null;
};

/** Cantidad de personas que representa un RSVP (adultos + niños). */
export function partySize(r: Pick<RsvpForTables, "adults" | "children">) {
  return (r.adults ?? 0) + (r.children ?? 0);
}

/** Lugares ya ocupados en una mesa, sumando solo RSVPs confirmados asignados a ella. */
export function occupiedSeats(tableId: string, rsvps: RsvpForTables[]) {
  return rsvps
    .filter((r) => r.table_id === tableId && r.status === "confirmed")
    .reduce((total, r) => total + partySize(r), 0);
}

/** Lugares libres en una mesa (nunca negativo). */
export function freeSeats(table: EventTable, rsvps: RsvpForTables[]) {
  return Math.max(0, table.capacity - occupiedSeats(table.id, rsvps));
}

export type TableStatus = "empty" | "partial" | "full";

export function tableStatus(table: EventTable, rsvps: RsvpForTables[]): TableStatus {
  const occupied = occupiedSeats(table.id, rsvps);
  if (occupied === 0) return "empty";
  if (occupied >= table.capacity) return "full";
  return "partial";
}

/** "dietary_items" es jsonb sin esquema — nunca se asume su forma. Devuelve
 * solo las entradas que efectivamente tienen name/quantity válidos. */
export function parseDietaryItems(raw: unknown): DietaryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is { name: unknown; quantity: unknown } =>
        !!item && typeof item === "object" && "name" in item,
    )
    .map((item) => ({
      name: String((item as { name: unknown }).name ?? "").trim(),
      quantity: Number((item as { quantity?: unknown }).quantity ?? 1) || 1,
    }))
    .filter((item) => item.name.length > 0);
}

/** Formato único de restricciones alimentarias, usado por igual en el PDF,
 * el Excel y la impresión de Mesas, para que las tres salidas muestren
 * exactamente la misma información (pedido explícito de la consolidación
 * de exportaciones). Combina el detalle estructurado ("Vegetariano (1)")
 * con cualquier observación libre de "dietary", y devuelve ["Ninguna"]
 * cuando no hay nada que mostrar — nunca una lista vacía. */
export function formatDietaryRestrictions(r: Pick<RsvpForTables, "dietary" | "dietary_items">): string[] {
  const items = parseDietaryItems(r.dietary_items).map((item) => `${item.name} (${item.quantity})`);
  const freeText = r.dietary?.trim() ? [r.dietary.trim()] : [];
  const lines = [...items, ...freeText];
  return lines.length > 0 ? lines : ["Ninguna"];
}

/** Colores predefinidos para elegir al crear una mesa (paleta acorde al branding). */
export const TABLE_COLOR_PRESETS = [
  { label: "Dorado", value: "#D8A857" },
  { label: "Verde salvia", value: "#8A9A7B" },
  { label: "Azul noche", value: "#5B7A9D" },
  { label: "Terracota", value: "#C17A54" },
  { label: "Ciruela", value: "#8B6A8C" },
  { label: "Gris piedra", value: "#8A8579" },
];

export const DEFAULT_TABLE_COLOR = TABLE_COLOR_PRESETS[0].value;

/**
 * Los errores de Supabase (PostgrestError) son objetos planos con `.message`,
 * NO instancias de `Error` — `e instanceof Error` los deja pasar de largo y
 * termina mostrando un mensaje genérico que oculta el error real de la base de datos.
 * Este helper extrae el mensaje real venga de donde venga.
 */
export function getErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return fallback;
}
