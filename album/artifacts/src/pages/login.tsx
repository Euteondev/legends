import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useRegisterUser } from "@/hooks/use-db";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerUser = useRegisterUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    registerUser.mutate(
      { data: { name: name.trim(), email: email.trim().toLowerCase() } },
      {
        onSuccess: (user) => {
          login(user);
          setLocation("/");
          toast({ title: `Bem-vindo ao campo, ${user.name}! ⚽` });
        },
        onError: () => {
          toast({ title: "Erro ao entrar. Tente novamente.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      <div className="absolute inset-0 field-bg" />
      <div className="absolute inset-0 field-stripes" />

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border-2 border-white/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white/20 bg-white/5" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-20 border-t-2 border-l-2 border-r-2 border-white/10 rounded-t-sm" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 border-b-2 border-l-2 border-r-2 border-white/10 rounded-b-sm" />
      </div>

      <div className="absolute inset-0 bg-[#001a0f]/75" />

      <div className="relative z-10 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <div className="brasil-bar h-1.5 rounded-full w-48 mx-auto mb-6" />

          <div className="relative inline-block mb-4">
            <div className="w-24 h-24 rounded-3xl copa-badge flex items-center justify-center shadow-2xl shadow-yellow-500/30 text-5xl">
              ⚽
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[#009C3B] border-2 border-[#FFDF00] flex items-center justify-center text-base shadow-lg">
              🇧🇷
            </div>
          </div>

          <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-lg">
            Finanças Empresariais
          </h1>
          <p className="text-2xl font-black mt-1 drop-shadow-lg">
            <span className="text-[#FFDF00]">Legends</span>{" "}
            <span className="text-white">2026</span>
          </p>
          <p className="text-white/60 text-sm mt-2">
            Colete figurinhas, dispute o ranking e seja a lenda da temporada
          </p>

          <div className="inline-flex items-center gap-2 mt-4 px-4 py-1.5 rounded-full border border-yellow-400/40 bg-yellow-400/10">
            <span className="text-base">🏆</span>
            <span className="text-yellow-400 text-xs font-bold uppercase tracking-widest">Copa do Mundo 2026</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 shadow-2xl"
        >
          <h2 className="text-lg font-bold mb-6 text-white flex items-center gap-2">
            <span>Entrar no Álbum</span>
            <span className="text-base">🎴</span>
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-white/80 font-semibold">Nome completo</Label>
              <Input
                id="name"
                data-testid="input-name"
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-yellow-400 focus:ring-yellow-400/30"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-white/80 font-semibold">E-mail corporativo</Label>
              <Input
                id="email"
                data-testid="input-email"
                type="email"
                placeholder="seu.nome@vale.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-yellow-400 focus:ring-yellow-400/30"
              />
            </div>
            <Button
              type="submit"
              data-testid="button-login"
              className="w-full copa-badge text-[#002776] font-black text-base py-5 shadow-lg hover:opacity-90 transition-opacity border-0"
              disabled={registerUser.isPending}
            >
              {registerUser.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <span className="mr-2">⚽</span>
              )}
              Entrar no Álbum
            </Button>
          </form>
          <p className="text-xs text-white/40 text-center mt-4">
            Ao entrar, você concorda em participar do programa Legends 2026
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex justify-center gap-4 mt-6 text-white/30 text-xs"
        >
          <span>🇧🇷 Vale Salobo</span>
          <span>•</span>
          <span> Finanças Empresariais</span>
          <span>•</span>
          <span>🏆 2026</span>
          <span>•</span>
          <span>⛏️ Desenvolvido por Euteon Araujo</span>
        </motion.div>
      </div>
    </div>
  );
}
