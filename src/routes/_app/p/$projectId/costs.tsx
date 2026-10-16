import { createFileRoute } from "@tanstack/react-router";
import { CostsPage } from "@/client/features/costs/CostsPage";

export const Route = createFileRoute("/_app/p/$projectId/costs")({
  component: CostsRoute,
});

function CostsRoute() {
  const { projectId } = Route.useParams();
  return <CostsPage projectId={projectId} />;
}
