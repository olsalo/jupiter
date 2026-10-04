import React from "react"
import * as TablerIcons from "@tabler/icons-react"
import type { IconProps as TablerIconProps } from "@tabler/icons-react"

/**
 * 1. THE ICON MAP
 */
export const iconMap = {
  // Navigation
  chevronUp: TablerIcons.IconChevronUp,
  chevronDown: TablerIcons.IconChevronDown,
  chevronLeft: TablerIcons.IconChevronLeft,
  chevronRight: TablerIcons.IconChevronRight,
  arrowLeft: TablerIcons.IconArrowLeft,
  arrowRight: TablerIcons.IconArrowRight,
  menu: TablerIcons.IconMenu2,
  x: TablerIcons.IconX,
  selector: TablerIcons.IconSelector,
  dots: TablerIcons.IconDots,
  dotsVertical: TablerIcons.IconDotsVertical,
  gripVertical: TablerIcons.IconGripVertical,
  minus: TablerIcons.IconMinus,
  plus: TablerIcons.IconPlus,
  layoutSidebarInactive: TablerIcons.IconLayoutSidebarInactive,

  alertCircle: TablerIcons.IconAlertCircle,
  circleCheck: TablerIcons.IconCircleCheck,
  alertTriangle: TablerIcons.IconAlertTriangle,
  exclamationCircle: TablerIcons.IconExclamationCircle,

  circleCheckFilled: TablerIcons.IconCircleCheckFilled,
  infoCircle: TablerIcons.IconInfoCircle,

  calendar: TablerIcons.IconCalendar,
  logOut: TablerIcons.IconLogout,
  trash: TablerIcons.IconTrash,
  // Actions
  add: TablerIcons.IconPlus,
  edit: TablerIcons.IconPencil,
  delete: TablerIcons.IconTrash,
  search: TablerIcons.IconSearch,
  settings: TablerIcons.IconSettings,
  user: TablerIcons.IconUser,
  users: TablerIcons.IconUsers,
  building: TablerIcons.IconBuilding,
  mail: TablerIcons.IconMail,
  bell: TablerIcons.IconBell,
  palette: TablerIcons.IconPalette,
  sun: TablerIcons.IconSun,
  moon: TablerIcons.IconMoon,
  plug: TablerIcons.IconPlug,
  creditCard: TablerIcons.IconCreditCard,
  notes: TablerIcons.IconNotes,
  notesFilled: TablerIcons.IconNotes,
  forms: TablerIcons.IconForms,
  chartBar: TablerIcons.IconChartBar,
  bolt: TablerIcons.IconBolt,
  dashboard: TablerIcons.IconDashboard,
  dashboardFilled: TablerIcons.IconDashboardFilled,
  copy: TablerIcons.IconCopy,
  download: TablerIcons.IconDownload,
  refresh: TablerIcons.IconRefresh,
  share: TablerIcons.IconShare3,
  send: TablerIcons.IconSend2,
  textSize: TablerIcons.IconTextSize,
  // Status
  check: TablerIcons.IconCheck,
  info: TablerIcons.IconInfoCircle,
  help: TablerIcons.IconHelpCircle,
  loader: TablerIcons.IconLoader2,
  wifiOff: TablerIcons.IconWifiOff,

  // Brand/Custom
  home: TablerIcons.IconHome,
  circleNumber1: TablerIcons.IconCircleNumber1,
  circleNumber2: TablerIcons.IconCircleNumber2,
  /**
   * FIX: We destructure Tabler-specific props to map them to valid SVG attributes.
   * This prevents the "Type '{ stroke: number... }' is not assignable to SVG" error.
   */
  cursorGrow: ({ size, stroke, color, ...rest }: TablerIconProps) => (
    <svg fill="black" height="14" stroke="white" viewBox="0 0 24 14" width="26" xmlns="http://www.w3.org/2000/svg" {...rest}>
      <path d="M19.5 5.5L6.49737 5.51844V2L1 6.9999L6.5 12L6.49737 8.5L19.5 8.5V12L25 6.9999L19.5 2V5.5Z" />
    </svg>
  ),
} as const

/**
 * 2. THE TYPES
 */
export type AppIconName = keyof typeof iconMap

interface WrappedIconProps extends Omit<TablerIconProps, "name"> {
  name: AppIconName | React.ComponentType<TablerIconProps>
}

/**
 * 3. THE COMPONENT
 */
const Icon = ({ name, size = 24, stroke = 2, color = "currentColor", ...props }: WrappedIconProps) => {
  const FallbackIcon = TablerIcons.IconHelpCircle
  let IconComponent: React.ComponentType<TablerIconProps>

  if (typeof name === "string") {
    IconComponent = (iconMap[name as AppIconName] as React.ComponentType<TablerIconProps>) || FallbackIcon
  } else {
    IconComponent = name
  }

  return <IconComponent size={size} stroke={stroke} color={color} {...props} />
}

export default Icon
