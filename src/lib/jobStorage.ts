import type { JobSpec } from "../types";

export function sanitizedJob(job: JobSpec): JobSpec {
  return {
    ...job,
    inlineHashes: "",
    brain: {
      ...job.brain,
      password: ""
    }
  };
}
