import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { canArmAtTop, computePull, findScrollableAncestor } from "./pullToRefreshGesture";

/**
 * Pull-to-Refresh コンポーネント。X / Instagram 流の引き下げで更新する
 * ジェスチャをモバイル向けに提供する。
 *
 * 動作仕様：
 * - 指の真下の「実際にスクロールしている要素」を touchstart のたびに live
 *   で解決し (resolveScroller)、その要素が最上端 (scrollTop<=0) のときだけ
 *   起動する。フィード途中ではスクロールコンテナが scrollTop>0 なので決して
 *   起動しない (= 誤発火しない)。
 * - touchmove で指の Y 移動量を resistance で減衰して引き量に変換。ただし
 *   ARM_DISTANCE を超える明確な引きだけを計上し、僅かなブレでインジケータが
 *   チラつかないようにする。
 * - THRESHOLD まで引いて指を離すと onRefresh を呼ぶ
 * - onRefresh が resolve するまで indicator がスピンし続ける
 * - インジケータは container 上端に absolute で出し、子コンテンツも軽く
 *   translateY されることで "引いてる" 感を視覚化する
 *
 * 依存ライブラリは使わず、touch event だけで完結。iOS の rubber-band と
 * 競合しないよう、touchmove 内で event.preventDefault() は呼ばない。
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
  // 直近のスクロール時刻を記録して、スクロール momentum が落ち着く前の
  // touchstart は PTR を起動しないようにする。「最上部にバウンドした直後
  // に指で下に引いた」ような誤発火を防ぐ。
  const lastScrollAtRef = useRef(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // このジェスチャで実際にスクロールしている要素。touchstart のたびに
  // 指の下の DOM から live で解決する (下記 resolveScroller 参照)。
  const gestureScrollerRef = useRef<HTMLElement | null>(null);

  const THRESHOLD = 140;
  const MAX_PULL = 200;
  const RESISTANCE = 0.28;
  // pull を計上し始める最小の引き距離。ここを超えるまではインジケータも
  // 出さないので、スクロール上端での僅かな指のブレで「更新しかけ」が
  // チラつくのを防ぐ。
  const ARM_DISTANCE = 18;
  // スクロール後この時間 (ms) は PTR を起動しない。500ms あれば momentum
  // も止まり、ユーザーが「意図的に下に引いた」と区別できる。
  const SCROLL_QUIET_MS = 500;

  // 指の下 (= startEl) から上に辿り、実際にスクロール可能な (中身が
  // あふれていて overflow-y が auto/scroll) 最初の ancestor を返す。
  // 旧実装は mount 時に一度だけ container を検出し、外したときは window
  // にフォールバックしていた。window.scrollY は内部スクロール時も常に 0
  // なので、フィード途中でも getScrollTop()===0 になり PTR が誤発火して
  // いた。毎ジェスチャ live で解決することでこの取りこぼしを無くす。
  const resolveScroller = (startEl: Element | null): HTMLElement | null => {
    if (typeof window === "undefined") return null;
    const start = (startEl as HTMLElement | null) || rootRef.current;
    return findScrollableAncestor<HTMLElement>(
      start,
      (el) => {
        const style = window.getComputedStyle(el);
        const canScrollY = style.overflowY === "auto" || style.overflowY === "scroll";
        return canScrollY && el.scrollHeight > el.clientHeight + 1;
      },
      (el) => el === document.body || el === document.documentElement,
    );
  };

  // 現在の scrollTop。ジェスチャ中の scroller が無ければ「最上部扱い (0)」。
  const getScrollTop = () => {
    const scroller = gestureScrollerRef.current;
    return scroller ? scroller.scrollTop : 0;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleScroll = () => {
      lastScrollAtRef.current = Date.now();
    };
    // capture phase で document 全体の scroll を拾い、momentum / バウンドの
    // 直後かどうかを判定するためのタイムスタンプを更新する。
    document.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, []);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (refreshing) return;
    // 指の真下のスクロールコンテナを live で解決し、その最上端でだけ起動。
    const scroller = resolveScroller(event.target as Element | null);
    gestureScrollerRef.current = scroller;
    // スクロール可能なコンテナが本当に最上端 (scrollTop<=0) のときだけ。
    // 中途半端な位置 (scrollTop>0) で引いても起動しない＝誤発火を断つ。
    if (!canArmAtTop(scroller ? scroller.scrollTop : null)) return;
    // スクロール momentum / 最上部バウンドの直後は PTR を起動しない。
    if (Date.now() - lastScrollAtRef.current < SCROLL_QUIET_MS) return;
    startYRef.current = event.touches[0].clientY;
    activeRef.current = true;
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (!activeRef.current || refreshing || startYRef.current === null) return;
    // 途中で少しでも下にスクロールしたら (= 最上端を離れたら) 追跡を解除
    if (getScrollTop() > 0) {
      activeRef.current = false;
      setPull(0);
      return;
    }
    // スクロール直後 (momentum / bounce 中) も pull を計上しない。
    // touchstart 後にスクロールイベントが発火するパターンへの追加防衛。
    if (Date.now() - lastScrollAtRef.current < SCROLL_QUIET_MS) {
      activeRef.current = false;
      setPull(0);
      return;
    }
    const deltaY = event.touches[0].clientY - startYRef.current;
    // ARM_DISTANCE を超える明確な下方向の引きだけを pull にする。僅かな
    // 指のブレや上方向・横方向は無視し、インジケータをチラつかせない。
    setPull(computePull(deltaY, ARM_DISTANCE, RESISTANCE, MAX_PULL));
  };

  const handleTouchEnd = async () => {
    if (!activeRef.current || refreshing) {
      activeRef.current = false;
      startYRef.current = null;
      gestureScrollerRef.current = null;
      return;
    }
    activeRef.current = false;
    startYRef.current = null;
    gestureScrollerRef.current = null;
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
      ref={rootRef}
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
