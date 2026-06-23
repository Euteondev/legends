import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListCollaborators,
  useGetMyCards,
  useUnlockCard,
  useChallengeCard,
  getGetMyCardsQueryKey,
  getGetAlbumStatsQueryKey,
  getGetRecentActivityQueryKey,
  getGetMyMissionsQueryKey,
  type Collaborator,
} from "@/hooks/use-db";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, X, Lock, Unlock, Star, Zap, Award, Clock, Users,
  ChevronLeft, ChevronRight, BookOpen, Loader2, HelpCircle
} from "lucide-react";
import { CollaboratorCard } from "@/components/cards/CollaboratorCard";

// ── Rarity styling ─────────────────────────────────────────────────────────────
const RARITY_BORDER: Record<string, string> = {
  comum:    "border-gray-300",
  rara:     "border-[#3CB5E5] shadow-[0_0_10px_rgba(60,181,229,0.3)]",
  epica:    "border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.4)]",
  lendaria: "border-yellow-400 shadow-[0_0_15px_rgba(255,215,0,0.5)]",
};

const RARITY_BADGE: Record<string, string> = {
  comum:    "bg-gray-100 text-gray-600",
  rara:     "bg-blue-100 text-blue-700",
  epica:    "bg-purple-100 text-purple-700",
  lendaria: "bg-yellow-100 text-yellow-700",
};

const RARITY_LABEL: Record<string, string> = {
  comum: "Comum", rara: "Rara", epica: "Épica", lendaria: "Lendária",
};

// ── Category config ────────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<string, { emoji: string; color: string; bg: string }> = {
  "Guardiões dos Contratos": { emoji: "🛡️", color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  "Mestres da Estratégia":   { emoji: "♟️", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  "Especialistas da Operação":{ emoji: "⚙️", color: "text-green-700",  bg: "bg-green-50 border-green-200" },
  "Lendas Financeiras":      { emoji: "🏆", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
};

const DEFAULT_CATEGORY = { emoji: "⭐", color: "text-primary", bg: "bg-primary/5 border-primary/20" };

// ── Album sticker slot ─────────────────────────────────────────────────────────
function StickerSlot({
  collaborator,
  isUnlocked,
  slotIdx,
  onClick,
}: {
  collaborator: Collaborator;
  isUnlocked: boolean;
  slotIdx: number;
  onClick: () => void;
}) {
  if (!isUnlocked) {
    return (
      <motion.button
        whileHover={{ scale: 1.03 }}
        onClick={onClick}
        className="relative aspect-[3/4] rounded-lg overflow-hidden border-2 border-dashed border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center cursor-pointer group hover:border-primary/40 transition-all"
        data-testid={`card-collaborator-${collaborator.id}`}
      >
        <div className="absolute top-1.5 left-2 text-[10px] font-bold text-gray-300">
          #{slotIdx + 1}
        </div>
        <div className="w-10 h-10 rounded-full bg-gray-200 mb-1.5 opacity-60" />
        <div className="w-12 h-1.5 rounded bg-gray-200 mb-1 opacity-60" />
        <div className="w-8 h-1 rounded bg-gray-200 opacity-40" />
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="text-center">
            <HelpCircle className="w-5 h-5 text-primary/70 mx-auto mb-0.5" />
            <span className="text-[10px] text-primary/80 font-semibold">Desafiar!</span>
          </div>
        </div>
      </motion.button>
    );
  }

  return (
    <div data-testid={`card-collaborator-${collaborator.id}`}>
      <CollaboratorCard collaborator={collaborator} isUnlocked={true} onClick={onClick} />
    </div>
  );
}

// ── Challenge Dialog ───────────────────────────────────────────────────────────
function ChallengeDialog({
  collaborator,
  onClose,
  onSuccess,
}: {
  collaborator: Collaborator;
  onClose: () => void;
  onSuccess: (card: Collaborator) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const challengeCard = useChallengeCard();
  const { toast } = useToast();

  const question = collaborator.challengeQuestion?.trim()
    ? collaborator.challengeQuestion.trim()
    : `Qual é o Super Poder de ${collaborator.name}?`;

  const handleSubmit = () => {
    if (!answer.trim()) return;
    challengeCard.mutate(
      { collaboratorId: collaborator.id, data: { answer: answer.trim() } },
      {
        onSuccess: (data: any) => {
          if (data.success) {
            toast({ title: "🎉 Correto! Figurinha desbloqueada!", description: data.message });
            onSuccess(data.collaborator ?? collaborator);
          } else {
            setAttempts((a) => a + 1);
            setHint(data.hint ?? null);
            toast({
              title: "❌ Resposta incorreta",
              description: data.message ?? "Tente novamente!",
              variant: "destructive",
            });
            setAnswer("");
          }
        },
        onError: () => {
          toast({ title: "Erro ao enviar resposta", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl">
        <DialogTitle className="sr-only">Desafio: {collaborator.name}</DialogTitle>

        {/* Header */}
        <div className="bg-gradient-to-br from-[#002776] to-[#001a50] p-6 text-center relative overflow-hidden">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="text-5xl mb-3"
          >
            🏆
          </motion.div>
          <h2 className="text-white font-black text-lg">Desafio Legends</h2>
          <p className="text-white/70 text-sm mt-1">Responda certo para desbloquear a figurinha!</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Collaborator preview */}
          <div className="flex items-center gap-3 bg-muted/60 rounded-xl p-3">
            {collaborator.photoUrl ? (
              <img src={collaborator.photoUrl} alt={collaborator.name} className="w-12 h-12 rounded-full object-cover border-2 border-primary/30" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/30">
                <Users className="w-6 h-6 text-primary/50" />
              </div>
            )}
            <div>
              <p className="font-bold text-sm">{collaborator.name}</p>
              <p className="text-xs text-muted-foreground">{collaborator.role}</p>
              <Badge className={`mt-0.5 text-[10px] border-0 ${RARITY_BADGE[collaborator.rarity]}`}>
                {RARITY_LABEL[collaborator.rarity] ?? collaborator.rarity}
              </Badge>
            </div>
          </div>

          {/* Question */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" /> Pergunta
            </p>
            <p className="font-semibold text-sm">{question}</p>
          </div>

          {/* Hint after failed attempts */}
          {hint && attempts > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5"
            >
              <p className="text-xs text-yellow-700 font-semibold">
                💡 Dica: a resposta começa com a letra <span className="text-lg font-black tracking-widest">{hint}</span>
              </p>
            </motion.div>
          )}

          {/* Answer input */}
          <div className="space-y-2">
            <Input
              placeholder="Digite sua resposta..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="text-sm"
              autoFocus
            />
            {attempts > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {attempts} tentativa{attempts !== 1 ? "s" : ""} incorreta{attempts !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1" size="sm">
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!answer.trim() || challengeCard.isPending}
              className="flex-1 bg-[#002776] hover:bg-[#001a50] text-white"
              size="sm"
            >
              {challengeCard.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Verificando...</>
              ) : (
                "Responder ⚡"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Card detail modal ──────────────────────────────────────────────────────────
function CardDetailModal({
  card,
  onClose,
}: {
  card: Collaborator;
  isUnlocked: boolean;
  onClose: () => void;
}) {
  const [showBack, setShowBack] = useState(false);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl">
        <DialogTitle className="sr-only">{card.name}</DialogTitle>

        <AnimatePresence mode="wait">
          {!showBack ? (
            <motion.div
              key="front"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.22 }}
              className="p-6 flex flex-col items-center gap-4 bg-card"
            >
              <div className="w-52">
                <CollaboratorCard collaborator={card} isUnlocked={true} />
              </div>

              <div className="text-center space-y-1">
                <h2 className="font-black text-lg text-foreground">{card.name}</h2>
                <p className="text-muted-foreground text-sm">{card.role}</p>
                <Badge className={`border-0 ${RARITY_BADGE[card.rarity]}`}>
                  {card.isSpecial ? "⭐ " : ""}
                  {RARITY_LABEL[card.rarity] ?? card.rarity}
                </Badge>
              </div>

              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowBack(true)}
                >
                  Ver verso →
                </Button>
                <Button variant="ghost" className="flex-1" onClick={onClose}>
                  Fechar
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="back"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.22 }}
              className="bg-card"
            >
              <div className="px-5 pt-5 pb-3 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="font-black text-base">{card.name}</h2>
                  <p className="text-muted-foreground text-xs">{card.role}</p>
                </div>
                <Badge className={`border-0 ${RARITY_BADGE[card.rarity]}`}>
                  {RARITY_LABEL[card.rarity] ?? card.rarity}
                </Badge>
              </div>

              <div className="p-5 space-y-2.5 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted/60 rounded-lg p-2.5">
                    <p className="text-muted-foreground text-xs mb-0.5">Área</p>
                    <p className="font-semibold">{card.area}</p>
                  </div>
                  <div className="bg-muted/60 rounded-lg p-2.5">
                    <p className="text-muted-foreground text-xs mb-0.5">Gerência</p>
                    <p className="font-semibold truncate">{card.management}</p>
                  </div>
                  {card.position && (
                    <div className="bg-muted/60 rounded-lg p-2.5">
                      <p className="text-muted-foreground text-xs mb-0.5">⚽ Posição</p>
                      <p className="font-semibold">{card.position}</p>
                    </div>
                  )}
                  {card.yearsAtVale != null && (
                    <div className="bg-muted/60 rounded-lg p-2.5">
                      <p className="text-muted-foreground text-xs mb-0.5 flex items-center gap-1"><Clock className="w-3 h-3" />Tempo de Vale</p>
                      <p className="font-semibold">{card.yearsAtVale} {card.yearsAtVale === 1 ? "ano" : "anos"}</p>
                    </div>
                  )}
                  <div className="bg-muted/60 rounded-lg p-2.5">
                    <p className="text-muted-foreground text-xs mb-0.5 flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500" />Pontos</p>
                    <p className="font-semibold">{card.points} pts</p>
                  </div>
                  <div className="bg-muted/60 rounded-lg p-2.5">
                    <p className="text-muted-foreground text-xs mb-0.5">Categoria</p>
                    <p className="font-semibold truncate">{card.category}</p>
                  </div>
                </div>

                {card.superPower && (
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                    <p className="text-primary text-xs font-bold mb-0.5 flex items-center gap-1"><Zap className="w-3 h-3" />Super Poder</p>
                    <p className="text-sm">{card.superPower}</p>
                  </div>
                )}

                {card.curiosity && (
                  <div className="bg-muted/60 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs font-bold mb-0.5">💡 Curiosidade</p>
                    <p className="text-sm">{card.curiosity}</p>
                  </div>
                )}

                {card.achievement && (
                  <div className="bg-secondary/10 border border-secondary/20 rounded-lg p-3">
                    <p className="text-secondary text-xs font-bold mb-0.5 flex items-center gap-1"><Award className="w-3 h-3" />Conquista</p>
                    <p className="text-sm">{card.achievement}</p>
                  </div>
                )}
                {previewTarget.keyBehavior && (
                  <div className="bg-primary/10 rounded-lg p-3 mt-3">
                    <p className="text-[10px] text-primary font-bold mb-1">
                      🎯 Comportamento Chave
                    </p>
                    <p className="text-foreground text-sm">
                      {previewTarget.keyBehavior}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => setShowBack(false)}>
                    ← Ver figurinha
                  </Button>
                  <Button variant="ghost" className="flex-1" onClick={onClose}>
                    Fechar
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

// ── Unlock Success Dialog ──────────────────────────────────────────────────────
function UnlockSuccessDialog({
  card,
  onClose,
}: {
  card: Collaborator;
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
        <DialogTitle className="sr-only">Figurinha Desbloqueada!</DialogTitle>
        <div className="bg-gradient-to-b from-[#002776] to-[#001a50] p-8">
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="text-6xl mb-4"
          >
            🎉
          </motion.div>
          <h2 className="text-white font-black text-xl mb-1">Desafio Concluído!</h2>
          <p className="text-white/70 text-sm">Você desbloqueou uma figurinha!</p>
        </div>

        <div className="p-6 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`relative rounded-2xl overflow-hidden mx-auto w-40 aspect-[3/4] border-4 ${
              card.rarity === "lendaria" ? "border-yellow-400" :
              card.rarity === "epica" ? "border-purple-400" :
              card.rarity === "rara" ? "border-blue-400" : "border-gray-300"
            } ${RARITY_GLOW[card.rarity] ?? ""}`}
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
              <p className="font-bold text-xs leading-tight">{card.name}</p>
              <p className="text-[10px] text-white/70">{card.role}</p>
            </div>
          </motion.div>

          <div className="space-y-1">
            <p className="font-bold text-foreground">{card.name}</p>
            <p className="text-sm text-muted-foreground">{card.role}</p>
            <Badge className={`mt-1 border-0 ${RARITY_BADGE[card.rarity]}`}>
              {RARITY_LABEL[card.rarity] ?? card.rarity}
            </Badge>
          </div>

          <Button className="w-full bg-[#002776] hover:bg-[#001a50] text-white font-bold" onClick={onClose}>
            ⚡ Incrível! Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Album Page ────────────────────────────────────────────────────────────
export default function AlbumPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<Collaborator | null>(null);
  const [challengeTarget, setChallengeTarget] = useState<Collaborator | null>(null);
  const [justUnlocked, setJustUnlocked] = useState<Collaborator | null>(null);

  const { data: collaborators, isLoading } = useListCollaborators();
  const { data: myCards } = useGetMyCards();
  const unlockCard = useUnlockCard();

  const collaboratorIdSet = useMemo(
    () => new Set((collaborators ?? []).map((c) => c.id)),
    [collaborators]
  );
  const myCardSet = useMemo(
    () => new Set((myCards ?? []).filter((id) => collaboratorIdSet.has(id))),
    [myCards, collaboratorIdSet]
  );
  const unlockedCount = myCardSet.size;
  const totalCount = collaborators?.length ?? 0;

  const categories = useMemo(
    () => [...new Set((collaborators ?? []).map((c) => c.category))].sort(),
    [collaborators]
  );

  const activeCategory = activeCat ?? categories[0] ?? "";

  const categoryCards = useMemo(() => {
    const base = (collaborators ?? []).filter((c) => c.category === activeCategory);
    if (!search) return base;
    const q = search.toLowerCase();
    return base.filter((c) => c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q));
  }, [collaborators, activeCategory, search]);

  const allSearchResults = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return (collaborators ?? []).filter(
      (c) => c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q)
    );
  }, [collaborators, search]);

  const displayCards = search ? allSearchResults : categoryCards;

  const catStats = useMemo(() => {
    const map: Record<string, { total: number; unlocked: number }> = {};
    for (const c of collaborators ?? []) {
      if (!map[c.category]) map[c.category] = { total: 0, unlocked: 0 };
      map[c.category]!.total++;
      if (myCardSet.has(c.id)) map[c.category]!.unlocked++;
    }
    return map;
  }, [collaborators, myCardSet]);

  const handleCardClick = (card: Collaborator) => {
    if (myCardSet.has(card.id)) {
      setSelectedCard(card);
      return;
    }
    // Open challenge dialog for locked cards
    setChallengeTarget(card);
  };

  const handleChallengeSuccess = (card: Collaborator) => {
    setChallengeTarget(null);
    setJustUnlocked(card);
    queryClient.invalidateQueries({ queryKey: getGetMyCardsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAlbumStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetMyMissionsQueryKey() });
  };

  const catCfg = CATEGORY_CONFIG[activeCategory] ?? DEFAULT_CATEGORY;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" /> Álbum Copa 2026
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {unlockedCount} de {totalCount} figurinhas
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-primary">
            {totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0}%
          </div>
          <p className="text-xs text-muted-foreground">completo</p>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="w-full bg-muted rounded-full h-2.5">
        <motion.div
          className="h-2.5 rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>

      {/* Hint for locked cards */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 border border-border/50">
        <HelpCircle className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
        <span>Clique em uma figurinha bloqueada para respondê-la um desafio e desbloqueá-la!</span>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar colaborador..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-9"
          data-testid="input-search"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="flex gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-32 rounded-full" />)}</div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-lg" />)}
          </div>
        </div>
      ) : (
        <>
          {/* Search results view */}
          {search ? (
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                {displayCards.length} resultado{displayCards.length !== 1 ? "s" : ""} para "{search}"
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                {displayCards.map((card, i) => (
                  <StickerSlot
                    key={card.id}
                    collaborator={card}
                    isUnlocked={myCardSet.has(card.id)}
                    slotIdx={i}
                    onClick={() => handleCardClick(card)}
                  />
                ))}
              </div>
              {displayCards.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>Nenhuma figurinha encontrada</p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Category tabs */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {categories.map((cat) => {
                  const cfg = CATEGORY_CONFIG[cat] ?? DEFAULT_CATEGORY;
                  const stats = catStats[cat] ?? { total: 0, unlocked: 0 };
                  const isActive = cat === activeCategory;

                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCat(cat)}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all border ${
                        isActive
                          ? `${cfg.bg} ${cfg.color} border-current`
                          : "border-border text-muted-foreground hover:border-gray-300 hover:text-foreground"
                      }`}
                    >
                      <span>{cfg.emoji}</span>
                      <span className="hidden sm:inline">{cat}</span>
                      <span className="sm:hidden">{cat.split(" ").slice(-1)[0]}</span>
                      <span className={`text-[10px] font-bold ${isActive ? "" : "text-muted-foreground"}`}>
                        {stats.unlocked}/{stats.total}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Album page */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeCategory}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg, #fdf8f0 0%, #fef9f0 50%, #fdf5e8 100%)",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.8)",
                  }}
                >
                  {/* Category header */}
                  <div className={`px-5 py-4 border-b ${catCfg.bg} border-current/20 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{catCfg.emoji}</span>
                      <div>
                        <h2 className={`font-black text-base ${catCfg.color}`}>{activeCategory}</h2>
                        <p className="text-xs text-muted-foreground">
                          {catStats[activeCategory]?.unlocked ?? 0} de {catStats[activeCategory]?.total ?? 0} figurinhas
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-black ${catCfg.color}`}>
                        {catStats[activeCategory]?.total
                          ? Math.round(((catStats[activeCategory]?.unlocked ?? 0) / catStats[activeCategory]!.total) * 100)
                          : 0}%
                      </div>
                      <div className="w-20 bg-black/10 rounded-full h-1.5 mt-1">
                        <div
                          className={`h-1.5 rounded-full ${catCfg.color.replace("text-", "bg-")}`}
                          style={{
                            width: `${catStats[activeCategory]?.total
                              ? ((catStats[activeCategory]?.unlocked ?? 0) / catStats[activeCategory]!.total) * 100
                              : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card grid — album page style */}
                  <div className="p-5">
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                      {categoryCards.map((card, i) => (
                        <StickerSlot
                          key={card.id}
                          collaborator={card}
                          isUnlocked={myCardSet.has(card.id)}
                          slotIdx={i}
                          onClick={() => handleCardClick(card)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Page footer */}
                  <div className="px-5 py-3 border-t border-black/5 flex items-center justify-between">
                    <button
                      onClick={() => {
                        const idx = categories.indexOf(activeCategory);
                        if (idx > 0) setActiveCat(categories[idx - 1]!);
                      }}
                      disabled={categories.indexOf(activeCategory) === 0}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                    </button>

                    <div className="flex items-center gap-1.5">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setActiveCat(cat)}
                          className={`rounded-full transition-all ${
                            cat === activeCategory ? "w-5 h-2 bg-primary" : "w-2 h-2 bg-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        const idx = categories.indexOf(activeCategory);
                        if (idx < categories.length - 1) setActiveCat(categories[idx + 1]!);
                      }}
                      disabled={categories.indexOf(activeCategory) === categories.length - 1}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                    >
                      Próxima <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </>
          )}
        </>
      )}

      {/* Challenge dialog for locked cards */}
      {challengeTarget && (
        <ChallengeDialog
          collaborator={challengeTarget}
          onClose={() => setChallengeTarget(null)}
          onSuccess={handleChallengeSuccess}
        />
      )}

      {/* Card detail modal for unlocked cards */}
      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          isUnlocked={myCardSet.has(selectedCard.id)}
          onClose={() => setSelectedCard(null)}
        />
      )}

      {/* Unlock success dialog */}
      {justUnlocked && (
        <UnlockSuccessDialog
          card={justUnlocked}
          onClose={() => setJustUnlocked(null)}
        />
      )}
    </div>
  );
}
