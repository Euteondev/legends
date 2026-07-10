import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  useGetFeaturedCollaborators,
  useGetRankings,
  useGetRecentActivity,
  useGetAlbumStats,
  useGetMyCards,
} from "@/hooks/use-db";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Star, Clock, TrendingUp, Users, Award, Trophy } from "lucide-react";

const RARITY_COLORS: Record<string, string> = {
  comum: "bg-gray-100 text-gray-700 border-gray-200",
  rara: "bg-blue-50 text-blue-700 border-blue-200",
  epica: "bg-purple-50 text-purple-700 border-purple-200",
  lendaria: "bg-yellow-50 text-yellow-700 border-yellow-300",
};
const RARITY_LABELS: Record<string, string> = {
  comum: "Comum", rara: "Rara", epica: "Épica", lendaria: "Lendária",
};

const PODIUM_ORDER = [1, 0, 2];
const MEDAL_BG = [
  "from-gray-50 to-slate-50 border-gray-200 text-gray-500",
  "from-yellow-50 to-amber-50 border-yellow-300 text-yellow-500",
  "from-amber-50 to-orange-50 border-amber-300 text-amber-600",
];
const PODIUM_H = ["h-44", "h-32", "h-28"];

export default function HomePage() {
  const { user } = useAuth();
  const { data: rankings, isLoading: rankingsLoading } = useGetRankings();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();
  const { data: stats, isLoading: statsLoading } = useGetAlbumStats();
  const { data: myCards } = useGetMyCards();

  const top3 = rankings?.slice(0, 3) ?? [];
  const unlockedCount = myCards?.length ?? 0;
  const totalCards = stats?.total ?? 0;
  const albumProgress = totalCards > 0 ? Math.round((unlockedCount / totalCards) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* ── HERO: Football field ── */}
      <motion.section
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden text-white"
        style={{ minHeight: 260 }}
      >
        {/* Field background */}
        <div className="absolute inset-0 field-bg" />
        <div className="absolute inset-0 field-stripes" />
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#001a0f]/90 via-[#002a10]/70 to-transparent" />

        {/* Field decorations */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute right-8 top-1/2 -translate-y-1/2 w-48 h-48 rounded-full border-2 border-white/10" />
          <div className="absolute right-8 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white/20" />
          <div className="absolute right-8 top-0 bottom-0 w-px bg-white/10" />
        </div>

        <div className="relative z-10 p-8 md:p-10">
          {/* Copa 2026 badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/20 border border-yellow-400/40 mb-5">
            <span className="text-sm">🏆</span>
            <span className="text-yellow-400 text-xs font-bold uppercase tracking-widest">Copa do Mundo 2026</span>
            <span className="text-sm">🇧🇷</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-1 drop-shadow-lg">
            Finanças Empresariais
          </h1>
          <p className="text-2xl md:text-3xl font-black mb-2">
            <span className="text-yellow-400">Legends</span>{" "}
            <span className="text-white/90">2026</span>
          </p>

          {/* Brazil flag bar */}
          <div className="brasil-bar h-1 rounded-full w-40 mb-4" />

          <p className="text-white/70 max-w-md mb-6 text-sm md:text-base">
            Colete as figurinhas dos seus colegas, complete missões e dispute quem é a <strong className="text-yellow-400">lenda da temporada</strong>!
          </p>

          {/* My progress */}
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 backdrop-blur-sm">
              <span className="text-white/60 text-xs">Meu álbum</span>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-24 bg-white/20 rounded-full h-1.5">
                  <div className="bg-yellow-400 rounded-full h-1.5" style={{ width: `${albumProgress}%` }} />
                </div>
                <span className="text-yellow-400 font-black text-sm">{albumProgress}%</span>
              </div>
            </div>
            <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 backdrop-blur-sm">
              <span className="text-white/60 text-xs">Pontos</span>
              <p className="text-yellow-400 font-black text-sm">⭐ {user?.points ?? 0}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/album">
              <Button
                data-testid="button-open-album"
                size="lg"
                className="copa-badge text-[#002776] font-black shadow-lg hover:opacity-90 border-0"
              >
                <BookOpen className="w-5 h-5 mr-2" />
                Abrir Álbum
              </Button>
            </Link>
            <Link href="/ranking">
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 bg-white/5"
              >
                🏆 Ver Ranking
              </Button>
            </Link>
          </div>
        </div>

        {/* Floating football */}
        <div className="absolute right-16 top-1/2 -translate-y-1/2 text-7xl md:text-8xl opacity-30 ball-bounce pointer-events-none hidden md:block select-none">
          ⚽
        </div>
      </motion.section>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          [
            { emoji: "🎴", label: "Total de Cards", value: stats?.total ?? 0, color: "text-primary" },
            { emoji: "👥", label: "Participantes", value: stats?.totalUsers ?? 0, color: "text-primary" },
            { emoji: "🔓", label: "Desbloqueados", value: stats?.totalUnlocks ?? 0, color: "text-[#009C3B]" },
            { emoji: "📊", label: "Meu Progresso", value: `${albumProgress}%`, color: "text-yellow-500" },
          ].map(({ emoji, label, value, color }, idx) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * idx }}
              className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                <span className="text-base">{emoji}</span>
                {label}
              </div>
              <div className={`text-2xl font-black ${color}`}>{value}</div>
            </motion.div>
          ))
        )}
      </div>

      {/* ── Podium Top 3 ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black flex items-center gap-2">
            🏆 <span>Pódio da Copa</span>
          </h2>
          <Link href="/ranking">
            <Button variant="ghost" size="sm" className="text-primary font-semibold">Ver todos →</Button>
          </Link>
        </div>

        {rankingsLoading ? (
          <div className="grid md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : top3.length > 0 ? (
          <div className="bg-card border border-border rounded-2xl p-6">
            {/* Podium visual */}
            <div className="flex items-end justify-center gap-3 mb-4">
              {PODIUM_ORDER.map((originalIdx) => {
                const entry = top3[originalIdx];
                if (!entry) return null;
                const isMe = user?.id === entry.userId;
                const medals = ["🥇", "🥈", "🥉"];
                return (
                  <motion.div
                    key={entry.userId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: originalIdx * 0.1 }}
                    className={`flex-1 max-w-[140px] bg-gradient-to-t ${MEDAL_BG[originalIdx]} border rounded-t-2xl ${PODIUM_H[originalIdx]} flex flex-col items-center justify-end pb-3 px-2 relative ${isMe ? "ring-2 ring-primary" : ""}`}
                  >
                    <div className="absolute -top-5 text-3xl">{medals[originalIdx]}</div>
                    <div className="w-10 h-10 rounded-full bg-white border-2 border-current overflow-hidden flex items-center justify-center mb-1.5">
                      {entry.photo ? (
                        <img src={entry.photo} alt={entry.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg">👤</span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-center text-foreground truncate w-full leading-tight">
                      {entry.name.split(" ")[0]}
                    </p>
                    <p className="text-sm font-black text-primary mt-0.5">{entry.points} pts</p>
                  </motion.div>
                );
              })}
            </div>
            <div className="text-center text-xs text-muted-foreground">⚽ {stats?.totalUsers ?? 0} jogadores no torneio</div>
          </div>
        ) : (
          <div className="bg-card border border-dashed border-border rounded-xl py-12 text-center text-muted-foreground">
            <div className="text-4xl mb-2">🏆</div>
            <p>Nenhum participante ainda. Seja o primeiro!</p>
          </div>
        )}
      </section>

      {/* ── Recent Activity ── */}
      <section>
        <h2 className="text-xl font-black flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-primary" />
          Atividade Recente
        </h2>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {activityLoading ? (
            <div className="p-4 space-y-3">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : activity && activity.length > 0 ? (
            <div className="divide-y divide-border">
              {activity.slice(0, 8).map((item, idx) => (
                <motion.div
                  key={`${item.userId}-${item.collaboratorId}-${item.unlockedAt}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-base">
                    ⚽
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      <span className="font-bold text-foreground">{item.userName}</span>
                      <span className="text-muted-foreground"> desbloqueou </span>
                      <span className="font-bold text-foreground">{item.collaboratorName}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.unlockedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                  <Badge className={`text-xs border flex-shrink-0 ${RARITY_COLORS[item.rarity] ?? ""}`}>
                    {RARITY_LABELS[item.rarity] ?? item.rarity}
                  </Badge>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-12">
              <div className="text-4xl mb-2">⚽</div>
              <p>Nenhuma atividade recente</p>
              <Link href="/album">
                <Button variant="link" className="text-primary mt-1">Desbloqueie sua primeira figurinha</Button>
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
