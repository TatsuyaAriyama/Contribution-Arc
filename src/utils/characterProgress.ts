/**
 * キャラクター進行（Arc コイン残高）の local / cloud 競合解決。
 *
 * 背景: 購入で coins を減らした直後、デバウンス書き込み (1.5s) が cloud に
 * 着地する前にリロードや stale な onSnapshot が来ると、cloud の購入前残高で
 * ローカルの消費が巻き戻り、所持シルエット (ownedCharacterShapes) だけが
 * localStorage キャッシュで残ってしまう。結果「コインを払わずに解放」できる
 * 不整合になる。color / shape と同じ「ローカルの方が新しければローカルを
 * 採用する」規則を coins にも適用してこれを防ぐ。
 */
export function resolveCoins(opts: {
  /** localStorage にミラーした最後のローカル残高。未キャッシュなら null。 */
  localCoins: number | null | undefined;
  /** ローカルで coins/character を最後に操作した時刻 (ms)。 */
  localStamp: number;
  /** cloud (Firestore) 上の残高。 */
  cloudCoins: number;
  /** cloud profile の lastSyncedAt を ms 化したもの。 */
  cloudStamp: number;
}): number {
  const { localCoins, localStamp, cloudCoins, cloudStamp } = opts;
  if (
    typeof localCoins === "number" &&
    Number.isFinite(localCoins) &&
    localStamp > cloudStamp
  ) {
    return localCoins;
  }
  return cloudCoins;
}
