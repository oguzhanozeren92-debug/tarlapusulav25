export type CostActivity = { id: string; type: string; activityDate: string; cost: number | null };

export function buildFieldCostSummary(activities: CostActivity[], areaDecares: number | null | undefined, year: number | null, today: string) {
  const unique = [...new Map(activities.map((item) => [item.id, item])).values()];
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const undated = unique.filter((item) => !validDate(item.activityDate)).length;
  const future = unique.filter((item) => validDate(item.activityDate) && item.activityDate > today).length;
  const selected = unique.filter((item) => validDate(item.activityDate) && item.activityDate <= today &&
    (year === null || Number(item.activityDate.slice(0, 4)) === year));
  const recorded = selected.filter((item) => item.cost !== null && typeof item.cost === 'number' && Number.isFinite(item.cost) && item.cost >= 0);
  const groups = new Map<string, { type: string; cents: number; count: number }>();
  for (const item of recorded) {
    const type = item.type || 'Diğer';
    const group = groups.get(type) ?? { type, cents: 0, count: 0 };
    group.cents += Math.round(item.cost! * 100);
    group.count++;
    groups.set(type, group);
  }
  const totalCents = [...groups.values()].reduce((sum, group) => sum + group.cents, 0);
  return {
    total: totalCents / 100, recordedCount: recorded.length, activityCount: selected.length,
    missingCount: selected.length - recorded.length, undatedCount: undated, futureCount: future,
    perDecare: typeof areaDecares === 'number' && Number.isFinite(areaDecares) && areaDecares > 0 ? totalCents / 100 / areaDecares : null,
    groups: [...groups.values()].sort((a, b) => b.cents - a.cents).map((group) => ({ type: group.type, total: group.cents / 100, count: group.count })),
  };
}
