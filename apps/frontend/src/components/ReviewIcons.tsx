import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * Material Design icon pack for Rota.
 *
 * All icons are sourced from MaterialCommunityIcons (the Material Design Icons
 * set) so screens and components share one visual language instead of
 * hand-drawn shapes. Icons are consumed through these named exports using the
 * shared `{ color, size }` contract.
 */

type IconProps = { color: string; size?: number };
type MaterialIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const createIcon =
  (name: MaterialIconName, defaultSize = 20): React.FC<IconProps> =>
  ({ color, size = defaultSize }) => (
    <MaterialCommunityIcons name={name} color={color} size={size} />
  );

export const ArrowLeftIcon = createIcon('arrow-left');
export const ArrowRightIcon = createIcon('arrow-right');
export const ChevronRightIcon = createIcon('chevron-right', 18);
export const ChevronDownIcon = createIcon('chevron-down', 16);
export const PlusIcon = createIcon('plus', 18);
export const HouseIcon = createIcon('home-outline');
export const CalendarDaysIcon = createIcon('calendar-month-outline');
export const Repeat2Icon = createIcon('swap-horizontal');
export const ActivityNavIcon = createIcon('chart-timeline-variant');
export const EllipsisIcon = createIcon('dots-horizontal');
export const BellIcon = createIcon('bell-outline');
export const SunMoonIcon = createIcon('theme-light-dark');
export const MoonIcon = createIcon('moon-waning-crescent');
export const LanguagesIcon = createIcon('translate');
export const InfoIcon = createIcon('information-outline', 18);
export const CheckIcon = createIcon('check', 16);
export const ArrowUpRightIcon = createIcon('arrow-top-right', 16);
export const UsersIcon = createIcon('account-multiple-outline', 18);
export const UserRoundIcon = createIcon('account-outline', 18);
export const WifiOffIcon = createIcon('wifi-off', 18);
export const AlertTriangleIcon = createIcon('alert-outline', 18);
export const XIcon = createIcon('close', 18);
export const CreditCardIcon = createIcon('credit-card-outline');
export const ClockIcon = createIcon('clock-outline');
export const SettingsIcon = createIcon('cog-outline');
export const ShieldIcon = createIcon('shield-outline');
export const LinkIcon = createIcon('link-variant');
export const MailIcon = createIcon('email-outline');
export const CircleCheckIcon = createIcon('check-circle-outline', 24);
export const FlashIcon = createIcon('lightning-bolt', 16);
