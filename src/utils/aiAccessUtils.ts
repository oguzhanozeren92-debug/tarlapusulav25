import type { AiAccessStatus } from '../types';

export const normalizeAiAccessStatus = (value: any): AiAccessStatus => ({
  plan: String(value?.plan ?? 'free'),
  dailyFreeUsed: Boolean(
    value?.dailyFreeUsed ?? value?.daily_free_used ?? false,
  ),
  freeRemaining: Number(
    value?.freeRemaining ?? value?.free_remaining ?? 0,
  ),
  rewardCredits: Number(
    value?.rewardCredits ?? value?.reward_credits ?? 0,
  ),
  unlimited: Boolean(value?.unlimited ?? false),
});
