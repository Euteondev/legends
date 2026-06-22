export interface User {
  id: string;
  name: string;
  email: string;
  photo: string | null;
  points: number;
  progress: number;
  isAdmin: boolean;
  createdAt: string;
  loginDays?: string[];
}

export interface Collaborator {
  id: string;
  name: string;
  role: string;
  position: string | null;
  area: string;
  management: string;
  email: string | null;
  photoUrl: string | null;
  yearsAtVale: number | null;
  superPower: string | null;
  curiosity: string | null;
  achievement: string | null;
  challengeQuestion: string | null;
  challengeAnswer: string | null;
  rarity: "comum" | "rara" | "epica" | "lendaria";
  category: string;
  points: number;
  isSpecial: boolean;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  goal: number;
  rewardPoints: number;
  missionType: string;
  type: "auto" | "peer" | "evidence";
  requiresApproval: boolean;
  status?: "open" | "closed";
}

export interface MyMission {
  missionId: string;
  title: string;
  description: string;
  goal: number;
  progress: number;
  rewardPoints: number;
  missionType: string;
  type: "auto" | "peer" | "evidence";
  requiresApproval: boolean;
  started: boolean;
  completed: boolean;
  submissionStatus: "in_progress" | "pending_review" | "rejected";
  reviewNote: string | null;
}

export interface RankingEntry {
  rank: number;
  userId: string;
  name: string;
  photo: string | null;
  points: number;
  unlockedCount: number;
  progress: number;
}

export interface AlbumStats {
  total: number;
  totalUsers: number;
  totalUnlocks: number;
  byRarity: Record<string, number>;
  byCategory: Record<string, number>;
}

export interface RecentActivity {
  userId: string;
  collaboratorId: string;
  unlockedAt: string;
  userName: string;
  userPhoto: string | null;
  collaboratorName: string;
  collaboratorPhoto: string | null;
  rarity: string;
  type?: "card" | "rarity_upgrade";
  newRarity?: string;
}

export interface PendingMission {
  userMissionId: string;
  userId: string;
  userName: string;
  userPhoto: string | null;
  missionId: string;
  missionTitle: string;
  proofText: string | null;
  submittedAt: string | null;
}
