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
  Timestamp,
  DocumentData,
  QueryDocumentSnapshot,
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
} from "./types";

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
  return {
    id,
    name: data.name ?? "",
    role: data.role ?? "",
    area: data.area ?? "",
    management: data.management ?? "",
    email: data.email ?? null,
    position: data.position ?? null,
    photoUrl: data.photoUrl ?? null,
    yearsAtVale: data.yearsAtVale ?? null,
    keyBehavior: data.keyBehavior ?? null,
    superPower: data.superPower ?? null,
    curiosity: data.curiosity ?? null,
    achievement: data.achievement ?? null,
    challengeQuestion: data.challengeQuestion ?? null,
    challengeAnswer: data.challengeAnswer ?? null,
    rarity: data.rarity ?? "comum",
    category: data.category ?? "",
    points: data.points ?? 10,
    isSpecial: data.isSpecial ?? false,
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

  return missions
    .filter((m) => m.status !== "closed" || umMap.has(m.id))
    .map((m) => {
      const umDoc = umMap.get(m.id);
      const um = umDoc?.data();
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
      } satisfies MyMission;
    });
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

  const rewardCard = await awardRandomCard(userId, userCards, allCollabs);
  const bonusPoints = rewardCard ? 0 : mission.rewardPoints;

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
  const [usersSnap, userCardsSnap, collabSnap] = await Promise.all([
    getDocs(query(collection(db, "users"), orderBy("points", "desc"))),
    getDocs(collection(db, "userCards")),
    getDocs(collection(db, "collaborators")),
  ]);

  const total = collabSnap.size;
  const cardCounts = new Map<string, number>();
  for (const d of userCardsSnap.docs) {
    const uid = d.data().userId as string;
    cardCounts.set(uid, (cardCounts.get(uid) ?? 0) + 1);
  }

  return usersSnap.docs.map((d, idx) => {
    const data = d.data();
    const unlockedCount = cardCounts.get(d.id) ?? 0;
    return {
      rank: idx + 1,
      userId: d.id,
      name: data.name ?? "",
      photo: data.photo ?? null,
      points: data.points ?? 0,
      unlockedCount,
      progress: total > 0 ? (unlockedCount / total) * 100 : 0,
    };
  });
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
  const [userCardsSnap, raritySnap] = await Promise.all([
    getDocs(query(collection(db, "userCards"), orderBy("unlockedAt", "desc"), limit(20))),
    getDocs(query(collection(db, "rarityEvents"), orderBy("upgradedAt", "desc"), limit(10))),
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

  if (userCardsSnap.empty) {
    return rarityActivities
      .sort((a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime())
      .slice(0, 20);
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

  return [...rarityActivities, ...cardActivities]
    .sort((a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime())
    .slice(0, 20);
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

export async function listUsers(): Promise<User[]> {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => toUser(d.id, d.data()));
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

  const [userDocs, missionDocs] = await Promise.all([
    Promise.all(userIds.map((id) => getDoc(doc(db, "users", id)))),
    Promise.all(missionIds.map((id) => getDoc(doc(db, "missions", id)))),
  ]);

  const usersMap = new Map(userDocs.filter((d) => d.exists()).map((d) => [d.id, d.data()!]));
  const missionsMap = new Map(missionDocs.filter((d) => d.exists()).map((d) => [d.id, d.data()!]));

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

  const [userCards, allCollabs, userDoc] = await Promise.all([
    getUserCards(um.userId),
    getAllCollaborators(),
    getDoc(doc(db, "users", um.userId)),
  ]);

  const rewardCard = await awardRandomCard(um.userId, userCards, allCollabs);
  const bonusPoints = rewardCard ? 0 : mission.rewardPoints;

  const batch = writeBatch(db);
  batch.update(doc(db, "userMissions", userMissionId), {
    submissionStatus: "in_progress",
    completed: true,
    completedAt: serverTimestamp(),
  });

  const currentPoints = userDoc.data()?.points ?? 0;
  if (rewardCard) {
    await addCardToUser(um.userId, rewardCard.id, "mission");
    const updatedCards = [...userCards, rewardCard.id];
    const progress = allCollabs.length > 0
      ? (updatedCards.length / allCollabs.length) * 100
      : 0;
    batch.update(doc(db, "users", um.userId), {
      points: currentPoints + mission.rewardPoints + rewardCard.points,
      progress,
    });
  } else {
    batch.update(doc(db, "users", um.userId), {
      points: currentPoints + bonusPoints,
    });
  }

  await batch.commit();
  return { rewardCard, bonusPoints };
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
