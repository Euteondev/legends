import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useListCollaborators,
  useCreateCollaborator,
  useUpdateCollaborator,
  useDeleteCollaborator,
  useListMissions,
  useCreateMission,
  useUpdateMission,
  useDeleteMission,
  useListUsers,
  useDeleteUser,
  useListPendingMissions,
  useApproveMission,
  useRejectMission,
  useListCategorySettings,
  useSetCategoryLocked,
  getListCollaboratorsQueryKey,
  getListMissionsQueryKey,
  useGetAppSettings,
  useUpdateAppSettings,
  getListUsersQueryKey,
  getListPendingMissionsQueryKey,
  getGetMyMissionsQueryKey,
  getListCategorySettingsQueryKey,
  type Collaborator,
  type Mission,
} from "@/hooks/use-db";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { CollaboratorCard } from "@/components/cards/CollaboratorCard";
import {
  ShieldAlert, Plus, Trash2, Edit2, Users, Target, Loader2, Star,
  Eye, Power, PowerOff, Lock, Unlock, X, Zap, Award, Clock,
  CheckCircle2, XCircle, FileText, RefreshCw, Tags, PenLine, ChevronsUpDown, Check
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Link } from "wouter";
import { behaviorOptions } from "@/lib/constants";


const RARITY_COLORS: Record<string, string> = {
  comum: "bg-gray-100 text-gray-700",
  rara: "bg-blue-100 text-blue-700",
  epica: "bg-purple-100 text-purple-700",
  lendaria: "bg-yellow-100 text-yellow-700",
};

const collaboratorSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  area: z.string().min(1),
  management: z.string().min(1),
  email: z.string().optional(),
  position: z.string().optional(),
  rarity: z.enum(["comum", "rara", "epica", "lendaria"]),
  category: z.string().min(1),
  points: z.coerce.number().min(0).default(10),
  keyBehavior: z.enum(behaviorOptions).nullable().optional(),
  superPower: z.string().optional(),
  curiosity: z.string().optional(),
  achievement: z.string().optional(),
  challengeQuestion: z.string().optional(),
  challengeAnswer: z.string().optional(),
  yearsAtVale: z.coerce.number().optional(),
  photoUrl: z.string().optional(),
  backgroundUrl: z.string().optional(),
  isSpecial: z.boolean().default(false),
});

const specialCollaboratorSchema = z.object({
  name: z.string().min(1),
  rarity: z.enum(["comum", "rara", "epica", "lendaria"]),
  category: z.string().min(1),
  points: z.coerce.number().min(0).default(10),
  superPower: z.string().optional(),
  curiosity: z.string().optional(),
  achievement: z.string().optional(),
  challengeQuestion: z.string().optional(),
  challengeAnswer: z.string().optional(),
  photoUrl: z.string().optional(),
  backgroundUrl: z.string().optional(),
  hideCardName: z.boolean().default(false),
});

const missionSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  goal: z.coerce.number().min(1),
  rewardPoints: z.coerce.number().min(0).default(50),
  missionType: z.string().min(1),
  type: z.enum(["auto", "peer", "evidence"]).default("auto"),
  requiresApproval: z.boolean().default(false),
  rewardMode: z.enum(["random", "specific", "points_only"]).default("random"),
  specificCardId: z.string().optional(),
  // peer_question dual rewards
  challengerRewardPoints: z.coerce.number().min(0).default(50).optional(),
  challengerRewardMode: z.enum(["random", "specific", "points_only"]).default("random").optional(),
  challengerSpecificCardId: z.string().optional(),
  challengedRewardPoints: z.coerce.number().min(0).default(50).optional(),
  challengedRewardMode: z.enum(["random", "specific", "points_only"]).default("random").optional(),
  challengedSpecificCardId: z.string().optional(),
});

type CollaboratorForm = z.infer<typeof collaboratorSchema>;
type SpecialCollaboratorForm = z.infer<typeof specialCollaboratorSchema>;
type MissionForm = z.infer<typeof missionSchema>;

export default function AdminPage() {
  const { user } = useAuth();
  const { data: pendingMissions } = useListPendingMissions();
  const pendingCount = pendingMissions?.length ?? 0;

  if (!user?.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
        <ShieldAlert className="w-12 h-12 text-destructive" />
        <h2 className="text-xl font-bold">Acesso restrito</h2>
        <p className="text-muted-foreground">Esta área é somente para administradores.</p>
        <Link href="/"><Button>Voltar para Home</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black flex items-center gap-2">
          🛡️ <span>Painel Admin</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Gerenciar figurinhas, missões e usuários</p>
      </div>

      <Tabs defaultValue="collaborators">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="collaborators" data-testid="tab-collaborators">⭐ Figurinhas</TabsTrigger>
          <TabsTrigger value="missions" data-testid="tab-missions">🎯 Missões</TabsTrigger>
          <TabsTrigger value="validacoes" data-testid="tab-validacoes" className="relative">
            📋 Validações
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">👥 Usuários</TabsTrigger>
        </TabsList>
        <TabsContent value="collaborators" className="mt-4">
          <CollaboratorsTab />
        </TabsContent>
        <TabsContent value="missions" className="mt-4">
          <MissionsTab />
        </TabsContent>
        <TabsContent value="validacoes" className="mt-4">
          <ValidacoesTab />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <UsersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Collaborators Tab ────────────────────────────────────────────────────────
function CollaboratorsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: collaborators, isLoading } = useListCollaborators();
  const createCollaborator = useCreateCollaborator();
  const updateCollaborator = useUpdateCollaborator();
  const deleteCollaborator = useDeleteCollaborator();
  const { data: categorySettings } = useListCategorySettings();
  const setCategoryLocked = useSetCategoryLocked();

  const [createOpen, setCreateOpen] = useState(false);
  const [createSpecialOpen, setCreateSpecialOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Collaborator | null>(null);
  const [editSpecialTarget, setEditSpecialTarget] = useState<Collaborator | null>(null);
  const [previewTarget, setPreviewTarget] = useState<Collaborator | null>(null);
  const [manageCatsOpen, setManageCatsOpen] = useState(false);
  const [newCatInput, setNewCatInput] = useState("");

  const lockedCategories = useMemo(
    () => new Set((categorySettings ?? []).filter((c) => c.locked).map((c) => c.name)),
    [categorySettings]
  );

  const handleToggleCategoryLock = (cat: string) => {
    const isLocked = lockedCategories.has(cat);
    setCategoryLocked.mutate({ name: cat, locked: !isLocked }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCategorySettingsQueryKey() });
        toast({ title: isLocked ? `🔓 Categoria "${cat}" desbloqueada!` : `🔒 Categoria "${cat}" bloqueada` });
      },
      onError: () => toast({ title: "Erro ao atualizar categoria", variant: "destructive" }),
    });
  };

  const [extraCategories, setExtraCategories] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("fl-extra-categories") ?? "[]"); } catch { return []; }
  });

  const allCategories = useMemo(() => {
    const fromDB = collaborators?.map((c) => c.category) ?? [];
    return Array.from(new Set([...fromDB, ...extraCategories])).sort();
  }, [collaborators, extraCategories]);

  const handleAddCategory = () => {
    const trimmed = newCatInput.trim();
    if (!trimmed || allCategories.includes(trimmed)) return;
    const updated = [...extraCategories, trimmed];
    setExtraCategories(updated);
    localStorage.setItem("fl-extra-categories", JSON.stringify(updated));
    setNewCatInput("");
    toast({ title: `✅ Categoria "${trimmed}" adicionada` });
  };

  const handleRemoveCategory = (cat: string) => {
    const updated = extraCategories.filter((c) => c !== cat);
    setExtraCategories(updated);
    localStorage.setItem("fl-extra-categories", JSON.stringify(updated));
  };

  const firstCategory = allCategories[0] ?? "";
  const defaultValues: CollaboratorForm = {
    name: "", role: "", area: "", management: "", email: "", position: "",
    rarity: "comum", category: firstCategory, points: 10, isSpecial: false, keyBehavior: undefined,
    superPower: "", curiosity: "", achievement: "",
    challengeQuestion: "", challengeAnswer: "", photoUrl: "",
    yearsAtVale: undefined,
  };

  const createForm = useForm<CollaboratorForm>({ resolver: zodResolver(collaboratorSchema), defaultValues });
  const editForm = useForm<CollaboratorForm>({ resolver: zodResolver(collaboratorSchema), defaultValues });

  const handleCreate = createForm.handleSubmit((data) => {
    createCollaborator.mutate({ data: {
      ...data,
      email: data.email || null,
      photoUrl: data.photoUrl ?? null,
      backgroundUrl: data.backgroundUrl || null,
      superPower: data.superPower ?? null,
      curiosity: data.curiosity ?? null,
      achievement: data.achievement ?? null,
      challengeQuestion: data.challengeQuestion ?? null,
      challengeAnswer: data.challengeAnswer ?? null,
      yearsAtVale: data.yearsAtVale ?? null,
      position: data.position || null,
    }}, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCollaboratorsQueryKey() });
        toast({ title: "✅ Figurinha criada!" });
        createForm.reset(defaultValues);
        setCreateOpen(false);
      },
      onError: () => toast({ title: "Erro ao criar", variant: "destructive" }),
    });
  });

  const handleEdit = editForm.handleSubmit((data) => {
    if (!editTarget) return;
    updateCollaborator.mutate({ id: editTarget.id, data: {
      ...data,
      email: data.email || null,
      photoUrl: data.photoUrl ?? null,
      backgroundUrl: data.backgroundUrl || null,
      superPower: data.superPower ?? null,
      curiosity: data.curiosity ?? null,
      achievement: data.achievement ?? null,
      challengeQuestion: data.challengeQuestion ?? null,
      challengeAnswer: data.challengeAnswer ?? null,
      yearsAtVale: data.yearsAtVale ?? null,
      position: data.position || null,
    }}, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCollaboratorsQueryKey() });
        toast({ title: "✅ Figurinha atualizada!" });
        setEditTarget(null);
      },
      onError: () => toast({ title: "Erro ao editar", variant: "destructive" }),
    });
  });

  const specialDefaultValues: SpecialCollaboratorForm = {
    name: "", rarity: "lendaria", category: firstCategory, points: 20,
    superPower: "", curiosity: "", achievement: "",
    challengeQuestion: "", challengeAnswer: "", photoUrl: "", backgroundUrl: "",
    hideCardName: false,
  };
  const createSpecialForm = useForm<SpecialCollaboratorForm>({ resolver: zodResolver(specialCollaboratorSchema), defaultValues: specialDefaultValues });
  const editSpecialForm = useForm<SpecialCollaboratorForm>({ resolver: zodResolver(specialCollaboratorSchema), defaultValues: specialDefaultValues });

  const handleCreateSpecial = createSpecialForm.handleSubmit((data) => {
    createCollaborator.mutate({ data: {
      name: data.name,
      role: "Figurinha Especial",
      area: "",
      management: "",
      email: null,
      position: null,
      rarity: data.rarity,
      category: data.category,
      points: data.points,
      isSpecial: true,
      keyBehavior: null,
      superPower: data.superPower ?? null,
      curiosity: data.curiosity ?? null,
      achievement: data.achievement ?? null,
      challengeQuestion: data.challengeQuestion ?? null,
      challengeAnswer: data.challengeAnswer ?? null,
      photoUrl: data.photoUrl ?? null,
      backgroundUrl: data.backgroundUrl || null,
      yearsAtVale: null,
      hideCardName: data.hideCardName ?? false,
    }}, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCollaboratorsQueryKey() });
        toast({ title: "✅ Figurinha especial criada!" });
        createSpecialForm.reset(specialDefaultValues);
        setCreateSpecialOpen(false);
      },
      onError: () => toast({ title: "Erro ao criar", variant: "destructive" }),
    });
  });

  const openEdit = (c: Collaborator) => {
    if (c.isSpecial) {
      editSpecialForm.reset({
        name: c.name,
        rarity: c.rarity as SpecialCollaboratorForm["rarity"],
        category: c.category,
        points: c.points,
        superPower: c.superPower ?? "",
        curiosity: c.curiosity ?? "",
        achievement: c.achievement ?? "",
        challengeQuestion: c.challengeQuestion ?? "",
        challengeAnswer: c.challengeAnswer ?? "",
        photoUrl: c.photoUrl ?? "",
        backgroundUrl: c.backgroundUrl ?? "",
        hideCardName: c.hideCardName ?? false,
      });
      setEditSpecialTarget(c);
    } else {
      editForm.reset({
        name: c.name,
        role: c.role,
        area: c.area,
        management: c.management,
        email: c.email ?? "",
        rarity: c.rarity as CollaboratorForm["rarity"],
        category: c.category,
        points: c.points,
        isSpecial: c.isSpecial,
        keyBehavior: c.keyBehavior ?? undefined,
        superPower: c.superPower ?? "",
        curiosity: c.curiosity ?? "",
        achievement: c.achievement ?? "",
        challengeQuestion: c.challengeQuestion ?? "",
        challengeAnswer: c.challengeAnswer ?? "",
        yearsAtVale: c.yearsAtVale ?? undefined,
        photoUrl: c.photoUrl ?? "",
        backgroundUrl: c.backgroundUrl ?? "",
        position: c.position ?? "",
      });
      setEditTarget(c);
    }
  };

  const handleEditSpecial = editSpecialForm.handleSubmit((data) => {
    if (!editSpecialTarget) return;
    updateCollaborator.mutate({ id: editSpecialTarget.id, data: {
      name: data.name,
      role: "Figurinha Especial",
      area: "",
      management: "",
      email: null,
      position: null,
      rarity: data.rarity,
      category: data.category,
      points: data.points,
      isSpecial: true,
      keyBehavior: null,
      superPower: data.superPower ?? null,
      curiosity: data.curiosity ?? null,
      achievement: data.achievement ?? null,
      challengeQuestion: data.challengeQuestion ?? null,
      challengeAnswer: data.challengeAnswer ?? null,
      photoUrl: data.photoUrl ?? null,
      backgroundUrl: data.backgroundUrl || null,
      yearsAtVale: null,
      hideCardName: data.hideCardName ?? false,
    }}, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCollaboratorsQueryKey() });
        toast({ title: "✅ Figurinha especial atualizada!" });
        setEditSpecialTarget(null);
      },
      onError: () => toast({ title: "Erro ao editar", variant: "destructive" }),
    });
  });

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Excluir figurinha "${name}"? Esta ação não pode ser desfeita.`)) return;
    deleteCollaborator.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCollaboratorsQueryKey() });
        toast({ title: "Figurinha excluída" });
      },
      onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{collaborators?.length ?? 0} figurinhas cadastradas</span>
        <div className="flex items-center gap-2">
          <Dialog open={manageCatsOpen} onOpenChange={setManageCatsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Tags className="w-4 h-4 mr-1" /> Categorias
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Gerenciar Categorias</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">Categorias ativas no álbum. As categorias dos colaboradores existentes são detectadas automaticamente.</p>
                <p className="text-xs text-muted-foreground">
                  Categorias bloqueadas ficam visíveis no álbum (gerando curiosidade) mas as figurinhas não podem ser desbloqueadas até o admin liberar.
                </p>
                <div className="space-y-1 max-h-52 overflow-y-auto">
                  {allCategories.map((cat) => {
                    const isFromDB = collaborators?.some((c) => c.category === cat);
                    const isExtra = extraCategories.includes(cat);
                    const isLocked = lockedCategories.has(cat);
                    return (
                      <div key={cat} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
                        <span className="text-sm font-medium">{cat}</span>
                        <div className="flex items-center gap-1.5">
                          {isFromDB && <span className="text-[10px] text-muted-foreground">em uso</span>}
                          <Button
                            size="icon" variant="ghost"
                            className={`h-6 w-6 ${isLocked ? "text-orange-600 hover:text-orange-700" : "text-green-600 hover:text-green-700"}`}
                            title={isLocked ? "Desbloquear categoria" : "Bloquear categoria"}
                            onClick={() => handleToggleCategoryLock(cat)}
                            disabled={setCategoryLocked.isPending}
                          >
                            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                          </Button>
                          {isExtra && !isFromDB && (
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => handleRemoveCategory(cat)}>
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="Nova categoria..."
                    value={newCatInput}
                    onChange={(e) => setNewCatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCategory(); } }}
                  />
                  <Button size="sm" onClick={handleAddCategory} disabled={!newCatInput.trim()}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-new-collaborator">
                <Plus className="w-4 h-4 mr-1" /> Nova Figurinha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nova Figurinha</DialogTitle></DialogHeader>
              <CollaboratorFormFields
                form={createForm}
                onSubmit={handleCreate}
                isPending={createCollaborator.isPending}
                submitLabel="Criar Figurinha"
                categories={allCategories}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={createSpecialOpen} onOpenChange={setCreateSpecialOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" data-testid="button-new-special-collaborator">
                <Star className="w-4 h-4 mr-1" /> Figurinha Especial
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>⭐ Nova Figurinha Especial</DialogTitle></DialogHeader>
              <SpecialCollaboratorFormFields
                form={createSpecialForm}
                onSubmit={handleCreateSpecial}
                isPending={createCollaborator.isPending}
                submitLabel="Criar Figurinha Especial"
                categories={allCategories}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : (
        <div className="space-y-4">
          {(() => {
            if (!collaborators || collaborators.length === 0) {
              return (
                <div className="bg-card border border-border rounded-xl text-center py-12 text-muted-foreground text-sm">
                  <div className="text-3xl mb-2">🎴</div>
                  Nenhuma figurinha cadastrada
                </div>
              );
            }
            // Agrupar por categoria
            const byCategory = new Map<string, Collaborator[]>();
            for (const c of collaborators) {
              const cat = c.isSpecial ? "⭐ Especiais" : (c.category || "Sem categoria");
              if (!byCategory.has(cat)) byCategory.set(cat, []);
              byCategory.get(cat)!.push(c);
            }
            // Ordenar categorias: Especiais primeiro, depois alfabético
            const sortedCats = [...byCategory.keys()].sort((a, b) => {
              if (a === "⭐ Especiais") return -1;
              if (b === "⭐ Especiais") return 1;
              return a.localeCompare(b, "pt-BR");
            });

            return sortedCats.map((cat) => (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{cat}</span>
                  <span className="text-xs text-muted-foreground">({byCategory.get(cat)!.length})</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="divide-y divide-border">
                    {byCategory.get(cat)!.map((c) => (
                      <motion.div
                        key={c.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                        data-testid={`admin-collab-${c.id}`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {c.photoUrl ? (
                            <img src={c.photoUrl} alt={c.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-lg">{c.isSpecial ? "⭐" : "👤"}</span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm truncate">{c.name}</p>
                            {c.isSpecial && <span className="text-xs">⭐</span>}
                            {c.hideCardName && <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">sem nome</span>}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {c.isSpecial ? "Figurinha Especial" : `${c.role} — ${c.area}`}
                          </p>
                        </div>

                        <Badge className={`text-xs flex-shrink-0 border-0 ${RARITY_COLORS[c.rarity] ?? ""}`}>
                          {c.rarity}
                        </Badge>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost" size="icon"
                            className="text-primary hover:text-primary h-8 w-8"
                            title="Prévia"
                            onClick={() => setPreviewTarget(c)}
                            data-testid={`button-preview-collab-${c.id}`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="text-muted-foreground hover:text-foreground h-8 w-8"
                            title="Editar"
                            onClick={() => openEdit(c)}
                            data-testid={`button-edit-collab-${c.id}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="text-destructive hover:text-destructive h-8 w-8"
                            title="Excluir"
                            onClick={() => handleDelete(c.id, c.name)}
                            data-testid={`button-delete-collab-${c.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar: {editTarget?.name}</DialogTitle>
          </DialogHeader>
          <CollaboratorFormFields
            form={editForm}
            onSubmit={handleEdit}
            isPending={updateCollaborator.isPending}
            submitLabel="Salvar Alterações"
            categories={allCategories}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editSpecialTarget} onOpenChange={(open) => { if (!open) setEditSpecialTarget(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>⭐ Editar Especial: {editSpecialTarget?.name}</DialogTitle>
          </DialogHeader>
          <SpecialCollaboratorFormFields
            form={editSpecialForm}
            onSubmit={handleEditSpecial}
            isPending={updateCollaborator.isPending}
            submitLabel="Salvar Alterações"
            categories={allCategories}
          />
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {previewTarget && (
          <Dialog open={!!previewTarget} onOpenChange={(open) => { if (!open) setPreviewTarget(null); }}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="w-4 h-4" /> Prévia da Figurinha
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="max-w-[200px] mx-auto">
                  <CollaboratorCard
                    collaborator={previewTarget}
                    isUnlocked={true}
                  />
                </div>
                <div className="space-y-2 text-sm">
                  {previewTarget.superPower && (
                    <div className="bg-primary/10 rounded-lg p-3">
                      <p className="text-primary font-bold text-xs mb-0.5">⚡ Super Poder</p>
                      <p className="text-foreground">{previewTarget.superPower}</p>
                    </div>
                  )}
                  {previewTarget.curiosity && (
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-muted-foreground font-bold text-xs mb-0.5">💡 Curiosidade</p>
                      <p className="text-foreground">{previewTarget.curiosity}</p>
                    </div>
                  )}
                  {previewTarget.achievement && (
                    <div className="bg-secondary/10 rounded-lg p-3">
                      <p className="text-secondary font-bold text-xs mb-0.5">🏆 Conquista</p>
                      <p className="text-foreground">{previewTarget.achievement}</p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="bg-muted rounded p-2">
                    <p className="font-semibold text-foreground">{previewTarget.area}</p>
                    <p>Área</p>
                  </div>
                  <div className="bg-muted rounded p-2">
                    <p className="font-semibold text-foreground">{previewTarget.points} pts</p>
                    <p>Pontos</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setPreviewTarget(null); openEdit(previewTarget); }}>
                    <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Editar
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => setPreviewTarget(null)}>
                    Fechar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Photo picker component ───────────────────────────────────────────────────
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
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex-1 flex items-center gap-2 px-3 py-2 border border-input rounded-md text-sm text-muted-foreground hover:bg-muted/50 transition-colors text-left"
        >
          {value ? "✅ Imagem selecionada — clique para trocar" : "Selecionar imagem do dispositivo..."}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => { onChange(""); if (fileRef.current) fileRef.current.value = ""; }}
            className="flex items-center px-2 py-2 border border-destructive/40 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
            title="Remover imagem"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {value && (
        <img src={value} alt="Prévia" className="w-16 h-16 rounded-lg object-cover border border-border" />
      )}
    </div>
  );
}

// ─── Searchable collaborator combobox ─────────────────────────────────────────
function CollaboratorCombobox({
  value,
  onChange,
  collaborators,
  placeholder = "Selecione a figurinha...",
}: {
  value: string;
  onChange: (v: string) => void;
  collaborators: Collaborator[] | undefined;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = collaborators?.find((c) => c.id === value);
  const filtered = (collaborators ?? []).filter((c) =>
    `${c.name} ${c.category}`.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors"
        >
          <span className={selected ? "text-foreground" : "text-muted-foreground"}>
            {selected ? `${selected.name} (${selected.category})` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por nome ou categoria..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Nenhuma figurinha encontrada.</CommandEmpty>
            <CommandGroup>
              {filtered.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.id}
                  onSelect={() => {
                    onChange(c.id);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check className={`mr-2 h-4 w-4 ${value === c.id ? "opacity-100" : "opacity-0"}`} />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground shrink-0">{c.category}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Collaborator form ────────────────────────────────────────────────────────
function CollaboratorFormFields({
  form, onSubmit, isPending, submitLabel, categories
}: {
  form: ReturnType<typeof useForm<CollaboratorForm>>;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  submitLabel: string;
  categories: string[];
}) {
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const challengeQuestion = useWatch({ control: form.control, name: "challengeQuestion" });
  const isSpecial = useWatch({ control: form.control, name: "isSpecial" });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem><FormLabel>Nome *</FormLabel><FormControl><Input {...field} data-testid="input-collab-name" /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="role" render={({ field }) => (
            <FormItem><FormLabel>Cargo *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="area" render={({ field }) => (
            <FormItem><FormLabel>Área *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="management" render={({ field }) => (
            <FormItem><FormLabel>Gerência *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <div className="col-span-2">
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel>📧 Email do colaborador</FormLabel><FormControl><Input {...field} type="email" placeholder="email@valesalobo.com.br" /></FormControl></FormItem>
            )} />
          </div>
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
          <FormField control={form.control} name="rarity" render={({ field }) => (
            <FormItem>
              <FormLabel>Raridade *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="comum">⚪ Comum</SelectItem>
                  <SelectItem value="rara">🔵 Rara</SelectItem>
                  <SelectItem value="epica">🟣 Épica</SelectItem>
                  <SelectItem value="lendaria">🟡 Lendária</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )} />
          <FormField control={form.control} name="category" render={({ field }) => (
            <FormItem>
              <FormLabel>Categoria *</FormLabel>
              {isCustomCategory ? (
                <div className="flex gap-1">
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Nome da categoria..."
                      autoFocus
                    />
                  </FormControl>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 flex-shrink-0"
                    onClick={() => setIsCustomCategory(false)}
                    title="Voltar para lista"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <Select
                  onValueChange={(val) => {
                    if (val === "__custom__") {
                      setIsCustomCategory(true);
                      field.onChange("");
                    } else {
                      field.onChange(val);
                    }
                  }}
                  value={field.value}
                >
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                    <SelectItem value="__custom__">
                      <span className="flex items-center gap-1.5 text-primary">
                        <PenLine className="w-3.5 h-3.5" /> Digitar nova categoria...
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </FormItem>
          )} />
          <FormField control={form.control} name="points" render={({ field }) => (
            <FormItem><FormLabel>Pontos</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="yearsAtVale" render={({ field }) => (
            <FormItem><FormLabel>Anos na Vale</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
          )} />
        </div>
        <FormField
          control={form.control}
          name="keyBehavior"
          render={({ field }) => (
            <FormItem>
              <FormLabel>🎯 Comportamento Chave</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || undefined}>
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
          <FormItem>
            <FormLabel>📷 Foto</FormLabel>
            <FormControl>
              <PhotoPickerField value={field.value ?? ""} onChange={field.onChange} />
            </FormControl>
          </FormItem>
        )} />
        <FormField control={form.control} name="superPower" render={({ field }) => (
          <FormItem><FormLabel>⚡ Super Poder</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="challengeQuestion" render={({ field: qField }) => (
          <FormItem>
            <FormLabel>❓ Pergunta do Desafio</FormLabel>
            <FormControl>
              <Input
                {...qField}
                placeholder="Qual é o Super Poder de ...? (deixe vazio para usar a padrão)"
              />
            </FormControl>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Se vazio, usa a pergunta padrão: "Qual é o Super Poder de [nome]?"
            </p>
          </FormItem>
        )} />
        {!!challengeQuestion?.trim() && (
          <FormField control={form.control} name="challengeAnswer" render={({ field }) => (
            <FormItem>
              <FormLabel>✅ Resposta da Pergunta do Desafio <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="Resposta correta para a pergunta acima..."
                />
              </FormControl>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                O sistema vai comparar a resposta do usuário com este valor.
              </p>
            </FormItem>
          )} />
        )}
        <FormField control={form.control} name="curiosity" render={({ field }) => (
          <FormItem><FormLabel>💡 Curiosidade</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="achievement" render={({ field }) => (
          <FormItem><FormLabel>🏆 Conquista</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl></FormItem>
        )} />

        <FormField control={form.control} name="isSpecial" render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0">
            <FormControl>
              <input type="checkbox" checked={field.value} onChange={field.onChange} className="w-4 h-4 rounded" />
            </FormControl>
            <FormLabel className="font-normal cursor-pointer">⭐ Figurinha especial (efeito brilho)</FormLabel>
          </FormItem>
        )} />

        {isSpecial && (
          <FormField control={form.control} name="backgroundUrl" render={({ field }) => (
            <FormItem>
              <FormLabel>🖼️ Imagem de fundo (figurinha especial)</FormLabel>
              <FormControl>
                <PhotoPickerField value={field.value ?? ""} onChange={field.onChange} />
              </FormControl>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Se vazio, usa o fundo padrão da raridade selecionada.
              </p>
            </FormItem>
          )} />
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {submitLabel}
        </Button>
      </form>
    </Form>
  );
}

// ─── Special collaborator form ────────────────────────────────────────────────
function SpecialCollaboratorFormFields({
  form, onSubmit, isPending, submitLabel, categories
}: {
  form: ReturnType<typeof useForm<SpecialCollaboratorForm>>;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  submitLabel: string;
  categories: string[];
}) {
  const challengeQuestion = useWatch({ control: form.control, name: "challengeQuestion" });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-xs text-muted-foreground bg-primary/5 rounded-lg px-3 py-2">
          Figurinhas especiais não pertencem a um colaborador — sem cargo, área, gerência ou email.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Nome *</FormLabel><FormControl><Input {...field} data-testid="input-special-name" /></FormControl></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="rarity" render={({ field }) => (
            <FormItem>
              <FormLabel>Raridade *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="comum">⚪ Comum</SelectItem>
                  <SelectItem value="rara">🔵 Rara</SelectItem>
                  <SelectItem value="epica">🟣 Épica</SelectItem>
                  <SelectItem value="lendaria">🟡 Lendária</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )} />
          <FormField control={form.control} name="category" render={({ field }) => (
            <FormItem>
              <FormLabel>Categoria *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )} />
          <FormField control={form.control} name="points" render={({ field }) => (
            <FormItem><FormLabel>Pontos</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="photoUrl" render={({ field }) => (
          <FormItem>
            <FormLabel>📷 Foto</FormLabel>
            <FormControl>
              <PhotoPickerField value={field.value ?? ""} onChange={field.onChange} />
            </FormControl>
          </FormItem>
        )} />
        <FormField control={form.control} name="backgroundUrl" render={({ field }) => (
          <FormItem>
            <FormLabel>🖼️ Imagem de fundo</FormLabel>
            <FormControl>
              <PhotoPickerField value={field.value ?? ""} onChange={field.onChange} />
            </FormControl>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Se vazio, usa o fundo padrão da raridade selecionada.
            </p>
          </FormItem>
        )} />
        <FormField control={form.control} name="superPower" render={({ field }) => (
          <FormItem><FormLabel>⚡ Super Poder</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="challengeQuestion" render={({ field: qField }) => (
          <FormItem>
            <FormLabel>❓ Pergunta do Desafio</FormLabel>
            <FormControl>
              <Input
                {...qField}
                placeholder="Pergunta para desbloquear esta figurinha (deixe vazio para usar a padrão)"
              />
            </FormControl>
          </FormItem>
        )} />
        {!!challengeQuestion?.trim() && (
          <FormField control={form.control} name="challengeAnswer" render={({ field }) => (
            <FormItem>
              <FormLabel>✅ Resposta da Pergunta do Desafio <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="Resposta correta para a pergunta acima..."
                />
              </FormControl>
            </FormItem>
          )} />
        )}
        <FormField control={form.control} name="curiosity" render={({ field }) => (
          <FormItem><FormLabel>💡 Curiosidade</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="achievement" render={({ field }) => (
          <FormItem><FormLabel>🏆 Conquista</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl></FormItem>
        )} />

        <FormField control={form.control} name="hideCardName" render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0 bg-muted/40 rounded-lg px-3 py-2">
            <FormControl>
              <input type="checkbox" checked={field.value ?? false} onChange={field.onChange} className="w-4 h-4 rounded" />
            </FormControl>
            <div>
              <FormLabel className="font-normal cursor-pointer">🏷️ Ocultar nome na figurinha</FormLabel>
              <p className="text-[11px] text-muted-foreground">Quando marcado, o banner com o nome não aparece sobre a imagem da figurinha.</p>
            </div>
          </FormItem>
        )} />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {submitLabel}
        </Button>
      </form>
    </Form>
  );
}

// ─── Missions Tab ─────────────────────────────────────────────────────────────
function DuplicateDonationSettings() {
  const { data: settings } = useGetAppSettings();
  const updateSettings = useUpdateAppSettings();
  const { toast } = useToast();
  const [points, setPoints] = useState<number | null>(null);

  const value = points ?? settings?.duplicateDonationPoints ?? 10;

  const handleSave = () => {
    updateSettings.mutate({ duplicateDonationPoints: value }, {
      onSuccess: () => toast({ title: "✅ Configuração salva!" }),
      onError: () => toast({ title: "Erro ao salvar configuração", variant: "destructive" }),
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 flex-wrap">
      <div className="flex-1 min-w-[220px]">
        <p className="font-semibold text-sm">🔁 Doação de figurinha repetida</p>
        <p className="text-xs text-muted-foreground">Pontos ganhos por quem doa uma figurinha repetida a outro participante.</p>
      </div>
      <Input
        type="number"
        min={0}
        className="w-24"
        value={value}
        onChange={(e) => setPoints(Number(e.target.value))}
      />
      <Button size="sm" onClick={handleSave} disabled={updateSettings.isPending}>
        {updateSettings.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
      </Button>
    </div>
  );
}

function MissionsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: missions, isLoading } = useListMissions();
  const createMission = useCreateMission();
  const updateMission = useUpdateMission();
  const deleteMission = useDeleteMission();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Mission | null>(null);
  const [seedingDefaults, setSeedingDefaults] = useState(false);

  const defaultValues: MissionForm = { title: "", description: "", goal: 1, rewardPoints: 50, missionType: "unlock_cards", type: "auto", requiresApproval: false, rewardMode: "random", specificCardId: "" };

  const DEFAULT_ALBUM_MISSIONS = [
    { title: "Rumo à Final", description: "Complete 80% do álbum para ganhar uma figurinha especial!", goal: 80, rewardPoints: 200, missionType: "album_percent", type: "auto" as const, requiresApproval: false, status: "open" as const },
    { title: "Campeão dos Legends", description: "Complete 100% do álbum e se torne um verdadeiro Legends!", goal: 100, rewardPoints: 500, missionType: "album_percent", type: "auto" as const, requiresApproval: false, status: "open" as const },
  ];

  const handleSeedDefaultMissions = async () => {
    const existingGoals = new Set(
      (missions ?? []).filter((m) => m.missionType === "album_percent").map((m) => m.goal)
    );
    const toCreate = DEFAULT_ALBUM_MISSIONS.filter((m) => !existingGoals.has(m.goal));
    if (toCreate.length === 0) {
      toast({ title: "Missões de progresso já existem!" });
      return;
    }
    setSeedingDefaults(true);
    try {
      for (const m of toCreate) {
        await createMission.mutateAsync({ data: m });
      }
      queryClient.invalidateQueries({ queryKey: getListMissionsQueryKey() });
      toast({ title: `✅ ${toCreate.length} missão(ões) de progresso criada(s)!` });
    } catch {
      toast({ title: "Erro ao criar missões padrão", variant: "destructive" });
    } finally {
      setSeedingDefaults(false);
    }
  };

  const createForm = useForm<MissionForm>({ resolver: zodResolver(missionSchema), defaultValues });
  const editForm = useForm<MissionForm>({ resolver: zodResolver(missionSchema), defaultValues });

  const handleCreate = createForm.handleSubmit((data) => {
    createMission.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMissionsQueryKey() });
        toast({ title: "✅ Missão criada!" });
        createForm.reset(defaultValues);
        setCreateOpen(false);
      },
      onError: () => toast({ title: "Erro ao criar missão", variant: "destructive" }),
    });
  });

  const handleEdit = editForm.handleSubmit((data) => {
    if (!editTarget) return;
    updateMission.mutate({ id: editTarget.id, data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMissionsQueryKey() });
        toast({ title: "✅ Missão atualizada!" });
        setEditTarget(null);
      },
      onError: () => toast({ title: "Erro ao editar", variant: "destructive" }),
    });
  });

  const openEdit = (m: Mission) => {
    editForm.reset({
      title: m.title,
      description: m.description,
      goal: m.goal,
      rewardPoints: m.rewardPoints,
      missionType: m.missionType ?? "unlock_cards",
      type: (m.type ?? "auto") as MissionForm["type"],
      requiresApproval: m.requiresApproval ?? false,
      rewardMode: m.rewardMode ?? "random",
      specificCardId: m.specificCardId ?? "",
      challengerRewardPoints: m.challengerRewardPoints ?? 50,
      challengerRewardMode: m.challengerRewardMode ?? "random",
      challengerSpecificCardId: m.challengerSpecificCardId ?? "",
      challengedRewardPoints: m.challengedRewardPoints ?? 50,
      challengedRewardMode: m.challengedRewardMode ?? "points_only",
      challengedSpecificCardId: m.challengedSpecificCardId ?? "",
    });
    setEditTarget(m);
  };

  const toggleStatus = (m: Mission) => {
    const newStatus = m.status === "open" ? "closed" : "open";
    updateMission.mutate(
      { id: m.id, data: { status: newStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMissionsQueryKey() });
          toast({ title: newStatus === "open" ? "✅ Missão aberta!" : "🔒 Missão encerrada!" });
        },
        onError: () => toast({ title: "Erro ao atualizar status", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (id: string, title: string) => {
    if (!confirm(`Excluir missão "${title}"?`)) return;
    deleteMission.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMissionsQueryKey() });
        toast({ title: "Missão excluída" });
      },
      onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
    });
  };

  const openMissions = missions?.filter((m) => m.status === "open" || !m.status) ?? [];
  const closedMissions = missions?.filter((m) => m.status === "closed") ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{missions?.length ?? 0} missões</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">
            {openMissions.length} abertas
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-semibold">
            {closedMissions.length} encerradas
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSeedDefaultMissions}
            disabled={seedingDefaults || isLoading}
            title="Cria automaticamente as missões de progresso do álbum (80% e 100%)"
          >
            {seedingDefaults ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <span className="mr-1">📊</span>}
            Missões padrão
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-new-mission">
              <Plus className="w-4 h-4 mr-1" /> Nova Missão
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Nova Missão</DialogTitle></DialogHeader>
            <MissionFormFields form={createForm} onSubmit={handleCreate} isPending={createMission.isPending} submitLabel="Criar Missão" />
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <DuplicateDonationSettings />

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : (
        <div className="space-y-3">
          {missions?.map((m) => {
            const isOpen = m.status === "open" || !m.status;
            return (
              <motion.div
                key={m.id}
                className={`bg-card border rounded-xl p-4 transition-all ${isOpen ? "border-border" : "border-dashed border-gray-200 opacity-60"}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base ${isOpen ? "bg-primary/10" : "bg-gray-100"}`}>
                    {isOpen ? "🎯" : "🔒"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{m.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{m.description}</p>
                      </div>
                      <Badge className={`flex-shrink-0 text-xs border-0 ${isOpen ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {isOpen ? "Aberta" : "Encerrada"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>Meta: {m.goal}</span>
                      <span>⭐ {m.rewardPoints} pts</span>
                      <span className="text-foreground/40">•</span>
                      <span>{m.missionType}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                  <Button
                    variant="outline"
                    size="sm"
                    className={`gap-1.5 text-xs font-semibold flex-1 ${isOpen ? "text-orange-600 border-orange-200 hover:bg-orange-50" : "text-green-600 border-green-200 hover:bg-green-50"}`}
                    onClick={() => toggleStatus(m)}
                    data-testid={`button-toggle-mission-${m.id}`}
                    disabled={updateMission.isPending}
                  >
                    {updateMission.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> :
                      isOpen ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
                    {isOpen ? "Encerrar" : "Reabrir"}
                  </Button>
                  {m.missionType !== "album_percent" && (
                    <Button
                      variant="ghost" size="icon"
                      className="text-muted-foreground hover:text-foreground h-8 w-8"
                      onClick={() => openEdit(m)}
                      data-testid={`button-edit-mission-${m.id}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {m.missionType !== "album_percent" ? (
                    <Button
                      variant="ghost" size="icon"
                      className="text-destructive hover:text-destructive h-8 w-8"
                      onClick={() => handleDelete(m.id, m.title)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  ) : (
                    <div className="h-8 w-8 flex items-center justify-center" title="Missão permanente — não pode ser excluída">
                      <Lock className="w-3.5 h-3.5 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
          {(!missions || missions.length === 0) && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <div className="text-3xl mb-2">🎯</div>
              Nenhuma missão cadastrada
            </div>
          )}
        </div>
      )}

      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar: {editTarget?.title}</DialogTitle></DialogHeader>
          <MissionFormFields form={editForm} onSubmit={handleEdit} isPending={updateMission.isPending} submitLabel="Salvar Alterações" />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RewardModeSelect({ control, name, collaborators }: {
  control: any;
  name: string;
  collaborators: Collaborator[] | undefined;
}) {
  const mode = useWatch({ control, name });
  const cardFieldName = name.replace("RewardMode", "SpecificCardId").replace("rewardMode", "specificCardId");
  return (
    <div className="space-y-2">
      <FormField control={control} name={name} render={({ field }) => (
        <FormItem>
          <Select onValueChange={field.onChange} value={field.value ?? "random"}>
            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
            <SelectContent>
              <SelectItem value="random">🎲 Figurinha Aleatória</SelectItem>
              <SelectItem value="specific">🎯 Figurinha Específica</SelectItem>
              <SelectItem value="points_only">⭐ Somente Pontos (sem figurinha)</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>
      )} />
      {mode === "specific" && (
        <FormField control={control} name={cardFieldName} render={({ field }) => (
          <FormItem>
            <FormControl>
              <CollaboratorCombobox
                value={field.value ?? ""}
                onChange={field.onChange}
                collaborators={collaborators}
              />
            </FormControl>
          </FormItem>
        )} />
      )}
    </div>
  );
}

function MissionFormFields({
  form, onSubmit, isPending, submitLabel
}: {
  form: ReturnType<typeof useForm<MissionForm>>;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const { data: collaborators } = useListCollaborators();
  const rewardMode = useWatch({ control: form.control, name: "rewardMode" });
  const missionType = useWatch({ control: form.control, name: "missionType" });
  const isPeerQuestion = missionType === "peer_question";

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem><FormLabel>Título *</FormLabel><FormControl><Input {...field} data-testid="input-mission-title" /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem><FormLabel>Descrição *</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl></FormItem>
        )} />
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="goal" render={({ field }) => (
            <FormItem><FormLabel>Meta *</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
          )} />
          {!isPeerQuestion && (
            <FormField control={form.control} name="rewardPoints" render={({ field }) => (
              <FormItem><FormLabel>⭐ Recompensa (pts) *</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
            )} />
          )}
        </div>
        <FormField control={form.control} name="missionType" render={({ field }) => (
          <FormItem>
            <FormLabel>Mecânica da Missão</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="unlock_cards">🎴 Desbloquear Figurinhas</SelectItem>
                <SelectItem value="unlock_category">📂 Desbloquear Categoria</SelectItem>
                <SelectItem value="unlock_rarity">💎 Desbloquear Raridade</SelectItem>
                <SelectItem value="unlock_other_category">🔀 Desbloquear Categoria Diferente</SelectItem>
                <SelectItem value="album_percent">📊 Progresso do Álbum (%)</SelectItem>
                <SelectItem value="login">⚡ Login / Acesso</SelectItem>
                <SelectItem value="peer_interaction">🤝 Interação com Outro Jogador</SelectItem>
                <SelectItem value="peer_question">❓ Pergunta Configurável (Desafio)</SelectItem>
              </SelectContent>
            </Select>
            {field.value === "album_percent" && (
              <p className="text-xs text-muted-foreground mt-1">
                💡 Use a <strong>Meta</strong> para definir o % do álbum necessário (ex: 50 = completar 50% do álbum). Esta missão é acompanhada automaticamente.
              </p>
            )}
            {field.value === "unlock_other_category" && (
              <p className="text-xs text-muted-foreground mt-1">
                💡 O usuário precisa desbloquear figurinhas de uma categoria <strong>diferente</strong> da sua própria categoria (identificada pelo email). Use a <strong>Meta</strong> para definir quantas figurinhas.
              </p>
            )}
            {field.value === "peer_interaction" && (
              <p className="text-xs text-muted-foreground mt-1">
                💡 O jogador presenteia um colega com uma figurinha. A figurinha vai para o álbum do colega selecionado; o remetente ganha os pontos configurados.
              </p>
            )}
            {field.value === "peer_question" && (
              <p className="text-xs text-muted-foreground mt-1">
                💡 O jogador cria um desafio de pergunta para um colega. Configure recompensas separadas para quem enviou e quem respondeu corretamente.
              </p>
            )}
          </FormItem>
        )} />

        {/* Recompensas para peer_question: dual config */}
        {isPeerQuestion ? (
          <div className="space-y-3 bg-muted/30 rounded-xl p-4 border border-border">
            <p className="text-xs font-bold text-foreground">🎁 Recompensas do Desafio</p>

            {/* Desafiante */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-primary flex items-center gap-1">👤 Quem enviou o desafio</p>
              <div className="grid grid-cols-2 gap-2">
                <FormField control={form.control} name="challengerRewardPoints" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">⭐ Pontos</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                  </FormItem>
                )} />
                <div>
                  <p className="text-xs font-medium mb-1.5">🎴 Figurinha</p>
                  <RewardModeSelect control={form.control} name="challengerRewardMode" collaborators={collaborators} />
                </div>
              </div>
            </div>

            <div className="border-t border-border/50" />

            {/* Desafiado */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-amber-600 flex items-center gap-1">👤 Quem respondeu o desafio</p>
              <div className="grid grid-cols-2 gap-2">
                <FormField control={form.control} name="challengedRewardPoints" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">⭐ Pontos</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                  </FormItem>
                )} />
                <div>
                  <p className="text-xs font-medium mb-1.5">🎴 Figurinha</p>
                  <RewardModeSelect control={form.control} name="challengedRewardMode" collaborators={collaborators} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <FormField control={form.control} name="rewardMode" render={({ field }) => (
              <FormItem>
                <FormLabel>🎁 Tipo de Recompensa</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? "random"}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="random">🎲 Figurinha Aleatória</SelectItem>
                    <SelectItem value="specific">🎯 Figurinha Específica</SelectItem>
                    <SelectItem value="points_only">⭐ Somente Pontos (sem figurinha)</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            {rewardMode === "specific" && (
              <FormField control={form.control} name="specificCardId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Figurinha Específica *</FormLabel>
                  <FormControl>
                    <CollaboratorCombobox
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      collaborators={collaborators}
                    />
                  </FormControl>
                </FormItem>
              )} />
            )}
          </>
        )}

        <FormField control={form.control} name="type" render={({ field }) => (
          <FormItem>
            <FormLabel>Modo de Validação</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="auto">⚡ Automática — validada pelo sistema</SelectItem>
                <SelectItem value="peer">👥 Interação — confirmação entre pares</SelectItem>
                <SelectItem value="evidence">📋 Evidência — comprovante revisado pelo admin</SelectItem>
              </SelectContent>
            </Select>
          </FormItem>
        )} />
        <FormField control={form.control} name="requiresApproval" render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0">
            <FormControl>
              <input type="checkbox" checked={field.value} onChange={field.onChange} className="w-4 h-4 rounded" />
            </FormControl>
            <FormLabel className="font-normal cursor-pointer">Requer aprovação do admin antes de concluir</FormLabel>
          </FormItem>
        )} />
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {submitLabel}
        </Button>
      </form>
    </Form>
  );
}

// ─── Proof display ────────────────────────────────────────────────────────────
function ProofDisplay({ proofText }: { proofText: string }) {
  let text = proofText;
  let attachments: Array<{ name: string; data: string }> = [];
  try {
    const parsed = JSON.parse(proofText);
    if (parsed && typeof parsed === "object") {
      text = parsed.text ?? "";
      attachments = Array.isArray(parsed.attachments) ? parsed.attachments : [];
    }
  } catch {
    // plain text
  }

  return (
    <div className="bg-muted/60 rounded-lg p-3 space-y-2">
      <p className="text-xs font-bold text-muted-foreground flex items-center gap-1">
        <FileText className="w-3.5 h-3.5" /> Comprovante enviado
      </p>
      {text && <p className="text-sm text-foreground">{text}</p>}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {attachments.map((att, i) => (
            att.data.startsWith("data:image/") ? (
              <a key={i} href={att.data} target="_blank" rel="noopener noreferrer">
                <img
                  src={att.data}
                  alt={att.name}
                  className="w-20 h-20 object-cover rounded-lg border border-border hover:opacity-80 transition-opacity"
                />
              </a>
            ) : (
              <a
                key={i}
                href={att.data}
                download={att.name}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                {att.name}
              </a>
            )
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Validações Tab ───────────────────────────────────────────────────────────
function ValidacoesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: pending, isLoading, refetch } = useListPendingMissions();
  const approveMission = useApproveMission();
  const rejectMission = useRejectMission();

  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const handleApprove = (userMissionId: string, userName: string) => {
    approveMission.mutate({ userMissionId }, {
      onSuccess: (data: any) => {
        queryClient.invalidateQueries({ queryKey: getListPendingMissionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyMissionsQueryKey() });
        const cardName = data?.rewardCard?.name;
        toast({ title: cardName
          ? `✅ ${userName} aprovado! Figurinha "${cardName}" sorteada.`
          : `✅ ${userName} aprovado! Pontos bônus concedidos.`
        });
      },
      onError: () => toast({ title: "Erro ao aprovar", variant: "destructive" }),
    });
  };

  const handleReject = (userMissionId: string, userName: string) => {
    if (!rejectNote.trim()) {
      toast({ title: "Informe o motivo da rejeição", variant: "destructive" });
      return;
    }
    rejectMission.mutate({ userMissionId, data: { note: rejectNote.trim() } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPendingMissionsQueryKey() });
        toast({ title: `❌ Comprovante de ${userName} rejeitado.` });
        setRejectTarget(null);
        setRejectNote("");
      },
      onError: () => toast({ title: "Erro ao rejeitar", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{pending?.length ?? 0} comprovantes pendentes</span>
          {(pending?.length ?? 0) > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold">
              ⏳ Aguardando revisão
            </span>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={() => refetch()} className="gap-1.5 text-muted-foreground">
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      ) : pending && pending.length > 0 ? (
        <div className="space-y-3">
          {pending.map((item) => (
            <motion.div
              key={item.userMissionId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-orange-200 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {item.userPhoto
                    ? <img src={item.userPhoto} alt={item.userName} className="w-full h-full object-cover" />
                    : <span className="text-lg">👤</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-bold text-sm">{item.userName}</p>
                    <Badge className="bg-orange-100 text-orange-700 border-0 text-[10px]">⏳ Pendente</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Missão: <span className="font-semibold text-foreground">{item.missionTitle}</span>
                  </p>
                  {item.targetUserName && (
                    <p className="text-xs text-muted-foreground">
                      🤝 Colega: <span className="font-semibold text-foreground">{item.targetUserName}</span>
                    </p>
                  )}
                  {item.submittedAt && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(item.submittedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
              </div>

              <ProofDisplay proofText={item.proofText ?? ""} />

              {rejectTarget === item.userMissionId && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-bold text-red-700">Motivo da rejeição</p>
                  <Textarea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    placeholder="Informe o motivo para o participante..."
                    rows={2}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" className="flex-1 gap-1.5"
                      onClick={() => handleReject(item.userMissionId, item.userName)}
                      disabled={rejectMission.isPending}
                    >
                      {rejectMission.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      Confirmar Rejeição
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setRejectTarget(null); setRejectNote(""); }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {rejectTarget !== item.userMissionId && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white border-0"
                    onClick={() => handleApprove(item.userMissionId, item.userName)}
                    disabled={approveMission.isPending}
                  >
                    {approveMission.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Aprovar + Sortear Figurinha
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5 border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => { setRejectTarget(item.userMissionId); setRejectNote(""); }}
                  >
                    <XCircle className="w-3.5 h-3.5" /> Rejeitar
                  </Button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-5xl mb-3">✅</div>
          <p className="font-medium">Nenhum comprovante pendente</p>
          <p className="text-sm mt-1">Tudo em dia!</p>
        </div>
      )}
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: users, isLoading } = useListUsers();
  const { data: collaborators } = useListCollaborators();
  const deleteUser = useDeleteUser();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const linkedEmails = new Set(
    (collaborators ?? [])
      .map((c) => c.email?.trim().toLowerCase())
      .filter((e): e is string => !!e)
  );

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteUser.mutate({ id: deleteTarget.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast({ title: "✅ Usuário excluído!" });
        setDeleteTarget(null);
      },
      onError: () => toast({ title: "Erro ao excluir usuário", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-4">
      <span className="text-sm text-muted-foreground">{users?.length ?? 0} usuários cadastrados</span>
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {users?.map((u) => {
              const isLinked = !!u.email && linkedEmails.has(u.email.trim().toLowerCase());
              return (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40" data-testid={`admin-user-${u.id}`}>
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {u.photo ? <img src={u.photo} alt={u.name} className="w-full h-full object-cover" /> : <span className="text-base">👤</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-sm truncate">{u.name}</p>
                    {u.isAdmin && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">admin</Badge>}
                    <span
                      title={isLinked ? "Figurinha vinculada" : "Sem figurinha vinculada"}
                      className={`text-xs ${isLinked ? "text-green-600" : "text-muted-foreground/40"}`}
                    >
                      {isLinked ? "🎴" : "⭘"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold">⭐ {u.points}</div>
                  <div className="text-xs text-muted-foreground">{Math.round(u.progress ?? 0)}% álbum</div>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteTarget({ id: u.id, name: u.name })}
                  className="flex-shrink-0 p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Excluir usuário"
                  data-testid={`button-delete-user-${u.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              );
            })}
            {(!users || users.length === 0) && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <div className="text-3xl mb-2">👥</div>
                Nenhum usuário ainda
              </div>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita e removerá o cadastro do usuário (as figurinhas e progresso associados permanecerão registrados separadamente).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteUser.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
