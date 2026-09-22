import { supabase } from '../../../supabaseClient';

export type HomeProfileSummary = {
  profileName: string;
  points: number | null;
};

export async function fetchHomeProfileSummary(): Promise<HomeProfileSummary | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const fallback = String(
    user.user_metadata?.username ?? user.email?.split('@')[0] ?? 'Çiftçi',
  ).trim();

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  const profileName =
    typeof data?.username === 'string' && data.username.trim()
      ? data.username.trim()
      : fallback || 'Çiftçi';

  const possiblePoints = [
    data?.points,
    data?.total_points,
    data?.score,
    data?.gamification_points,
  ].find((value) => Number.isFinite(Number(value)));

  return {
    profileName,
    points:
      possiblePoints === undefined ? null : Number(possiblePoints),
  };
}
