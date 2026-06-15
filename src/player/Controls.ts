export class Controls {
  forward = false
  backward = false
  left = false
  right = false
  jump = false
  shoot = false
  private element: HTMLElement
  private boundKeyDown: (e: KeyboardEvent) => void
  private boundKeyUp: (e: KeyboardEvent) => void
  private boundMouseDown: (e: MouseEvent) => void
  private boundMouseUp: (e: MouseEvent) => void

  onMouseMove: ((e: MouseEvent) => void) | null = null

  constructor(element: HTMLElement) {
    this.element = element

    this.boundKeyDown = (e: KeyboardEvent) => this.onKeyDown(e)
    this.boundKeyUp = (e: KeyboardEvent) => this.onKeyUp(e)
    this.boundMouseDown = (e: MouseEvent) => this.onMouseDown(e)
    this.boundMouseUp = (e: MouseEvent) => this.onMouseUp(e)

    this.bindEvents()
  }

  private bindEvents() {
    document.addEventListener('keydown', this.boundKeyDown)
    document.addEventListener('keyup', this.boundKeyUp)
    document.addEventListener('mousedown', this.boundMouseDown)
    document.addEventListener('mouseup', this.boundMouseUp)
    document.addEventListener('mousemove', this.boundMouseMove)
  }

  private boundMouseMove = (e: MouseEvent) => {
    if (this.onMouseMove && document.pointerLockElement === this.element) {
      this.onMouseMove(e)
    }
  }

  private onKeyDown(e: KeyboardEvent) {
    switch (e.code) {
      case 'KeyW': this.forward = true; break
      case 'KeyS': this.backward = true; break
      case 'KeyA': this.left = true; break
      case 'KeyD': this.right = true; break
      case 'Space': this.jump = true; break
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    switch (e.code) {
      case 'KeyW': this.forward = false; break
      case 'KeyS': this.backward = false; break
      case 'KeyA': this.left = false; break
      case 'KeyD': this.right = false; break
      case 'Space': this.jump = false; break
    }
  }

  private onMouseDown(e: MouseEvent) {
    if (e.button === 0) {
      this.shoot = true
      if (document.pointerLockElement !== this.element) {
        this.element.requestPointerLock()
      }
    }
  }

  private onMouseUp(e: MouseEvent) {
    if (e.button === 0) {
      this.shoot = false
    }
  }

  getMovement() {
    return {
      forward: this.forward,
      backward: this.backward,
      left: this.left,
      right: this.right,
      jump: this.jump,
    }
  }

  destroy() {
    document.removeEventListener('keydown', this.boundKeyDown)
    document.removeEventListener('keyup', this.boundKeyUp)
    document.removeEventListener('mousedown', this.boundMouseDown)
    document.removeEventListener('mouseup', this.boundMouseUp)
    document.removeEventListener('mousemove', this.boundMouseMove)
    if (document.pointerLockElement === this.element) {
      document.exitPointerLock()
    }
  }
}
