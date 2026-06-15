export class Controls {
  forward = false
  backward = false
  left = false
  right = false
  jump = false
  shoot = false
  private element: HTMLElement

  constructor(element: HTMLElement) {
    this.element = element
    this.bindEvents()
  }

  private bindEvents() {
    document.addEventListener('keydown', (e) => this.onKeyDown(e))
    document.addEventListener('keyup', (e) => this.onKeyUp(e))
    document.addEventListener('mousedown', (e) => this.onMouseDown(e))
    document.addEventListener('mouseup', (e) => this.onMouseUp(e))
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
    document.removeEventListener('keydown', this.onKeyDown)
    document.removeEventListener('keyup', this.onKeyUp)
    document.removeEventListener('mousedown', this.onMouseDown)
    document.removeEventListener('mouseup', this.onMouseUp)
  }
}
