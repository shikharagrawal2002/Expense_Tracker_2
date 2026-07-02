import {
  Briefcase,
  Laptop,
  TrendingUp,
  PlusCircle,
  Home,
  ShoppingCart,
  Zap,
  Car,
  HeartPulse,
  Shield,
  Utensils,
  Film,
  ShoppingBag,
  Plane,
  Repeat,
  GraduationCap,
  Receipt,
  MoreHorizontal,
  ArrowLeftRight,
  PieChart,
  CandlestickChart,
  Bitcoin,
  Coins,
  Landmark,
  LifeBuoy,
  Tag,
  type LucideIcon,
} from 'lucide-react'

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  laptop: Laptop,
  'trending-up': TrendingUp,
  'plus-circle': PlusCircle,
  home: Home,
  'shopping-cart': ShoppingCart,
  zap: Zap,
  car: Car,
  'heart-pulse': HeartPulse,
  shield: Shield,
  utensils: Utensils,
  film: Film,
  'shopping-bag': ShoppingBag,
  plane: Plane,
  repeat: Repeat,
  'graduation-cap': GraduationCap,
  receipt: Receipt,
  'more-horizontal': MoreHorizontal,
  'arrow-left-right': ArrowLeftRight,
  'pie-chart': PieChart,
  'candlestick-chart': CandlestickChart,
  bitcoin: Bitcoin,
  coins: Coins,
  landmark: Landmark,
  'life-buoy': LifeBuoy,
  tag: Tag,
}

export function getCategoryIcon(icon: string): LucideIcon {
  return CATEGORY_ICONS[icon] ?? Tag
}

export const ICON_PICKER_OPTIONS = Object.keys(CATEGORY_ICONS)

export const COLOR_SWATCHES = [
  '#22c55e', '#f97316', '#eab308', '#0ea5e9', '#6366f1',
  '#ec4899', '#ef4444', '#14b8a6', '#8b5cf6', '#94a3b8',
]
