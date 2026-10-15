import {
  createFileRoute,
  stripSearchParams,
  useNavigate,
} from "@tanstack/react-router";
import { OverviewPage } from "@/client/features/overview/OverviewPage";
import {
  OVERVIEW_SEARCH_DEFAULTS,
  overviewSearchSchema,
} from "@/types/schemas/overview";

// The project home is the Quiet Coyote Overview. The stock dashboard is still
// reachable at /p/$projectId/dashboard.
export const Route = createFileRoute("/_app/p/$projectId/")({
  validateSearch: overviewSearchSchema,
  search: {
    middlewares: [stripSearchParams(OVERVIEW_SEARCH_DEFAULTS)],
  },
  component: OverviewRoute,
});

function OverviewRoute() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  return (
    <OverviewPage
      key={projectId}
      projectId={projectId}
      search={search}
      onSearchChange={(update) => {
        void navigate({
          search: (prev) => ({ ...prev, ...update }),
          replace: true,
        });
      }}
    />
  );
}
