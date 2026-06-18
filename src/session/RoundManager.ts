export enum RoundState {
  Buying = 'buying',
  Active = 'active',
  Over = 'over',
}

export class RoundManager {
  state: RoundState = RoundState.Buying
  round: number = 1
  ctScore: number = 0
  tScore: number = 0
  buyPhaseTimer: number = 15
  roundTimer: number = 115
  isHalftime: boolean = false
  matchOver: boolean = false
  winner: 'ct' | 't' | 'draw' | null = null

  private readonly maxRounds = 30
  private readonly winScore = 16
  private readonly buyPhaseDuration = 15
  private readonly roundDuration = 115

  get buyPhase(): boolean {
    return this.state === RoundState.Buying
  }

  update(dt: number): void {
    if (this.state === RoundState.Buying) {
      this.buyPhaseTimer -= dt
      if (this.buyPhaseTimer <= 0) {
        this.state = RoundState.Active
        this.roundTimer = this.roundDuration
      }
    } else if (this.state === RoundState.Active) {
      this.roundTimer -= dt
      if (this.roundTimer <= 0) {
        this.state = RoundState.Over
        this.roundTimer = 0
      }
    }
  }

  endRound(winner: 'ct' | 't' | 'draw'): void {
    if (winner === 'ct') this.ctScore++
    else if (winner === 't') this.tScore++
    // draw: no score change

    // Check match end
    if (this.ctScore >= this.winScore || this.tScore >= this.winScore) {
      this.matchOver = true
      this.winner = this.ctScore >= this.winScore ? 'ct' : 't'
      return
    }

    if (this.round >= this.maxRounds) {
      this.matchOver = true
      if (this.ctScore === this.tScore) {
        this.winner = 'draw'
      } else {
        this.winner = this.ctScore > this.tScore ? 'ct' : 't'
      }
      return
    }

    // Check halftime
    if (this.round === 15) {
      this.isHalftime = true
    }

    // Advance round
    this.round++
    this.state = RoundState.Buying
    this.buyPhaseTimer = this.buyPhaseDuration
  }

  setRound(round: number): void {
    this.round = round
  }
}
