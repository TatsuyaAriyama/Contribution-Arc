import { useEffect, useRef } from "react";
import type Phaser from "phaser";
import { createGame } from "./game/createGame";

// Phaser.Game をマウント/破棄するだけの薄いコンポーネント。
// StrictMode の二重マウント対策として cleanup で必ず game.destroy(true)。
export default function PhaserGame() {
  const parentRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!parentRef.current) return;
    const game = createGame(parentRef.current);
    gameRef.current = game;
    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div className="adventure-canvas" ref={parentRef} />;
}
