export class Economy {
  money: number
  private consecutiveLosses: number = 0

  constructor(startMoney: number = 800) {
    this.money = startMoney
  }

  addMoney(amount: number): void {
    this.money += amount
  }

  spendMoney(amount: number): boolean {
    if (amount > this.money) return false
    this.money -= amount
    return true
  }

  canAfford(amount: number): boolean {
    return this.money >= amount
  }

  reset(amount: number = 800): void {
    this.money = amount
    this.consecutiveLosses = 0
  }

  recordWin(): void {
    this.addMoney(3250)
    this.consecutiveLosses = 0
  }

  recordLoss(): void {
    this.consecutiveLosses++
    const bonus = Math.min(1400 + (this.consecutiveLosses - 1) * 500, 3400)
    this.addMoney(bonus)
  }

  recordKillReward(weaponType: string): void {
    const rewards: Record<string, number> = {
      pistol: 300,
      usp: 300,
      glock: 300,
      deagle: 300,
      mp5: 600,
      m4: 300,
      aug: 300,
      ak: 300,
      galil: 300,
      shotgun: 900,
      awp: 100,
      knife: 1500,
    }
    this.addMoney(rewards[weaponType] ?? 300)
  }

  recordBombPlant(): void {
    this.addMoney(300)
  }
}