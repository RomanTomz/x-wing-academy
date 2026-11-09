import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PLAYER_MIN_Y, SCENES } from '../core/constants';
import { audio, speech, store } from '../core/services';
import { generateQuestion, hintFor } from '../education/questionGenerator';
import { createRng, type Rng } from '../education/rng';
import type { Question } from '../education/types';
import { Droid } from '../entities/Droid';
import { Enemy, type EnemyPattern } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { InputController } from '../input/InputController';
import { Mission, type InterludeKind } from '../progression/mission';
import { rankForXp } from '../progression/xp';
import { Effects } from '../ui/effects';
import { Hud } from '../ui/Hud';
import { createBackdrop, type Backdrop } from '../ui/Scenery';
import { THEMES, type Theme } from '../art/themes';
import { applyResult, boundsFor, type AdaptiveState } from '../education/difficulty';
import { firstStageOfTier } from '../education/stages';
import { BOSS_HITS, isMissionConfig, LEVEL_NAMES, planetById, QUICK_MISSION, type MissionConfig, type Planet } from '../progression/campaign';
import { Interlude } from './mission/Interlude';
import { StarDestroyerBattle } from './mission/StarDestroyerBattle';

type Phase = 'intro' | 'active' | 'resolving' | 'interlude' | 'complete';

const LANES = [250, 640, 1030];
const PATTERNS: EnemyPattern[] = ['sway', 'figure8', 'bob'];
const PRAISE = ['Direct hit!', 'Excellent flying!', 'Target destroyed!', 'Great work, pilot!', 'Bullseye!', 'Superb shot!', 'You got it!', 'Amazing!'];
const RETRY = ['Shields up — it got away! Try another.', 'Not that one — try again!', "It escaped! You've got this.", 'Keep going, pilot!'];
const DURING_QUESTION_MIN_Y = Math.max(PLAYER_MIN_Y, 450);
const INTERLUDE_MIN_Y = Math.round(GAME_HEIGHT * 0.4);

export interface MissionResultData {
  stats: ReturnType<Mission['getStats']>;
}

export class MissionScene extends Phaser.Scene {
  private phase: Phase = 'intro';
  private mission!: Mission;
  private input2!: InputController;
  private starfield!: Backdrop;
  private config: MissionConfig = QUICK_MISSION;
  private planet: Planet | null = null;
  private theme: Theme = THEMES.space;
  /** Campaign missions adapt within the chosen level without touching Quick Mission difficulty. */
  private localAdaptive: AdaptiveState | null = null;
  private hud!: Hud;
  private fx!: Effects;
  private player!: Player;
  private droid: Droid | null = null;
  private enemies: Enemy[] = [];
  private question: Question | null = null;
  private wrongCount = 0;
  private attempts = 0;
  private recentDisplays: string[] = [];
  private rng!: Rng;
  private interlude: Interlude | null = null;
  private boss: StarDestroyerBattle | null = null;
  private streak = 0;
  private missionXp = 0;

  constructor() {
    super(SCENES.mission);
  }

  create(data?: unknown): void {
    // Phaser reuses scene instances, so reset all per-mission state here.
    this.config = isMissionConfig(data) ? data : QUICK_MISSION;
    this.planet = this.config.mode === 'campaign' ? (planetById(this.config.planetId) ?? null) : null;
    this.theme = THEMES[this.planet?.theme ?? 'space'];
    this.localAdaptive =
      // Start in the middle of the level so its label is honest (e.g. Cadet bonds really reach 10); it can still step down.
      this.config.mode === 'campaign' ? { stage: firstStageOfTier(this.config.level) + 1, recent: [], sinceChange: 0 } : null;
    this.phase = 'intro';
    this.enemies = [];
    this.question = null;
    this.wrongCount = 0;
    this.attempts = 0;
    this.recentDisplays = [];
    this.interlude = null;
    this.streak = 0;
    this.missionXp = 0;
    this.droid = null;
    this.rng = createRng(Date.now());
    const isBoss = this.planet?.kind === 'boss';
    this.boss = null;
    // Boss battles are one continuous fight with a fixed number of hits.
    this.mission = isBoss ? new Mission(BOSS_HITS, { interludes: false }) : new Mission(store.settings.missionLength);

    this.starfield = createBackdrop(this, this.planet?.theme ?? 'space');
    this.fx = new Effects(this);
    const hudLabel =
      this.config.mode === 'campaign' && this.planet ? `${this.planet.name} • ${LEVEL_NAMES[this.config.level]}` : rankForXp(store.data.profile.totalXp).rank.name;
    this.hud = new Hud(this, hudLabel, { imperial: this.planet?.faction === 'empire' });
    this.hud.setProgress(0, this.mission.totalQuestions, 0);
    this.hud.setBanner(this.planet ? this.planet.name : 'Mission start', 'Get ready, pilot!');

    const equipped = store.data.profile.equipped;
    this.player = new Player(this, GAME_WIDTH / 2, GAME_HEIGHT + 120, equipped, {
      groundShadow: this.planet !== null && !isBoss,
      craft: this.planet?.faction === 'empire' ? 'tie' : undefined,
    });
    this.player.canFire = false;
    this.player.minY = DURING_QUESTION_MIN_Y;
    if (equipped.droid) this.droid = new Droid(this, GAME_WIDTH / 2 - 100, GAME_HEIGHT + 100);
    if (isBoss) this.boss = new StarDestroyerBattle(this, this.fx, this.player, BOSS_HITS);

    this.input2 = new InputController(this);
    this.input2.pointerSteer = true;

    this.hud.speakerButton.on('pointerdown', () => this.repeatQuestion());
    this.hud.pauseButton.on('pointerdown', () => this.openPause());

    this.game.events.on(Phaser.Core.Events.BLUR, this.onBlur, this);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onBlur, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    audio.playMusic('mission', this.theme.music);
    this.cameras.main.fadeIn(400, 0, 0, 0);

    // Fly in from below.
    this.starfield.speed = 6;
    this.tweens.add({ targets: this.starfield, speed: 1, duration: 1600, ease: 'Quad.easeOut' });
    this.tweens.add({
      targets: this.player.sprite,
      y: GAME_HEIGHT - 150,
      duration: 1300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.player.canFire = true;
        this.hud.say(`Good luck, Pilot ${store.settings.pilotName}!`);
        if (this.boss) this.boss.intro(() => this.next());
        else this.time.delayedCall(700, () => this.next());
      },
    });
  }

  private cleanup(): void {
    this.game.events.off(Phaser.Core.Events.BLUR, this.onBlur, this);
    this.game.events.off(Phaser.Core.Events.HIDDEN, this.onBlur, this);
    this.interlude?.destroy();
    this.interlude = null;
    this.boss?.destroy();
    speech.cancel();
    audio.setEngine(-1);
  }

  private onBlur(): void {
    if (this.scene.isActive() && this.phase !== 'complete') this.openPause();
  }

  private openPause(): void {
    if (!this.scene.isActive()) return;
    speech.cancel();
    audio.setEngine(-1);
    this.input2.clear();
    this.scene.launch(SCENES.pause);
    this.scene.pause();
  }

  private repeatQuestion(): void {
    audio.unlock();
    if (this.question && this.phase === 'active') {
      speech.speak(this.question.spoken);
      this.hud.pulseQuestion();
    }
  }

  // ---------------------------------------------------------------- Flow

  private next(): void {
    const step = this.mission.advance();
    if (step.type === 'question') this.spawnQuestion();
    else if (step.type === 'interlude') this.startInterlude(step.kind);
    else this.finish();
  }

  private spawnQuestion(): void {
    const q = generateQuestion({
      stage: this.localAdaptive ? this.localAdaptive.stage : store.data.profile.stage,
      topicPool: this.planet?.topics,
      enabledTopics: store.settings.topics,
      rng: this.rng,
      recentDisplays: this.recentDisplays,
      previousTopic: this.question?.topic,
    });
    this.question = q;
    this.wrongCount = 0;
    this.attempts = 0;
    this.player.minY = DURING_QUESTION_MIN_Y;
    this.hud.setQuestion(q);
    this.hud.setProgress(this.mission.currentQuestion - 1, this.mission.totalQuestions, this.mission.currentQuestion);
    speech.speak(q.spoken);

    const patterns = this.rng.shuffle(PATTERNS);
    const slots = this.boss?.slots();
    this.enemies = q.options.map(
      (value, i) =>
        new Enemy(this, {
          value,
          label: q.optionLabels[i],
          isCorrect: value === q.answer,
          homeX: slots ? slots[i].x : LANES[i],
          homeY: slots ? slots[i].y : 268 + this.rng.int(-6, 10),
          pattern: slots ? 'fixed' : patterns[i],
          delay: i * 160,
          groundShadow: this.planet !== null && !slots,
          look: slots ? 'turret' : this.planet?.faction === 'empire' ? 'xwing' : 'tie',
        }),
    );
    audio.play('whoosh');
    this.phase = 'active';
  }

  private startInterlude(kind: InterludeKind): void {
    this.phase = 'interlude';
    this.player.minY = INTERLUDE_MIN_Y;
    audio.resetCrystalCombo();
    if (kind === 'crystals') {
      this.hud.setBanner('Bonus run', this.theme.crystalName);
      this.hud.say('Fly into them to collect them!');
      speech.speak(`Bonus run! ${this.theme.crystalName}`);
    } else {
      this.hud.setBanner('Look out!', this.theme.asteroidName);
      this.hud.say(this.theme.asteroidHint);
      speech.speak(this.theme.asteroidHint);
      this.starfield.setStorm(true);
    }
    this.starfield.speed = 2.5;
    this.interlude = new Interlude(this, kind, this.player, { asteroid: this.theme.asteroidTint, crystal: this.theme.crystalTint }, {
      onCrystal: (x, y) => {
        const xp = this.mission.collectCrystal();
        this.addXp(xp, x, y);
        this.fx.sparkle(x, y);
        audio.play('crystal');
      },
      onAsteroidDestroyed: (x, y) => {
        const xp = this.mission.destroyAsteroid();
        this.addXp(xp, x, y);
        this.fx.rockBurst(x, y);
        audio.play('asteroid');
      },
      onBump: (x, y) => this.player.bump(x, y),
      onDone: () => {
        this.interlude = null;
        this.starfield.setStorm(false);
        this.tweens.add({ targets: this.starfield, speed: 1, duration: 800 });
        this.fx.banner('FIELD CLEAR!', '#7fe8ff');
        this.hud.say('Great flying! Back to the battle.');
        this.droid?.cheer();
        this.time.delayedCall(1500, () => this.next());
      },
    });
  }

  private finish(): void {
    this.phase = 'complete';
    this.player.canFire = false;
    if (this.boss) {
      this.hud.setBanner('Victory!', `${this.planet?.name ?? 'Boss'} down!`);
      this.hud.clearHint();
      this.boss.finale(() => this.wrapUp());
    }
    else this.wrapUp();
  }

  private wrapUp(): void {
    this.hud.setProgress(this.mission.totalQuestions, this.mission.totalQuestions, 0);
    const stats = this.mission.getStats();
    const result = store.completeMission(
      stats.xpEarned,
      this.config.mode === 'campaign' ? { planetId: this.config.planetId, level: this.config.level } : undefined,
    );
    const won = this.boss ? `${this.planet?.name ?? 'Boss'} defeated!` : 'The fleet is safe!';
    this.hud.setBanner('Mission complete', won);
    speech.speak(`Mission complete! ${won}`, { interrupt: !this.boss });
    this.player.canFire = false;
    this.player.roll();
    this.time.delayedCall(900, () => {
      audio.play('whoosh');
      this.tweens.add({ targets: this.starfield, speed: 8, duration: 1000, ease: 'Quad.easeIn' });
      this.tweens.add({ targets: this.player.sprite, y: -200, duration: 1100, ease: 'Quad.easeIn' });
    });
    this.time.delayedCall(2000, () => {
      this.cameras.main.fadeOut(400, 255, 255, 255);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start(SCENES.complete, { stats, result, config: this.config });
      });
    });
  }

  // ---------------------------------------------------------------- Combat

  private onEnemyHit(enemy: Enemy, x: number, y: number): void {
    if (this.phase !== 'active' || !this.question) return;
    this.attempts++;
    const result = this.mission.recordAttempt(enemy.isCorrect);
    if (result.kind === 'ignored') return;
    if (result.kind === 'incorrect') {
      this.wrongCount = result.wrongCount;
      this.streak = 0;
      enemy.shieldHitAndRetreat();
      this.fx.impact(x, y);
      audio.play('shield');
      const hint = hintFor(this.question, enemy.value, this.wrongCount);
      this.hud.showHint(hint);
      this.hud.say(this.rng.pick(RETRY));
      speech.speak(hint);
      return;
    }

    // Correct!
    this.phase = 'resolving';
    const q = this.question;
    this.streak = result.firstTry ? this.streak + 1 : 0;
    this.fx.explosion(enemy.x, enemy.y, this.boss ? 1.6 : 1.2);
    this.boss?.onTurretDestroyed(enemy.x, enemy.y);
    enemy.kill();
    audio.play('explosion');
    audio.play('correct');
    this.cameras.main.shake(180, 0.006);
    this.cameras.main.flash(120, 255, 240, 200, false);
    this.addXp(result.xp, enemy.x, enemy.y - 40);
    const praise = this.rng.pick(PRAISE);
    this.fx.banner(praise.toUpperCase());
    this.hud.say(this.streak >= 3 ? `${praise} That's ${this.streak} in a row!` : praise);
    this.hud.clearHint();
    speech.speak(praise);
    this.droid?.cheer();
    if (this.streak > 0 && this.streak % 3 === 0) this.player.roll();

    for (const e of this.enemies) if (e !== enemy) e.flyAway();
    this.enemies = [];

    this.recentDisplays = [...this.recentDisplays, q.display].slice(-8);
    let change = store.recordQuestion(q.topic, result.firstTry, this.attempts, this.localAdaptive === null);
    if (this.localAdaptive && this.config.mode === 'campaign') {
      const adapted = applyResult(this.localAdaptive, result.firstTry, boundsFor(false, this.config.level));
      this.localAdaptive = adapted.state;
      change = adapted.change;
    }
    this.hud.setProgress(this.mission.currentQuestion, this.mission.totalQuestions, 0);
    if (change === 'up') {
      this.time.delayedCall(900, () => {
        audio.play('levelup');
        this.hud.say('Promotion! Trickier targets ahead, pilot!', 3000);
      });
    }
    this.time.delayedCall(1700, () => this.next());
  }

  private addXp(amount: number, x: number, y: number): void {
    this.missionXp += amount;
    this.hud.setXp(this.missionXp);
    this.fx.floatText(x, y, `+${amount} XP`);
  }

  private checkLaserHits(): void {
    if (this.phase !== 'active') return;
    for (const laser of [...this.player.lasers]) {
      for (const enemy of this.enemies) {
        if (!enemy.targetable || !enemy.hitTest(laser.sprite.x, laser.sprite.y)) continue;
        const { x, y } = laser.sprite;
        this.player.removeLaser(laser);
        this.onEnemyHit(enemy, x, y);
        break;
      }
      // A correct hit ends the question — ignore any other lasers this frame.
      if (this.phase !== 'active') return;
    }
  }

  private updateLockOn(): void {
    let best: Enemy | null = null;
    if (this.phase === 'active') {
      let bestDist = Infinity;
      for (const e of this.enemies) {
        if (!e.targetable || !e.inAimColumn(this.player.x)) continue;
        const d = Math.abs(e.x - this.player.x);
        if (d < bestDist) {
          bestDist = d;
          best = e;
        }
      }
    }
    for (const e of this.enemies) e.setLocked(e === best && e.state === 'active');
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50);
    this.input2.update();
    if (this.input2.consume('pause')) {
      this.openPause();
      return;
    }
    if (this.input2.consume('repeat')) this.repeatQuestion();

    this.starfield.sway = -this.player.x / GAME_WIDTH + 0.5;
    this.starfield.update(dt);
    this.player.update(dt, this.input2);
    this.droid?.update(dt, this.player.x, this.player.y);
    for (const e of this.enemies) e.update(dt);
    this.checkLaserHits();
    this.updateLockOn();
    this.interlude?.update(dt);
    this.interlude?.syncGlows();
    this.boss?.update(dt, this.enemies, this.phase === 'active');
    this.hud.update(dt);
  }
}
