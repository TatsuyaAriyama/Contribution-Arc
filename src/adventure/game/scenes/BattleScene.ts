import Phaser from "phaser";
import { AdventureEvents, eventBus, type SyncPayload } from "../eventBus";
import { ASSET_MANIFEST, USE_PLACEHOLDER } from "../../data/assetManifest";

// 戦闘シーン（MVP の核）。
// 状態は React 側が真実。ここは eventBus から受け取った状態を描画するだけ。
//
// 注: Phaser 4.1 では ScenePlugin の this.scene.start() がシーン遷移を
// 実行しないため、Boot/Preload を分けてチェーンする方式は使えない。
// アセット読み込みは本シーン自身の preload() で行う（単一シーン構成）。
export class BattleScene extends Phaser.Scene {
  private current: SyncPayload | null = null;

  private enemyContainer?: Phaser.GameObjects.Container;
  private enemyRect?: Phaser.GameObjects.Rectangle;
  private enemySprite?: Phaser.GameObjects.Image;
  private playerContainer?: Phaser.GameObjects.Container;

  private hpBarBg?: Phaser.GameObjects.Rectangle;
  private hpBarFill?: Phaser.GameObjects.Rectangle;
  private hpText?: Phaser.GameObjects.Text;
  private nameText?: Phaser.GameObjects.Text;

  private readonly hpBarWidth = 360;

  constructor() {
    super("Battle");
  }

  preload() {
    // USE_PLACEHOLDER の間は実ファイルをロードしない（矩形描画で進める）。
    if (USE_PLACEHOLDER) return;
    for (const [key, path] of Object.entries(ASSET_MANIFEST)) {
      this.load.image(key, path);
    }
  }

  create() {
    const { width, height } = this.scale;

    this.drawBackground(width, height);

    // 敵（プレースホルダ矩形 or スプライト）
    this.enemyContainer = this.add.container(width / 2, height * 0.4);
    if (USE_PLACEHOLDER) {
      this.enemyRect = this.add
        .rectangle(0, 0, 160, 160, 0x6c8cff)
        .setStrokeStyle(4, 0xffffff, 0.18);
      this.enemyContainer.add(this.enemyRect);
    }
    // ふわふわ浮遊アニメ
    this.tweens.add({
      targets: this.enemyContainer,
      y: height * 0.4 - 14,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });

    // 敵 HP バー
    this.nameText = this.add
      .text(width / 2, height * 0.12, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "22px",
        color: "#f4f4f5",
      })
      .setOrigin(0.5);
    this.hpBarBg = this.add
      .rectangle(width / 2, height * 0.18, this.hpBarWidth, 18, 0x000000, 0.4)
      .setStrokeStyle(2, 0xffffff, 0.25);
    this.hpBarFill = this.add
      .rectangle(
        width / 2 - this.hpBarWidth / 2,
        height * 0.18,
        this.hpBarWidth,
        18,
        0x6fcf97,
      )
      .setOrigin(0, 0.5);
    this.hpText = this.add
      .text(width / 2, height * 0.18, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        color: "#0b0b0c",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // プレイヤー（初期キャラ風: 角丸ボディ + 2本足 + 2つの目）
    this.playerContainer = this.add.container(width * 0.24, height * 0.74);
    this.drawPlayer(0xb18cff);

    // 既に sync 済みなら反映
    if (this.current) this.applySync(this.current);

    // イベント購読
    eventBus.on(AdventureEvents.SYNC, this.handleSync, this);
    eventBus.on(AdventureEvents.DAMAGE, this.handleDamage, this);
    eventBus.on(AdventureEvents.DEFEATED, this.handleDefeated, this);

    // シーン破棄時に購読解除
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);

    // React に「初期 sync をくれ」と合図
    eventBus.emit(AdventureEvents.SCENE_READY);
  }

  private cleanup() {
    eventBus.off(AdventureEvents.SYNC, this.handleSync, this);
    eventBus.off(AdventureEvents.DAMAGE, this.handleDamage, this);
    eventBus.off(AdventureEvents.DEFEATED, this.handleDefeated, this);
  }

  private drawBackground(width: number, height: number) {
    // 2D-HD 風の暗い奥行きグラデ + 地平線
    const g = this.add.graphics();
    g.fillGradientStyle(0x10131c, 0x10131c, 0x222a3d, 0x222a3d, 1);
    g.fillRect(0, 0, width, height);
    // 地面
    const ground = this.add.graphics();
    ground.fillStyle(0x2c2540, 1);
    ground.fillRect(0, height * 0.62, width, height * 0.38);
    // ほのかなビネット
    const vignette = this.add.graphics();
    vignette.fillStyle(0x000000, 0.25);
    vignette.fillRect(0, 0, width, height * 0.18);
  }

  private drawPlayer(color: number) {
    if (!this.playerContainer) return;
    this.playerContainer.removeAll(true);

    const body = this.add.graphics();
    // ボディ（角丸四角）
    body.fillStyle(color, 1);
    body.fillRoundedRect(-44, -56, 88, 88, 22);
    // 2本足
    body.fillStyle(color, 1);
    body.fillRoundedRect(-30, 30, 18, 22, 6);
    body.fillRoundedRect(12, 30, 18, 22, 6);
    // 目
    body.fillStyle(0xffffff, 1);
    body.fillCircle(-16, -22, 9);
    body.fillCircle(16, -22, 9);
    body.fillStyle(0x1a1a1a, 1);
    body.fillCircle(-14, -22, 4.5);
    body.fillCircle(18, -22, 4.5);
    this.playerContainer.add(body);

    // 待機の上下アニメ
    this.tweens.add({
      targets: this.playerContainer,
      y: this.playerContainer.y - 6,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
  }

  private handleSync(payload: SyncPayload) {
    this.current = payload;
    if (this.scene.isActive()) this.applySync(payload);
  }

  private applySync(payload: SyncPayload) {
    if (this.nameText) this.nameText.setText(payload.enemyName);
    if (this.enemyRect) this.enemyRect.setFillStyle(payload.enemyColor);
    this.drawPlayer(payload.playerColor);
    this.updateHpBar(payload.projectedDamage, payload.enemyMaxHp, false);
  }

  private handleDamage(payload: SyncPayload) {
    this.current = payload;
    this.updateHpBar(payload.projectedDamage, payload.enemyMaxHp, true);
    this.flashEnemy();
  }

  private updateHpBar(damage: number, maxHp: number, animate: boolean) {
    if (!this.hpBarFill || !this.hpText) return;
    const remaining = Math.max(0, maxHp - damage);
    const ratio = maxHp > 0 ? remaining / maxHp : 0;
    const targetWidth = this.hpBarWidth * ratio;

    // 残量で色を変える
    const color = ratio > 0.5 ? 0x6fcf97 : ratio > 0.2 ? 0xf2c94c : 0xeb5757;
    this.hpBarFill.setFillStyle(color);

    this.hpText.setText(`${Math.round(remaining)} / ${maxHp}`);

    if (animate) {
      this.tweens.add({
        targets: this.hpBarFill,
        width: targetWidth,
        duration: 600,
        ease: "Cubic.out",
      });
    } else {
      this.hpBarFill.width = targetWidth;
    }
  }

  private flashEnemy() {
    if (!this.enemyContainer) return;
    this.tweens.add({
      targets: this.enemyContainer,
      x: this.enemyContainer.x + 8,
      duration: 50,
      yoyo: true,
      repeat: 3,
    });
    // ヒットフラッシュ
    const flash = this.add
      .rectangle(this.scale.width / 2, this.scale.height * 0.4, 200, 200, 0xffffff, 0.6)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 220,
      onComplete: () => flash.destroy(),
    });
  }

  private handleDefeated() {
    if (!this.enemyContainer) return;
    // 撃破演出: 白フラッシュ → 縮小しながらフェード
    this.cameras.main.flash(260, 255, 255, 255);
    this.tweens.add({
      targets: this.enemyContainer,
      scale: 0,
      alpha: 0,
      angle: 180,
      duration: 700,
      ease: "Back.in",
    });
  }
}
