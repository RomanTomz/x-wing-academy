import Phaser from 'phaser';

export type Action = 'fire' | 'pause' | 'repeat' | 'confirm' | 'back' | 'up' | 'down' | 'left' | 'right';

/**
 * Unifies keyboard, mouse and gamepad into simple game actions.
 * Gamepad mapping follows the W3C "standard" layout, which PlayStation and
 * Xbox controllers report in Chrome (Cross/A = fire, Options/Start = pause).
 */
export class InputController {
  private scene: Phaser.Scene;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private pressed = new Set<Action>();
  private padPrev: boolean[] = [];
  private padAxisPrev = { x: 0, y: 0 };
  pointerSteer = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const kb = scene.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      const map: Record<string, number> = {
        left: K.LEFT, right: K.RIGHT, up: K.UP, down: K.DOWN,
        a: K.A, d: K.D, w: K.W, s: K.S,
        space: K.SPACE, p: K.P, esc: K.ESC, r: K.R, enter: K.ENTER,
      };
      for (const [name, code] of Object.entries(map)) this.keys[name] = kb.addKey(code, true, false);
      kb.on('keydown', (e: KeyboardEvent) => {
        if (e.repeat) return;
        const code = e.code || ({ ' ': 'Space', Enter: 'Enter', Escape: 'Escape', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight' } as Record<string, string>)[e.key] || `Key${e.key.toUpperCase()}`;
        switch (code) {
          case 'Space': this.pressed.add('fire'); this.pressed.add('confirm'); break;
          case 'Enter': case 'NumpadEnter': this.pressed.add('confirm'); break;
          case 'KeyP': this.pressed.add('pause'); break;
          case 'Escape': this.pressed.add('pause'); this.pressed.add('back'); break;
          case 'KeyR': this.pressed.add('repeat'); break;
          case 'ArrowUp': case 'KeyW': this.pressed.add('up'); break;
          case 'ArrowDown': case 'KeyS': this.pressed.add('down'); break;
          case 'ArrowLeft': case 'KeyA': this.pressed.add('left'); break;
          case 'ArrowRight': case 'KeyD': this.pressed.add('right'); break;
        }
      });
    }
  }

  private isDown(...names: string[]): boolean {
    return names.some((n) => this.keys[n]?.isDown);
  }

  private pad(): Phaser.Input.Gamepad.Gamepad | null {
    const gp = this.scene.input.gamepad;
    if (!gp || gp.total === 0) return null;
    return gp.getPad(0) ?? null;
  }

  /** Call once per frame before reading actions. */
  update(): void {
    const pad = this.pad();
    if (!pad) return;
    const buttons = pad.buttons.map((b) => b.pressed);
    const edge = (i: number): boolean => buttons[i] === true && this.padPrev[i] !== true;
    if (edge(0)) { this.pressed.add('fire'); this.pressed.add('confirm'); }
    if (edge(1)) this.pressed.add('back');
    if (edge(3)) this.pressed.add('repeat');
    if (edge(9)) this.pressed.add('pause');
    if (edge(12)) this.pressed.add('up');
    if (edge(13)) this.pressed.add('down');
    if (edge(14)) this.pressed.add('left');
    if (edge(15)) this.pressed.add('right');
    const ax = pad.leftStick.x;
    const ay = pad.leftStick.y;
    if (ax > 0.6 && this.padAxisPrev.x <= 0.6) this.pressed.add('right');
    if (ax < -0.6 && this.padAxisPrev.x >= -0.6) this.pressed.add('left');
    if (ay > 0.6 && this.padAxisPrev.y <= 0.6) this.pressed.add('down');
    if (ay < -0.6 && this.padAxisPrev.y >= -0.6) this.pressed.add('up');
    this.padAxisPrev = { x: ax, y: ay };
    this.padPrev = buttons;
  }

  /** Movement vector, each axis -1..1. */
  get move(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.isDown('left', 'a')) x -= 1;
    if (this.isDown('right', 'd')) x += 1;
    if (this.isDown('up', 'w')) y -= 1;
    if (this.isDown('down', 's')) y += 1;
    const pad = this.pad();
    if (pad) {
      const dead = 0.2;
      if (Math.abs(pad.leftStick.x) > dead) x = pad.leftStick.x;
      if (Math.abs(pad.leftStick.y) > dead) y = pad.leftStick.y;
      if (pad.left) x = -1;
      if (pad.right) x = 1;
      if (pad.up) y = -1;
      if (pad.down) y = 1;
    }
    return { x: Phaser.Math.Clamp(x, -1, 1), y: Phaser.Math.Clamp(y, -1, 1) };
  }

  get fireHeld(): boolean {
    const pad = this.pad();
    const padFire = pad ? pad.buttons[0]?.pressed === true || pad.buttons[7]?.pressed === true : false;
    const pointer = this.scene.input.activePointer;
    return this.isDown('space') || padFire || (this.pointerSteer && pointer.isDown);
  }

  /** True once per press. */
  consume(action: Action): boolean {
    const had = this.pressed.has(action);
    this.pressed.delete(action);
    return had;
  }

  clear(): void {
    this.pressed.clear();
  }
}
