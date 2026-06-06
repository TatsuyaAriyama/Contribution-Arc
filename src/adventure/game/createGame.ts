import Phaser from "phaser";
import { BattleScene } from "./scenes/BattleScene";

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

// 親要素にマウントする Phaser.Game を生成。
// 破棄は呼び出し側(PhaserGame.tsx)の useEffect cleanup で game.destroy(true)。
export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#10131c",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      roundPixels: false,
    },
    scene: [BattleScene],
  });
}
