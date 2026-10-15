import {
  createFileRoute,
  stripSearchParams,
  useNavigate,
} from "@tanstack/react-router";
import { TrafficPage } from "@/client/features/traffic/TrafficPage";
import {
  TRAFFIC_SEARCH_DEFAULTS,
  trafficSearchSchema,
} from "@/types/schemas/traffic";

export const Route = createFileRoute("/_app/p/$projectId/traffic")({
  validateSearch: trafficSearchSchema,
  search: {
    middlewares: [stripSearchParams(TRAFFIC_SEARCH_DEFAULTS)],
  },
  component: TrafficRoute,
});

function TrafficRoute() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  return (
    <TrafficPage
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
