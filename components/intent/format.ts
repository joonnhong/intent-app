import type { SessionRecord } from '../../services/storage';

export function formatTargetTime(durationMinutes: number) {
  const now = new Date();
  const targetDate = new Date(now.getTime() + durationMinutes * 60 * 1000);
  const timeLabel = targetDate.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  const isSameDate =
    targetDate.getFullYear() === now.getFullYear() &&
    targetDate.getMonth() === now.getMonth() &&
    targetDate.getDate() === now.getDate();

  if (isSameDate) {
    return timeLabel;
  }

  return `Tomorrow, ${timeLabel}`;
}

export function formatDuration(durationMinutes: number) {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m remaining`;
  }

  if (hours > 0) {
    return `${hours}h remaining`;
  }

  return `${minutes}m remaining`;
}

export function formatPlainDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.round((safeSeconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return '0m';
}

export function formatSessionStatus(status: SessionRecord['status']) {
  if (status === 'success') {
    return 'Completed';
  }

  if (status === 'partial') {
    return 'Ended early';
  }

  return 'Too many penalties';
}
export function formatSessionDate(date: string) {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Saved session';
  }

  return parsedDate.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}



