import { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetMyMissions,
  useCompleteMission,
  useStartMission,
  useSubmitMissionProof,
  useListCollaborators,
  useGetMyCards,
  useListUsers,
  useStartPeerInteractionMission,
  useStartQuestionMission,
  useGetIncomingChallenges,
  useAnswerChallenge,
  getGetMyMissionsQueryKey,
  getGetMyCardsQueryKey,
  getGetAlbumStatsQueryKey,
  type Collaborator,
} from "@/hooks/use-db";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Play, Award, Loader2, Clock, Send, CheckCircle2, XCircle,
  Zap, Users, FileText, Star, Lock, TrendingUp, Paperclip, X, Image,
  Handshake, HelpCircle
} from "lucide-react";

// ── Mission type config ───────────────────────────────────────────────────────
const MISSION_TYPE_CONFIG: Record<string, { emoji: string; label: string }> = {
  unlock_cards:     { emoji: "🎴", label: "Figurinhas" },
  unlock_category:  { emoji: "📂", label: "Categoria" },
  unlock_rarity:    { emoji: "💎", label: "Raridade" },
  login:            { emoji: "⚡", label: "Login" },
  album_percent:    { emoji: "📊", label: "Álbum %" },
  peer_interaction: { emoji: "🤝", label: "Interação" },
  peer_question:    { emoji: "❓", label: "Desafio" },
};

const MISSION_KIND: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  auto:     { label: "Automática",  color: "bg-blue-100 text-blue-700",   icon: Zap },
  peer:     { label: "Interação",   color: "bg-purple-100 text-purple-700", icon: Users },
  evidence: { label: "Evidência",   color: "bg-orange-100 text-orange-700", icon: FileText },
};

const RARITY_LABEL: Record<string, string> = {
  comum: "⚪ Comum", rara: "🔵 Rara", epica: "🟣 Épica", lendaria: "🟡 Lendária",
};

// ── Reward Card Dialog ────────────────────────────────────────────────────────
function RewardDialog({
  card,
  bonusPoints,
  onClose,
}: {
  card: Collaborator | null;
  bonusPoints: number;
  onClose: () => void;
}) {
  const RARITY_GLOW: Record<string, string> = {
    comum: "",
    rara: "shadow-[0_0_30px_rgba(60,181,229,0.5)]",
    epica: "shadow-[0_0_30px_rgba(168,85,247,0.6)]",
    lendaria: "shadow-[0_0_40px_rgba(255,215,0,0.8)]",
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm text-center p-0 overflow-hidden rounded-2xl">
        <DialogTitle className="sr-only">Recompensa da Missão</DialogTitle>
        <div className="bg-gradient-to-b from-[#002776] to-[#001a50] p-8">
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="text-6xl mb-4"
          >
            🎁
          </motion.div>
          <h2 className="text-white font-black text-xl mb-1">Missão Concluída!</h2>
          <p className="text-white/70 text-sm">
            {card ? "Você ganhou uma figurinha!" : `+${bonusPoints} pontos bônus!`}
          </p>
        </div>

        {card ? (
          <div className="p-6 space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`relative rounded-2xl overflow-hidden mx-auto w-40 aspect-[3/4] border-4 ${
                card.rarity === "lendaria" ? "border-yellow-400" :
                card.rarity === "epica" ? "border-purple-400" :
                card.rarity === "rara" ? "border-blue-400" : "border-gray-300"
              } ${RARITY_GLOW[card.rarity] ?? ""} ${card.isSpecial ? "border-4 border-yellow-400" : ""}`}
            >
              {card.photoUrl ? (
                <img src={card.photoUrl} alt={card.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                  <span className="text-4xl">👤</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute bottom-2 left-2 right-2 text-white">
                <Badge className={`mb-1 text-[10px] border-0 ${
                  card.rarity === "lendaria" ? "bg-yellow-400/20 text-yellow-300" :
                  card.rarity === "epica" ? "bg-purple-400/20 text-purple-300" :
                  card.rarity === "rara" ? "bg-blue-400/20 text-blue-300" : "bg-gray-400/20 text-gray-300"
                }`}>
                  {card.isSpecial ? "⭐ ESPECIAL" : (RARITY_LABEL[card.rarity] ?? card.rarity.toUpperCase())}
                </Badge>
                <p className="font-bold text-xs leading-tight">{card.name}</p>
                <p className="text-[10px] text-white/70">{card.role}</p>
              </div>
            </motion.div>

            <div className="space-y-1">
              <p className="font-bold text-foreground">{card.name}</p>
              <p className="text-sm text-muted-foreground">{card.role}</p>
              <Badge className="mt-1">{card.category}</Badge>
              {card.isSpecial && (
                <Badge className="ml-1 mt-1 bg-yellow-100 text-yellow-700 border-0">⭐ Figurinha Especial</Badge>
              )}
            </div>

            <Button className="w-full copa-badge text-[#002776] font-bold border-0" onClick={onClose}>
              🏆 Incrível! Fechar
            </Button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div className="text-5xl">⭐</div>
            <p className="font-bold">
              {bonusPoints > 0 ? "Você já tem todas as figurinhas!" : "Recompensa coletada!"}
            </p>
            {bonusPoints > 0 && (
              <p className="text-sm text-muted-foreground">+{bonusPoints} pontos bônus adicionados</p>
            )}
            <Button className="w-full" onClick={onClose}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Mission progress display ──────────────────────────────────────────────────
function MissionProgressBar({
  progress,
  goal,
  missionType,
}: {
  progress: number;
  goal: number;
  missionType: string;
}) {
  const pct = goal > 0 ? Math.min((progress / goal) * 100, 100) : 0;

  if (missionType === "album_percent") {
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Progresso do álbum
          </span>
          <span className="font-semibold text-primary">{progress}% / {goal}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <motion.div
            className="h-2 rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Progresso</span>
        <span className="font-semibold">{progress} / {goal}</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <motion.div
          className="h-2 rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>
    </div>
  );
}

// ── Evidence proof form with file upload ──────────────────────────────────────
function EvidenceProofForm({
  proofText,
  proofAttachments,
  onProofChange,
  onAttachmentsChange,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  proofText: string;
  proofAttachments: Array<{ name: string; data: string }>;
  onProofChange: (text: string) => void;
  onAttachmentsChange: (files: Array<{ name: string; data: string }>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    Promise.all(
      files.map(
        (file) =>
          new Promise<{ name: string; data: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ name: file.name, data: reader.result as string });
            reader.onerror = reject;
            reader.readAsDataURL(file);
          })
      )
    ).then((encoded) => {
      onAttachmentsChange([...proofAttachments, ...encoded]);
    });
    e.target.value = "";
  };

  const removeAttachment = (idx: number) => {
    onAttachmentsChange(proofAttachments.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <Textarea
        placeholder="Descreva sua evidência aqui..."
        value={proofText}
        onChange={(e) => onProofChange(e.target.value)}
        className="text-xs min-h-[80px]"
      />

      {/* Attachments preview */}
      {proofAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {proofAttachments.map((att, i) => (
            <div key={i} className="relative group">
              {att.data.startsWith("data:image/") ? (
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-border">
                  <img src={att.data} alt={att.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg border border-border bg-muted flex flex-col items-center justify-center gap-1">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <span className="text-[9px] text-muted-foreground text-center leading-tight px-1 truncate w-full">{att.name}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAttachment(i)}
                className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ width: 18, height: 18 }}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* File input trigger */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-xs gap-1.5"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="w-3 h-3" />
          Anexar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-xs"
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          className="flex-1 text-xs"
          onClick={onSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3 mr-1" />Enviar</>}
        </Button>
      </div>
    </div>
  );
}

// ── Mission card ──────────────────────────────────────────────────────────────
function MissionCard({
  mission,
  idx,
  action,
  proofMissionId,
  proofText,
  proofAttachments,
  onProofChange,
  onAttachmentsChange,
  onSubmitProof,
  onResubmit,
  isSubmitting,
}: {
  mission: any;
  idx: number;
  action?: React.ReactNode;
  proofMissionId?: string | null;
  proofText?: string;
  proofAttachments?: Array<{ name: string; data: string }>;
  onProofChange?: (text: string) => void;
  onAttachmentsChange?: (files: Array<{ name: string; data: string }>) => void;
  onSubmitProof?: (id: string, title: string) => void;
  onResubmit?: (id: string) => void;
  isSubmitting?: boolean;
}) {
  const typeConfig = MISSION_TYPE_CONFIG[mission.missionType] ?? { emoji: "🎯", label: mission.missionType };
  const kindConfig = MISSION_KIND[mission.type];
  const pct = mission.goal > 0 ? Math.min((mission.progress / mission.goal) * 100, 100) : 0;

  const isAlbumPercent = mission.missionType === "album_percent";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04 }}
      className={`bg-card border rounded-xl p-4 space-y-3 ${
        mission.completed ? "border-green-200 bg-green-50/30" :
        mission.submissionStatus === "pending_review" ? "border-orange-200 bg-orange-50/30" :
        mission.submissionStatus === "rejected" ? "border-red-200 bg-red-50/30" :
        isAlbumPercent ? "border-primary/20 bg-primary/3" :
        "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${
            isAlbumPercent ? "bg-primary/10" : "bg-muted"
          }`}>
            {typeConfig.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
              <h3 className="font-bold text-sm">{mission.title}</h3>
              {isAlbumPercent && (
                <Badge className="text-[10px] bg-primary/10 text-primary border-0">🏆 Especial</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{mission.description}</p>
            {mission.targetUserName && (
              <p className="text-xs text-muted-foreground mt-0.5">
                🤝 Colega: <span className="font-semibold text-foreground">{mission.targetUserName}</span>
              </p>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-bold text-primary">+{mission.rewardPoints}</div>
          <div className="text-[10px] text-muted-foreground">pts</div>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {kindConfig && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${kindConfig.color}`}>
            <kindConfig.icon className="w-2.5 h-2.5" />
            {kindConfig.label}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
          {typeConfig.emoji} {typeConfig.label}
        </span>
        {mission.completed && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
            <CheckCircle2 className="w-2.5 h-2.5" /> Concluída
          </span>
        )}
        {mission.submissionStatus === "pending_review" && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
            <Clock className="w-2.5 h-2.5" /> Aguardando
          </span>
        )}
        {mission.submissionStatus === "rejected" && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
            <XCircle className="w-2.5 h-2.5" /> Rejeitada
          </span>
        )}
      </div>

      {/* Progress bar (only for started missions that aren't completed, and not peer types) */}
      {mission.started && !mission.completed &&
        mission.missionType !== "peer_interaction" && mission.missionType !== "peer_question" && (
        <MissionProgressBar
          progress={mission.progress}
          goal={mission.goal}
          missionType={mission.missionType}
        />
      )}

      {/* album_percent: show auto-start note */}
      {isAlbumPercent && !mission.started && !mission.completed && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-2">
          <TrendingUp className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
          <span>Esta missão acompanha automaticamente o progresso do seu álbum.</span>
        </div>
      )}

      {/* peer_question: waiting for target answer */}
      {mission.missionType === "peer_question" && mission.started && !mission.completed && (
        <div className="space-y-1.5 bg-muted/50 rounded-lg px-2.5 py-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <HelpCircle className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
            <span>
              {mission.challengeStatus === "correct"
                ? "Seu colega respondeu corretamente!"
                : `Aguardando ${mission.targetUserName ?? "seu colega"} responder o desafio.`}
            </span>
          </div>
          {mission.challengeQuestion && (
            <p className="text-xs italic text-foreground/80">"{mission.challengeQuestion}"</p>
          )}
        </div>
      )}

      {/* peer_interaction: pending review note (when not yet in the standard "pending_review" badge state) */}
      {mission.missionType === "peer_interaction" && mission.started && !mission.completed &&
        mission.submissionStatus === "in_progress" && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-2">
          <Handshake className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
          <span>Interação registrada com {mission.targetUserName ?? "o colega escolhido"}.</span>
        </div>
      )}

      {/* Evidence proof area */}
      {mission.type === "evidence" && mission.started && !mission.completed &&
        mission.submissionStatus !== "pending_review" && (
          proofMissionId === mission.missionId ? (
            <EvidenceProofForm
              proofText={proofText ?? ""}
              proofAttachments={proofAttachments ?? []}
              onProofChange={onProofChange ?? (() => {})}
              onAttachmentsChange={onAttachmentsChange ?? (() => {})}
              onSubmit={() => onSubmitProof?.(mission.missionId, mission.title)}
              onCancel={() => { onProofChange?.(""); onAttachmentsChange?.([]); }}
              isSubmitting={isSubmitting ?? false}
            />
          ) : null
        )
      }

      {/* Rejection note */}
      {mission.submissionStatus === "rejected" && mission.reviewNote && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700">
          <p className="font-semibold mb-0.5">📝 Feedback do admin:</p>
          <p>{mission.reviewNote}</p>
        </div>
      )}

      {/* Action area */}
      {action && <div className="pt-1">{action}</div>}
    </motion.div>
  );
}

// ── Rarity progression banner config ─────────────────────────────────────────
const RARITY_BANNER: Record<string, { gradient: string; emoji: string; label: string; text: string }> = {
  rara:     { gradient: "from-[#3CB5E5] to-[#1a8fc4]",  emoji: "🔵", label: "Rara",     text: "Você completou 50% do álbum. Continue!" },
  epica:    { gradient: "from-purple-600 to-purple-800", emoji: "💜", label: "Épica",    text: "Incrível! 75% do álbum já coletado!" },
  lendaria: { gradient: "from-yellow-500 to-amber-600",  emoji: "⭐", label: "Lendária", text: "🏆 100% do álbum! Você é uma LENDA!" },
};

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({
  title,
  color,
  children,
}: {
  title: string;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h2 className={`text-sm font-black ${color ?? "text-foreground"}`}>{title}</h2>
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MissionsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: missions, isLoading } = useGetMyMissions();
  const completeMission = useCompleteMission();
  const startMission = useStartMission();
  const submitProof = useSubmitMissionProof();
  const startPeerInteraction = useStartPeerInteractionMission();
  const startQuestionMission = useStartQuestionMission();
  const { data: incomingChallenges } = useGetIncomingChallenges();
  const answerChallenge = useAnswerChallenge();

  const { user: authUser } = useAuth();
  const { data: collaborators } = useListCollaborators();
  const { data: myCards } = useGetMyCards();
  const { data: allUsers } = useListUsers();
  const myCollaborator = useMemo(
    () => collaborators?.find((c) => c.email?.toLowerCase() === authUser?.email?.toLowerCase()) ?? null,
    [collaborators, authUser?.email]
  );

  // Compute album progress locally (same formula as album & profile pages)
  const collaboratorIdSet = useMemo(
    () => new Set((collaborators ?? []).map((c) => c.id)),
    [collaborators]
  );
  const validUnlockedCount = useMemo(
    () => (myCards ?? []).filter((id) => collaboratorIdSet.has(id)).length,
    [myCards, collaboratorIdSet]
  );
  const totalCollaborators = collaborators?.length ?? 0;
  const albumProgressPct = Math.min(
    100,
    totalCollaborators > 0 ? Math.round((validUnlockedCount / totalCollaborators) * 100) : 0
  );
  // Effective rarity based on real current progress
  const effectiveRarity =
    albumProgressPct >= 100 ? "lendaria" :
    albumProgressPct >= 75  ? "epica"    :
    albumProgressPct >= 50  ? "rara"     : null;

  const [reward, setReward] = useState<{ card: Collaborator | null; bonusPoints: number } | null>(null);
  const [proofMissionId, setProofMissionId] = useState<string | null>(null);
  const [proofText, setProofText] = useState("");
  const [proofAttachments, setProofAttachments] = useState<Array<{ name: string; data: string }>>([]);
  const [peerDialogMission, setPeerDialogMission] = useState<{ missionId: string; title: string; missionType: string } | null>(null);
  const [challengeAnswers, setChallengeAnswers] = useState<Record<string, string>>({});

  // Group missions — album_percent auto-missions are always shown in "in progress" even without explicit start
  const canClaim   = missions?.filter((m) => m.started && !m.completed && m.submissionStatus === "in_progress" && m.progress >= m.goal && m.type !== "evidence") ?? [];
  const pending    = missions?.filter((m) => m.submissionStatus === "pending_review") ?? [];
  const inProgress = missions?.filter((m) => m.started && !m.completed && m.submissionStatus === "in_progress" && (m.type === "evidence" || m.progress < m.goal) && m.missionType !== "album_percent") ?? [];
  const albumPct   = missions?.filter((m) => m.missionType === "album_percent" && !m.completed) ?? [];
  const rejected   = missions?.filter((m) => m.submissionStatus === "rejected") ?? [];
  const notStarted = missions?.filter((m) => !m.started && !m.completed && m.missionType !== "album_percent") ?? [];
  const completed  = missions?.filter((m) => m.completed) ?? [];

  const totalCount = missions?.length ?? 0;
  const completedCount = completed.length;

  const handleStart = (missionId: string, title: string) => {
    startMission.mutate({ missionId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyMissionsQueryKey() });
        toast({ title: `⚽ Missão iniciada: ${title}!` });
      },
    });
  };

  const handleStartPeerInteraction = (missionId: string, title: string, targetUserId: string) => {
    startPeerInteraction.mutate({ missionId, targetUserId }, {
      onSuccess: (data: any) => {
        queryClient.invalidateQueries({ queryKey: getGetMyMissionsQueryKey() });
        if (data?.completed) {
          if (data?.rewardCard !== undefined) {
            setReward({ card: data.rewardCard, bonusPoints: data.bonusPoints ?? 0 });
          } else {
            toast({ title: `🏆 Missão concluída: ${title}!` });
          }
        } else {
          toast({ title: `🤝 Interação registrada: ${title}! Aguardando aprovação do admin.` });
        }
        setPeerDialogMission(null);
      },
      onError: (e: any) => {
        toast({ title: e?.response?.data?.error ?? "Erro ao iniciar missão", variant: "destructive" });
      },
    });
  };

  const handleStartQuestionMission = (missionId: string, title: string, targetUserId: string, question: string, answer: string) => {
    if (!question.trim() || !answer.trim()) {
      toast({ title: "Preencha a pergunta e a resposta", variant: "destructive" });
      return;
    }
    startQuestionMission.mutate({ missionId, targetUserId, question: question.trim(), answer: answer.trim() }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyMissionsQueryKey() });
        toast({ title: `❓ Desafio criado: ${title}! Aguardando resposta do colega.` });
        setPeerDialogMission(null);
      },
      onError: (e: any) => {
        toast({ title: e?.response?.data?.error ?? "Erro ao iniciar missão", variant: "destructive" });
      },
    });
  };

  const handleAnswerChallenge = (userMissionId: string) => {
    const answer = challengeAnswers[userMissionId]?.trim();
    if (!answer) {
      toast({ title: "Digite uma resposta", variant: "destructive" });
      return;
    }
    answerChallenge.mutate({ userMissionId, answer }, {
      onSuccess: (data: any) => {
        queryClient.invalidateQueries({ queryKey: ["incomingChallenges"] });
        if (data?.correct) {
          toast({ title: "✅ Resposta correta! Seu colega foi recompensado." });
        } else {
          toast({ title: "❌ Resposta incorreta. Tente novamente!", variant: "destructive" });
        }
        setChallengeAnswers((prev) => ({ ...prev, [userMissionId]: "" }));
      },
      onError: (e: any) => {
        toast({ title: e?.response?.data?.error ?? "Erro ao responder", variant: "destructive" });
      },
    });
  };

  const handleComplete = (missionId: string) => {
    completeMission.mutate({ missionId }, {
      onSuccess: (data: any) => {
        queryClient.invalidateQueries({ queryKey: getGetMyMissionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyCardsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAlbumStatsQueryKey() });
        if (data?.rewardCard !== undefined) {
          setReward({ card: data.rewardCard, bonusPoints: data.bonusPoints ?? 0 });
        } else {
          toast({ title: "🏆 Missão concluída! Recompensa dada!" });
        }
      },
      onError: (e: any) => {
        toast({ title: e?.response?.data?.error ?? "Erro ao concluir", variant: "destructive" });
      },
    });
  };

  const handleSubmitProof = (missionId: string, title: string) => {
    if (!proofText.trim() && proofAttachments.length === 0) {
      toast({ title: "Escreva uma evidência ou adicione um anexo antes de enviar", variant: "destructive" });
      return;
    }
    const proofPayload = proofAttachments.length > 0
      ? JSON.stringify({ text: proofText.trim(), attachments: proofAttachments })
      : proofText.trim();
    submitProof.mutate({ missionId, data: { proofText: proofPayload } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyMissionsQueryKey() });
        toast({ title: `📋 Comprovante enviado: ${title}! Aguardando validação do admin.` });
        setProofMissionId(null);
        setProofText("");
        setProofAttachments([]);
      },
      onError: () => toast({ title: "Erro ao enviar comprovante", variant: "destructive" }),
    });
  };

  const handleResubmit = (missionId: string) => {
    setProofMissionId(missionId);
    setProofText("");
    setProofAttachments([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">🎯 Missões da Copa</h1>
          <p className="text-muted-foreground text-sm mt-1">Complete objetivos e ganhe figurinhas sorteadas!</p>
        </div>
        {totalCount > 0 && (
          <div className="text-right">
            <div className="text-2xl font-black text-primary">{completedCount}/{totalCount}</div>
            <p className="text-xs text-muted-foreground">concluídas</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(MISSION_KIND).map(([k, v]) => (
          <div key={k} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${v.color}`}>
            <v.icon className="w-3 h-3" />
            {v.label}
          </div>
        ))}
      </div>

      {/* Rarity progression banner — based on real current album progress */}
      {myCollaborator && effectiveRarity && RARITY_BANNER[effectiveRarity] && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`bg-gradient-to-r ${RARITY_BANNER[effectiveRarity]!.gradient} rounded-xl p-4 flex items-center gap-4`}
        >
          <span className="text-4xl">{RARITY_BANNER[effectiveRarity]!.emoji}</span>
          <div>
            <h3 className="font-black text-white text-sm">
              🎉 Parabéns, {myCollaborator.name.split(" ")[0]}!
            </h3>
            <p className="text-white/90 text-xs mt-0.5">
              Sua figurinha é <strong>{RARITY_BANNER[effectiveRarity]!.label}</strong> — {albumProgressPct}% do álbum
            </p>
            <p className="text-white/70 text-[11px] mt-0.5">
              {RARITY_BANNER[effectiveRarity]!.text}
            </p>
          </div>
        </motion.div>
      )}

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progresso geral</span>
            <span>{Math.round((completedCount / totalCount) * 100)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <motion.div
              className="h-2 rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${(completedCount / totalCount) * 100}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-6">
          {/* ── Can claim ── */}
          {canClaim.length > 0 && (
            <Section title="🏆 Pronto para Resgatar" color="text-yellow-600">
              {canClaim.map((m, i) => (
                <MissionCard key={m.missionId} mission={m} idx={i}
                  action={
                    <Button size="sm" onClick={() => handleComplete(m.missionId)}
                      disabled={completeMission.isPending}
                      className="w-full copa-badge text-[#002776] font-bold border-0"
                    >
                      {completeMission.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "🎁 Resgatar Recompensa"}
                    </Button>
                  }
                />
              ))}
            </Section>
          )}

          {/* ── Album % milestone missions ── */}
          {albumPct.length > 0 && (
            <Section title="📊 Missões de Progresso do Álbum" color="text-primary">
              {albumPct.map((m, i) => (
                <MissionCard key={m.missionId} mission={m} idx={i}
                  action={
                    m.progress >= m.goal ? (
                      <Button size="sm" onClick={() => handleComplete(m.missionId)}
                        disabled={completeMission.isPending}
                        className="w-full copa-badge text-[#002776] font-bold border-0"
                      >
                        {completeMission.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "🎁 Resgatar Figurinha Especial!"}
                      </Button>
                    ) : (
                      <div className="text-xs text-muted-foreground text-center py-1">
                        Complete mais figurinhas no álbum para desbloquear!
                      </div>
                    )
                  }
                />
              ))}
            </Section>
          )}

          {/* ── Pending review ── */}
          {pending.length > 0 && (
            <Section title="⏳ Aguardando Revisão" color="text-orange-600">
              {pending.map((m, i) => (
                <MissionCard key={m.missionId} mission={m} idx={i} />
              ))}
            </Section>
          )}

          {/* ── Rejected ── */}
          {rejected.length > 0 && (
            <Section title="❌ Rejeitadas" color="text-red-600">
              {rejected.map((m, i) => (
                <MissionCard key={m.missionId} mission={m} idx={i}
                  proofMissionId={proofMissionId}
                  proofText={proofText}
                  proofAttachments={proofAttachments}
                  onProofChange={setProofText}
                  onAttachmentsChange={setProofAttachments}
                  onSubmitProof={handleSubmitProof}
                  isSubmitting={submitProof.isPending}
                  action={
                    proofMissionId !== m.missionId ? (
                      <Button size="sm" variant="outline" onClick={() => handleResubmit(m.missionId)}
                        className="w-full text-xs"
                      >
                        <Send className="w-3 h-3 mr-1" /> Reenviar Comprovante
                      </Button>
                    ) : undefined
                  }
                />
              ))}
            </Section>
          )}

          {/* ── In progress ── */}
          {inProgress.length > 0 && (
            <Section title="🔥 Em Progresso">
              {inProgress.map((m, i) => (
                <MissionCard key={m.missionId} mission={m} idx={i}
                  proofMissionId={proofMissionId}
                  proofText={proofText}
                  proofAttachments={proofAttachments}
                  onProofChange={setProofText}
                  onAttachmentsChange={setProofAttachments}
                  onSubmitProof={handleSubmitProof}
                  isSubmitting={submitProof.isPending}
                  action={
                    m.type === "evidence" && proofMissionId !== m.missionId ? (
                      <Button size="sm" variant="outline" onClick={() => setProofMissionId(m.missionId)}
                        className="w-full text-xs"
                      >
                        <Send className="w-3 h-3 mr-1" /> Enviar Comprovante
                      </Button>
                    ) : undefined
                  }
                />
              ))}
            </Section>
          )}

          {/* ── Not started ── */}
          {notStarted.length > 0 && (
            <Section title="🔒 Disponíveis" color="text-muted-foreground">
              {notStarted.map((m, i) => (
                <MissionCard key={m.missionId} mission={m} idx={i}
                  action={
                    m.missionType === "peer_interaction" || m.missionType === "peer_question" ? (
                      <Button size="sm" variant="outline"
                        onClick={() => setPeerDialogMission({ missionId: m.missionId, title: m.title, missionType: m.missionType })}
                        className="w-full text-xs"
                      >
                        {m.missionType === "peer_interaction"
                          ? <><Handshake className="w-3 h-3 mr-1" />Escolher Colega</>
                          : <><HelpCircle className="w-3 h-3 mr-1" />Criar Desafio</>}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => handleStart(m.missionId, m.title)}
                        disabled={startMission.isPending}
                        className="w-full text-xs"
                      >
                        {startMission.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Play className="w-3 h-3 mr-1" />Iniciar Missão</>}
                      </Button>
                    )
                  }
                />
              ))}
            </Section>
          )}

          {/* ── Incoming challenges (peer_question, need to answer) ── */}
          {incomingChallenges && incomingChallenges.length > 0 && (
            <Section title="📨 Desafios Recebidos" color="text-purple-600">
              {incomingChallenges.map((c, i) => (
                <motion.div
                  key={c.userMissionId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-card border border-purple-200 bg-purple-50/30 rounded-xl p-4 space-y-3"
                >
                  <div>
                    <h3 className="font-bold text-sm">{c.missionTitle}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      De: <span className="font-semibold text-foreground">{c.fromUserName}</span>
                    </p>
                    <p className="text-sm italic mt-1.5">"{c.question}"</p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Sua resposta..."
                      value={challengeAnswers[c.userMissionId] ?? ""}
                      onChange={(e) => setChallengeAnswers((prev) => ({ ...prev, [c.userMissionId]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAnswerChallenge(c.userMissionId); }}
                      className="text-sm"
                    />
                    <Button size="sm" onClick={() => handleAnswerChallenge(c.userMissionId)}
                      disabled={answerChallenge.isPending}
                    >
                      {answerChallenge.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </Section>
          )}

          {/* ── Completed ── */}
          {completed.length > 0 && (
            <Section title={`✅ Concluídas (${completed.length})`} color="text-green-600">
              {completed.map((m, i) => (
                <MissionCard key={m.missionId} mission={m} idx={i} />
              ))}
            </Section>
          )}

          {/* Empty state */}
          {totalCount === 0 && (
            <div className="text-center py-16 text-muted-foreground space-y-3">
              <div className="text-5xl">🎯</div>
              <p className="font-semibold">Nenhuma missão disponível</p>
              <p className="text-sm">As missões serão adicionadas em breve!</p>
            </div>
          )}
        </div>
      )}

      {/* Reward dialog */}
      {reward && (
        <RewardDialog
          card={reward.card}
          bonusPoints={reward.bonusPoints}
          onClose={() => setReward(null)}
        />
      )}

      {/* Peer target / question dialog */}
      {peerDialogMission && (
        <PeerMissionDialog
          mission={peerDialogMission}
          users={(allUsers ?? []).filter((u) => u.id !== authUser?.id)}
          isSubmitting={startPeerInteraction.isPending || startQuestionMission.isPending}
          onClose={() => setPeerDialogMission(null)}
          onSubmitPeerInteraction={(targetUserId) =>
            handleStartPeerInteraction(peerDialogMission.missionId, peerDialogMission.title, targetUserId)
          }
          onSubmitQuestion={(targetUserId, question, answer) =>
            handleStartQuestionMission(peerDialogMission.missionId, peerDialogMission.title, targetUserId, question, answer)
          }
        />
      )}
    </div>
  );
}

// ── Peer mission start dialog ────────────────────────────────────────────────
function PeerMissionDialog({
  mission,
  users,
  isSubmitting,
  onClose,
  onSubmitPeerInteraction,
  onSubmitQuestion,
}: {
  mission: { missionId: string; title: string; missionType: string };
  users: Array<{ id: string; name: string; email: string }>;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmitPeerInteraction: (targetUserId: string) => void;
  onSubmitQuestion: (targetUserId: string, question: string, answer: string) => void;
}) {
  const [targetUserId, setTargetUserId] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const isQuestion = mission.missionType === "peer_question";

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="flex items-center gap-2 text-base">
          {isQuestion ? <HelpCircle className="w-4 h-4" /> : <Handshake className="w-4 h-4" />}
          {mission.title}
        </DialogTitle>
        <div className="space-y-3 pt-1">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Escolha um colega
            </label>
            <Select value={targetUserId} onValueChange={setTargetUserId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um colega..." />
              </SelectTrigger>
              <SelectContent className="max-h-72 overflow-y-auto">
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isQuestion && (
            <>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Pergunta para o seu colega
                </label>
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ex: Qual é a capital do Brasil?"
                  className="text-sm"
                  rows={2}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Resposta correta
                </label>
                <Input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Ex: Brasília"
                  className="text-sm"
                />
              </div>
            </>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={!targetUserId || isSubmitting || (isQuestion && (!question.trim() || !answer.trim()))}
              onClick={() =>
                isQuestion
                  ? onSubmitQuestion(targetUserId, question, answer)
                  : onSubmitPeerInteraction(targetUserId)
              }
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
