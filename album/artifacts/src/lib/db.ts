import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  setDoc,
  Timestamp,
  DocumentData,
  QueryDocumentSnapshot,
  increment,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  User,
  Collaborator,
  Mission,
  MyMission,
  RankingEntry,
  AlbumStats,
  RecentActivity,
  PendingMission,
  CategorySetting,
  IncomingChallenge,
} from "./types";

import { behaviorOptions } from "@/lib/constants";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toUser(id: string, data: DocumentData): User {
  return {
    id,
    name: data.name ?? "",
    email: data.email ?? "",
    photo: data.photo ?? null,
    points: data.points ?? 0,
    progress: data.progress ?? 0,
    isAdmin: data.isAdmin ?? false,
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toDate().toISOString()
      : (data.createdAt ?? new Date().toISOString()),
    loginDays: data.loginDays ?? [],
  };
}

function toCollaborator(id: string, data: DocumentData): Collaborator {
   const validBehaviors = new Set(behaviorOptions);
  return {
    id,
    name: data.name ?? "",
    role: data.role ?? "",
    area: data.area ?? "",
    management: data.management ?? "",
    email: data.email ?? null,
    position: data.position ?? null,
    photoUrl: data.photoUrl ?? null,
    backgroundUrl: data.backgroundUrl ?? null,
    yearsAtVale: data.yearsAtVale ?? null,
    keyBehavior: validBehaviors.has(data.keyBehavior)
      ? data.keyBehavior
      : null,
    superPower: data.superPower ?? null,
    curiosity: data.curiosity ?? null,
    achievement: data.achievement ?? null,
    challengeQuestion: data.challengeQuestion ?? null,
    challengeAnswer: data.challengeAnswer ?? null,
    rarity: data.rarity ?? "comum",
    category: data.category ?? "",
    points: data.points ?? 10,
    isSpecial: data.isSpecial ?? false,
    hideCardName: data.hideCardName ?? false,
  };
}

function toMission(id: string, data: DocumentData): Mission {
  return {
    id,
    title: data.title ?? "",
    description: data.description ?? "",
    goal: data.goal ?? 1,
    rewardPoints: data.rewardPoints ?? 50,
    missionType: data.missionType ?? "unlock_cards",
    type: data.type ?? "auto",
    requiresApproval: data.requiresApproval ?? false,
    status: data.status ?? "open",
    rewardMode: data.rewardMode ?? "random",
    specificCardId: data.specificCardId ?? null,
    challengerRewardPoints: data.challengerRewardPoints ?? undefined,
    challengerRewardMode: data.challengerRewardMode ?? undefined,
    challengerSpecificCardId: data.challengerSpecificCardId ?? null,
    challengedRewardPoints: data.challengedRewardPoints ?? undefined,
    challengedRewardMode: data.challengedRewardMode ?? undefined,
    challengedSpecificCardId: data.challengedSpecificCardId ?? null,
  };
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getUserCards(userId: string): Promise<string[]> {
  const snap = await getDocs(
    query(collection(db, "userCards"), where("userId", "==", userId))
  );
  return snap.docs.map((d) => d.data().collaboratorId as string);
}

async function getAllCollaborators(): Promise<Collaborator[]> {
  const snap = await getDocs(collection(db, "collaborators"));
  return snap.docs.map((d) => toCollaborator(d.id, d.data()));
}

async function recalcAndSaveProgress(
  userId: string,
  userCards: string[],
  allCollabs: Collaborator[]
): Promise<number> {
  const total = allCollabs.length;
  const progress = total > 0 ? (userCards.length / total) * 100 : 0;
  await updateDoc(doc(db, "users", userId), { progress });
  return progress;
}

async function checkAndUpgradeCollaboratorRarity(userId: string, progress: number): Promise<void> {
  const RARITY_ORDER: Record<string, number> = { comum: 0, rara: 1, epica: 2, lendaria: 3 };
  const RARITY_NAMES = ["comum", "rara", "epica", "lendaria"] as const;

  let targetLevel = 0;
  if (progress >= 100) targetLevel = 3;
  else if (progress >= 75) targetLevel = 2;
  else if (progress >= 50) targetLevel = 1;
  if (targetLevel === 0) return;

  const userSnap = await getDoc(doc(db, "users", userId));
  if (!userSnap.exists()) return;
  const userEmail = (userSnap.data().email as string | undefined)?.toLowerCase();
  if (!userEmail) return;

  const collabSnap = await getDocs(
    query(collection(db, "collaborators"), where("email", "==", userEmail))
  );
  if (collabSnap.empty) return;

  const collabDoc = collabSnap.docs[0]!;
  const currentRarity = (collabDoc.data().rarity as string) ?? "comum";
  const currentLevel = RARITY_ORDER[currentRarity] ?? 0;
  if (targetLevel <= currentLevel) return;

  const newRarity = RARITY_NAMES[targetLevel]!;
  await updateDoc(collabDoc.ref, { rarity: newRarity });

  const ud = userSnap.data();
  await addDoc(collection(db, "rarityEvents"), {
    userId,
    collaboratorId: collabDoc.id,
    oldRarity: currentRarity,
    newRarity,
    upgradedAt: serverTimestamp(),
    userName: ud.name ?? "",
    userPhoto: ud.photo ?? null,
    collaboratorName: collabDoc.data().name ?? "",
    collaboratorPhoto: collabDoc.data().photoUrl ?? null,
  });
}

async function awardRandomCard(
  userId: string,
  userCards: string[],
  allCollabs: Collaborator[]
): Promise<Collaborator | null> {
  const userCardSet = new Set(userCards);
  const available = allCollabs.filter((c) => !userCardSet.has(c.id));
  if (available.length === 0) return null;

  const weights: Record<string, number> = {
    comum: 60,
    rara: 25,
    epica: 12,
    lendaria: 3,
  };
  const pool: Collaborator[] = [];
  for (const c of available) {
    const w = weights[c.rarity] ?? 30;
    for (let i = 0; i < w; i++) pool.push(c);
  }
  const winner = pool[Math.floor(Math.random() * pool.length)] ?? available[0]!;
  return winner;
}

async function resolveMissionReward(
  userId: string,
  userCards: string[],
  allCollabs: Collaborator[],
  mission: Mission,
  allowDuplicate = false
): Promise<{ rewardCard: Collaborator | null; bonusPoints: number }> {
  const rewardMode = mission.rewardMode ?? "random";

  if (rewardMode === "points_only") {
    return { rewardCard: null, bonusPoints: mission.rewardPoints };
  }

  if (rewardMode === "specific" && mission.specificCardId) {
    const userCardSet = new Set(userCards);
    if (!allowDuplicate && userCardSet.has(mission.specificCardId)) {
      return { rewardCard: null, bonusPoints: mission.rewardPoints };
    }
    const specificCard = allCollabs.find((c) => c.id === mission.specificCardId);
    if (specificCard) {
      return { rewardCard: specificCard, bonusPoints: 0 };
    }
    return { rewardCard: null, bonusPoints: mission.rewardPoints };
  }

  const rewardCard = await awardRandomCard(userId, userCards, allCollabs);
  return { rewardCard, bonusPoints: rewardCard ? 0 : mission.rewardPoints };
}

async function resolveMissionRewardCustom(
  userId: string,
  userCards: string[],
  allCollabs: Collaborator[],
  rewardPoints: number,
  rewardMode: "random" | "specific" | "points_only",
  specificCardId: string | null | undefined,
  allowDuplicate = false
): Promise<{ rewardCard: Collaborator | null; bonusPoints: number }> {
  if (rewardMode === "points_only") {
    return { rewardCard: null, bonusPoints: rewardPoints };
  }
  if (rewardMode === "specific" && specificCardId) {
    const userCardSet = new Set(userCards);
    if (!allowDuplicate && userCardSet.has(specificCardId)) {
      return { rewardCard: null, bonusPoints: rewardPoints };
    }
    const specificCard = allCollabs.find((c) => c.id === specificCardId);
    if (specificCard) return { rewardCard: specificCard, bonusPoints: 0 };
    return { rewardCard: null, bonusPoints: rewardPoints };
  }
  const rewardCard = await awardRandomCard(userId, userCards, allCollabs);
  return { rewardCard, bonusPoints: rewardCard ? 0 : rewardPoints };
}

async function addCardToUser(
  userId: string,
  collaboratorId: string,
  source: string
): Promise<void> {
  await addDoc(collection(db, "userCards"), {
    userId,
    collaboratorId,
    unlockedAt: serverTimestamp(),
    unlockedBy: source,
  });
}

async function tickAutoMissions(
  userId: string,
  userCards: string[],
  allCollabs: Collaborator[],
  loginDays: string[]
): Promise<void> {
  const umSnap = await getDocs(
    query(
      collection(db, "userMissions"),
      where("userId", "==", userId),
      where("started", "==", true),
      where("completed", "==", false)
    )
  );
  if (umSnap.empty) return;

  const missionsToCheck = umSnap.docs.filter((d) => {
    const data = d.data();
    return (
      data.submissionStatus === "in_progress" || data.missionType === "album_percent"
    );
  });
  if (missionsToCheck.length === 0) return;

  const missionIds = [...new Set(missionsToCheck.map((d) => d.data().missionId as string))];

  const missionDocs = await Promise.all(
    missionIds.map((id) => getDoc(doc(db, "missions", id)))
  );
  const missionMap = new Map<string, Mission>();
  for (const md of missionDocs) {
    if (md.exists()) missionMap.set(md.id, toMission(md.id, md.data()!));
  }

  const total = allCollabs.length;
  const albumPercent = total > 0 ? Math.round((userCards.length / total) * 100) : 0;
  const userCardSet = new Set(userCards);

  const needsOwnCategory = missionsToCheck.some((umDoc) => {
    const m = missionMap.get(umDoc.data().missionId as string);
    return m?.missionType === "unlock_other_category";
  });
  let ownCategory: string | null = null;
  if (needsOwnCategory) {
    const userSnap = await getDoc(doc(db, "users", userId));
    const userEmail = (userSnap.data()?.email as string | undefined)?.toLowerCase();
    if (userEmail) {
      const ownCollab = allCollabs.find((c) => c.email?.toLowerCase() === userEmail);
      ownCategory = ownCollab?.category ?? null;
    }
  }

  const batch = writeBatch(db);
  for (const umDoc of missionsToCheck) {
    const um = umDoc.data();
    const mission = missionMap.get(um.missionId);
    if (!mission) continue;

    let progress = 0;
    switch (mission.missionType) {
      case "unlock_cards":
        progress = userCards.length;
        break;
      case "unlock_category": {
        const cats = new Set(allCollabs.map((c) => c.category));
        const catArr = [...cats].sort();
        const targetCat = catArr[0] ?? "";
        progress = allCollabs.filter(
          (c) => c.category === targetCat && userCardSet.has(c.id)
        ).length;
        break;
      }
      case "unlock_rarity": {
        const targetRarity = um.targetRarity ?? "rara";
        progress = allCollabs.filter(
          (c) => c.rarity === targetRarity && userCardSet.has(c.id)
        ).length;
        break;
      }
      case "login":
        progress = loginDays.length;
        break;
      case "album_percent":
        progress = albumPercent;
        break;
      case "unlock_other_category":
        progress = ownCategory
          ? allCollabs.filter((c) => c.category !== ownCategory && userCardSet.has(c.id)).length
          : allCollabs.filter((c) => userCardSet.has(c.id)).length;
        break;
    }
    batch.update(umDoc.ref, { progress });
  }
  await batch.commit();
}

async function ensureAlbumPercentMissionsStarted(userId: string): Promise<void> {
  const missionsSnap = await getDocs(
    query(
      collection(db, "missions"),
      where("missionType", "==", "album_percent"),
      where("status", "==", "open")
    )
  );
  if (missionsSnap.empty) return;

  for (const mDoc of missionsSnap.docs) {
    const existingSnap = await getDocs(
      query(
        collection(db, "userMissions"),
        where("userId", "==", userId),
        where("missionId", "==", mDoc.id)
      )
    );
    if (existingSnap.empty) {
      await addDoc(collection(db, "userMissions"), {
        userId,
        missionId: mDoc.id,
        started: true,
        completed: false,
        progress: 0,
        submissionStatus: "in_progress",
        reviewNote: null,
        proofText: null,
        submittedAt: null,
        completedAt: null,
        createdAt: serverTimestamp(),
      });
    } else {
      const umDoc = existingSnap.docs[0]!;
      if (!umDoc.data().started) {
        await updateDoc(umDoc.ref, { started: true });
      }
    }
  }
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function registerUser(name: string, email: string): Promise<User> {
  const emailLower = email.toLowerCase().trim();
  const today = todayUTC();

  const existingSnap = await getDocs(
    query(collection(db, "users"), where("email", "==", emailLower))
  );

  if (!existingSnap.empty) {
    const userDoc = existingSnap.docs[0]!;
    const data = userDoc.data();
    const loginDays: string[] = data.loginDays ?? [];
    const updates: Record<string, unknown> = {};

    if (!loginDays.includes(today)) {
      updates.loginDays = [...loginDays, today];
    }

    if (Object.keys(updates).length > 0) {
      await updateDoc(userDoc.ref, updates);
    }

    const updatedUser = toUser(userDoc.id, { ...data, ...updates });

    const userCards = await getUserCards(userDoc.id);
    const allCollabs = await getAllCollaborators();
    await tickAutoMissions(
      userDoc.id,
      userCards,
      allCollabs,
      updatedUser.loginDays ?? []
    );
    await ensureAlbumPercentMissionsStarted(userDoc.id);

    return updatedUser;
  }

  const newUserRef = await addDoc(collection(db, "users"), {
    name: name.trim(),
    email: emailLower,
    photo: null,
    points: 0,
    progress: 0,
    isAdmin: false,
    loginDays: [today],
    createdAt: serverTimestamp(),
  });

  await ensureAlbumPercentMissionsStarted(newUserRef.id);

  const newDoc = await getDoc(newUserRef);
  return toUser(newUserRef.id, newDoc.data()!);
}

export async function getMe(userId: string): Promise<User | null> {
  const snap = await getDoc(doc(db, "users", userId));
  if (!snap.exists()) return null;
  return toUser(snap.id, snap.data());
}

// ─── Cards ────────────────────────────────────────────────────────────────────

export async function getMyCards(userId: string): Promise<string[]> {
  return getUserCards(userId);
}

export async function unlockCard(userId: string, collaboratorId: string): Promise<void> {
  const existing = await getDocs(
    query(
      collection(db, "userCards"),
      where("userId", "==", userId),
      where("collaboratorId", "==", collaboratorId)
    )
  );
  if (!existing.empty) return;

  const collabDoc = await getDoc(doc(db, "collaborators", collaboratorId));
  if (!collabDoc.exists()) throw new Error("Collaborator not found");
  const collab = toCollaborator(collabDoc.id, collabDoc.data());

  await addCardToUser(userId, collaboratorId, "admin");
  await updateDoc(doc(db, "users", userId), {
    points: (await getDoc(doc(db, "users", userId))).data()?.points ?? 0 + collab.points,
  });

  const userCards = await getUserCards(userId);
  const allCollabs = await getAllCollaborators();
  const newProgress = await recalcAndSaveProgress(userId, userCards, allCollabs);
  await checkAndUpgradeCollaboratorRarity(userId, newProgress);

  const userDoc = await getDoc(doc(db, "users", userId));
  const loginDays: string[] = userDoc.data()?.loginDays ?? [];
  await tickAutoMissions(userId, userCards, allCollabs, loginDays);
}

export async function challengeCard(
  userId: string,
  collaboratorId: string,
  answer: string
): Promise<{ success: boolean; message: string; hint?: string; collaborator?: Collaborator }> {
  const existing = await getDocs(
    query(
      collection(db, "userCards"),
      where("userId", "==", userId),
      where("collaboratorId", "==", collaboratorId)
    )
  );
  if (!existing.empty) {
    return { success: false, message: "Você já tem esta figurinha!" };
  }

  const collabDoc = await getDoc(doc(db, "collaborators", collaboratorId));
  if (!collabDoc.exists()) throw new Error("Collaborator not found");
  const collab = toCollaborator(collabDoc.id, collabDoc.data());

  const correctAnswer = (
    collab.challengeAnswer || collab.superPower || ""
  ).toLowerCase().trim();

  const givenAnswer = answer.toLowerCase().trim();

  if (!correctAnswer || givenAnswer === correctAnswer) {
    await addCardToUser(userId, collaboratorId, "challenge");

    const userDoc = await getDoc(doc(db, "users", userId));
    const currentPoints = userDoc.data()?.points ?? 0;
    await updateDoc(doc(db, "users", userId), {
      points: currentPoints + collab.points,
    });

    const userCards = await getUserCards(userId);
    const allCollabs = await getAllCollaborators();
    const newProgress = await recalcAndSaveProgress(userId, userCards, allCollabs);
    await checkAndUpgradeCollaboratorRarity(userId, newProgress);

    const loginDays: string[] = userDoc.data()?.loginDays ?? [];
    await tickAutoMissions(userId, userCards, allCollabs, loginDays);

    return {
      success: true,
      message: `Figurinha de ${collab.name} desbloqueada! +${collab.points} pts`,
      collaborator: collab,
    };
  }

  const hint = correctAnswer[0]?.toUpperCase() ?? "";
  return {
    success: false,
    message: "Resposta incorreta. Tente novamente!",
    hint,
  };
}

// ─── Collaborators ────────────────────────────────────────────────────────────

export async function listCollaborators(): Promise<Collaborator[]> {
  const snap = await getDocs(collection(db, "collaborators"));
  return snap.docs.map((d) => toCollaborator(d.id, d.data()));
}

export async function createCollaborator(
  data: Omit<Collaborator, "id">
): Promise<Collaborator> {
  const ref = await addDoc(collection(db, "collaborators"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, ...data };
}

export async function updateCollaborator(
  id: string,
  data: Partial<Omit<Collaborator, "id">>
): Promise<void> {
  await updateDoc(doc(db, "collaborators", id), data);
}

export async function deleteCollaborator(id: string): Promise<void> {
  await deleteDoc(doc(db, "collaborators", id));
}

// ─── Missions ─────────────────────────────────────────────────────────────────

export async function listMissions(): Promise<Mission[]> {
  const snap = await getDocs(collection(db, "missions"));
  return snap.docs.map((d) => toMission(d.id, d.data()));
}

export async function createMission(
  data: Omit<Mission, "id">
): Promise<Mission> {
  const ref = await addDoc(collection(db, "missions"), {
    ...data,
    status: data.status ?? "open",
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, ...data };
}

export async function updateMission(
  id: string,
  data: Partial<Omit<Mission, "id">>
): Promise<void> {
  await updateDoc(doc(db, "missions", id), data);
}

export async function deleteMission(id: string): Promise<void> {
  await deleteDoc(doc(db, "missions", id));
}

// ─── Category Settings ────────────────────────────────────────────────────────

export async function listCategorySettings(): Promise<CategorySetting[]> {
  const snap = await getDocs(collection(db, "categorySettings"));
  return snap.docs.map((d) => ({ name: d.id, locked: d.data().locked ?? false }));
}

export async function setCategoryLocked(name: string, locked: boolean): Promise<void> {
  await setDoc(doc(db, "categorySettings", name), { locked }, { merge: true });
}

// ─── User Missions ────────────────────────────────────────────────────────────

export async function getMyMissions(userId: string): Promise<MyMission[]> {
  const [missionsSnap, userMissionsSnap] = await Promise.all([
    getDocs(query(collection(db, "missions"), where("status", "!=", "archived"))),
    getDocs(query(collection(db, "userMissions"), where("userId", "==", userId))),
  ]);

  const missions = missionsSnap.docs.map((d) => toMission(d.id, d.data()));
  const umMap = new Map<string, QueryDocumentSnapshot<DocumentData>>();
  for (const d of userMissionsSnap.docs) {
    umMap.set(d.data().missionId as string, d);
  }

  const targetUserIds = [
    ...new Set(
      userMissionsSnap.docs
        .map((d) => d.data().targetUserId as string | undefined)
        .filter((id): id is string => !!id)
    ),
  ];
  const targetUserDocs = await Promise.all(
    targetUserIds.map((id) => getDoc(doc(db, "users", id)))
  );
  const targetNameMap = new Map<string, string>();
  for (const td of targetUserDocs) {
    if (td.exists()) targetNameMap.set(td.id, (td.data().name as string) ?? "");
  }

  return missions
    .filter((m) => m.status !== "closed" || umMap.has(m.id))
    .map((m) => {
      const umDoc = umMap.get(m.id);
      const um = umDoc?.data();
      const targetUserId = (um?.targetUserId as string | undefined) ?? null;
      return {
        missionId: m.id,
        title: m.title,
        description: m.description,
        goal: m.goal,
        progress: um?.progress ?? 0,
        rewardPoints: m.rewardPoints,
        missionType: m.missionType,
        type: m.type,
        requiresApproval: m.requiresApproval,
        started: um?.started ?? false,
        completed: um?.completed ?? false,
        submissionStatus: um?.submissionStatus ?? "in_progress",
        reviewNote: um?.reviewNote ?? null,
        targetUserId,
        targetUserName: targetUserId ? targetNameMap.get(targetUserId) ?? null : null,
        challengeQuestion: (um?.challengeQuestion as string | undefined) ?? null,
        challengeStatus: (um?.challengeStatus as "pending" | "correct" | undefined) ?? null,
      } satisfies MyMission;
    });
}

// ─── Peer Interaction & Challenge Missions ────────────────────────────────────

async function grantMissionReward(
  userId: string,
  missionId: string,
  umRef: ReturnType<typeof doc>
): Promise<{ rewardCard: Collaborator | null; bonusPoints: number }> {
  const missionDoc = await getDoc(doc(db, "missions", missionId));
  if (!missionDoc.exists()) throw new Error("Mission not found");
  const mission = toMission(missionDoc.id, missionDoc.data());

  const [userCards, allCollabs, userDoc] = await Promise.all([
    getUserCards(userId),
    getAllCollaborators(),
    getDoc(doc(db, "users", userId)),
  ]);

  const { rewardCard, bonusPoints } = await resolveMissionReward(userId, userCards, allCollabs, mission);

  const batch = writeBatch(db);
  batch.update(umRef, {
    completed: true,
    completedAt: serverTimestamp(),
  });

  const currentPoints = userDoc.data()?.points ?? 0;
  if (rewardCard) {
    await addCardToUser(userId, rewardCard.id, "mission");
    const updatedCards = [...userCards, rewardCard.id];
    const progress = allCollabs.length > 0
      ? (updatedCards.length / allCollabs.length) * 100
      : 0;
    batch.update(doc(db, "users", userId), {
      points: currentPoints + mission.rewardPoints + rewardCard.points,
      progress,
    });
  } else {
    batch.update(doc(db, "users", userId), {
      points: currentPoints + bonusPoints,
    });
  }

  await batch.commit();
  return { rewardCard, bonusPoints };
}

export async function startPeerInteractionMission(
  userId: string,
  missionId: string,
  targetUserId: string
): Promise<{ rewardCard: Collaborator | null; bonusPoints: number } | null> {
  const missionDoc = await getDoc(doc(db, "missions", missionId));
  if (!missionDoc.exists()) throw new Error("Mission not found");
  const mission = toMission(missionDoc.id, missionDoc.data());

  const existingSnap = await getDocs(
    query(
      collection(db, "userMissions"),
      where("userId", "==", userId),
      where("missionId", "==", missionId)
    )
  );

  let umRef;
  if (!existingSnap.empty) {
    umRef = existingSnap.docs[0]!.ref;
    const existing = existingSnap.docs[0]!.data();
    if (existing.completed) throw new Error("Mission already completed");
    await updateDoc(umRef, {
      started: true,
      targetUserId,
      submissionStatus: mission.requiresApproval ? "pending_review" : "in_progress",
      submittedAt: mission.requiresApproval ? serverTimestamp() : null,
    });
  } else {
    umRef = doc(collection(db, "userMissions"));
    await setDoc(umRef, {
      userId,
      missionId,
      started: true,
      completed: false,
      progress: 0,
      targetUserId,
      submissionStatus: mission.requiresApproval ? "pending_review" : "in_progress",
      reviewNote: null,
      proofText: null,
      submittedAt: mission.requiresApproval ? serverTimestamp() : null,
      completedAt: null,
      createdAt: serverTimestamp(),
    });
  }

  if (mission.requiresApproval) {
    return null;
  }

  // ── Peer gift: figurinha vai para o álbum do DESTINATÁRIO; pontos ficam com o REMETENTE ──
  const [targetUserCards, allCollabs, senderDoc, targetDoc] = await Promise.all([
    getUserCards(targetUserId),
    getAllCollaborators(),
    getDoc(doc(db, "users", userId)),
    getDoc(doc(db, "users", targetUserId)),
  ]);

  const { rewardCard, bonusPoints } = await resolveMissionReward(
    targetUserId, targetUserCards, allCollabs, mission, true
  );

  const batch = writeBatch(db);
  batch.update(umRef, { completed: true, completedAt: serverTimestamp() });
  // Remetente ganha os pontos — atomic increment evita corrida de leitura/escrita
  batch.update(doc(db, "users", userId), { points: increment(mission.rewardPoints) });

  if (rewardCard) {
    // Figurinha vai para o DESTINATÁRIO — dentro do mesmo batch
    const cardRef = doc(collection(db, "userCards"));
    batch.set(cardRef, {
      userId: targetUserId,
      collaboratorId: rewardCard.id,
      unlockedAt: serverTimestamp(),
      unlockedBy: "peer_gift",
      giftedByName: senderDoc.data()?.name ?? "",
    });
    const updatedTargetCards = [...targetUserCards, rewardCard.id];
    const targetProgress = allCollabs.length > 0
      ? (updatedTargetCards.length / allCollabs.length) * 100 : 0;
    batch.update(doc(db, "users", targetUserId), { progress: targetProgress });

    // Registra atividade — dentro do mesmo batch
    const activityRef = doc(collection(db, "missionActivities"));
    batch.set(activityRef, {
      type: "peer_gift",
      senderId: userId,
      senderName: senderDoc.data()?.name ?? "",
      recipientId: targetUserId,
      recipientName: targetDoc.data()?.name ?? "",
      cardId: rewardCard.id,
      cardName: rewardCard.name,
      cardRarity: rewardCard.rarity,
      missionId,
      missionTitle: mission.title,
      pointsGiven: mission.rewardPoints,
      createdAt: serverTimestamp(),
    });
  }

  await batch.commit();
  return { rewardCard, bonusPoints };
}

export async function startQuestionMission(
  userId: string,
  missionId: string,
  targetUserId: string,
  question: string,
  answer: string
): Promise<void> {
  const existingSnap = await getDocs(
    query(
      collection(db, "userMissions"),
      where("userId", "==", userId),
      where("missionId", "==", missionId)
    )
  );

  if (!existingSnap.empty) {
    const existing = existingSnap.docs[0]!.data();
    if (existing.completed) throw new Error("Mission already completed");
    await updateDoc(existingSnap.docs[0]!.ref, {
      started: true,
      targetUserId,
      challengeQuestion: question,
      challengeAnswer: answer.trim().toLowerCase(),
      challengeStatus: "pending",
      submissionStatus: "in_progress",
    });
    return;
  }

  await addDoc(collection(db, "userMissions"), {
    userId,
    missionId,
    started: true,
    completed: false,
    progress: 0,
    targetUserId,
    challengeQuestion: question,
    challengeAnswer: answer.trim().toLowerCase(),
    challengeStatus: "pending",
    submissionStatus: "in_progress",
    reviewNote: null,
    proofText: null,
    submittedAt: null,
    completedAt: null,
    createdAt: serverTimestamp(),
  });
}

export async function getIncomingChallenges(userId: string): Promise<IncomingChallenge[]> {
  const umSnap = await getDocs(
    query(
      collection(db, "userMissions"),
      where("targetUserId", "==", userId),
      where("challengeStatus", "==", "pending")
    )
  );
  if (umSnap.empty) return [];

  const missionIds = [...new Set(umSnap.docs.map((d) => d.data().missionId as string))];
  const fromUserIds = [...new Set(umSnap.docs.map((d) => d.data().userId as string))];

  const [missionDocs, userDocs] = await Promise.all([
    Promise.all(missionIds.map((id) => getDoc(doc(db, "missions", id)))),
    Promise.all(fromUserIds.map((id) => getDoc(doc(db, "users", id)))),
  ]);
  const missionsMap = new Map(missionDocs.filter((d) => d.exists()).map((d) => [d.id, d.data()!]));
  const usersMap = new Map(userDocs.filter((d) => d.exists()).map((d) => [d.id, d.data()!]));

  return umSnap.docs
    .map((d) => {
      const data = d.data();
      const mission = missionsMap.get(data.missionId);
      const fromUser = usersMap.get(data.userId);
      if (!mission || !fromUser) return null;
      return {
        userMissionId: d.id,
        missionId: data.missionId as string,
        missionTitle: mission.title ?? "",
        fromUserId: data.userId as string,
        fromUserName: fromUser.name ?? "",
        question: data.challengeQuestion ?? "",
      } satisfies IncomingChallenge;
    })
    .filter((x): x is IncomingChallenge => x !== null);
}

export async function answerChallenge(
  userMissionId: string,
  responderUserId: string,
  answerGiven: string
): Promise<{ correct: boolean }> {
  const umRef = doc(db, "userMissions", userMissionId);
  const umDoc = await getDoc(umRef);
  if (!umDoc.exists()) throw new Error("Challenge not found");
  const um = umDoc.data();

  if (um.targetUserId !== responderUserId) throw new Error("Not authorized to answer this challenge");
  if (um.challengeStatus !== "pending") throw new Error("Challenge already resolved");

  const isCorrect = answerGiven.trim().toLowerCase() === (um.challengeAnswer ?? "");
  if (!isCorrect) {
    return { correct: false };
  }

  // Resolve dados antes de commitar — não marca completado até tudo estar pronto
  const challengerUserId = um.userId as string;
  const missionId = um.missionId as string;

  const [missionDoc, challengerCards, challengedCards, allCollabs, challengerDoc, challengedDoc] = await Promise.all([
    getDoc(doc(db, "missions", missionId)),
    getUserCards(challengerUserId),
    getUserCards(responderUserId),
    getAllCollaborators(),
    getDoc(doc(db, "users", challengerUserId)),
    getDoc(doc(db, "users", responderUserId)),
  ]);

  if (!missionDoc.exists()) return { correct: true };
  const mission = toMission(missionDoc.id, missionDoc.data());

  // Recompensa do desafiante (quem criou o desafio)
  const challengerMode = mission.challengerRewardMode ?? mission.rewardMode ?? "random";
  const challengerPts = mission.challengerRewardPoints ?? mission.rewardPoints;
  const challengerCardId = mission.challengerSpecificCardId ?? mission.specificCardId;
  const { rewardCard: challengerCard } = await resolveMissionRewardCustom(
    challengerUserId, challengerCards, allCollabs, challengerPts, challengerMode, challengerCardId, true
  );

  // Recompensa do desafiado (quem respondeu)
  const challengedMode = mission.challengedRewardMode ?? "points_only";
  const challengedPts = mission.challengedRewardPoints ?? 0;
  const challengedCardId = mission.challengedSpecificCardId ?? null;
  const { rewardCard: challengedCard } = await resolveMissionRewardCustom(
    responderUserId, challengedCards, allCollabs, challengedPts, challengedMode, challengedCardId, true
  );

  // Tudo em um único batch — status de completado + pontos + figurinhas + atividade
  const batch = writeBatch(db);

  // Marca o desafio como concluído no mesmo batch
  batch.update(umRef, { challengeStatus: "correct", completed: true, completedAt: serverTimestamp() });

  // Recompensas do desafiante — increment evita corrida de leitura/escrita
  if (challengerCard) {
    const cCardRef = doc(collection(db, "userCards"));
    batch.set(cCardRef, {
      userId: challengerUserId,
      collaboratorId: challengerCard.id,
      unlockedAt: serverTimestamp(),
      unlockedBy: "challenge_reward",
    });
    const updatedChallengerCards = [...challengerCards, challengerCard.id];
    const challengerProgress = allCollabs.length > 0
      ? (updatedChallengerCards.length / allCollabs.length) * 100 : 0;
    batch.update(doc(db, "users", challengerUserId), {
      points: increment(challengerPts + challengerCard.points),
      progress: challengerProgress,
    });
  } else {
    batch.update(doc(db, "users", challengerUserId), { points: increment(challengerPts) });
  }

  // Recompensas do desafiado
  if (challengedCard) {
    const dCardRef = doc(collection(db, "userCards"));
    batch.set(dCardRef, {
      userId: responderUserId,
      collaboratorId: challengedCard.id,
      unlockedAt: serverTimestamp(),
      unlockedBy: "challenge_reward",
      giftedByName: challengerDoc.data()?.name ?? "",
    });
    const updatedChallengedCards = [...challengedCards, challengedCard.id];
    const challengedProgress = allCollabs.length > 0
      ? (updatedChallengedCards.length / allCollabs.length) * 100 : 0;
    batch.update(doc(db, "users", responderUserId), {
      points: increment(challengedPts + challengedCard.points),
      progress: challengedProgress,
    });
  } else if (challengedPts > 0) {
    batch.update(doc(db, "users", responderUserId), { points: increment(challengedPts) });
  }

  // Registrar atividade no mesmo batch
  const activityRef = doc(collection(db, "missionActivities"));
  batch.set(activityRef, {
    type: "challenge_complete",
    senderId: challengerUserId,
    senderName: challengerDoc.data()?.name ?? "",
    recipientId: responderUserId,
    recipientName: challengedDoc.data()?.name ?? "",
    cardId: challengerCard?.id ?? null,
    cardName: challengerCard?.name ?? null,
    cardRarity: challengerCard?.rarity ?? null,
    missionId,
    missionTitle: mission.title,
    pointsGiven: challengerPts,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  return { correct: true };
}

export async function startMission(
  userId: string,
  missionId: string
): Promise<void> {
  const existingSnap = await getDocs(
    query(
      collection(db, "userMissions"),
      where("userId", "==", userId),
      where("missionId", "==", missionId)
    )
  );

  if (!existingSnap.empty) {
    await updateDoc(existingSnap.docs[0]!.ref, { started: true });
    return;
  }

  await addDoc(collection(db, "userMissions"), {
    userId,
    missionId,
    started: true,
    completed: false,
    progress: 0,
    submissionStatus: "in_progress",
    reviewNote: null,
    proofText: null,
    submittedAt: null,
    completedAt: null,
    createdAt: serverTimestamp(),
  });
}

export async function completeMission(
  userId: string,
  missionId: string
): Promise<{ rewardCard: Collaborator | null; bonusPoints: number }> {
  const umSnap = await getDocs(
    query(
      collection(db, "userMissions"),
      where("userId", "==", userId),
      where("missionId", "==", missionId)
    )
  );
  if (umSnap.empty) throw new Error("Mission not started");

  const umDoc = umSnap.docs[0]!;
  const um = umDoc.data();
  if (um.completed) throw new Error("Mission already completed");

  const missionDoc = await getDoc(doc(db, "missions", missionId));
  if (!missionDoc.exists()) throw new Error("Mission not found");
  const mission = toMission(missionDoc.id, missionDoc.data());

  const [userCards, allCollabs, userDoc] = await Promise.all([
    getUserCards(userId),
    getAllCollaborators(),
    getDoc(doc(db, "users", userId)),
  ]);

  const { rewardCard, bonusPoints } = await resolveMissionReward(userId, userCards, allCollabs, mission);

  const batch = writeBatch(db);
  batch.update(umDoc.ref, {
    completed: true,
    completedAt: serverTimestamp(),
  });

  const currentPoints = userDoc.data()?.points ?? 0;
  if (rewardCard) {
    await addCardToUser(userId, rewardCard.id, "mission");
    const updatedCards = [...userCards, rewardCard.id];
    const progress = allCollabs.length > 0
      ? (updatedCards.length / allCollabs.length) * 100
      : 0;
    batch.update(doc(db, "users", userId), {
      points: currentPoints + mission.rewardPoints + rewardCard.points,
      progress,
    });
  } else {
    batch.update(doc(db, "users", userId), {
      points: currentPoints + bonusPoints,
    });
  }

  await batch.commit();

  return { rewardCard, bonusPoints };
}

export async function submitMissionProof(
  userId: string,
  missionId: string,
  proofText: string
): Promise<void> {
  const umSnap = await getDocs(
    query(
      collection(db, "userMissions"),
      where("userId", "==", userId),
      where("missionId", "==", missionId)
    )
  );
  if (umSnap.empty) throw new Error("Mission not started");

  await updateDoc(umSnap.docs[0]!.ref, {
    proofText,
    submissionStatus: "pending_review",
    submittedAt: serverTimestamp(),
  });
}

// ─── Rankings ─────────────────────────────────────────────────────────────────

export async function getRankings(): Promise<RankingEntry[]> {
  const [usersSnap, userCardsSnap, collabSnap, completedMissionsSnap] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "userCards")),
    getDocs(collection(db, "collaborators")),
    getDocs(query(collection(db, "userMissions"), where("completed", "==", true))),
  ]);

  const total = collabSnap.size;
  const cardCounts = new Map<string, number>();
  for (const d of userCardsSnap.docs) {
    const uid = d.data().userId as string;
    cardCounts.set(uid, (cardCounts.get(uid) ?? 0) + 1);
  }

  const earliestCompletion = new Map<string, number>();
  for (const d of completedMissionsSnap.docs) {
    const data = d.data();
    const uid = data.userId as string;
    const completedAt = data.completedAt instanceof Timestamp
      ? data.completedAt.toDate().getTime()
      : null;
    if (completedAt === null) continue;
    const current = earliestCompletion.get(uid);
    if (current === undefined || completedAt < current) {
      earliestCompletion.set(uid, completedAt);
    }
  }

  const entries = usersSnap.docs.map((d) => {
    const data = d.data();
    const unlockedCount = cardCounts.get(d.id) ?? 0;
    return {
      userId: d.id,
      name: data.name ?? "",
      photo: data.photo ?? null,
      points: data.points ?? 0,
      unlockedCount,
      progress: total > 0 ? (unlockedCount / total) * 100 : 0,
    };
  });

  entries.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const aTime = earliestCompletion.get(a.userId) ?? Infinity;
    const bTime = earliestCompletion.get(b.userId) ?? Infinity;
    return aTime - bTime;
  });

  return entries.map((entry, idx) => ({ rank: idx + 1, ...entry }));
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getAlbumStats(): Promise<AlbumStats> {
  const [collabSnap, userCardsSnap, usersSnap] = await Promise.all([
    getDocs(collection(db, "collaborators")),
    getDocs(collection(db, "userCards")),
    getDocs(collection(db, "users")),
  ]);

  const byRarity: Record<string, number> = {
    comum: 0, rara: 0, epica: 0, lendaria: 0,
  };
  const byCategory: Record<string, number> = {};

  for (const d of collabSnap.docs) {
    const data = d.data();
    byRarity[data.rarity] = (byRarity[data.rarity] ?? 0) + 1;
    byCategory[data.category] = (byCategory[data.category] ?? 0) + 1;
  }

  return {
    total: collabSnap.size,
    totalUsers: usersSnap.size,
    totalUnlocks: userCardsSnap.size,
    byRarity,
    byCategory,
  };
}

// ─── Recent Activity ──────────────────────────────────────────────────────────

export async function getRecentActivity(): Promise<RecentActivity[]> {
  const [userCardsSnap, raritySnap, missionActivSnap] = await Promise.all([
    getDocs(query(collection(db, "userCards"), orderBy("unlockedAt", "desc"))),
    getDocs(query(collection(db, "rarityEvents"), orderBy("upgradedAt", "desc"))),
    getDocs(query(collection(db, "missionActivities"), orderBy("createdAt", "desc"))),
  ]);

  const rarityActivities: RecentActivity[] = raritySnap.docs.map((d) => {
    const data = d.data();
    const upgradedAt = data.upgradedAt instanceof Timestamp
      ? data.upgradedAt.toDate().toISOString()
      : new Date().toISOString();
    return {
      userId: data.userId as string,
      collaboratorId: data.collaboratorId as string,
      unlockedAt: upgradedAt,
      userName: data.userName ?? "",
      userPhoto: data.userPhoto ?? null,
      collaboratorName: data.collaboratorName ?? "",
      collaboratorPhoto: data.collaboratorPhoto ?? null,
      rarity: data.newRarity ?? "rara",
      type: "rarity_upgrade" as const,
      newRarity: data.newRarity as string,
    };
  });

  const missionActivities: RecentActivity[] = missionActivSnap.docs.map((d) => {
    const data = d.data();
    const createdAt = data.createdAt instanceof Timestamp
      ? data.createdAt.toDate().toISOString()
      : new Date().toISOString();
    return {
      userId: data.senderId as string,
      collaboratorId: (data.cardId as string) ?? "",
      unlockedAt: createdAt,
      userName: data.senderName ?? "",
      userPhoto: null,
      collaboratorName: data.cardName ?? "",
      collaboratorPhoto: null,
      rarity: (data.cardRarity as string) ?? "comum",
      type: data.type as "peer_gift" | "challenge_complete" | "duplicate_gift",
      missionTitle: data.missionTitle ?? "",
      senderName: data.senderName ?? "",
      recipientName: data.recipientName ?? "",
    };
  });

  if (userCardsSnap.empty) {
    return [...rarityActivities, ...missionActivities]
      .sort((a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime());
  }

  const userIds = [...new Set(userCardsSnap.docs.map((d) => d.data().userId as string))];
  const collabIds = [...new Set(userCardsSnap.docs.map((d) => d.data().collaboratorId as string))];

  const [userDocs, collabDocs] = await Promise.all([
    Promise.all(userIds.map((id) => getDoc(doc(db, "users", id)))),
    Promise.all(collabIds.map((id) => getDoc(doc(db, "collaborators", id)))),
  ]);

  const usersMap = new Map(userDocs.filter((d) => d.exists()).map((d) => [d.id, d.data()!]));
  const collabsMap = new Map(collabDocs.filter((d) => d.exists()).map((d) => [d.id, d.data()!]));

  const cardActivities: RecentActivity[] = userCardsSnap.docs.flatMap((d) => {
    const data = d.data();
    const user = usersMap.get(data.userId);
    const collab = collabsMap.get(data.collaboratorId);
    if (!user || !collab) return [];

    const unlockedAt = data.unlockedAt instanceof Timestamp
      ? data.unlockedAt.toDate().toISOString()
      : new Date().toISOString();

    return [{
      userId: data.userId as string,
      collaboratorId: data.collaboratorId as string,
      unlockedAt,
      userName: user.name ?? "",
      userPhoto: user.photo ?? null,
      collaboratorName: collab.name ?? "",
      collaboratorPhoto: collab.photoUrl ?? null,
      rarity: collab.rarity ?? "comum",
      type: "card" as const,
    } as RecentActivity];
  });

  return [...rarityActivities, ...missionActivities, ...cardActivities]
    .sort((a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime());
}

// ─── Featured Collaborators ───────────────────────────────────────────────────

export async function getFeaturedCollaborators(): Promise<Collaborator[]> {
  const snap = await getDocs(
    query(
      collection(db, "collaborators"),
      where("isSpecial", "==", true),
      limit(6)
    )
  );
  if (snap.size < 3) {
    const fallback = await getDocs(
      query(collection(db, "collaborators"), limit(6))
    );
    return fallback.docs.map((d) => toCollaborator(d.id, d.data()));
  }
  return snap.docs.map((d) => toCollaborator(d.id, d.data()));
}

// ─── Admin: Users ─────────────────────────────────────────────────────────────

// ─── Admin: App Settings ───────────────────────────────────────────────────────

export async function getAppSettings(): Promise<{ duplicateDonationPoints: number }> {
  const snap = await getDoc(doc(db, "settings", "general"));
  const data = snap.exists() ? snap.data() : {};
  return { duplicateDonationPoints: (data?.duplicateDonationPoints as number) ?? 10 };
}

export async function updateAppSettings(data: { duplicateDonationPoints: number }): Promise<void> {
  await setDoc(doc(db, "settings", "general"), data, { merge: true });
}

// ─── Duplicate card donation ────────────────────────────────────────────────────

export async function getMyCardGiftInfo(
  userId: string
): Promise<Record<string, { count: number; giftedByName: string | null; unlockedBy: string | null }>> {
  const snap = await getDocs(query(collection(db, "userCards"), where("userId", "==", userId)));
  const result: Record<string, { count: number; giftedByName: string | null; unlockedBy: string | null; unlockedAt: number }> = {};
  for (const d of snap.docs) {
    const data = d.data();
    const collaboratorId = data.collaboratorId as string;
    const unlockedAtMs = data.unlockedAt instanceof Timestamp ? data.unlockedAt.toMillis() : 0;
    const giftedByName = (data.giftedByName as string | undefined) ?? null;
    const unlockedBy = (data.unlockedBy as string | undefined) ?? null;
    if (!result[collaboratorId]) {
      result[collaboratorId] = { count: 0, giftedByName: null, unlockedBy: null, unlockedAt: -1 };
    }
    result[collaboratorId]!.count++;
    if (unlockedAtMs >= result[collaboratorId]!.unlockedAt) {
      result[collaboratorId]!.unlockedAt = unlockedAtMs;
      result[collaboratorId]!.giftedByName = giftedByName;
      result[collaboratorId]!.unlockedBy = unlockedBy;
    }
  }
  const out: Record<string, { count: number; giftedByName: string | null; unlockedBy: string | null }> = {};
  for (const [k, v] of Object.entries(result)) out[k] = { count: v.count, giftedByName: v.giftedByName, unlockedBy: v.unlockedBy };
  return out;
}

export async function donateDuplicateCard(
  userId: string,
  collaboratorId: string,
  targetUserId: string
): Promise<void> {
  if (userId === targetUserId) throw new Error("Não é possível doar para você mesmo");

  const [ownedSnap, settings, senderDoc, collabDoc] = await Promise.all([
    getDocs(
      query(
        collection(db, "userCards"),
        where("userId", "==", userId),
        where("collaboratorId", "==", collaboratorId)
      )
    ),
    getAppSettings(),
    getDoc(doc(db, "users", userId)),
    getDoc(doc(db, "collaborators", collaboratorId)),
  ]);

  if (ownedSnap.size < 2) {
    throw new Error("Você precisa de mais de uma figurinha repetida para doar");
  }
  if (!collabDoc.exists()) throw new Error("Figurinha não encontrada");

  const cardToRemove = ownedSnap.docs[0]!;
  const senderName = senderDoc.data()?.name ?? "";
  const collab = toCollaborator(collabDoc.id, collabDoc.data());

  const [targetCards, allCollabs, targetDoc] = await Promise.all([
    getUserCards(targetUserId),
    getAllCollaborators(),
    getDoc(doc(db, "users", targetUserId)),
  ]);

  const batch = writeBatch(db);
  batch.delete(cardToRemove.ref);

  const newCardRef = doc(collection(db, "userCards"));
  batch.set(newCardRef, {
    userId: targetUserId,
    collaboratorId,
    unlockedAt: serverTimestamp(),
    unlockedBy: "duplicate_donation",
    giftedByName: senderName,
  });

  const updatedTargetCards = [...targetCards, collaboratorId];
  const targetProgress = allCollabs.length > 0 ? (updatedTargetCards.length / allCollabs.length) * 100 : 0;
  batch.update(doc(db, "users", targetUserId), { progress: targetProgress });
  batch.update(doc(db, "users", userId), { points: increment(settings.duplicateDonationPoints) });

  const activityRef = doc(collection(db, "missionActivities"));
  batch.set(activityRef, {
    type: "duplicate_gift",
    senderId: userId,
    senderName,
    recipientId: targetUserId,
    recipientName: targetDoc.data()?.name ?? "",
    cardId: collaboratorId,
    cardName: collab.name,
    cardRarity: collab.rarity,
    missionId: null,
    missionTitle: null,
    pointsGiven: settings.duplicateDonationPoints,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function listUsers(): Promise<User[]> {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs
    .map((d) => toUser(d.id, d.data()))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
}

export async function deleteUser(id: string): Promise<void> {
  await deleteDoc(doc(db, "users", id));
}

// ─── Admin: Pending Missions ──────────────────────────────────────────────────

export async function listPendingMissions(): Promise<PendingMission[]> {
  const umSnap = await getDocs(
    query(
      collection(db, "userMissions"),
      where("submissionStatus", "==", "pending_review")
    )
  );
  if (umSnap.empty) return [];

  const userIds = [...new Set(umSnap.docs.map((d) => d.data().userId as string))];
  const missionIds = [...new Set(umSnap.docs.map((d) => d.data().missionId as string))];
  const targetUserIds = [
    ...new Set(
      umSnap.docs
        .map((d) => d.data().targetUserId as string | undefined)
        .filter((id): id is string => !!id)
    ),
  ];

  const [userDocs, missionDocs, targetUserDocs] = await Promise.all([
    Promise.all(userIds.map((id) => getDoc(doc(db, "users", id)))),
    Promise.all(missionIds.map((id) => getDoc(doc(db, "missions", id)))),
    Promise.all(targetUserIds.map((id) => getDoc(doc(db, "users", id)))),
  ]);

  const usersMap = new Map(userDocs.filter((d) => d.exists()).map((d) => [d.id, d.data()!]));
  const missionsMap = new Map(missionDocs.filter((d) => d.exists()).map((d) => [d.id, d.data()!]));
  const targetNameMap = new Map(
    targetUserDocs.filter((d) => d.exists()).map((d) => [d.id, (d.data()!.name as string) ?? ""])
  );

  return umSnap.docs
    .map((d) => {
      const data = d.data();
      const user = usersMap.get(data.userId);
      const mission = missionsMap.get(data.missionId);
      if (!user || !mission) return null;

      const submittedAt = data.submittedAt instanceof Timestamp
        ? data.submittedAt.toDate().toISOString()
        : null;

      return {
        userMissionId: d.id,
        userId: data.userId as string,
        userName: user.name ?? "",
        userPhoto: user.photo ?? null,
        missionId: data.missionId as string,
        missionTitle: mission.title ?? "",
        proofText: data.proofText ?? null,
        submittedAt,
        targetUserName: data.targetUserId ? targetNameMap.get(data.targetUserId) ?? null : null,
      } satisfies PendingMission;
    })
    .filter((x): x is PendingMission => x !== null);
}

export async function approveMission(
  userMissionId: string
): Promise<{ rewardCard: Collaborator | null; bonusPoints: number }> {
  const umDoc = await getDoc(doc(db, "userMissions", userMissionId));
  if (!umDoc.exists()) throw new Error("UserMission not found");

  const um = umDoc.data();
  const missionDoc = await getDoc(doc(db, "missions", um.missionId));
  if (!missionDoc.exists()) throw new Error("Mission not found");
  const mission = toMission(missionDoc.id, missionDoc.data());

  const batch = writeBatch(db);
  batch.update(doc(db, "userMissions", userMissionId), {
    submissionStatus: "in_progress",
    completed: true,
    completedAt: serverTimestamp(),
  });

  // Para missões de interação entre jogadores, figurinha vai para o DESTINATÁRIO
  if (mission.missionType === "peer_interaction" && um.targetUserId) {
    const targetUserId = um.targetUserId as string;
    const [targetCards, allCollabs, senderDoc, targetDoc] = await Promise.all([
      getUserCards(targetUserId),
      getAllCollaborators(),
      getDoc(doc(db, "users", um.userId)),
      getDoc(doc(db, "users", targetUserId)),
    ]);

    const { rewardCard, bonusPoints } = await resolveMissionReward(targetUserId, targetCards, allCollabs, mission, true);
    // Remetente ganha pontos — atomic increment
    batch.update(doc(db, "users", um.userId), { points: increment(mission.rewardPoints) });

    if (rewardCard) {
      // Figurinha e atividade dentro do mesmo batch
      const cardRef = doc(collection(db, "userCards"));
      batch.set(cardRef, {
        userId: targetUserId,
        collaboratorId: rewardCard.id,
        unlockedAt: serverTimestamp(),
        unlockedBy: "peer_gift",
        giftedByName: senderDoc.data()?.name ?? "",
      });
      const updatedTargetCards = [...targetCards, rewardCard.id];
      const targetProgress = allCollabs.length > 0
        ? (updatedTargetCards.length / allCollabs.length) * 100 : 0;
      batch.update(doc(db, "users", targetUserId), { progress: targetProgress });

      const activityRef = doc(collection(db, "missionActivities"));
      batch.set(activityRef, {
        type: "peer_gift",
        senderId: um.userId,
        senderName: senderDoc.data()?.name ?? "",
        recipientId: targetUserId,
        recipientName: targetDoc.data()?.name ?? "",
        cardId: rewardCard.id,
        cardName: rewardCard.name,
        cardRarity: rewardCard.rarity,
        missionId: um.missionId,
        missionTitle: mission.title,
        pointsGiven: mission.rewardPoints,
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
    return { rewardCard, bonusPoints };
  }

  // Demais missões: recompensa vai para quem completou
  const [userCards, allCollabs] = await Promise.all([
    getUserCards(um.userId),
    getAllCollaborators(),
  ]);

  const { rewardCard, bonusPoints } = await resolveMissionReward(um.userId, userCards, allCollabs, mission);

  if (rewardCard) {
    const cardRef = doc(collection(db, "userCards"));
    batch.set(cardRef, {
      userId: um.userId,
      collaboratorId: rewardCard.id,
      unlockedAt: serverTimestamp(),
      unlockedBy: "mission",
    });
    const updatedCards = [...userCards, rewardCard.id];
    const progress = allCollabs.length > 0
      ? (updatedCards.length / allCollabs.length) * 100 : 0;
    batch.update(doc(db, "users", um.userId), {
      points: increment(mission.rewardPoints + rewardCard.points),
      progress,
    });
  } else {
    batch.update(doc(db, "users", um.userId), { points: increment(bonusPoints) });
  }

  await batch.commit();
  return { rewardCard, bonusPoints };
}

// ─── Repair: retroactively grant peer-gift rewards that were approved before ──
// the duplicate-allow fix existed (so the card/activity never got created).
export async function repairMissingPeerGifts(): Promise<{ repaired: number }> {
  const [missionsSnap, userMissionsSnap] = await Promise.all([
    getDocs(collection(db, "missions")),
    getDocs(query(collection(db, "userMissions"), where("completed", "==", true))),
  ]);

  const peerInteractionMissionIds = new Set(
    missionsSnap.docs
      .filter((d) => d.data().missionType === "peer_interaction")
      .map((d) => d.id)
  );

  const candidates = userMissionsSnap.docs.filter((d) => {
    const data = d.data();
    return (
      peerInteractionMissionIds.has(data.missionId as string) &&
      !!data.targetUserId
    );
  });

  if (candidates.length === 0) return { repaired: 0 };

  const [existingActivitiesSnap, allCollabs] = await Promise.all([
    getDocs(query(collection(db, "missionActivities"), where("type", "==", "peer_gift"))),
    getAllCollaborators(),
  ]);

  const existingKeys = new Set(
    existingActivitiesSnap.docs.map((d) => {
      const data = d.data();
      return `${data.missionId}:${data.senderId}:${data.recipientId}`;
    })
  );

  let repaired = 0;
  const batch = writeBatch(db);

  for (const umDoc of candidates) {
    const um = umDoc.data();
    const missionId = um.missionId as string;
    const senderId = um.userId as string;
    const targetUserId = um.targetUserId as string;
    const key = `${missionId}:${senderId}:${targetUserId}`;
    if (existingKeys.has(key)) continue; // already has a logged gift, nothing to repair

    const missionDoc = missionsSnap.docs.find((d) => d.id === missionId);
    if (!missionDoc) continue;
    const mission = toMission(missionDoc.id, missionDoc.data());

    const [targetCards, senderDoc, targetDoc] = await Promise.all([
      getUserCards(targetUserId),
      getDoc(doc(db, "users", senderId)),
      getDoc(doc(db, "users", targetUserId)),
    ]);
    if (!senderDoc.exists() || !targetDoc.exists()) continue;

    const { rewardCard } = await resolveMissionReward(targetUserId, targetCards, allCollabs, mission, true);
    if (!rewardCard) continue;

    const cardRef = doc(collection(db, "userCards"));
    batch.set(cardRef, {
      userId: targetUserId,
      collaboratorId: rewardCard.id,
      unlockedAt: serverTimestamp(),
      unlockedBy: "peer_gift",
      giftedByName: senderDoc.data()?.name ?? "",
    });

    const updatedTargetCards = [...targetCards, rewardCard.id];
    const targetProgress = allCollabs.length > 0
      ? (updatedTargetCards.length / allCollabs.length) * 100 : 0;
    batch.update(doc(db, "users", targetUserId), { progress: targetProgress });

    const activityRef = doc(collection(db, "missionActivities"));
    batch.set(activityRef, {
      type: "peer_gift",
      senderId,
      senderName: senderDoc.data()?.name ?? "",
      recipientId: targetUserId,
      recipientName: targetDoc.data()?.name ?? "",
      cardId: rewardCard.id,
      cardName: rewardCard.name,
      cardRarity: rewardCard.rarity,
      missionId,
      missionTitle: mission.title,
      pointsGiven: mission.rewardPoints,
      createdAt: um.completedAt ?? serverTimestamp(),
    });

    existingKeys.add(key); // avoid double-repair if duplicated in candidates
    repaired++;
  }

  if (repaired > 0) await batch.commit();
  return { repaired };
}

export async function rejectMission(
  userMissionId: string,
  note: string
): Promise<void> {
  await updateDoc(doc(db, "userMissions", userMissionId), {
    submissionStatus: "rejected",
    reviewNote: note,
  });
}
