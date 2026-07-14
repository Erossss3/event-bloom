import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/events/$id/live")({
  component: LivePage,
});

function LivePage() {
  return (
    <div
      style={{
        background: "red",
        color: "white",
        height: "100vh",
        display: "grid",
        placeItems: "center",
        fontSize: "50px",
        fontWeight: "bold",
      }}
    >
      RUTA LIVE FUNCIONANDO
    </div>
  );
}