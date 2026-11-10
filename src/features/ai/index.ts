export { useGenerateAiHint, useGenerateAiProgramDraft } from './api/hooks';
export { aiHandlers } from './api/mocks';
export { getAiMode, type AiMode } from './lib/mode';
export { sanitizeAiInput } from './lib/sanitizeInput';
export { hintFromViolation } from './model/hints';
export { planFromUtterance } from './model/planner';
export type {
  AiFallbackReason,
  AiHint,
  AiHintRequest,
  AiProgramDraft,
  AiSource,
  AiStep,
} from './model/types';
export { AI_STEP_MAX_BLOCKS, validateAiSteps } from './model/validate';
