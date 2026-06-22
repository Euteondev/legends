import { useQuery, useMutation } from "@tanstack/react-query";
import * as db from "@/lib/db";
import { useAuth } from "@/hooks/use-auth";
import type { Collaborator, Mission } from "@/lib/types";

export type { User, Collaborator, Mission, MyMission, RankingEntry, AlbumStats, RecentActivity, PendingMission } from "@/lib/types";

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const getGetMyCardsQueryKey = () => ["myCards"] as const;
export const getGetAlbumStatsQueryKey = () => ["albumStats"] as const;
export const getGetRecentActivityQueryKey = () => ["recentActivity"] as const;
export const getGetMyMissionsQueryKey = () => ["myMissions"] as const;
export const getListCollaboratorsQueryKey = () => ["collaborators"] as const;
export const getListMissionsQueryKey = () => ["missions"] as const;
export const getListUsersQueryKey = () => ["users"] as const;
export const getListPendingMissionsQueryKey = () => ["pendingMissions"] as const;
export const getGetRankingsQueryKey = () => ["rankings"] as const;
export const getGetMeQueryKey = () => ["me"] as const;

// ─── Auth ─────────────────────────────────────────────────────────────────────

export function useRegisterUser() {
  return useMutation({
    mutationFn: ({ data }: { data: { name: string; email: string } }) =>
      db.registerUser(data.name, data.email),
  });
}

// ─── Me ──────────────────────────────────────────────────────────────────────

export function useGetMe() {
  const { user } = useAuth();
  return useQuery({
    queryKey: getGetMeQueryKey(),
    queryFn: () => (user ? db.getMe(user.id) : null),
    enabled: !!user,
  });
}

// ─── Cards ────────────────────────────────────────────────────────────────────

export function useGetMyCards() {
  const { user } = useAuth();
  return useQuery({
    queryKey: getGetMyCardsQueryKey(),
    queryFn: () => (user ? db.getMyCards(user.id) : []),
    enabled: !!user,
  });
}

export function useUnlockCard() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ collaboratorId }: { collaboratorId: string }) => {
      if (!user) throw new Error("Not authenticated");
      return db.unlockCard(user.id, collaboratorId);
    },
  });
}

export function useChallengeCard() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({
      collaboratorId,
      data,
    }: {
      collaboratorId: string;
      data: { answer: string };
    }) => {
      if (!user) throw new Error("Not authenticated");
      return db.challengeCard(user.id, collaboratorId, data.answer);
    },
  });
}

// ─── Collaborators ────────────────────────────────────────────────────────────

export function useListCollaborators() {
  return useQuery({
    queryKey: getListCollaboratorsQueryKey(),
    queryFn: db.listCollaborators,
  });
}

export function useCreateCollaborator() {
  return useMutation({
    mutationFn: ({ data }: { data: Omit<Collaborator, "id"> }) =>
      db.createCollaborator(data),
  });
}

export function useUpdateCollaborator() {
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Omit<Collaborator, "id">>;
    }) => db.updateCollaborator(id, data),
  });
}

export function useDeleteCollaborator() {
  return useMutation({
    mutationFn: ({ id }: { id: string }) => db.deleteCollaborator(id),
  });
}

// ─── Missions ─────────────────────────────────────────────────────────────────

export function useListMissions() {
  return useQuery({
    queryKey: getListMissionsQueryKey(),
    queryFn: db.listMissions,
  });
}

export function useCreateMission() {
  return useMutation({
    mutationFn: ({ data }: { data: Omit<Mission, "id"> }) =>
      db.createMission(data),
  });
}

export function useUpdateMission() {
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Omit<Mission, "id">>;
    }) => db.updateMission(id, data),
  });
}

export function useDeleteMission() {
  return useMutation({
    mutationFn: ({ id }: { id: string }) => db.deleteMission(id),
  });
}

// ─── User Missions ────────────────────────────────────────────────────────────

export function useGetMyMissions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: getGetMyMissionsQueryKey(),
    queryFn: () => (user ? db.getMyMissions(user.id) : []),
    enabled: !!user,
  });
}

export function useStartMission() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ missionId }: { missionId: string }) => {
      if (!user) throw new Error("Not authenticated");
      return db.startMission(user.id, missionId);
    },
  });
}

export function useCompleteMission() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ missionId }: { missionId: string }) => {
      if (!user) throw new Error("Not authenticated");
      return db.completeMission(user.id, missionId);
    },
  });
}

export function useSubmitMissionProof() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({
      missionId,
      data,
    }: {
      missionId: string;
      data: { proofText: string };
    }) => {
      if (!user) throw new Error("Not authenticated");
      return db.submitMissionProof(user.id, missionId, data.proofText);
    },
  });
}

// ─── Rankings ─────────────────────────────────────────────────────────────────

export function useGetRankings() {
  return useQuery({
    queryKey: getGetRankingsQueryKey(),
    queryFn: db.getRankings,
  });
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function useGetAlbumStats() {
  return useQuery({
    queryKey: getGetAlbumStatsQueryKey(),
    queryFn: db.getAlbumStats,
  });
}

// ─── Recent Activity ──────────────────────────────────────────────────────────

export function useGetRecentActivity() {
  return useQuery({
    queryKey: getGetRecentActivityQueryKey(),
    queryFn: db.getRecentActivity,
  });
}

// ─── Featured Collaborators ───────────────────────────────────────────────────

export function useGetFeaturedCollaborators() {
  return useQuery({
    queryKey: ["featuredCollaborators"],
    queryFn: db.getFeaturedCollaborators,
  });
}

// ─── Admin: Users ─────────────────────────────────────────────────────────────

export function useListUsers() {
  return useQuery({
    queryKey: getListUsersQueryKey(),
    queryFn: db.listUsers,
  });
}

// ─── Admin: Pending Missions ──────────────────────────────────────────────────

export function useListPendingMissions() {
  return useQuery({
    queryKey: getListPendingMissionsQueryKey(),
    queryFn: db.listPendingMissions,
  });
}

export function useApproveMission() {
  return useMutation({
    mutationFn: ({ userMissionId }: { userMissionId: string }) =>
      db.approveMission(userMissionId),
  });
}

export function useRejectMission() {
  return useMutation({
    mutationFn: ({
      userMissionId,
      data,
    }: {
      userMissionId: string;
      data: { note: string };
    }) => db.rejectMission(userMissionId, data.note),
  });
}
