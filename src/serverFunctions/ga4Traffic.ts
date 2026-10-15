import { createServerFn } from "@tanstack/react-start";
import { Ga4TrafficHistoryService } from "@/server/features/ga4/services/Ga4TrafficHistoryService";
import { AppError } from "@/server/lib/errors";
import { Ga4ReportError } from "@/server/lib/ga4Errors";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { trafficHistoryInputSchema } from "@/types/schemas/traffic";

/** Daily sessions, users and key events for the whole available history of
 *  the connected GA4 property, filtered to one channel view. The Traffic tab
 *  picks ranges and granularity client-side from this one response. */
export const getGa4TrafficHistory = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(trafficHistoryInputSchema)
  .handler(async ({ data, context }) => {
    try {
      return await Ga4TrafficHistoryService.getHistory({
        projectId: context.projectId,
        channel: data.channel,
      });
    } catch (error) {
      // Same handling as getGa4DashboardReport: fall back to the connect card
      // for states that can never succeed on retry.
      if (
        error instanceof Ga4ReportError &&
        (error.code === "ga4_not_connected" ||
          error.code === "ga4_reconnect_required" ||
          error.code === "ga4_property_inaccessible")
      ) {
        return { connected: false as const };
      }
      // Quota exhaustion is external and transient: RATE_LIMITED keeps it out
      // of error tracking.
      if (
        error instanceof Ga4ReportError &&
        error.code === "ga4_quota_exhausted"
      ) {
        throw new AppError("RATE_LIMITED");
      }
      throw error;
    }
  });
