import { BadgeCheck, Sparkles } from "lucide-react";
import type { Badge, BadgeIcon } from "../presentation/badges.ts";

const ICONS: Record<BadgeIcon, typeof Sparkles> = { sparkles: Sparkles, check: BadgeCheck };

export function BadgeChip({ badge, as: Tag = "li" }: { badge: Badge; as?: "li" | "span" }) {
  const Icon = badge.icon ? ICONS[badge.icon] : null;
  return (
    <Tag className={`b ${badge.tone}`}>
      {Icon && <Icon size={12} strokeWidth={2.4} aria-hidden />}
      {badge.label}
    </Tag>
  );
}
