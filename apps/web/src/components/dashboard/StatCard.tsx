import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const VARIANTS = {
  red:    { card: "bg-red-50 border-red-200",      icon: "bg-red-100" },
  green:  { card: "bg-green-50 border-green-200",  icon: "bg-green-100" },
  yellow: { card: "bg-amber-50 border-amber-200",  icon: "bg-amber-100" },
  blue:   { card: "bg-blue-50 border-blue-200",    icon: "bg-blue-100" },
  orange: { card: "bg-orange-50 border-orange-200", icon: "bg-orange-100" },
  indigo: { card: "bg-indigo-50 border-indigo-200", icon: "bg-indigo-100" },
} as const;

type ColorVariant = keyof typeof VARIANTS;

type Props = {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  icon: React.ReactNode;
  colorVariant?: ColorVariant;
  loading?: boolean;
  href?: string;
};

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  colorVariant = "blue",
  loading,
  href,
}: Props) {
  const router = useRouter();
  const variant = VARIANTS[colorVariant];

  if (loading) {
    return (
      <div className={cn("border rounded-xl p-5 animate-pulse", variant.card)}>
        <div className="h-3 w-24 bg-white/60 rounded mb-3" />
        <div className="h-8 w-16 bg-white/60 rounded mb-2" />
        <div className="h-3 w-32 bg-white/60 rounded" />
      </div>
    );
  }

  return (
    <div
      onClick={href ? () => router.push(href) : undefined}
      className={cn(
        "border rounded-xl p-5 transition-all",
        variant.card,
        href && "cursor-pointer hover:shadow-md hover:scale-[1.01]",
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-gray-600">{title}</p>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", variant.icon)}>
          {icon}
        </div>
      </div>

      <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>

      {(subtitle || trend !== undefined) && (
        <div className="flex items-center gap-2">
          {trend !== undefined && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-xs font-medium",
                trend > 0 ? "text-green-600" : trend < 0 ? "text-red-500" : "text-gray-400",
              )}
            >
              {trend > 0 ? <TrendingUp size={11} /> : trend < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
              {Math.abs(trend)}%
            </span>
          )}
          {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
