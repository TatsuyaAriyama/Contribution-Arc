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
/**
 * 所有シェイプ集合を local / cloud から解決する。
 *
 * 背景: 購入/着用直後はデバウンス書き込み (1.5s) がまだ cloud に着地して
 * いない。その間にリロードすると、cloud の ownedCharacterShapes に新しい
 * shape がまだ無く、所有判定が落ちて装着 shape が default に巻き戻る
 * (「キャラを選択したのにリロードで戻る」バグ)。ローカル選択が cloud より
 * 新しい間 (preferLocal) はローカル所有キャッシュも所有事実として信用し、
 * これを防ぐ。cloud が新しい場合は cloud のみを信用して localStorage
 * 改ざんによる非所持 shape の解放を防ぐ。"default" は常に含む。
 */
export function resolveOwnedShapes<T extends string>(opts: {
  /** cloud profile 上の所有シェイプ。 */
  cloudOwned: readonly T[];
  /** localStorage にミラーした所有シェイプ。 */
  localOwned: readonly T[];
  /** ローカル選択が cloud より新しいか (character-updated-at > lastSyncedAt)。 */
  preferLocal: boolean;
  /** 常に所有とみなす既定シェイプ。 */
  defaultShape: T;
}): T[] {
  const { cloudOwned, localOwned, preferLocal, defaultShape } = opts;
  return Array.from(
    new Set<T>([
      defaultShape,
      ...cloudOwned,
      ...(preferLocal ? localOwned : []),
    ]),
  );
}

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
