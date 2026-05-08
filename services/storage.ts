import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'intent.stats.v1';
const SESSION_HISTORY_KEY = 'intent.sessionHistory.v1';
const INVITE_CODE_KEY = 'intent.inviteCode.v1';
const FRIENDS_KEY = 'intent.friends.v1';
const ACTIVE_SESSION_KEY = 'intent.activeSession.v1';
const SOUND_EFFECTS_KEY = 'intent.soundEffects.v1';
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
  purpose?: string;
  note?: string;
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

export type Friend = {
  id: string;
  inviteCode: string;
  addedAt: string;
  displayName: string;
  currentStreak: number;
  totalPoints: number;
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
    purpose: typeof value.purpose === 'string' && value.purpose.trim().length > 0 ? value.purpose.trim() : undefined,
    note: typeof value.note === 'string' && value.note.trim().length > 0 ? value.note.trim() : undefined,
  };
}

function createSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const suffix = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');

  return `INTENT-${suffix}`;
}

function normalizeInviteCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

function getInviteCodeSeed(inviteCode: string): number {
  return inviteCode.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
}

function createMockFriendStats(inviteCode: string) {
  const seed = getInviteCodeSeed(inviteCode);

  return {
    displayName: `Friend ${inviteCode.slice(-4)}`,
    currentStreak: seed % 8,
    totalPoints: 120 + (seed % 24) * 35,
  };
}

function normalizeFriend(value: Partial<Friend> | null): Friend | null {
  if (!value || typeof value.inviteCode !== 'string') {
    return null;
  }

  const inviteCode = normalizeInviteCode(value.inviteCode);

  if (!inviteCode.startsWith('INTENT-') || inviteCode.length < 10) {
    return null;
  }

  const mockStats = createMockFriendStats(inviteCode);
  const currentStreak = typeof value.currentStreak === 'number' ? value.currentStreak : mockStats.currentStreak;
  const totalPoints = typeof value.totalPoints === 'number' ? value.totalPoints : mockStats.totalPoints;

  return {
    id: typeof value.id === 'string' ? value.id : inviteCode,
    inviteCode,
    addedAt: typeof value.addedAt === 'string' ? value.addedAt : new Date().toISOString(),
    displayName: typeof value.displayName === 'string' ? value.displayName : mockStats.displayName,
    currentStreak: Number.isFinite(currentStreak) ? Math.max(0, currentStreak) : mockStats.currentStreak,
    totalPoints: Number.isFinite(totalPoints) ? Math.max(0, totalPoints) : mockStats.totalPoints,
  };
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


export async function getInviteCode(): Promise<string> {
  try {
    const storedInviteCode = await AsyncStorage.getItem(INVITE_CODE_KEY);

    if (storedInviteCode) {
      return normalizeInviteCode(storedInviteCode);
    }

    const nextInviteCode = createInviteCode();
    await AsyncStorage.setItem(INVITE_CODE_KEY, nextInviteCode);

    return nextInviteCode;
  } catch {
    return createInviteCode();
  }
}

export async function getFriends(): Promise<Friend[]> {
  try {
    const storedFriends = await AsyncStorage.getItem(FRIENDS_KEY);

    if (!storedFriends) {
      return [];
    }

    const parsedFriends = JSON.parse(storedFriends) as Partial<Friend>[];

    if (!Array.isArray(parsedFriends)) {
      return [];
    }

    return parsedFriends
      .map((friend) => normalizeFriend(friend))
      .filter((friend): friend is Friend => Boolean(friend))
      .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  } catch {
    return [];
  }
}

export async function saveFriends(friends: Friend[]): Promise<void> {
  try {
    const normalizedFriends = friends
      .map((friend) => normalizeFriend(friend))
      .filter((friend): friend is Friend => Boolean(friend));

    await AsyncStorage.setItem(FRIENDS_KEY, JSON.stringify(normalizedFriends));
  } catch {
    // Friend invites are local-only and should not block the account screen.
  }
}

export async function addFriendByCode(inviteCode: string): Promise<Friend | null> {
  const normalizedCode = normalizeInviteCode(inviteCode);

  if (!normalizedCode.startsWith('INTENT-') || normalizedCode.length < 10) {
    return null;
  }

  const [ownInviteCode, friends] = await Promise.all([getInviteCode(), getFriends()]);

  if (normalizedCode === ownInviteCode || friends.some((friend) => friend.inviteCode === normalizedCode)) {
    return null;
  }

  const mockStats = createMockFriendStats(normalizedCode);
  const nextFriend: Friend = {
    id: `${Date.now()}-${normalizedCode}`,
    inviteCode: normalizedCode,
    addedAt: new Date().toISOString(),
    ...mockStats,
  };

  await saveFriends([nextFriend, ...friends]);
  return nextFriend;
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

export async function resetFriends(): Promise<void> {
  try {
    await AsyncStorage.removeItem(FRIENDS_KEY);
    await AsyncStorage.removeItem(INVITE_CODE_KEY);
  } catch {
    // Social prototype data should not block reset actions.
  }
}

export async function getSoundEffectsEnabled(): Promise<boolean> {
  try {
    const storedPreference = await AsyncStorage.getItem(SOUND_EFFECTS_KEY);

    return storedPreference === null ? true : storedPreference === 'true';
  } catch {
    return true;
  }
}

export async function saveSoundEffectsEnabled(isEnabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(SOUND_EFFECTS_KEY, String(isEnabled));
  } catch {
    // Sound preference should not block settings interactions.
  }
}

export async function resetAll(): Promise<void> {
  await Promise.all([
    resetStats(),
    resetHistory(),
    resetFriends(),
    AsyncStorage.removeItem(ACTIVE_SESSION_KEY),
    AsyncStorage.removeItem(SOUND_EFFECTS_KEY),
  ]);
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

export async function applyPartialRewardAndFailure(pointsEarned: number): Promise<Stats> {
  const stats = await getStats();
  const normalizedPoints = Number.isFinite(pointsEarned) ? Math.max(0, pointsEarned) : 0;
  const nextStats: Stats = {
    totalPoints: stats.totalPoints + normalizedPoints,
    currentStreak: 0,
    lastSuccessDate: null,
  };

  await saveStats(nextStats);
  return nextStats;
}














