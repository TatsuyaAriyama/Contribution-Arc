// Pull-to-Refresh のジェスチャ判定を DOM/React から切り離した純粋ロジック。
// ここが「フィード途中なのに更新が走る」誤発火の温床だったので、依存を
// 注入可能にして node 上でユニットテストできるようにしている。

/** scroll 祖先探索に必要な最小限の DOM 形状。 */
export type ScrollableNode = {
  parentElement: ScrollableNode | null;
};

/**
 * 指の真下 (start) から上に辿り、実際に縦スクロール可能な最初の祖先を返す。
 *
 * 旧実装は mount 時に一度だけ container を検出し、外したときは window に
 * フォールバックしていた。window.scrollY は内部スクロール中も常に 0 なので
 * 「フィード途中でも最上端と誤認 → PTR 誤発火」していた。これを毎ジェスチャ
 * 指の下から live で解決することで取りこぼしを無くす。
 *
 * @param start       touchstart の event.target 相当（無ければ root を使う想定）
 * @param isScrollable その要素が縦スクロール可能か（overflow-y auto/scroll かつ
 *                     scrollHeight > clientHeight）。DOM 依存を注入する。
 * @param isStop      探索を打ち切る境界（document.body / documentElement 相当）
 */
export function findScrollableAncestor<T extends ScrollableNode>(
  start: T | null,
  isScrollable: (el: T) => boolean,
  isStop: (el: T) => boolean,
): T | null {
  let el: T | null = start;
  while (el && !isStop(el)) {
    if (isScrollable(el)) return el;
    el = el.parentElement as T | null;
  }
  return null;
}

/**
 * その scroller が最上端にいて PTR を起動してよいか。
 * scroller が無い (null) ＝スクロールするものが無い＝最上端扱いで許可。
 * これが false（scrollTop > 0 ＝フィード途中）なら絶対に起動しない。
 */
export function canArmAtTop(scrollerScrollTop: number | null): boolean {
  return scrollerScrollTop === null || scrollerScrollTop <= 0;
}

/**
 * 指の下方向移動量 deltaY を実際の引き量(pull)へ変換する。
 * armDistance を超えるまでは 0（インジケータを出さない）＝僅かなブレで
 * 「更新しかけ」がチラつくのを防ぐ。
 */
export function computePull(
  deltaY: number,
  armDistance: number,
  resistance: number,
  maxPull: number,
): number {
  if (deltaY <= armDistance) return 0;
  return Math.min((deltaY - armDistance) * resistance, maxPull);
}
