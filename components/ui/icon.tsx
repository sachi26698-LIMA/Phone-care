import {
  BatteryCharging,
  Database,
  Fingerprint,
  Gauge,
  Monitor,
  Shapes,
  Smartphone,
  Thermometer,
  Wifi,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  smartphone: Smartphone,
  battery: BatteryCharging,
  database: Database,
  wifi: Wifi,
  thermometer: Thermometer,
  monitor: Monitor,
  fingerprint: Fingerprint,
  shapes: Shapes,
  gauge: Gauge,
};

export function ModuleIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? Smartphone;
  return <Icon className={className} aria-hidden="true" />;
}
