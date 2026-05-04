import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'intent.stats.v1';
const SESSION_HISTORY_KEY = 'intent.sessionHistory.v1';
const MAX_SESSION_HISTORY = 50;

export type SessionHistoryStatus = 'success' | 'partial' | 'ended';

export type SessionRecord = {
  id: string;
  date: string;
  durationSeconds: number;
  completedSeconds: number;
  status: SessionHistoryStatus;
  pointsEarned: number;
  penaltyCount: number;
};

export type AchievementId = 'first-detox' | 'one-hour-club' | 'deep-focus' | 'comeback' | 'streak-3';

export type Achievement = {
  id: AchievementId;
  title: string;
  description: string;
  isUnlocked: boolean;
};

export type Stats = {
  totalPoints: number;
  currentStreak: number;
  lastSuccessDate: string | null;
};

const DEFAULT_STATS: Stats = {
  totalPoints: 0,
  currentStreak: 0,
  lastSuccessDate: null,
};

function normalizeStats(value: Partial<Stats> | null): Stats {
  if (!value) {
    return DEFAULT_STATS;
  }

  const totalPoints = typeof value.totalPoints === 'number' ? value.totalPoints : 0;
  const currentStreak = typeof value.currentStreak === 'number' ? value.currentStreak : 0;
  const lastSuccessDate = typeof value.lastSuccessDate === 'string' ? value.lastSuccessDate : null;

  return {
    totalPoints: Number.isFinite(totalPoints) ? totalPoints : 0,
    currentStreak: Number.isFinite(currentStreak) ? currentStreak : 0,
    lastSuccessDate,
  };
}

function normalizeSessionRecord(value: Partial<SessionRecord> | null): SessionRecord | null {
  if (!value) {
    return null;
  }

  const status = value.status === 'success' || value.status === 'partial' || value.status === 'ended'
    ? value.status
    : null;

  if (!status) {
    return null;
  }

  return {
    id: typeof value.id === 'string' ? value.id : `${Date.now()}`,
    date: typeof value.date === 'string' ? value.date : new Date().toISOString(),
    durationSeconds: typeof value.durationSeconds === 'number' && Number.isFinite(value.durationSeconds)
      ? Math.max(0, value.durationSeconds)
      : 0,
    completedSeconds: typeof value.completedSeconds === 'number' && Number.isFinite(value.completedSeconds)
      ? Math.max(0, value.completedSeconds)
      : 0,
    status,
    pointsEarned: typeof value.pointsEarned === 'number' && Number.isFinite(value.pointsEarned)
      ? Math.max(0, value.pointsEarned)
      : 0,
    penaltyCount: typeof value.penaltyCount === 'number' && Number.isFinite(value.penaltyCount)
      ? Math.max(0, value.penaltyCount)
      : 0,
  };
}

function createSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function calculateRewardPoints(durationMinutes: number): number {
  const normalizedDuration = Math.max(0, durationMinutes);
  const basePoints = normalizedDuration * 2;
  const durationBonus =
    normalizedDuration >= 240
      ? 2.5
      : normalizedDuration >= 120
      ? 2
      : normalizedDuration >= 60
      ? 1.5
      : normalizedDuration >= 30
      ? 1.2
      : 1;

  return Math.round(basePoints * durationBonus);
}

export function calculateAchievements(stats: Stats, history: SessionRecord[]): Achievement[] {
  const successfulSessions = history.filter((session) => session.status === 'success');
  const hasFirstDetox = successfulSessions.length > 0;
  const hasOneHourSuccess = successfulSessions.some((session) => session.durationSeconds >= 60 * 60);
  const hasDeepFocusSuccess = successfulSessions.some((session) => session.durationSeconds >= 120 * 60);
  const chronologicalHistory = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const hasComeback = chronologicalHistory.some((session, index) => {
    if (session.status !== 'partial' && session.status !== 'ended') {
      return false;
    }

    return chronologicalHistory[index + 1]?.status === 'success';
  });

  return [
    {
      id: 'first-detox',
      title: 'First Detox',
      description: 'Complete your first successful session.',
      isUnlocked: hasFirstDetox,
    },
    {
      id: 'one-hour-club',
      title: '1 Hour Club',
      description: 'Complete a successful session of 60 minutes or more.',
      isUnlocked: hasOneHourSuccess,
    },
    {
      id: 'deep-focus',
      title: 'Deep Focus',
      description: 'Complete a successful session of 120 minutes or more.',
      isUnlocked: hasDeepFocusSuccess,
    },
    {
      id: 'comeback',
      title: 'Comeback',
      description: 'Succeed after a partial or ended session.',
      isUnlocked: hasComeback,
    },
    {
      id: 'streak-3',
      title: 'Streak 3',
      description: 'Reach a 3 day streak.',
      isUnlocked: stats.currentStreak >= 3,
    },
  ];
}

export async function getStats(): Promise<Stats> {
  try {
    const storedStats = await AsyncStorage.getItem(STORAGE_KEY);

    if (!storedStats) {
      return DEFAULT_STATS;
    }

    return normalizeStats(JSON.parse(storedStats) as Partial<Stats>);
  } catch {
    return DEFAULT_STATS;
  }
}

export async function saveStats(stats: Stats): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeStats(stats)));
  } catch {
    // Keep the session flow usable even if local persistence fails.
  }
}

export async function resetStats(scope: 'all' | 'points' | 'streak' = 'all'): Promise<Stats> {
  const stats = await getStats();
  const nextStats: Stats = {
    totalPoints: scope === 'all' || scope === 'points' ? 0 : stats.totalPoints,
    currentStreak: scope === 'all' || scope === 'streak' ? 0 : stats.currentStreak,
    lastSuccessDate: scope === 'all' || scope === 'streak' ? null : stats.lastSuccessDate,
  };

  await saveStats(nextStats);
  return nextStats;
}

export async function getSessionHistory(): Promise<SessionRecord[]> {
  try {
    const storedHistory = await AsyncStorage.getItem(SESSION_HISTORY_KEY);

    if (!storedHistory) {
      return [];
    }

    const parsedHistory = JSON.parse(storedHistory) as Partial<SessionRecord>[];

    if (!Array.isArray(parsedHistory)) {
      return [];
    }

    return parsedHistory
      .map((record) => normalizeSessionRecord(record))
      .filter((record): record is SessionRecord => Boolean(record))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    return [];
  }
}

export async function saveSessionHistory(history: SessionRecord[]): Promise<void> {
  try {
    const normalizedHistory = history
      .map((record) => normalizeSessionRecord(record))
      .filter((record): record is SessionRecord => Boolean(record))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, MAX_SESSION_HISTORY);

    await AsyncStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(normalizedHistory));
  } catch {
    // History should not block the session flow.
  }
}

export async function resetHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_HISTORY_KEY);
  } catch {
    // Reset actions should not interrupt the settings flow.
  }
}

export async function resetAll(): Promise<void> {
  await Promise.all([resetStats(), resetHistory()]);
}

export async function recordSession(record: Omit<SessionRecord, 'id' | 'date'>): Promise<SessionRecord> {
  const nextRecord: SessionRecord = {
    ...record,
    id: createSessionId(),
    date: new Date().toISOString(),
  };
  const history = await getSessionHistory();

  await saveSessionHistory([nextRecord, ...history]);
  return nextRecord;
}

export async function applySuccess(durationMinutes: number): Promise<Stats> {
  const stats = await getStats();
  const todayKey = getLocalDateKey();
  const hasSuccessToday = stats.lastSuccessDate === todayKey;
  const pointsEarned = calculateRewardPoints(durationMinutes);
  const nextStats: Stats = {
    totalPoints: stats.totalPoints + pointsEarned,
    currentStreak: hasSuccessToday ? stats.currentStreak : stats.currentStreak + 1,
    lastSuccessDate: todayKey,
  };

  await saveStats(nextStats);
  return nextStats;
}

export async function applyPartialReward(pointsEarned: number): Promise<Stats> {
  const stats = await getStats();
  const normalizedPoints = Number.isFinite(pointsEarned) ? Math.max(0, pointsEarned) : 0;
  const nextStats: Stats = {
    totalPoints: stats.totalPoints + normalizedPoints,
    currentStreak: stats.currentStreak,
    lastSuccessDate: stats.lastSuccessDate,
  };

  await saveStats(nextStats);
  return nextStats;
}

export async function applyFailure(): Promise<Stats> {
  const stats = await getStats();
  const nextStats: Stats = {
    totalPoints: stats.totalPoints,
    currentStreak: 0,
    lastSuccessDate: null,
  };

  await saveStats(nextStats);
  return nextStats;
}
