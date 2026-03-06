import { useQuery } from "@tanstack/react-query";
import { getJob } from "@/services/api";
import type { JobResponse } from "@/types";

/**
 * Poll job status every 2 seconds while the job is active.
 */
export function useJobPolling(jobId: string | null) {
  return useQuery<JobResponse>({
    queryKey: ["job", jobId],
    queryFn: () => getJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "PENDING" || status === "PROCESSING") {
        return 2000;
      }
      return false;
    },
  });
}
