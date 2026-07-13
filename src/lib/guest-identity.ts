// Identidad de invitado por evento, persistida en localStorage.
// No requiere cuenta ni email. Un dispositivo = un invitado por evento.

export interface GuestIdentity {
  guestId: string;
  deviceToken: string;
  firstName: string;
  lastName?: string;
  avatarUrl?: string;
}

const keyFor = (eventId: string) => `momento.guest.${eventId}`;

export function getGuest(eventId: string): GuestIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(eventId));
    return raw ? (JSON.parse(raw) as GuestIdentity) : null;
  } catch {
    return null;
  }
}

export function saveGuest(eventId: string, guest: GuestIdentity): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(keyFor(eventId), JSON.stringify(guest));
}

export function clearGuest(eventId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(keyFor(eventId));
}

export function generateDeviceToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
