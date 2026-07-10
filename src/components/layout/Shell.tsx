import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Library,
  Trophy,
  Target,
  User as UserIcon,
  LogOut,
  ShieldAlert,
} from "lucide-react";

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Início", icon: LayoutDashboard, emoji: "🏟️" },
    { href: "/album", label: "Álbum", icon: Library, emoji: "📖" },
    { href: "/ranking", label: "Ranking", icon: Trophy, emoji: "🏆" },
    { href: "/missions", label: "Missões", icon: Target, emoji: "🎯" },
    { href: "/profile", label: "Perfil", icon: UserIcon, emoji: "⚽" },
  ];

  if (user?.isAdmin) {
    navItems.push({ href: "/admin", label: "Admin", icon: ShieldAlert, emoji: "🛡️" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Sidebar Desktop — stadium dark gradient */}
      <aside className="hidden md:flex w-64 flex-col sidebar-stadium border-r border-white/10 p-4 sticky top-0 h-screen">
        {/* Logo */}
        <div className="mb-6 px-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl copa-badge flex items-center justify-center shadow-lg text-xl">
              ⚽
            </div>
            <div>
              <h1 className="font-black text-white text-sm leading-tight tracking-tight">
                Finanças Legends
              </h1>
              <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest">Copa 2026</p>
            </div>
          </div>
          {/* Brasil flag bar */}
          <div className="brasil-bar h-1 rounded-full w-full" />
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <button
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-yellow-400 text-[#002776] shadow-lg shadow-yellow-400/20"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <span className="text-base">{item.emoji}</span>
                  {item.label}
                </button>
              </Link>
            );
          })}
        </nav>

        {/* Bottom: user info + Copa badge */}
        <div className="mt-auto pt-4 border-t border-white/10 space-y-3">
          {/* Copa 2026 stamp */}
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-white/5 border border-white/10">
            <span className="text-2xl">🇧🇷</span>
            <div>
              <p className="text-[10px] text-yellow-400 font-bold uppercase tracking-widest">Copa do Mundo</p>
              <p className="text-white font-black text-xs">USA · MEX · CAN 2026</p>
            </div>
          </div>

          {/* User info */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-yellow-400/20 border border-yellow-400/40 overflow-hidden flex items-center justify-center flex-shrink-0">
              {user?.photo ? (
                <img src={user.photo} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-5 h-5 text-yellow-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-white text-xs font-semibold truncate block">{user?.name}</span>
              <span className="text-yellow-400 text-[11px] font-bold">⭐ {user?.points ?? 0} pts</span>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-white/5 text-sm font-medium transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-3 sidebar-stadium border-b border-white/10 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg copa-badge flex items-center justify-center text-lg shadow">
              ⚽
            </div>
            <div>
              <h1 className="font-black text-white text-sm leading-none">Legends 2026</h1>
              <div className="brasil-bar h-0.5 rounded-full mt-0.5 w-16" />
            </div>
          </div>
          <span className="text-yellow-400 text-xs font-bold">⭐ {user?.points ?? 0} pts</span>
        </header>

        <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>

      {/* Mobile Nav Bottom */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 sidebar-stadium border-t border-white/10 flex justify-around p-1.5 z-50">
        {navItems.filter(i => i.label !== "Admin").map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <button
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                  isActive ? "text-yellow-400" : "text-white/50 hover:text-white/80"
                }`}
              >
                <span className={`text-xl ${isActive ? "ball-bounce" : ""}`}>{item.emoji}</span>
                <span className={`text-[9px] font-bold uppercase tracking-wide ${isActive ? "text-yellow-400" : "text-white/50"}`}>
                  {item.label}
                </span>
              </button>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
