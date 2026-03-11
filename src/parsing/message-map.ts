import type { EventStage, ToolFlowName } from "../domain/types.js";

export interface MessagePattern {
  pattern: RegExp;
  toolFlow: ToolFlowName;
  stage: EventStage;
}

export const messagePatterns: MessagePattern[] = [
  {
    pattern: /image generation requested/i,
    toolFlow: "image_asset_generate",
    stage: "request",
  },
  {
    pattern: /variation requested/i,
    toolFlow: "image_variation_generate",
    stage: "request",
  },
  {
    pattern: /variation generation started/i,
    toolFlow: "image_variation_generate",
    stage: "provider_request",
  },
  {
    pattern: /fal generation started/i,
    toolFlow: "unknown",
    stage: "provider_request",
  },
  {
    pattern: /google image generation completed; starting post-processing/i,
    toolFlow: "image_asset_generate",
    stage: "post_processing",
  },
  {
    pattern: /asset post-processing completed/i,
    toolFlow: "image_asset_generate",
    stage: "completed",
  },
  {
    pattern: /google variation completed; starting post-processing/i,
    toolFlow: "image_variation_generate",
    stage: "post_processing",
  },
  {
    pattern: /variation post-processing completed/i,
    toolFlow: "image_variation_generate",
    stage: "completed",
  },
  {
    pattern: /spritesheet generation requested/i,
    toolFlow: "spritesheet_generate",
    stage: "request",
  },
  {
    pattern: /spritesheet variation requested/i,
    toolFlow: "spritesheet_variation_generate",
    stage: "request",
  },
  {
    pattern: /spritesheet variation completed/i,
    toolFlow: "spritesheet_variation_generate",
    stage: "completed",
  },
  {
    pattern: /spritesheet generation completed/i,
    toolFlow: "spritesheet_generate",
    stage: "completed",
  },
  {
    pattern: /provider request started/i,
    toolFlow: "unknown",
    stage: "provider_request",
  },
  {
    pattern: /provider request completed/i,
    toolFlow: "unknown",
    stage: "provider_request",
  },
  {
    pattern: /provider request failed/i,
    toolFlow: "unknown",
    stage: "failed",
  },
  {
    pattern: /spritesheet analysis completed/i,
    toolFlow: "spritesheet_generate",
    stage: "analysis",
  },
  {
    pattern: /background removal completed/i,
    toolFlow: "unknown",
    stage: "background_removal",
  },
  {
    pattern: /spritesheet upload completed/i,
    toolFlow: "unknown",
    stage: "upload",
  },
  {
    pattern: /fal queue accepted/i,
    toolFlow: "unknown",
    stage: "queue_submit",
  },
  {
    pattern: /fal queue completed/i,
    toolFlow: "unknown",
    stage: "queue_wait",
  },
  {
    pattern: /fal queue timed out in in_queue/i,
    toolFlow: "unknown",
    stage: "queue_wait",
  },
  {
    pattern: /fal queue still running; handing off to status polling/i,
    toolFlow: "unknown",
    stage: "queue_wait",
  },
  {
    pattern: /primary model failed; starting fallback/i,
    toolFlow: "unknown",
    stage: "provider_request",
  },
  {
    pattern: /status tool called/i,
    toolFlow: "unknown",
    stage: "status_poll",
  },
  {
    pattern: /status tool completed/i,
    toolFlow: "unknown",
    stage: "status_poll",
  },
  {
    pattern: /status tool failed/i,
    toolFlow: "unknown",
    stage: "failed",
  },
  {
    pattern: /result tool called/i,
    toolFlow: "unknown",
    stage: "result_fetch",
  },
  {
    pattern: /result tool completed/i,
    toolFlow: "unknown",
    stage: "completed",
  },
  {
    pattern: /result tool failed/i,
    toolFlow: "unknown",
    stage: "failed",
  },
];
