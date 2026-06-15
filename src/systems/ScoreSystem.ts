export class ScoreSystem {
  score: number = 0
  highScore: number = 0
  wave: number = 0

  constructor() {
    this.highScore = parseInt(localStorage.getItem('browser-shooter-highscore') || '0', 10)
  }

  addKill(points: number) {
    this.score += points
  }

  completeWave() {
    this.wave++
    this.score += this.wave * 500
  }

  saveHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score
      localStorage.setItem('browser-shooter-highscore', this.highScore.toString())
    }
  }

  reset() {
    this.score = 0
    this.wave = 0
  }
}
