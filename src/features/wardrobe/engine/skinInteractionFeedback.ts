const CLICK_IMPULSE_MAX_ENERGY = 5;
const CLICK_IMPULSE_ENERGY_PER_CLICK = 1;
const DAMAGE_FLASH_MIN_CLICKS_PER_SECOND = 2;
const CLICK_IMPULSE_DECAY_PER_SECOND =
  DAMAGE_FLASH_MIN_CLICKS_PER_SECOND * CLICK_IMPULSE_ENERGY_PER_CLICK;
const CLICK_IMPULSE_BASE_SPEED = 18;
const CLICK_IMPULSE_SPEED_BOOST = 7;
const CLICK_IMPULSE_OFFSET_X = 0.035;
const CLICK_IMPULSE_ROTATION_Z = 0.055;
const CLICK_IMPULSE_SCALE_X = 0.018;
const CLICK_IMPULSE_SCALE_Y = 0.025;
const DAMAGE_FLASH_DURATION_SECONDS = 0.2;
const DAMAGE_FLASH_REPEAT_DELAY_SECONDS = 0.5;
const DAMAGE_FLASH_MAX_INTENSITY = 0.7;

export class SkinInteractionFeedback {
  private energy = 0;
  private phase = 0;
  private _offsetX = 0;
  private _rotationZ = 0;
  private _scaleX = 1;
  private _scaleY = 1;
  private _damageFlashIntensity = 0;
  private damageFlashRemainingSeconds = 0;
  private damageFlashCooldownSeconds = 0;

  get offsetX(): number {
    return this._offsetX;
  }

  get rotationZ(): number {
    return this._rotationZ;
  }

  get scaleX(): number {
    return this._scaleX;
  }

  get scaleY(): number {
    return this._scaleY;
  }

  get damageFlashIntensity(): number {
    return this._damageFlashIntensity;
  }

  addImpulse(): void {
    this.energy = Math.min(
      CLICK_IMPULSE_MAX_ENERGY,
      this.energy + CLICK_IMPULSE_ENERGY_PER_CLICK,
    );

    if (this.energy >= CLICK_IMPULSE_MAX_ENERGY && this.damageFlashCooldownSeconds <= 0) {
      this.triggerDamageFlash();
    }
  }

  update(dt: number): void {
    this.updateImpulse(dt);
    this.updateDamageFlash(dt);
  }

  private triggerDamageFlash(): void {
    this.damageFlashRemainingSeconds = DAMAGE_FLASH_DURATION_SECONDS;
    this.damageFlashCooldownSeconds =
      DAMAGE_FLASH_DURATION_SECONDS + DAMAGE_FLASH_REPEAT_DELAY_SECONDS;
    this._damageFlashIntensity = DAMAGE_FLASH_MAX_INTENSITY;
  }

  private updateImpulse(dt: number): void {
    const energy = Math.max(0, this.energy - CLICK_IMPULSE_DECAY_PER_SECOND * dt);
    this.energy = energy;

    if (energy <= 0) {
      this._offsetX = 0;
      this._rotationZ = 0;
      this._scaleX = 1;
      this._scaleY = 1;
      return;
    }

    const intensity = energy / CLICK_IMPULSE_MAX_ENERGY;
    this.phase += dt * (CLICK_IMPULSE_BASE_SPEED + energy * CLICK_IMPULSE_SPEED_BOOST);

    const shake = Math.sin(this.phase) * intensity;
    const squash = Math.abs(Math.sin(this.phase * 1.7)) * intensity;

    this._offsetX = shake * CLICK_IMPULSE_OFFSET_X;
    this._rotationZ = shake * CLICK_IMPULSE_ROTATION_Z;
    this._scaleX = 1 + squash * CLICK_IMPULSE_SCALE_X;
    this._scaleY = 1 - squash * CLICK_IMPULSE_SCALE_Y;
  }

  private updateDamageFlash(dt: number): void {
    this.damageFlashCooldownSeconds = Math.max(0, this.damageFlashCooldownSeconds - dt);

    if (this.damageFlashRemainingSeconds <= 0) {
      this._damageFlashIntensity = 0;
      return;
    }

    this.damageFlashRemainingSeconds = Math.max(0, this.damageFlashRemainingSeconds - dt);
    this._damageFlashIntensity =
      DAMAGE_FLASH_MAX_INTENSITY *
      (this.damageFlashRemainingSeconds / DAMAGE_FLASH_DURATION_SECONDS);
  }
}
