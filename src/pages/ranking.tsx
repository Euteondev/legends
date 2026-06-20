import { motion } from "framer-motion";
import { useGetRankings } from "@/hooks/use-db";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Star, TrendingUp, Users } from "lucide-react";

export default function RankingPage() {
  const { user } = useAuth();
  const { data: rankings, isLoading } = useGetRankings();

  const top3 = rankings?.slice(0, 3) ?? [];
  const rest = rankings?.slice(3) ?? [];

  const MEDAL_CONFIG = [
    { color: "text-yellow-500", bg: "from-yellow-50 to-amber-50 border-yellow-200", label: "Ouro", size: "h-40" },
    { color: "text-gray-400", bg: "from-gray-50 to-slate-50 border-gray-200", label: "Prata", size: "h-32" },
    { color: "text-amber-600", bg: "from-amber-50 to-orange-50 border-amber-200", label: "Bronze", size: "h-28" },
  ];

  const PODIUM_ORDER = [1, 0, 2]; // silver, gold, bronze

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-500" />
          Ranking
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Classificação geral por pontuação
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Podium Top 3 */}
          {top3.length >= 1 && (
            <div className="flex items-end justify-center gap-3 mb-8">
              {PODIUM_ORDER.map((originalIdx) => {
                const entry = top3[originalIdx];
                if (!entry) return null;
                const config = MEDAL_CONFIG[originalIdx]!;
                const isMe = user?.id === entry.userId;

                return (
                  <motion.div
                    key={entry.userId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * originalIdx }}
                    className={`flex-1 max-w-[160px] bg-gradient-to-t ${config.bg} border rounded-t-2xl ${config.size} flex flex-col items-center justify-end pb-4 px-2 relative ${isMe ? "ring-2 ring-primary" : ""}`}
                  >
                    <div className={`absolute -top-4 w-10 h-10 rounded-full flex items-center justify-center ${originalIdx === 0 ? "bg-yellow-400" : originalIdx === 1 ? "bg-gray-300" : "bg-amber-500"} shadow-md`}>
                      <span className="text-white font-black text-sm">#{entry.rank}</span>
                    </div>
                    <div className={`w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2 ${isMe ? "ring-2 ring-primary" : ""} overflow-hidden`}>
                      {entry.photo ? (
                        <img src={entry.photo} alt={entry.name} className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-6 h-6 text-primary" />
                      )}
                    </div>
                    <p className="text-xs font-bold text-center text-foreground truncate w-full text-center leading-tight">
                      {entry.name}
                    </p>
                    <p className={`text-sm font-black mt-0.5 ${config.color}`}>
                      {entry.points} pts
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.unlockedCount} cards
                    </p>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Full List */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/50 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Classificação Completa</span>
              <span className="ml-auto text-xs text-muted-foreground">{rankings?.length ?? 0} participantes</span>
            </div>
            <div className="divide-y divide-border">
              {rankings?.map((entry, idx) => {
                const isMe = user?.id === entry.userId;
                return (
                  <motion.div
                    key={entry.userId}
                    data-testid={`ranking-row-${entry.userId}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className={`flex items-center gap-4 px-4 py-3.5 transition-colors ${isMe ? "bg-primary/5" : "hover:bg-muted/50"}`}
                  >
                    <div className={`w-8 text-center font-black text-sm ${idx === 0 ? "text-yellow-500" : idx === 1 ? "text-gray-400" : idx === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
                      {idx < 3 ? (
                        <Medal className="w-5 h-5 mx-auto" />
                      ) : (
                        `#${entry.rank}`
                      )}
                    </div>

                    <div className={`w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0 ${isMe ? "ring-2 ring-primary" : ""}`}>
                      {entry.photo ? (
                        <img src={entry.photo} alt={entry.name} className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-5 h-5 text-primary" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate text-foreground">
                          {entry.name}
                          {isMe && <span className="text-primary text-xs ml-1">(você)</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex-1 max-w-32 bg-muted rounded-full h-1.5">
                          <div
                            className="bg-primary rounded-full h-1.5"
                            style={{ width: `${Math.min(entry.progress, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {entry.unlockedCount} cards
                        </span>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1 justify-end">
                        <Star className="w-3.5 h-3.5 text-yellow-500" />
                        <span className="font-bold text-foreground">{entry.points}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">pontos</p>
                    </div>
                  </motion.div>
                );
              })}

              {(!rankings || rankings.length === 0) && (
                <div className="text-center py-12 text-muted-foreground">
                  <Trophy className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>Nenhum participante ainda</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
