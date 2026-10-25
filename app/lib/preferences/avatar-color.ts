const avatarPalette = [
  "bg-[#1a73e8] text-white",
  "bg-[#8e24aa] text-white",
  "bg-[#2e7d32] text-white",
  "bg-[#a87900] text-white",
  "bg-[#d93025] text-white",
  "bg-[#008394] text-white",
  "bg-[#546e7a] text-white",
  "bg-[#c65d12] text-white",
  "bg-[#c03973] text-white",
  "bg-[#5c6bc0] text-white",
  "bg-[#6b7b25] text-white",
  "bg-[#8d6e63] text-white",
] as const

export function getAvatarColorClass(stableId: string) {
  let hash = 2166136261
  for (let index = 0; index < stableId.length; index++) {
    hash = Math.imul(hash ^ stableId.charCodeAt(index), 16777619) >>> 0
  }
  return avatarPalette[hash % avatarPalette.length]
}
