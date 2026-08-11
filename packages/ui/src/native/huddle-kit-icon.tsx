import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Crown,
  Info,
  Minus,
  Plus,
  QrCode,
  Smartphone,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react-native';
import { Text as SvgText, Rect, Svg } from 'react-native-svg';

import { colors } from '../colors';

import { huddleUIKitColors } from './huddle-kit-theme';

export type HuddleIconName =
  | 'back'
  | 'carousel-left'
  | 'carousel-right'
  | 'chevron-right'
  | 'close'
  | 'quick'
  | 'standard'
  | 'custom'
  | 'players'
  | 'clock'
  | 'category'
  | 'questions'
  | 'difficulty'
  | 'trophy'
  | 'phone'
  | 'host'
  | 'qr'
  | 'check'
  | 'plus'
  | 'minus'
  | 'remove'
  | 'info';

const iconMap = {
  back: ArrowLeft,
  'carousel-left': ChevronLeft,
  'carousel-right': ChevronRight,
  'chevron-right': ChevronRight,
  close: X,
  quick: Zap,
  standard: Crown,
  custom: SlidersHorizontal,
  players: Users,
  clock: Clock3,
  category: Tag,
  difficulty: Sparkles,
  trophy: Trophy,
  phone: Smartphone,
  host: Crown,
  qr: QrCode,
  check: Check,
  plus: Plus,
  minus: Minus,
  remove: Trash2,
  info: Info,
} as const;

export function QuestionsIcon({
  size = 28,
  color = huddleUIKitColors.navy,
  value = '10',
}: {
  readonly size?: number;
  readonly color?: string;
  readonly value?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" accessibilityElementsHidden>
      <Rect x="4" y="2.5" width="20" height="23" rx="3.2" fill="none" stroke={color} strokeWidth="2" />
      <SvgText x="14" y="17" textAnchor="middle" fontSize="10" fontWeight="700" fill={color}>
        {value}
      </SvgText>
    </Svg>
  );
}

export function HuddleIcon({
  name,
  size = 24,
  color = colors.ink,
  strokeWidth = 2.2,
}: {
  readonly name: HuddleIconName;
  readonly size?: number;
  readonly color?: string;
  readonly strokeWidth?: number;
}) {
  if (name === 'questions') {
    return <QuestionsIcon size={size} color={color} />;
  }

  const Icon = iconMap[name];
  return <Icon size={size} color={color} strokeWidth={strokeWidth} accessibilityElementsHidden />;
}
