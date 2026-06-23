import { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe,
  useGetMyCards,
  useGetMyMissions,
  useGetRankings,
  useListCollaborators,
  useCreateCollaborator,
  useUpdateCollaborator,
  getListCollaboratorsQueryKey,
  type Collaborator,
} from "@/hooks/use-db";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CollaboratorCard } from "@/components/cards/CollaboratorCard";
import { Link } from "wouter";
import {
  User as UserIcon,
  Star,
  Trophy,
  Target,
  CheckCircle2,
  BookOpen,
  LogOut,
  Plus,
  Pencil,
  Loader2,
  Sparkles,
} from "lucide-react";


export const behaviorOptions = [
  "Diálogo Aberto e Transparente",
  "Empoderamento com Comprometimento",
  "Sentimento de Dono",
  "Obsessão por Segurança e Gestão de Risco",
  "Escuta Ativa e Engajamento com a Sociedade",
] as const;


// ─── Photo picker component (avoids useRef inside render prop) ────────────────
function PhotoPickerField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => onChange(ev.target?.result as string);
          reader.readAsDataURL(file);
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="flex items-center gap-2 px-3 py-2 border border-input rounded-md text-sm text-muted-foreground hover:bg-muted/50 transition-colors w-full text-left"
      >
        {value ? "✅ Imagem selecionada — clique para trocar" : "Selecionar imagem do dispositivo..."}
      </button>
      {value && (
        <img src={value} alt="Prévia" className="w-16 h-16 rounded-lg object-cover border border-border" />
      )}
    </div>
  );
}

// ─── Self-service schema (user-editable fields only, no points/rarity/category) ──
const selfSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  role: z.string().min(1, "Cargo obrigatório"),
  area: z.string().min(1, "Área obrigatória"),
  management: z.string().min(1, "Gerência obrigatória"),
  photoUrl: z.string().optional(),
  yearsAtVale: z.coerce.number().optional(),
  keyBehavior: z.enum(behaviorOptions).optional(),
  superPower: z.string().optional(),
  curiosity: z.string().optional(),
  achievement: z.string().optional(),
  challengeQuestion: z.string().optional(),
  challengeAnswer: z.string().optional(),
  position: z.string().optional(),
});
type SelfForm = z.infer<typeof selfSchema>;

const SELF_DEFAULTS: SelfForm = {
  name: "", role: "", area: "", management: "",
  photoUrl: "", yearsAtVale: undefined, keyBehavior: undefined,
  superPower: "", curiosity: "", achievement: "",
  challengeQuestion: "", challengeAnswer: "", position: "",
};

// ─── Self-service sticker section ─────────────────────────────────────────────
function SelfStickerSection({ userEmail, displayRarity }: { userEmail: string; displayRarity: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: collaborators } = useListCollaborators();
  const createCollaborator = useCreateCollaborator();
  const updateCollaborator = useUpdateCollaborator();
  const [open, setOpen] = useState(false);

  const myCollaborator: Collaborator | null = useMemo(
    () => collaborators?.find((c) => c.email?.toLowerCase() === userEmail.toLowerCase()) ?? null,
    [collaborators, userEmail]
  );

  const form = useForm<SelfForm>({
    resolver: zodResolver(selfSchema),
    defaultValues: SELF_DEFAULTS,
  });

  const challengeQuestion = useWatch({ control: form.control, name: "challengeQuestion" });


  const behaviorOptions = [
    "Diálogo Aberto e Transparente",
    "Empoderamento com Comprometimento",
    "Sentimento de Dono",
    "Obsessão por Segurança e Gestão de Risco",
    "Escuta Ativa e Engajamento com a Sociedade",
  ] as const;


  
  const openForm = () => {
    if (myCollaborator) {
      form.reset({
        name: myCollaborator.name,
        role: myCollaborator.role,
        area: myCollaborator.area,
        management: myCollaborator.management,
        photoUrl: myCollaborator.photoUrl ?? "",
        yearsAtVale: myCollaborator.yearsAtVale ?? undefined,
        keyBehavior: myCollaborator.keyBehavior ?? undefined,
        superPower: myCollaborator.superPower ?? "",
        curiosity: myCollaborator.curiosity ?? "",
        achievement: myCollaborator.achievement ?? "",
        challengeQuestion: myCollaborator.challengeQuestion ?? "",
        challengeAnswer: myCollaborator.challengeAnswer ?? "",
        position: myCollaborator.position ?? "",
      });
    } else {
      form.reset(SELF_DEFAULTS);
    }
    setOpen(true);
  };

  const onSubmit = form.handleSubmit((data) => {
    const payload = {
      name: data.name,
      role: data.role,
      area: data.area,
      management: data.management,
      email: userEmail,
      photoUrl: data.photoUrl || null,
      yearsAtVale: data.yearsAtVale ?? null,
      keyBehavior: data.keyBehavior ?? null,
      superPower: data.superPower || null,
      curiosity: data.curiosity || null,
      achievement: data.achievement || null,
      challengeQuestion: data.challengeQuestion || null,
      challengeAnswer: data.challengeAnswer || null,
      position: data.position || null,
      rarity: myCollaborator?.rarity ?? ("comum" as const),
      category: myCollaborator?.category ?? data.area,
      points: myCollaborator?.points ?? 10,
      isSpecial: myCollaborator?.isSpecial ?? false,
    };

    if (myCollaborator) {
      updateCollaborator.mutate({ id: myCollaborator.id, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCollaboratorsQueryKey() });
          toast({ title: "✅ Figurinha atualizada!" });
          setOpen(false);
        },
        onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
      });
    } else {
      createCollaborator.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCollaboratorsQueryKey() });
          toast({ title: "🎉 Figurinha criada! O admin vai revisar em breve." });
          setOpen(false);
        },
        onError: () => toast({ title: "Erro ao criar figurinha", variant: "destructive" }),
      });
    }
  });

  const isPending = createCollaborator.isPending || updateCollaborator.isPending;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl overflow-hidden"
      >
        {myCollaborator ? (
          <div className="flex items-center gap-4 p-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground font-medium mb-0.5">Minha figurinha</p>
              <h3 className="font-bold text-foreground truncate">{myCollaborator.name}</h3>
              <p className="text-sm text-muted-foreground truncate">{myCollaborator.role}</p>
              <Badge className="mt-1.5 text-[10px] capitalize" variant="secondary">
                {displayRarity === "lendaria" ? "🟡 Lendária" :
                 displayRarity === "epica"    ? "🟣 Épica"    :
                 displayRarity === "rara"     ? "🔵 Rara"     : "⚪ Comum"}
              </Badge>
            </div>
            <Button size="sm" variant="outline" onClick={openForm} className="flex-shrink-0">
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-foreground text-sm">Crie sua figurinha!</h3>
              <p className="text-xs text-muted-foreground">Você ainda não tem uma figurinha no álbum. Crie a sua agora!</p>
            </div>
            <Button size="sm" onClick={openForm} className="flex-shrink-0">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Criar
            </Button>
          </div>
        )}
      </motion.div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{myCollaborator ? "Editar minha figurinha" : "Criar minha figurinha"}</DialogTitle>
          </DialogHeader>

          {/* Email badge (readonly info) */}
          <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2 text-sm">
            <span className="text-muted-foreground text-xs">Conta vinculada:</span>
            <span className="font-medium text-foreground truncate">{userEmail}</span>
          </div>

          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nome *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem><FormLabel>Cargo *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="position" render={({ field }) => (
                  <FormItem>
                    <FormLabel>⚽ Posição</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {["Goleiro","Zagueiro","Lateral","Volante","Meio Campo","Atacante","Técnico","Auxiliar Técnico"].map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="area" render={({ field }) => (
                  <FormItem><FormLabel>Área *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="management" render={({ field }) => (
                  <FormItem><FormLabel>Gerência *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="yearsAtVale" render={({ field }) => (
                  <FormItem><FormLabel>Anos na Vale</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                )} />
                <FormField
                  control={form.control}
                  name="keyBehavior"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>🎯 Comportamento Chave</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar comportamento..." />
                          </SelectTrigger>
                        </FormControl>

                        <SelectContent>
                          {behaviorOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="photoUrl" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>📷 Foto</FormLabel>
                    <FormControl>
                      <PhotoPickerField value={field.value ?? ""} onChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="superPower" render={({ field }) => (
                <FormItem><FormLabel>⚡ Super Poder</FormLabel><FormControl><Input {...field} placeholder="Ex: Transforma planilhas em ouro..." /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="curiosity" render={({ field }) => (
                <FormItem><FormLabel>💡 Curiosidade</FormLabel><FormControl><Textarea {...field} rows={2} placeholder="Uma curiosidade sobre você..." /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="achievement" render={({ field }) => (
                <FormItem><FormLabel>🏆 Conquista</FormLabel><FormControl><Textarea {...field} rows={2} placeholder="Sua maior conquista na Vale..." /></FormControl></FormItem>
              )} />

              <FormField control={form.control} name="challengeQuestion" render={({ field: qField }) => (
                <FormItem>
                  <FormLabel>❓ Pergunta do Desafio</FormLabel>
                  <FormControl>
                    <Input {...qField} placeholder="Deixe vazio para usar a pergunta padrão" />
                  </FormControl>
                  <p className="text-[11px] text-muted-foreground">Padrão: "Qual é o Super Poder de [nome]?"</p>
                </FormItem>
              )} />

              {!!challengeQuestion?.trim() && (
                <FormField control={form.control} name="challengeAnswer" render={({ field }) => (
                  <FormItem>
                    <FormLabel>✅ Resposta do Desafio *</FormLabel>
                    <FormControl><Input {...field} placeholder="Resposta correta..." /></FormControl>
                  </FormItem>
                )} />
              )}

              {!myCollaborator && (
                <p className="text-xs text-muted-foreground bg-muted/60 rounded-lg p-3">
                  ℹ️ Sua figurinha será criada com raridade <strong>Comum</strong>. O administrador poderá ajustar a raridade, categoria e pontuação depois.
                </p>
              )}

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {myCollaborator ? "Salvar alterações" : "Criar figurinha"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Profile Page ─────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user: authUser, logout } = useAuth();
  const { data: me, isLoading } = useGetMe();
  const { data: myCards } = useGetMyCards();
  const { data: myMissions } = useGetMyMissions();
  const { data: rankings } = useGetRankings();

  const { data: collaborators } = useListCollaborators();
  const myCollaborator = useMemo(
    () => collaborators?.find((c) => c.email?.toLowerCase() === authUser?.email?.toLowerCase()) ?? null,
    [collaborators, authUser?.email]
  );
  const [stickerPreviewOpen, setStickerPreviewOpen] = useState(false);

  const myRanking = rankings?.find((r) => r.userId === authUser?.id);
  const completedMissions = myMissions?.filter((m) => m.completed) ?? [];
  const collaboratorIdSet = useMemo(
    () => new Set((collaborators ?? []).map((c) => c.id)),
    [collaborators]
  );
  const unlockedCount = useMemo(
    () => (myCards ?? []).filter((id) => collaboratorIdSet.has(id)).length,
    [myCards, collaboratorIdSet]
  );
  const totalCount = collaborators?.length ?? 0;
  const progressPercent = Math.min(
    100,
    totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0
  );
  // Rarity displayed on profile follows current album progress
  const displayRarity =
    progressPercent >= 100 ? "lendaria" :
    progressPercent >= 75  ? "epica"    :
    progressPercent >= 50  ? "rara"     : "comum";
  const totalMissions = myMissions?.length ?? 0;
  const missionProgress = totalMissions > 0 ? (completedMissions.length / totalMissions) * 100 : 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-16 rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const user = me ?? authUser;

  return (
    <div className="space-y-5">
      {/* Hero card */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #1a7a2e 0%, #22a83c 40%, #1a7a2e 70%, #145c22 100%)",
          backgroundImage: "linear-gradient(160deg, #1a7a2e 0%, #22a83c 40%, #1a7a2e 70%, #145c22 100%)",
        }}
      >
        <div className="absolute top-0 right-0 opacity-10 pointer-events-none">
          <div className="w-40 h-40 rounded-full border-8 border-white translate-x-10 -translate-y-10" />
        </div>
        <div className="flex items-center gap-4 relative z-10">
          {myCollaborator && (
            <button
              onClick={() => setStickerPreviewOpen(true)}
              className="flex-shrink-0 w-16 hover:scale-105 active:scale-95 transition-transform"
              title="Ver minha figurinha"
            >
              <CollaboratorCard collaborator={myCollaborator} isUnlocked={true} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black">{user?.name}</h1>
            <p className="text-white/70 text-sm truncate">{user?.email}</p>
            {user?.isAdmin && (
              <Badge className="mt-1 bg-white/20 text-white border-white/30 text-xs">
                Administrador
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-5 relative z-10">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-white/80">Progresso do Álbum</span>
            <span className="font-bold">
              {unlockedCount} de {totalCount} — {progressPercent}%
            </span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2">
            <motion.div
              className="bg-white rounded-full h-2"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>
      </motion.div>

      {/* Figurinha preview dialog */}
      {myCollaborator && (
        <Dialog open={stickerPreviewOpen} onOpenChange={setStickerPreviewOpen}>
          <DialogContent className="max-w-[260px]">
            <DialogHeader>
              <DialogTitle className="text-center">Minha Figurinha</DialogTitle>
            </DialogHeader>
            <div className="w-48 mx-auto">
              <CollaboratorCard collaborator={myCollaborator} isUnlocked={true} />
            </div>
            <div className="text-center space-y-1 pb-2">
              <p className="font-bold">{myCollaborator.name}</p>
              <p className="text-sm text-muted-foreground">
                {myCollaborator.position ?? myCollaborator.role}
              </p>
              <Badge variant="secondary" className="capitalize">
                {displayRarity === "lendaria" ? "🟡 Lendária" :
                 displayRarity === "epica"    ? "🟣 Épica"    :
                 displayRarity === "rara"     ? "🔵 Rara"     : "⚪ Comum"}
              </Badge>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Self-service sticker section */}
      {authUser?.email && (
        <SelfStickerSection userEmail={authUser.email} displayRarity={displayRarity} />
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4">
        {[
          {
            icon: Star,
            label: "Pontuação Total",
            value: `${user?.points ?? 0} pts`,
            color: "text-yellow-500",
            bg: "bg-yellow-50 dark:bg-yellow-950",
          },
          {
            icon: Trophy,
            label: "Posição no Ranking",
            value: myRanking ? `#${myRanking.rank}` : "—",
            color: "text-primary",
            bg: "bg-primary/5",
          },
          {
            icon: BookOpen,
            label: "Cards Desbloqueados",
            value: String(unlockedCount),
            color: "text-secondary",
            bg: "bg-secondary/5",
          },
          {
            icon: Target,
            label: "Missões Concluídas",
            value: `${completedMissions.length}/${totalMissions}`,
            color: "text-purple-500",
            bg: "bg-purple-50 dark:bg-purple-950",
          },
        ].map(({ icon: Icon, label, value, color, bg }, idx) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.08 }}
            className={`${bg} border border-border rounded-xl p-4`}
          >
            <div className={`${color} mb-2`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="text-xl font-black text-foreground">{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </motion.div>
        ))}
      </div>

      {/* Missions progress */}
      {totalMissions > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-bold flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-primary" />
            Progresso nas Missões
          </h2>
          <div className="space-y-1.5 mb-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {completedMissions.length} de {totalMissions} concluídas
              </span>
              <span className="font-semibold">{Math.round(missionProgress)}%</span>
            </div>
            <Progress value={missionProgress} className="h-2" />
          </div>
          <div className="space-y-2 mt-4">
            {myMissions?.slice(0, 4).map((m) => (
              <div key={m.missionId} className="flex items-center gap-2 text-sm">
                {m.completed ? (
                  <CheckCircle2 className="w-4 h-4 text-secondary flex-shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-muted-foreground flex-shrink-0" />
                )}
                <span className={m.completed ? "text-muted-foreground line-through" : "text-foreground"}>
                  {m.title}
                </span>
                {!m.completed && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {m.progress}/{m.goal}
                  </span>
                )}
              </div>
            ))}
          </div>
          <Link href="/missions">
            <Button variant="link" size="sm" className="mt-2 p-0 text-primary">
              Ver todas as missões
            </Button>
          </Link>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <Link href="/album">
          <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-go-album">
            <BookOpen className="w-4 h-4" />
            Ir para o Álbum
          </Button>
        </Link>
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-destructive hover:text-destructive"
          onClick={logout}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4" />
          Sair da conta
        </Button>
      </div>
    </div>
  );
}
