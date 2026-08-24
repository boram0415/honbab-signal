export type SoloStatus = "green" | "yellow" | "red";

export type WaitLevel = 0 | 5 | 15 | null;

export type SignalColor = "green" | "yellow" | "red" | "gray";

export interface Restaurant {
  id: string;
  name: string;
  category: string;
  walk_min: number;
  price_min: number;
  price_max: number;
  solo_status: SoloStatus;
  solo_note: string | null;
  wait_1200: WaitLevel;
  wait_1230: WaitLevel;
  order_type: "kiosk" | "table_tablet" | "staff_call" | null;
  self_bar: boolean;
  noise_level: 1 | 2 | 3 | null;
  staff_talk: 1 | 2 | 3 | null;
  signature: string | null;
  closed_days: number[];
  open_time: string;
  close_time: string;
  kakaomap_url: string | null;
  photo_url: string | null;
  updated_at: string;
}

export interface WaitReport {
  id: string;
  restaurant_id: string;
  level: Exclude<WaitLevel, null>;
  device_id: string;
  created_at: string;
}
