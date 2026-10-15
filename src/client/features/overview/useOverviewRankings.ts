import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getLatestRankResults,
  getRankConfigTrend,
  getRankPositionMatrix,
  getRankTrackingConfigSummaries,
} from "@/serverFunctions/rank-tracking";
import type { OverviewDevice } from "@/types/schemas/overview";
import { buildRankingsView, defaultTracker } from "./overviewRankBands";

const TREND_DAYS = 365;
const MATRIX_RUNS = 8;
const STALE = 5 * 60 * 1000;

/** Rank tracker data for the Overview, read through the existing rank
 *  tracking server functions (no new server code, no paid calls). */
export function useOverviewRankings(input: {
  projectId: string;
  tracker: string | undefined;
  device: OverviewDevice;
}) {
  const { projectId, device } = input;
  const configsQuery = useQuery({
    queryKey: ["overviewRankConfigs", projectId],
    queryFn: () => getRankTrackingConfigSummaries({ data: { projectId } }),
    staleTime: STALE,
  });
  const configs = useMemo(
    () => (configsQuery.data ?? []).filter((config) => config.isActive),
    [configsQuery.data],
  );
  const config =
    configs.find((candidate) => candidate.id === input.tracker) ??
    defaultTracker(configs);
  const configId = config?.id;

  const trendQuery = useQuery({
    queryKey: ["overviewRankTrend", projectId, configId, device],
    enabled: Boolean(configId),
    queryFn: () =>
      getRankConfigTrend({
        data: {
          projectId,
          configId: configId ?? "",
          device,
          sinceDays: TREND_DAYS,
        },
      }),
    staleTime: STALE,
  });
  const matrixQuery = useQuery({
    queryKey: ["overviewRankMatrix", projectId, configId, device],
    enabled: Boolean(configId),
    queryFn: () =>
      getRankPositionMatrix({
        data: {
          projectId,
          configId: configId ?? "",
          device,
          runLimit: MATRIX_RUNS,
        },
      }),
    staleTime: STALE,
  });
  const namesQuery = useQuery({
    queryKey: ["overviewRankNames", projectId, configId],
    enabled: Boolean(configId),
    queryFn: () =>
      getLatestRankResults({
        data: { projectId, configId: configId ?? "" },
      }),
    staleTime: STALE,
  });

  const view = useMemo(() => {
    if (!trendQuery.data || !matrixQuery.data || !namesQuery.data) return null;
    return buildRankingsView({
      runs: trendQuery.data,
      cells: matrixQuery.data,
      names: new Map(
        namesQuery.data.rows.map((row) => [row.trackingKeywordId, row.keyword]),
      ),
    });
  }, [trendQuery.data, matrixQuery.data, namesQuery.data]);

  const loading =
    configsQuery.isPending ||
    (Boolean(configId) &&
      (trendQuery.isPending || matrixQuery.isPending || namesQuery.isPending));
  const error =
    configsQuery.error ??
    trendQuery.error ??
    matrixQuery.error ??
    namesQuery.error;

  return {
    configs,
    config: config ?? null,
    view,
    loading,
    error,
    refetch: () => {
      void configsQuery.refetch();
      void trendQuery.refetch();
      void matrixQuery.refetch();
      void namesQuery.refetch();
    },
  };
}
