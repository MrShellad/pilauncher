export interface MissingRuntime {
  instance_id: string;
  mc_version: string;
  loader_type: string;
  loader_version: string;
}

export interface VerifyInstanceRuntimeResult {
  instance_id: string;
  needs_repair: boolean;
  issues: string[];
  repair: MissingRuntime | null;
}

export interface PreLaunchCheckReport {
  passed: boolean;
  repair?: MissingRuntime | null;
  checks?: Array<{
    kind: string;
    status: 'passed' | 'warning' | 'failed' | string;
    message: string;
    details?: string[];
  }>;
}
