export const AVATAR_IDS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];

export const AVATARS: Record<AvatarId, number> = {
  "1": require("@/assets/images/avatars/avatar1.webp"),
  "2": require("@/assets/images/avatars/avatar2.webp"),
  "3": require("@/assets/images/avatars/avatar3.webp"),
  "4": require("@/assets/images/avatars/avatar4.webp"),
  "5": require("@/assets/images/avatars/avatar5.webp"),
  "6": require("@/assets/images/avatars/avatar6.webp"),
  "7": require("@/assets/images/avatars/avatar7.webp"),
  "8": require("@/assets/images/avatars/avatar8.webp"),
  "9": require("@/assets/images/avatars/avatar9.webp"),
};

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === "string" && (AVATAR_IDS as readonly string[]).includes(value);
}