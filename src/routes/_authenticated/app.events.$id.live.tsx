import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/events/$id/live")({
  component: LivePage,
});

function LivePage() {
  return (
    <div style={{ padding: 40 }}>
      <h1>FUNCIONA 🎉</h1>
    </div>
  );
}