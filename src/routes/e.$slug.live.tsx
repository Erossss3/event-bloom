import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/e/$slug/live')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/e/$slug/live"!</div>
}
