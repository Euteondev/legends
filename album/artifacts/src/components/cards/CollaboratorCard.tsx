import { motion } from "framer-motion";
import { type Collaborator } from "@/lib/types";
import { Lock, User as UserIcon } from "lucide-react";

/* 🎨 Fundos */
const CARD_BACKGROUNDS = {
  comum: `${import.meta.env.BASE_URL}card-comum.jpeg`,
  rara: `${import.meta.env.BASE_URL}card-rara.jpeg`,
  epica: `${import.meta.env.BASE_URL}card-epica.jpeg`,
  lendaria: `${import.meta.env.BASE_URL}card-lenda.jpeg`,
};

/* 🌈 Glow */
const GLOW_COLORS: Record<string, string> = {
  comum: "#22c55e",
  rara: "#3CB5E5",
  epica: "#a855f7",
  lendaria: "#FFD700",
};

/* 🎯 Nome (cores por raridade) */
const NAME_COLORS = {
  comum: "linear-gradient(135deg, #16a34a, #22c55e)",
  rara: "linear-gradient(135deg, #3CB5E5, #1E90FF)",
  epica: "linear-gradient(135deg, #a855f7, #7c3aed)",
  lendaria: "linear-gradient(135deg, #FFD700, #FF8C00)",
};

interface CollaboratorCardProps {
  collaborator: Collaborator;
  isUnlocked: boolean;
  onClick?: () => void;
}

export function CollaboratorCard({
  collaborator,
  isUnlocked,
  onClick,
}: CollaboratorCardProps) {
  const rarity = collaborator.rarity || "comum";
  const bg = CARD_BACKGROUNDS[rarity];
  const glowColor = GLOW_COLORS[rarity];
  const nameBg = NAME_COLORS[rarity];
  const displayLabel = collaborator.position || collaborator.role;

  if (!isUnlocked) {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        className="relative aspect-[3/4] rounded-xl overflow-hidden"
      >
        <img src={bg} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" />
        <div className="absolute inset-0 flex items-center justify-center flex-col gap-3">
          <Lock className="w-10 h-10 text-white/50" />
          <span className="text-white/40 font-bold">Bloqueado</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ scale: 1.07, y: -6 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer"
      style={{
        boxShadow: `0 0 12px ${glowColor}`,
      }}
    >
      {/* 🎨 Fundo */}
      <img
        src={bg}
        className="absolute inset-0 w-full h-full object-cover z-0"
        alt=""
        draggable={false}
      />

      {/* ✨ brilho animado */}
      <motion.div
        className="absolute inset-0 z-10"
        initial={{ x: "-120%" }}
        animate={{ x: "120%" }}
        transition={{
          repeat: Infinity,
          duration: rarity === "lendaria" ? 2 : 3,
          ease: "linear",
        }}
        style={{
          background:
            "linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.4), transparent 70%)",
          mixBlendMode: "screen",
        }}
      />

      {/* 📸 FOTO (PERFEITAMENTE ENCAIXADA NA MOLDURA) */}
      <div
        className="absolute z-20"
        style={{
          top: "18%",
          bottom: "17%",
          left: "15%",
          right: "15%",
        }}
      >
        {collaborator.photoUrl ? (
          <img
            src={collaborator.photoUrl}
            className="w-full h-full object-cover object-[50%_30%]"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/20">
            <UserIcon className="w-1/3 h-1/3 text-gray-400" />
          </div>
        )}
      </div>

      {/* 🏷️ NOME (ALINHADO COM BASE REAL DA MOLDURA) */}
      <div
        className="absolute z-30"
        style={{
          left: "15%",
          right: "15%",
          bottom: "17%",
        }}
      >
        <div
          className="rounded flex flex-col justify-center text-center border border-white/25"
          style={{
            height: "13%",
            background: nameBg,
            padding: "3px 6px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
          }}
        >
          <p className="text-white text-[10px] font-bold truncate drop-shadow">
            {collaborator.name}
          </p>

          {displayLabel && (
            <p className="text-white/90 text-[8px] truncate">
              {displayLabel}
            </p>
          )}
          {collaborator.keyBehavior && (
            <p
              className="text-[7px] truncate font-medium"
              style={{ color: "rgba(255,255,255,0.8)" }}
            >
              ⚽ {collaborator.keyBehavior}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}