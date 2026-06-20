/** CS-style bot first names; the scoreboard shows them prefixed with "BOT ". */
export const BOT_NAMES = [
  'Wade', 'Cooper', 'Gandhi', 'Quade', 'Quinn', 'Major', 'Rip', 'Seth',
  'Cliffe', 'Wolf', 'Opie', 'Vitaliy', 'Steel', 'Specter', 'Crab', 'Jock',
  'Tex', 'Boomer', 'Zach', 'Dave',
]

export function botDisplayName(name: string): string {
  return `BOT ${name}`
}
