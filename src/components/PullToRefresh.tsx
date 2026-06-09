import { useRef, useState, type ReactNode, type TouchEvent } from "react";

/**
 * Pull-to-Refresh コンポーネント。X / Instagram 流の引き下げで更新する
 * ジェスチャをモバイル向けに提供する。
 *
 * 動作仕様：
 * - window.scrollY === 0 のときだけ起動 (スクロール中の誤発火を防ぐ)
 * - touchmove で指の Y 移動量を resistance 0.5 で減衰して引き量に変換
 * - 60px 引いて指を離すと onRefresh を呼ぶ
 * - onRefresh が resolve するまで indicator がスピンし続ける
 * - インジケータは container 上端に absolute で出し、子コンテンツも軽く
 *   translateY されることで "引いてる" 感を視覚化する
 *
 * 依存ライブラリは使わず、touch event だけで完結。iOS の rubber-band と
 * 競合しないよう、touchmove 内で event.preventDefault() は呼ばず、
 * scrollTop === 0 で 0px 以下に引かれた時のみ視覚的に追従する。
 */
export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
}) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  const THRESHOLD = 60;
  const MAX_PULL = 96;
  const RESISTANCE = 0.5;

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (refreshing) return;
    // window のスクロール最上端でしか起動しない。中途半端な位置で引いて
    // も「リロードしかけ」表示が出るとスクロール体験が壊れる。
    if (window.scrollY > 0) return;
    startYRef.current = event.touches[0].clientY;
    activeRef.current = true;
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (!activeRef.current || refreshing || startYRef.current === null) return;
    if (window.scrollY > 0) {
      // 途中で下にスクロールしたら追跡を解除
      activeRef.current = false;
      setPull(0);
      return;
    }
    const deltaY = event.touches[0].clientY - startYRef.current;
    if (deltaY <= 0) {
      setPull(0);
      return;
    }
    const next = Math.min(deltaY * RESISTANCE, MAX_PULL);
    setPull(next);
  };

  const handleTouchEnd = async () => {
    if (!activeRef.current || refreshing) {
      activeRef.current = false;
      startYRef.current = null;
      return;
    }
    activeRef.current = false;
    startYRef.current = null;
    if (pull >= THRESHOLD) {
      setRefreshing(true);
      try {
        await onRefresh();
      } catch {
        // refresh 失敗は呼び出し側でハンドリングする。ここでは indicator
        // を確実に閉じることだけ保証する。
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  };

  const indicatorVisible = refreshing || pull > 0;
  const offset = refreshing ? 48 : Math.min(pull, MAX_PULL);
  const progress = refreshing ? 1 : Math.min(pull / THRESHOLD, 1);

  return (
    <div
      className="pull-to-refresh"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        className={`pull-to-refresh-indicator${
          refreshing ? " is-refreshing" : ""
        }${indicatorVisible ? " is-visible" : ""}`}
        style={{
          transform: `translateX(-50%) translateY(${offset}px)`,
          opacity: indicatorVisible ? Math.max(progress, 0.4) : 0,
        }}
        aria-hidden={!indicatorVisible}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          style={{
            transform: refreshing ? undefined : `rotate(${progress * 270}deg)`,
            transition: refreshing ? undefined : "transform 0.06s linear",
          }}
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray={refreshing ? "12 38" : "56.5 56.5"}
            strokeDashoffset={refreshing ? 0 : 56.5 * (1 - progress)}
          />
        </svg>
      </div>
      <div
        className="pull-to-refresh-content"
        style={{
          transform: `translateY(${refreshing ? 32 : Math.min(pull, MAX_PULL) * 0.6}px)`,
          transition: activeRef.current ? "none" : "transform 0.22s ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}
