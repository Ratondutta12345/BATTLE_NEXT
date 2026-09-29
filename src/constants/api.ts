import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEV_PORT = 3001;

function getConfiguredBaseUrl(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }

  const extraUrl = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (extraUrl?.trim()) {
    return extraUrl.trim().replace(/\/$/, '');
  }

  return undefined;
}

function getExpoHostUri(): string | undefined {
  return (
    Constants.expoGoConfig?.debuggerHost ??
    Constants.expoConfig?.hostUri ??
    Constants.manifest2?.extra?.expoGo?.debuggerHost
  );
}

function getDevHost(): string {
  const configured = getConfiguredBaseUrl();
  const hostUri = getExpoHostUri();

  if (configured) {
    const localUrl = /^(https?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.exec(configured);
    if (Platform.OS === 'android' && localUrl) {
      const expoHostname = hostUri?.split(':')[0];
      const hostname = expoHostname && expoHostname !== 'localhost' && expoHostname !== '127.0.0.1'
        ? expoHostname
        : '10.0.2.2';
      return `${localUrl[1]}${hostname}${localUrl[3] ?? `:${DEV_PORT}`}${localUrl[4] ?? ''}`;
    }
    return configured;
  }

  if (hostUri) {
    const hostname = hostUri.split(':')[0];
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:${DEV_PORT}`;
    }
  }

  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${DEV_PORT}`;
  }

  return `http://localhost:${DEV_PORT}`;
}

export const API_BASE_URL = getDevHost();

export const API_ENDPOINTS = {
  users: `${API_BASE_URL}/api/users`,
  userProfile: (id: number) => `${API_BASE_URL}/api/users/${id}`,
  userAvatar: (id: number) => `${API_BASE_URL}/api/users/${id}/avatar`,
  login: `${API_BASE_URL}/api/auth/login`,
  health: `${API_BASE_URL}/api/health`,
  activeAnnouncements: `${API_BASE_URL}/api/announcements/active`,
  notifications: (userId: number) => `${API_BASE_URL}/api/notifications?userId=${userId}`,
  markNotificationsRead: `${API_BASE_URL}/api/notifications/read-all`,
  registerPushToken: `${API_BASE_URL}/api/notifications/register-device`,
  unregisterPushToken: `${API_BASE_URL}/api/notifications/unregister-device`,
  wallet: (userId: number) => `${API_BASE_URL}/api/wallet/${userId}`,
  walletZapupiCreate: `${API_BASE_URL}/api/wallet/create-zapupi-order`,
  walletZapupiStatus: (orderId: string, userId: number) => `${API_BASE_URL}/api/wallet/check-status?orderId=${encodeURIComponent(orderId)}&userId=${userId}`,
  walletWithdrawStatus: (userId: number) => `${API_BASE_URL}/api/wallet/${userId}/withdraw-status`,
  walletWithdrawRequest: (userId: number) => `${API_BASE_URL}/api/wallet/${userId}/withdraw-requests`,
  walletTransactions: (userId: number) => `${API_BASE_URL}/api/wallet/${userId}/transactions`,
  topPlayers: `${API_BASE_URL}/api/players/top`,
  support: `${API_BASE_URL}/api/settings/support`,
  activeBanners: `${API_BASE_URL}/api/banners/active`,
  myContests: (status: string, userId: number) => `${API_BASE_URL}/api/contests/my/${status}?userId=${userId}`,
  activeGames: `${API_BASE_URL}/api/games/active`,
  game: (id: number) => `${API_BASE_URL}/api/games/${id}`,
  activeMatches: (gameId: number) => `${API_BASE_URL}/api/matches/active?gameId=${gameId}`,
  matchesByStatus: (gameId: number, status: string, userId?: number) => `${API_BASE_URL}/api/matches/by-status?gameId=${gameId}&status=${status}${userId ? `&userId=${userId}` : ''}`,
  match: (id: number, userId?: number) => `${API_BASE_URL}/api/matches/${id}${userId ? `?userId=${userId}` : ''}`,
  joinMatch: (id: number) => `${API_BASE_URL}/api/matches/${id}/join`,
  updateMatchEntry: (id: number) => `${API_BASE_URL}/api/matches/${id}/entry`,
} as const;

export type AuthUser = {
  id: number;
  fullName: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  mobileNo: string;
  avatarUrl?: string | null;
  isBlocked?: boolean;
  matches?: number;
  totalKills?: number;
  coinsWon?: number;
};

export type Announcement = {
  id: number;
  title: string | null;
  message: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Banner = {
  id: number;
  imageUrl: string;
  targetUrl: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Game = {
  id: number;
  name: string;
  imageUrl: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Match = {
  id: number;
  matchId: number;
  gameId: number;
  gameName?: string | null;
  gameVersion: string;
  name: string;
  matchSchedule: string;
  createdAt?: string;
  prizePool: number;
  perKill: number;
  teamType: string;
  entryFee: number;
  totalPlayers: number;
  joinedPlayers: number;
  userEntryCount?: number;
  map: string;
  status: string;
  bannerTitle?: string | null;
  bannerUrl?: string | null;
  matchUrl?: string;
  ruleTitle?: string | null;
  ruleContent?: string | null;
  prizeDescription?: string | null;
  matchDescription?: string | null;
  roomId?: string | null;
  roomPassword?: string | null;
  participants?: Array<{
    id: number;
    userId?: number;
    username?: string | null;
    name?: string | null;
    inGameName?: string | null;
    kills?: number;
    position?: string | null;
    booyahPrize?: number;
    totalPrize?: number;
    prizeAmount?: number;
    result?: string | null;
    status?: string;
    joinedAt?: string;
  }>;
};

export function resolveApiUrl(value: string) {
  return value.startsWith('http') ? value : `${API_BASE_URL}${value}`;
}

export async function apiRequest<T>(
  url: string,
  options: RequestInit = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        error: (data as { error?: string }).error || 'Request failed',
      };
    }

    return { ok: true, data: data as T };
  } catch {
    return {
      ok: false,
      error: `Could not reach the server at ${API_BASE_URL}. Make sure the admin backend is running.`,
    };
  }
}
