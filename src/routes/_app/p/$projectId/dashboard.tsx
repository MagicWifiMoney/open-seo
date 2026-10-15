import { dashboardSearchSchema } from "@/types/schemas/dashboard";
import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/client/features/dashboard/DashboardPage";

// The stock project dashboard, kept reachable now that the Overview is home.
export const Route = createFileRoute("/_app/p/$projectId/dashboard")({
  validateSearch: dashboardSearchSchema,
  component: ClassicDashboardRoute,
});

function ClassicDashboardRoute() {
  const { projectId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <DashboardPage
      key={projectId}
      projectId={projectId}
      tab={search.tab}
      onTabChange={(tab) => void navigate({ search: { tab } })}
    />
  );
}
