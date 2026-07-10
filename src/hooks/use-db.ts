import { useQuery, useMutation } from "@tanstack/react-query";
import * as db from "@/lib/db";
import { useAuth } from "@/hooks/use-auth";
import type { Collaborator, Mission } from "@/lib/types";

export type { User, Collaborator, Mission, MyMission, RankingEntry, AlbumStats, RecentActivity, PendingMission, CategorySetting, IncomingChallenge } from "@/lib/types";

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
export const getListCategorySettingsQueryKey = () => ["categorySettings"] as const;

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

export function useGetMyCardGiftInfo() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["myCardGiftInfo"],
    queryFn: () => (user ? db.getMyCardGiftInfo(user.id) : {}),
    enabled: !!user,
  });
}

export function useDonateDuplicateCard() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ collaboratorId, targetUserId }: { collaboratorId: string; targetUserId: string }) => {
      if (!user) throw new Error("Not authenticated");
      return db.donateDuplicateCard(user.id, collaboratorId, targetUserId);
    },
  });
}

export function useGetAppSettings() {
  return useQuery({
    queryKey: ["appSettings"],
    queryFn: db.getAppSettings,
  });
}

export function useUpdateAppSettings() {
  return useMutation({
    mutationFn: (data: { duplicateDonationPoints: number }) => db.updateAppSettings(data),
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

// ─── Category Settings ────────────────────────────────────────────────────────

export function useListCategorySettings() {
  return useQuery({
    queryKey: getListCategorySettingsQueryKey(),
    queryFn: db.listCategorySettings,
  });
}

export function useSetCategoryLocked() {
  return useMutation({
    mutationFn: ({ name, locked }: { name: string; locked: boolean }) =>
      db.setCategoryLocked(name, locked),
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

export function useStartPeerInteractionMission() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ missionId, targetUserId }: { missionId: string; targetUserId: string }) => {
      if (!user) throw new Error("Not authenticated");
      return db.startPeerInteractionMission(user.id, missionId, targetUserId);
    },
  });
}

export function useStartQuestionMission() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({
      missionId,
      targetUserId,
      question,
      answer,
    }: {
      missionId: string;
      targetUserId: string;
      question: string;
      answer: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      return db.startQuestionMission(user.id, missionId, targetUserId, question, answer);
    },
  });
}

export function useGetIncomingChallenges() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["incomingChallenges"],
    queryFn: () => (user ? db.getIncomingChallenges(user.id) : []),
    enabled: !!user,
  });
}

export function useAnswerChallenge() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ userMissionId, answer }: { userMissionId: string; answer: string }) => {
      if (!user) throw new Error("Not authenticated");
      return db.answerChallenge(userMissionId, user.id, answer);
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

export function useDeleteUser() {
  return useMutation({
    mutationFn: ({ id }: { id: string }) => db.deleteUser(id),
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

export function useRepairMissingPeerGifts() {
  return useMutation({
    mutationFn: () => db.repairMissingPeerGifts(),
  });
}
