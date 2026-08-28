import AsyncStorage from "@react-native-async-storage/async-storage";
import { isAvatarId } from "@/constants/avatars";

/* ================================================================
   PROFILE – Persistence for player name + avatar
   ================================================================ */

const STORAGE_KEY = "@get-away-thulla/profile";
export const MAX_PROFILE_NAME_LENGTH = 16;

export interface Profile {
  name: string;
  avatarId: string;
}

export const DEFAULT_PROFILE: Profile = { name: "Player", avatarId: "1" };

function sanitizeProfile(partial: Partial<Profile>): Profile {
  const rawName = typeof partial.name === "string" ? partial.name.trim() : "";
  const name = rawName.slice(0, MAX_PROFILE_NAME_LENGTH) || DEFAULT_PROFILE.name;
  const avatarId = isAvatarId(partial.avatarId) ? partial.avatarId : DEFAULT_PROFILE.avatarId;
  return { name, avatarId };
}

/** Load the persisted profile from AsyncStorage */
export async function loadProfile(): Promise<Profile> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw) as Partial<Profile>;
    return sanitizeProfile(parsed);
  } catch (err) {
    console.warn("[profile] Failed to load profile:", err);
    return { ...DEFAULT_PROFILE };
  }
}

/** Persist the profile to AsyncStorage */
export async function saveProfile(profile: Profile): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeProfile(profile)));
  } catch (err) {
    console.warn("[profile] Failed to save profile:", err);
  }
}