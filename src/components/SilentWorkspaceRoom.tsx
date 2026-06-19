import { useEffect, useRef, useState, type CSSProperties, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  renderAngelSvg,
  renderDefaultCharacterSvg,
  renderGhostSvg,
  renderOwlSvg,
  renderRoboSvg,
} from "./CharacterShapeSvg";
import { useTranslation } from "../i18n/LanguageContext";

/* 自分タブの "仲間を募集" 行に使う 2 人シルエットの line-art アイコン。
   旧 megaphone SVG はパスが複雑で潰れて見えていたので、意図 (= 人を
   集める) がより直感的に伝わる小柄なアイコンに差し替え。 */
function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.4" />
        <path d="M3 19c0-2.8 2.7-5 6-5s6 2.2 6 5" />
        <path d="M14 19c0-2 1.5-3.6 3-3.6S20 17 20 19" />
      </g>
    </svg>
  );
}

export type RoomActivityItem = {
  id: string;
  userId: string;
  userName: string;
  avatar?: string;
  text: string;
  meta: string;
  member?: RoomActor;
};

type RoomActorStatus = "working" | "deep-work" | "on-break";

export type CharacterShape = "default" | "ghost" | "owl" | "robo" | "angel";

export type PresetLogEntry = {
  id: string;
  userId: string;
  name: string;
  message: string;
  color?: string;
  at: number;
};

export type RoomActor = {
  id: string;
  userId: string;
  name: string;
  avatar?: string;
  characterColor?: string;
  characterShape?: CharacterShape;
  x: number;
  y: number;
  currentTask: string;
  building: string;
  status: RoomActorStatus;
  joinedAt: string;
  activeStartedAt?: string;
  accumulatedActiveMinutes?: number;
  breakStartedAt?: string;
  color: string;
  tone: "deep" | "green" | "soft" | "blue";
  /* Preset/chat bubble synced through the room document. Rendered for
     other members when fresh; the originator's bubble is driven by the
     local `bubbleMessage` prop instead (zero-latency feedback). */
  bubble?: string;
  bubbleAt?: string;
};

export type LearningItemSuggestion = {
  id: string;
  name: string;
  color: string;
};

/* A "置き手紙" left on the room floor. Positioned with x/y percentages
   like actors. `isUnread` lights it up for members who haven't opened it
   yet so the next person to enter notices it. */
export type FloorNoteMarker = {
  id: string;
  name: string;
  color?: string;
  x: number;
  y: number;
  isUnread?: boolean;
  isMine?: boolean;
};

/* A "記念碑" — a small stone standing in the room for a member's
   milestone (study hours, level, streak). Persists as room history. */
export type MonumentMarker = {
  id: string;
  x: number;
  y: number;
  icon: string;
  label: string;
  color?: string;
};

export type ActiveRecruitmentSummary = {
  stateLabel: string;
  joinedCount: number;
  onCancel: () => void;
};

type SilentWorkspaceRoomProps = {
  presentation?: "full" | "focus";
  roomName: string;
  roomDescription?: string;
  onlineCount: number;
  commitLabel: string;
  members: RoomActor[];
  currentUserId: string;
  isJoined: boolean;
  currentStayLabel: string;
  joinedAtLabel: string;
  taskValue: string;
  onTaskChange: (value: string) => void;
  onJoin: () => void;
  onLeave: () => void;
  presetMessages: string[];
  onPresetMessagesChange: (messages: string[]) => void;
  onPresetMessage: (message: string) => void;
  bubbleMessage: string;
  /* Recent-bubble log surfaced next to the stage. Lets the user catch
     up on what was said even after the per-actor bubbles have faded.
     Newest entry first; the parent caps the list (~12). */
  presetLog?: PresetLogEntry[];
  isPlayerWalking: boolean;
  /* ステージ床をタップした座標 (%)。スマホ向けの "Tap to walk" 操作で、
     キーボードが使えない端末でも自分のアバターを動かせるようにする。
     親 (App.tsx) はこの座標を walk-loop の目的地として消費する。
     null/undefined ならタップ移動は無効化 (popover 開放中など)。 */
  onStageTap?: (x: number, y: number) => void;
  /* タップ移動の視覚マーカー (id で 1.5s ごとにアニメをリセット)。
     null なら非表示。 */
  tapWalkMarker?: { x: number; y: number; id: number } | null;
  /* タイマー終了時の通知 (親で state クリア)。 */
  onTapWalkMarkerExpire?: (id: number) => void;
  onMemberOpen: (member: RoomActor) => void;
  /* In-stage compact profile popover. When `selectedMemberId` matches a
     member, `memberPanel` is rendered as a small card anchored near that
     member's avatar (instead of navigating to the full profile screen).
     `onMemberPanelClose` dismisses it; the backdrop calls it too. */
  selectedMemberId?: string | null;
  memberPanel?: ReactNode;
  /* ルームチャット: 「みんな」タブの下に表示。最大 50 件の最新を流す。
     送信は親 (App.tsx) の handler で NG word チェックを通してから
     Firestore へ書き込む。返り値が false なら入力欄に残す。 */
  chatMessages?: Array<{
    id: string;
    userId: string;
    userName: string;
    text: string;
    createdAt: string;
    characterColor?: string;
    characterShape?: string;
  }>;
  chatError?: string;
  onChatSend?: (text: string) => Promise<boolean>;
  /* Floor notes ("置き手紙"): non-sync drops left on the room floor.
     Tapping one opens it; the parent owns the open/compose state. */
  floorNotes?: FloorNoteMarker[];
  onFloorNoteOpen?: (noteId: string) => void;
  onComposeFloorNote?: () => void;
  canDropFloorNote?: boolean;
  floorNotePanel?: ReactNode;
  /* Milestone monuments ("記念碑"): small stones standing in the room
     for members' achievements. Tapping one shows its detail. */
  monuments?: MonumentMarker[];
  onMonumentOpen?: (monumentId: string) => void;
  monumentPanel?: ReactNode;
  /* Shared dismiss for any of the in-stage popovers above (profile /
     note / monument). The backdrop calls it. */
  onPanelClose?: () => void;
  totalLearnedLabel: string;
  learningItemSuggestions?: LearningItemSuggestion[];
  onLearningItemRegister?: (presetName: string) => void;
  onOpenRecruitmentModal?: () => void;
  activeRecruitmentSummary?: ActiveRecruitmentSummary | null;
  /** 部屋名変更 UI を出すかどうか (作成者 + dev のみ true)。 */
  canRenameRoom?: boolean;
  /** 部屋名変更の確定コールバック。trim 済み name を受け取る。 */
  onRenameRoom?: (newName: string) => void;
  /* Mobile overlay menu actions. The parent owns the rename form +
     delete confirmation; this component just surfaces the buttons
     inside the in-stage overlay so mobile users have a single
     place to manage the room. */
  onRoomRename?: () => void;
  onRoomDelete?: () => void;
  canDeleteRoom?: boolean;
  /* 分身の着替え ("change appearance"): a centered popover holding the
     shape/color picker so members can restyle their avatar without
     leaving the room. The parent owns the open state and the picker
     markup; this component surfaces the trigger and renders the panel
     in the shared stage-popover slot. */
  onComposeAppearance?: () => void;
  appearancePanel?: ReactNode;
};

function formatChatLogTime(atMs: number, t: (k: string, vars?: Record<string, string | number>) => string) {
  const diffSec = Math.max(0, Math.floor((Date.now() - atMs) / 1000));
  if (diffSec < 5) return t("今");
  if (diffSec < 60) return t("{n}秒前", { n: diffSec });
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t("{n}分前", { n: diffMin });
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t("{n}時間前", { n: diffHr });
  return t("{n}日前", { n: Math.floor(diffHr / 24) });
}

/* Active focus minutes for an actor, excluding break time. Used both by
   the stay label and the focus ring. */
function getActorActiveMinutes(member: RoomActor) {
  if (typeof member.accumulatedActiveMinutes === "number") {
    const base = member.accumulatedActiveMinutes;
    if (member.status === "on-break" || !member.activeStartedAt) {
      return Math.max(0, Math.floor(base));
    }
    return Math.max(
      0,
      Math.floor(base + (Date.now() - new Date(member.activeStartedAt).getTime()) / 60000),
    );
  }
  return Math.max(0, Math.floor((Date.now() - new Date(member.joinedAt).getTime()) / 60000));
}

function getActorStayLabel(member: RoomActor, t: (k: string) => string) {
  if (member.status === "on-break") {
    return t("休憩中");
  }

  const minutes = Math.max(1, getActorActiveMinutes(member));
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours <= 0) {
    return `${restMinutes}m`;
  }

  return restMinutes > 0 ? `${hours}h ${restMinutes}m` : `${hours}h`;
}

/* Focus-ring state for an actor. The ring fills clockwise over a single
   12-hour session: it starts empty (no color) when the actor joins and
   reaches a full revolution after 12 hours of active focus, then holds at
   full rather than wrapping back to empty. `--focus-progress` (0..1)
   drives the conic-gradient fill in CSS. */
function getActorFocusRing(member: RoomActor) {
  const active = getActorActiveMinutes(member);
  const cycleLength = 12 * 60; // 12 hours, one full revolution
  const progress = Math.min(1, active / cycleLength);
  return { progress };
}

/* ルームチャット小型 panel。最大 50 件の messages を表示 + 入力欄。
   - 親 (App.tsx) で NG word チェック + Firestore 書き込み
   - 送信成功 (resolve true) で入力欄をクリア、失敗時は残す */
function RoomChatPanel({
  messages,
  error,
  onSend,
  currentUserId,
}: {
  messages: Array<{
    id: string;
    userId: string;
    userName: string;
    text: string;
    createdAt: string;
  }>;
  error: string;
  onSend: (text: string) => Promise<boolean>;
  currentUserId: string;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim() || isSending) return;
    setIsSending(true);
    try {
      const ok = await onSend(draft);
      if (ok) setDraft("");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="atelier-chat-panel" aria-label={t("ルームチャット")}>
      <header className="atelier-chat-head">
        <span className="atelier-chat-title">{t("チャット")}</span>
        <span className="atelier-chat-count">{messages.length}</span>
      </header>
      <ol className="atelier-chat-list">
        {messages.length === 0 ? (
          <li className="atelier-chat-empty">{t("まだメッセージはありません。最初の一言を。")}</li>
        ) : (
          messages.map((m) => {
            const isSelf = m.userId === currentUserId;
            return (
              <li
                key={m.id}
                className={`atelier-chat-msg${isSelf ? " is-self" : ""}`}
              >
                <span className="atelier-chat-msg-author">
                  {m.userName}
                  {isSelf ? <em>YOU</em> : null}
                </span>
                <span className="atelier-chat-msg-text">{m.text}</span>
              </li>
            );
          })
        )}
      </ol>
      <form className="atelier-chat-form" onSubmit={handleSubmit}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("一言だけ。")}
          maxLength={280}
          rows={1}
          aria-label={t("チャットメッセージを書く")}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (draft.trim() && !isSending) {
                void onSend(draft).then((ok) => {
                  if (ok) setDraft("");
                });
              }
            }
          }}
        />
        <button type="submit" disabled={!draft.trim() || isSending}>
          {isSending ? t("送信…") : t("送る")}
        </button>
      </form>
      {error ? <p className="atelier-chat-error" role="alert">{error}</p> : null}
    </section>
  );
}

export function SilentWorkspaceRoom({
  presentation = "full",
  roomName,
  members,
  currentUserId,
  isJoined,
  currentStayLabel,
  joinedAtLabel,
  taskValue,
  onTaskChange,
  onJoin,
  onLeave,
  presetMessages,
  onPresetMessagesChange,
  onPresetMessage,
  bubbleMessage,
  presetLog = [],
  isPlayerWalking,
  onStageTap,
  tapWalkMarker = null,
  onTapWalkMarkerExpire,
  onMemberOpen,
  selectedMemberId = null,
  memberPanel,
  chatMessages = [],
  chatError = "",
  onChatSend,
  floorNotes = [],
  onFloorNoteOpen,
  onComposeFloorNote,
  canDropFloorNote = false,
  floorNotePanel,
  monuments = [],
  onMonumentOpen,
  monumentPanel,
  onPanelClose,
  learningItemSuggestions = [],
  onLearningItemRegister,
  onOpenRecruitmentModal,
  activeRecruitmentSummary = null,
  canRenameRoom = false,
  onRenameRoom,
  onRoomRename,
  onRoomDelete,
  canDeleteRoom = false,
  onComposeAppearance,
  appearancePanel,
}: SilentWorkspaceRoomProps) {
  const { t } = useTranslation();
  const isFocusPresentation = presentation === "focus";
  const [isPresetEditorOpen, setIsPresetEditorOpen] = useState(false);
  const [isPresetTrayOpen, setIsPresetTrayOpen] = useState(false);
  // HUD の開閉状態。モバイルでは FAB トグルで開閉する。PC では常時開き
  // 状態で固定 (ステージ下部中央の横長ツールバーとして常時表示する)。
  // 初期値を viewport 幅で分岐させることで PC では最初から actions が
  // tabIndex 0 / aria-hidden=false になり、キーボード操作も成立する。
  const [isHudOpen, setIsHudOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 721px)").matches;
  });
  // Mobile-only expand toggle for the in-stage room overlay. Desktop
  // CSS ignores this and always shows the full overlay; on phones the
  // overlay starts collapsed to a single-line pill (room name + meta)
  // and expands to show the task input + actions when ⋯ is tapped.
  const [isOverlayExpanded, setIsOverlayExpanded] = useState(false);
  /* 「みんな」(in-room people + chat) と「自分」(自分の状態 + 操作) の
     2 タブ。みんな側にメンバーが収まりきらなかったので画面を分ける。
     自分タブは Phase 13 で定型文 / 置き手紙 / 着替えを削った
     スリム構成 (status / task / 募集 / 退出) を維持する。 */
  const [mobileTab, setMobileTab] = useState<"people" | "me">("people");
  /* スマホ幅かどうか。ルームタブの「ポケ森風 箱庭レイアウト」を出す
     判定に使う。PC では false のまま従来の俯瞰 2D を使う。 */
  const [isPhone, setIsPhone] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 720px)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 720px)");
    const handle = (event: MediaQueryListEvent) => setIsPhone(event.matches);
    setIsPhone(mq.matches);
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);
  // Forces a re-render every 500ms while any actor has a fresh bubble
  // — the render-time TTL on `member.bubble` otherwise relies on some
  // other prop change to take effect, which means a bubble could
  // linger past its natural lifespan in an otherwise idle room (e.g.
  // the sender disconnected mid-message and nobody is moving). The
  // tick only runs while there's actually something to retire, so an
  // empty room doesn't pay the cost.
  const [bubbleTick, setBubbleTick] = useState(0);
  void bubbleTick;
  useEffect(() => {
    const now = Date.now();
    const hasActiveBubble = members.some((member) => {
      if (!member.bubble || !member.bubbleAt) return false;
      const ms = new Date(member.bubbleAt).getTime();
      return Number.isFinite(ms) && now - ms < 7000;
    });
    if (!hasActiveBubble) return;
    const id = window.setInterval(() => setBubbleTick((t) => t + 1), 500);
    return () => window.clearInterval(id);
  }, [members]);
  // Slow tick so the focus rings keep filling as minutes accrue even when
  // nothing else re-renders the stage. The ring now spans 12 hours, so each
  // 1% is ~7 minutes — a 60s tick is far finer than the eye can resolve and
  // costs almost nothing; only runs while there's at least one member.
  const [ringTick, setRingTick] = useState(0);
  void ringTick;
  useEffect(() => {
    if (members.length === 0) return;
    // 60s 間隔だと、ステージを見つめている間に進捗が "止まって見える"。
    // 10s に短縮しても 1 部屋あたり stand-alone な setState 1 回分なので
    // コストは無視できる。視覚的な "生きてる感" が大きく上がる。
    const id = window.setInterval(() => setRingTick((t) => t + 1), 10000);
    return () => window.clearInterval(id);
  }, [members.length]);

  // 入室トースト。前回のレンダーから members に新規 userId が増えていれば、
  // その名前を 3 秒だけステージ上部にフェード表示する。自分自身の入室は
  // 入室直後のオーバーレイで既に分かるので除外。これがあると「気配」を
  // ちゃんと感じられる ── 静かな部屋に人が来た合図。
  const previousMemberIdsRef = useRef<Set<string>>(new Set());
  const [arrivalToast, setArrivalToast] = useState<string | null>(null);
  useEffect(() => {
    const previous = previousMemberIdsRef.current;
    const currentIds = new Set(members.map((member) => member.userId));
    const newcomers = members.filter(
      (member) => !previous.has(member.userId) && member.userId !== currentUserId,
    );
    previousMemberIdsRef.current = currentIds;
    if (previous.size === 0) return; // 初回ハイドレートはトーストしない
    if (newcomers.length === 0) return;
    const label =
      newcomers.length === 1
        ? t("{name} さんが入室", { name: newcomers[0].name })
        : t("{name} さん他 {count} 人が入室", { name: newcomers[0].name, count: newcomers.length - 1 });
    setArrivalToast(label);
    const id = window.setTimeout(() => setArrivalToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [members, currentUserId]);

  // Esc キーでステージ内ポップオーバーを一括クローズ。ポップオーバーが
  // 開いている時だけリスナーを張るので、それ以外の入力には影響しない。
  const hasOpenPopover = Boolean(
    (selectedMemberId && memberPanel) || floorNotePanel || monumentPanel || appearancePanel,
  );
  useEffect(() => {
    if (!hasOpenPopover || !onPanelClose) return;
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onPanelClose();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [hasOpenPopover, onPanelClose]);

  // ポップオーバーが開いている間は背景スクロールを止める。スマホで
  // ポップオーバーの上下スクロールが裏のページに抜けるのを防ぐ。
  // 同時に :has() セレクタの代替として body class を付与する
  // (Samsung Internet 等で :has() が動作しないため、CSS 側はこの
  // class で HUD の退避や FAB 非表示などを判定する)。
  useEffect(() => {
    if (!hasOpenPopover) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("workspace-popover-active");
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.classList.remove("workspace-popover-active");
    };
  }, [hasOpenPopover]);

  // タップ移動マーカーの自動消滅 (1500ms)。親 (App.tsx) に id を通知して
  // state をクリアする。タップごとに id が変わるので連打しても確実に
  // 再アニメ・再タイマーが走る。
  useEffect(() => {
    if (!tapWalkMarker || !onTapWalkMarkerExpire) return;
    const id = window.setTimeout(() => onTapWalkMarkerExpire(tapWalkMarker.id), 1500);
    return () => window.clearTimeout(id);
  }, [tapWalkMarker, onTapWalkMarkerExpire]);

  // popover (member/note/monument/appearance) が開いたら HUD は閉じる。
  // FAB が popover の前に被ると操作不能になるので、明示的に退避させる。
  // popover が閉じた時、PC では HUD を再オープン (常時表示が PC の正)。
  useEffect(() => {
    if (hasOpenPopover) {
      setIsHudOpen(false);
      setIsPresetTrayOpen(false);
      setIsPresetEditorOpen(false);
    } else if (
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 721px)").matches
    ) {
      setIsHudOpen(true);
    }
  }, [hasOpenPopover]);

  // Esc / 外側タップで HUD 自体も閉じる。tap-to-walk の床タップとは
  // 干渉しないよう、stage 直接の onPointerDown は別経路。
  useEffect(() => {
    if (!isHudOpen) return;
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsHudOpen(false);
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [isHudOpen]);

  // 初回ヒント。スマホで入室直後に "床をタップで移動できます" を 5 秒だけ
  // 表示する。localStorage で一度見た人には二度と表示しない。タッチ可能
  // 端末でのみ表示し、PC では出さない (PC は WASD で動かす想定)。
  const [showTapHint, setShowTapHint] = useState(false);
  useEffect(() => {
    if (!isJoined) return;
    if (typeof window === "undefined") return;
    const isTouchDevice = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    if (!isTouchDevice) return;
    try {
      if (localStorage.getItem("ca:workspace-tap-hint-shown") === "1") return;
    } catch {
      /* localStorage 不可なら諦める */
    }
    setShowTapHint(true);
    const timer = window.setTimeout(() => {
      setShowTapHint(false);
      try {
        localStorage.setItem("ca:workspace-tap-hint-shown", "1");
      } catch {
        /* ignore */
      }
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [isJoined]);

  const presetSlots = [...presetMessages, "", "", "", "", "", ""].slice(0, 6);
  const visiblePresetMessages = presetSlots.map((message) => message.trim()).filter(Boolean);

  // ホットキー：1〜6 で定型文を送信。input/textarea にフォーカスがある
  // 時は無効。ポップオーバーが開いている間も無効。PC ユーザー向けの
  // パワーユーザー機能だが、知らない人には邪魔にならない（押さなければ
  // 何も起きない）。
  useEffect(() => {
    if (!isJoined || hasOpenPopover) return;
    const handle = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (target?.isContentEditable) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const num = Number(event.key);
      if (Number.isInteger(num) && num >= 1 && num <= 6) {
        const message = visiblePresetMessages[num - 1];
        if (message) {
          event.preventDefault();
          onPresetMessage(message);
        }
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [isJoined, hasOpenPopover, visiblePresetMessages, onPresetMessage]);
  const currentMember = members.find((member) => member.userId === currentUserId);
  const isCurrentUserOnBreak = currentMember?.status === "on-break";

  /* === Pomodoro mini-timer (自分タブ専用) ===
     25 分集中 → 5 分休息 を 1 セットとして自動サイクルする視覚的な
     タイマー。Firestore とは独立した client-side state。タブ間の
     移動では DOM が消えない (display:none) ので state は維持される。
     入室していない時は非表示 (= 動かさない)。 */
  type PomoMode = "work" | "break";
  const POMO_WORK_SECS = 25 * 60;
  const POMO_BREAK_SECS = 5 * 60;
  const [pomoMode, setPomoMode] = useState<PomoMode>("work");
  const [pomoRemaining, setPomoRemaining] = useState(POMO_WORK_SECS);
  const [pomoRunning, setPomoRunning] = useState(false);
  const [pomoSet, setPomoSet] = useState(1);
  useEffect(() => {
    if (!pomoRunning) return;
    const id = window.setInterval(() => {
      setPomoRemaining((rem) => {
        if (rem <= 1) {
          // セット切替
          setPomoMode((mode) => {
            const next: PomoMode = mode === "work" ? "break" : "work";
            setPomoRemaining(next === "work" ? POMO_WORK_SECS : POMO_BREAK_SECS);
            if (next === "work") setPomoSet((n) => n + 1);
            return next;
          });
          return 0;
        }
        return rem - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [pomoRunning]);
  const handlePomoToggle = () => setPomoRunning((r) => !r);
  const handlePomoReset = () => {
    setPomoRunning(false);
    setPomoMode("work");
    setPomoRemaining(POMO_WORK_SECS);
    setPomoSet(1);
  };
  const pomoTotal = pomoMode === "work" ? POMO_WORK_SECS : POMO_BREAK_SECS;
  const pomoProgress = 1 - pomoRemaining / pomoTotal;
  const pomoMM = String(Math.floor(pomoRemaining / 60)).padStart(2, "0");
  const pomoSS = String(pomoRemaining % 60).padStart(2, "0");

  /* 部屋名 inline rename (作成者のみ)。window.prompt は browser の
     URL バー (例: github.io) を表示してしまうので、in-app の input に
     差し替える。 */
  const [isEditingRoomName, setIsEditingRoomName] = useState(false);
  const [roomNameDraft, setRoomNameDraft] = useState("");
  const handleStartRenameRoom = () => {
    setRoomNameDraft(roomName);
    setIsEditingRoomName(true);
  };
  const handleSubmitRenameRoom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = roomNameDraft.trim().slice(0, 32);
    setIsEditingRoomName(false);
    if (next && next !== roomName && onRenameRoom) {
      onRenameRoom(next);
    }
  };
  const handleCancelRenameRoom = () => {
    setIsEditingRoomName(false);
    setRoomNameDraft("");
  };

  const handleTaskChange = (event: ChangeEvent<HTMLInputElement>) => {
    onTaskChange(event.target.value);
  };

  // 触覚フィードバック (対応端末のみ)。
  // - アクタータップ：12ms
  // - 置き手紙/記念碑タップ：10ms
  // 不対応 (iOS Safari など) は例外スローではなく undefined を返すだけ。
  const buzz = (ms: number) => {
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* ignore */
    }
  };

  const handlePresetChange = (index: number, value: string) => {
    onPresetMessagesChange(
      presetSlots.map((message, slotIndex) => (slotIndex === index ? value : message)).slice(0, 6),
    );
  };

  // Pre-join "lobby" view. The previous layout rendered the immersive
  // stage even before the user joined, which left the workspace-session
  // overlay floating over the stage with the "入室する" button awkwardly
  // overlapping. Replace it with a focused entry card: room name,
  // member peek (avatar stack), task input, and a single prominent CTA.
  if (!isJoined && !isFocusPresentation) {
    const previewMembers = members.slice(0, 5);
    const extraMembers = Math.max(0, members.length - previewMembers.length);
    return (
      <div className="workspace-2d-shell is-preview">
        <article className="workspace-room-preview">
          <header className="room-preview-header">
            <p className="room-preview-kicker">{t("作業部屋")}</p>
            <h3 className="room-preview-title">{roomName}</h3>
          </header>

          <div className="room-preview-members" aria-label={t("作業中のメンバー")}>
            {previewMembers.length > 0 ? (
              <div className="room-preview-avatar-stack">
                {previewMembers.map((member) => {
                  const fillColor = member.characterColor || member.color || "#7667a8";
                  const shape = member.characterShape || "default";
                  /* 投稿カード avatar と統一: キャラ shape + カラーで
                      描画。avatar URL があるユーザーは写真優先、
                      それ以外は shape に応じた SVG。default / ghost /
                      owl / robo / angel をサポート。 */
                  let content: ReactNode;
                  if (member.avatar) {
                    content = <img src={member.avatar} alt="" />;
                  } else if (shape === "default") {
                    content = renderDefaultCharacterSvg(fillColor, { showEdges: false });
                  } else if (shape === "ghost") {
                    content = renderGhostSvg(fillColor);
                  } else if (shape === "owl") {
                    content = renderOwlSvg(fillColor);
                  } else if (shape === "robo") {
                    content = renderRoboSvg(fillColor);
                  } else if (shape === "angel") {
                    content = renderAngelSvg(fillColor);
                  } else {
                    content = (
                      <span>{(member.name?.charAt(0) || "?").toUpperCase()}</span>
                    );
                  }
                  return (
                    <span
                      key={member.userId}
                      className={`room-preview-avatar room-preview-avatar-shape-${shape}`}
                      style={{ "--actor-color": fillColor } as CSSProperties}
                      title={member.name}
                    >
                      {content}
                    </span>
                  );
                })}
                {extraMembers > 0 ? (
                  <span className="room-preview-avatar room-preview-avatar-more">
                    +{extraMembers}
                  </span>
                ) : null}
              </div>
            ) : null}
            <span className="room-preview-count">
              {members.length > 0 ? t("{count}人が作業中", { count: members.length }) : t("まだ誰もいません")}
            </span>
          </div>

          <label className="room-preview-task-field">
            <span>{t("今やってること")}</span>
            <input
              value={taskValue}
              onChange={handleTaskChange}
              placeholder={t("作業内容を入力")}
              maxLength={48}
            />
          </label>

          <button type="button" className="room-preview-join" onClick={onJoin}>
            {t("入室する")}
          </button>

          {/* 解体は入室せずに行えるようにする。以前は解体ボタンが
              没入ステージ内オーバーレイ / canvas-actions 行にしか無く、
              どちらもモバイルでは CSS で非表示 (App.css の
              .workspace-room-canvas-actions / .workspace-room-overlay-admin)。
              そのためプレビュー画面では「入室する」しか押せず、解体しよう
              として入室してしまっていた。canDeleteRoom (= 作成者本人 or
              開発者アカウント) の時だけ出す。 */}
          {onRoomDelete && canDeleteRoom ? (
            <button
              type="button"
              className="room-preview-dismantle"
              onClick={onRoomDelete}
            >
              {t("解体する")}
            </button>
          ) : null}
        </article>
      </div>
    );
  }

  // Room-info overlay shown inside the immersive stage (top-left).
  // Replaces the previous .workspace-session-panel card that floated
  // above the stage and visually competed with the room canvas. Kept
  // small on purpose: title + stay meta + a compact task input + the
  // recruit / leave actions. Datalist autocomplete still covers
  // learning-item suggestions; the ghost hint surfaces when the typed
  // text doesn't match an existing item.
  const trimmedTask = taskValue.trim();
  const matchedLearningItem = learningItemSuggestions.find(
    (item) => item.name.toLowerCase() === trimmedTask.toLowerCase(),
  );
  const showGhostHint =
    trimmedTask.length > 0 && !matchedLearningItem && Boolean(onLearningItemRegister);

  /* ルームタブ廃止に伴い、整列ロジックも撤去。PC は保存座標のまま、
     モバイルでは stage 自体が CSS で非表示。 */
  const isMobileRoomLayout = false;
  const displayMembers = members;

  return (
    <div
      className={`workspace-2d-shell ${isFocusPresentation ? "focus-presentation" : ""}`}
      data-mobile-tab={mobileTab}
    >
      {/* モバイル専用のタブバー。PC では CSS で display:none。 */}
      <nav className="workspace-mobile-tabs" role="tablist" aria-label={t("作業部屋の表示")}>
        <button
          type="button"
          role="tab"
          className={`workspace-mobile-tab${mobileTab === "people" ? " is-active" : ""}`}
          aria-selected={mobileTab === "people"}
          onClick={() => setMobileTab("people")}
        >
          {t("みんな")}
          <span className="workspace-mobile-tab-count">{members.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          className={`workspace-mobile-tab${mobileTab === "me" ? " is-active" : ""}`}
          aria-selected={mobileTab === "me"}
          onClick={() => setMobileTab("me")}
        >
          {t("自分")}
        </button>
      </nav>
      <div className="workspace-2d-main">
        <div
          className="workspace-stage"
          aria-label="Silent workspace"
          onPointerDown={(event) => {
            // タップ移動：ステージ "床" 部分のタップに反応。
            // アクター・置き手紙・記念碑・ポップオーバー・オーバーレイ
            // をタップした場合は、それぞれのハンドラが既に動作するので
            // ここでは無視する (event.target === currentTarget)。
            if (event.target !== event.currentTarget) return;
            // 箱庭レイアウト中は座標を整列管理しているので、タップ移動は無効。
            if (isMobileRoomLayout) return;
            if (!onStageTap) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 100;
            const y = ((event.clientY - rect.top) / rect.height) * 100;
            onStageTap(x, y);
          }}
        >
          <div className="workspace-floor-grid" aria-hidden="true" />

          {/* タップ移動マーカー：タップ位置にリングを 1.5s だけ表示。
              `key={tapWalkMarker.id}` で毎タップ強制再マウントしてアニメ
              が必ず先頭から走るようにする (同じ位置への連打にも対応)。 */}
          {tapWalkMarker ? (
            <span
              key={tapWalkMarker.id}
              className="workspace-tap-marker"
              style={
                {
                  "--actor-x": `${tapWalkMarker.x}%`,
                  "--actor-y": `${tapWalkMarker.y}%`,
                } as CSSProperties
              }
              aria-hidden="true"
            />
          ) : null}

          {/* 初回タップ移動ヒント。タッチ端末のみ、初回入室時のみ 5 秒。 */}
          {showTapHint && !isMobileRoomLayout ? (
            <div className="workspace-tap-hint" role="status">
              <span aria-hidden="true">👆</span>
              {t("床をタップして移動できます")}
            </div>
          ) : null}

          {!isFocusPresentation ? (
            <aside
              className={`workspace-room-overlay ${isOverlayExpanded ? "is-expanded" : "is-collapsed"}`}
              aria-label={t("ルーム情報")}
            >
              <div className="workspace-room-overlay-head">
                <div className="workspace-room-overlay-head-text">
                  <strong className="workspace-room-overlay-name">{roomName}</strong>
                  <span className="workspace-room-overlay-meta">
                    {isJoined ? `${joinedAtLabel}〜 ${currentStayLabel}` : t("未入室")}
                  </span>
                </div>
                {/* Mobile-only expand/collapse toggle. Hidden on
                    desktop via CSS so the full overlay always shows
                    on wider viewports. */}
                <button
                  type="button"
                  className="workspace-room-overlay-toggle"
                  onClick={() => setIsOverlayExpanded((prev) => !prev)}
                  aria-expanded={isOverlayExpanded}
                  aria-label={isOverlayExpanded ? t("ルームメニューを閉じる") : t("ルームメニューを開く")}
                >
                  {isOverlayExpanded ? "×" : "⋯"}
                </button>
              </div>

              {activeRecruitmentSummary ? (
                <div className="workspace-room-overlay-recruitment" role="status">
                  <span>{activeRecruitmentSummary.stateLabel}</span>
                  <span className="workspace-room-overlay-recruitment-count">
                    {t("{count}人", { count: activeRecruitmentSummary.joinedCount })}
                  </span>
                  <button
                    type="button"
                    onClick={activeRecruitmentSummary.onCancel}
                    aria-label={t("募集を取り消す")}
                  >
                    {t("取消")}
                  </button>
                </div>
              ) : null}

              <div className="workspace-room-overlay-task">
                <input
                  value={taskValue}
                  onChange={handleTaskChange}
                  placeholder={t("今やってること")}
                  maxLength={48}
                  list="workspace-learning-items-datalist"
                  aria-label={t("今やってること")}
                />
                <datalist id="workspace-learning-items-datalist">
                  {learningItemSuggestions.map((item) => (
                    <option key={item.id} value={item.name} />
                  ))}
                </datalist>
                {showGhostHint ? (
                  <button
                    type="button"
                    className="workspace-room-overlay-ghost-hint"
                    onClick={() => onLearningItemRegister?.(trimmedTask)}
                  >
                    {t("+ 「{task}」を記録に追加", { task: trimmedTask })}
                  </button>
                ) : null}
              </div>

              <div className="workspace-room-overlay-actions">
                {isJoined ? (
                  <button
                    type="button"
                    className={`workspace-room-overlay-break ${isCurrentUserOnBreak ? "is-active" : ""}`}
                    onClick={() =>
                      onPresetMessage(isCurrentUserOnBreak ? "集中します" : "休憩します")
                    }
                    aria-pressed={isCurrentUserOnBreak}
                  >
                    {isCurrentUserOnBreak ? t("休憩終了") : t("休憩")}
                  </button>
                ) : null}
                {onOpenRecruitmentModal && isJoined && !activeRecruitmentSummary ? (
                  <button
                    type="button"
                    className="workspace-room-overlay-recruit"
                    onClick={onOpenRecruitmentModal}
                  >
                    {t("募集")}
                  </button>
                ) : null}
                {isJoined ? (
                  <button
                    type="button"
                    className="workspace-room-overlay-leave"
                    onClick={onLeave}
                  >
                    {t("退出")}
                  </button>
                ) : null}
              </div>

              {/* コミュニケーション系のクイックアクション。
                  以前は画面右下に "+ メニュー" FAB として浮かせていたが、
                  ステージ上のキャラクターと頻繁に被って "邪魔" になる
                  との報告。ルームカード内に小さなアイコン列として
                  埋め込んで、画面に同居する形に変更。
                  3 つとも親側の handler を呼ぶだけで、popover / トレイ
                  オープン経路は FAB 経由と完全に共通。 */}
              {(onComposeAppearance || (canDropFloorNote && onComposeFloorNote) || visiblePresetMessages.length > 0) ? (
                <div
                  className="workspace-room-overlay-comm"
                  role="group"
                  aria-label={t("ルーム内アクション")}
                >
                  {visiblePresetMessages.length > 0 ? (
                    <button
                      type="button"
                      className={`workspace-room-overlay-comm-button${isPresetTrayOpen ? " is-active" : ""}`}
                      onClick={() => setIsPresetTrayOpen((open) => !open)}
                      aria-pressed={isPresetTrayOpen}
                      aria-label={isPresetTrayOpen ? t("定型文を閉じる") : t("定型文を開く")}
                    >
                      <span aria-hidden="true">💬</span>
                      <small>{t("定型文")}</small>
                    </button>
                  ) : null}
                  {canDropFloorNote && isJoined && onComposeFloorNote ? (
                    <button
                      type="button"
                      className="workspace-room-overlay-comm-button"
                      onClick={onComposeFloorNote}
                      aria-label={t("置き手紙を残す")}
                    >
                      <span aria-hidden="true">✉</span>
                      <small>{t("置き手紙")}</small>
                    </button>
                  ) : null}
                  {onComposeAppearance ? (
                    <button
                      type="button"
                      className="workspace-room-overlay-comm-button"
                      onClick={onComposeAppearance}
                      aria-label={t("分身の見た目を変える")}
                    >
                      <span aria-hidden="true">✦</span>
                      <small>{t("着替え")}</small>
                    </button>
                  ) : null}
                </div>
              ) : null}

              {/* Owner / admin sub-actions. Surfaced inside the overlay
                  so the mobile layout has a single place for room
                  management — the parent's `.workspace-room-canvas-
                  actions` row is hidden at phone widths. The buttons
                  call back into the parent which owns the rename form
                  and delete confirmation. Rename is offered to anyone;
                  delete is gated on canDeleteRoom. */}
              {onRoomRename || onRoomDelete ? (
                <div className="workspace-room-overlay-admin">
                  {onRoomRename ? (
                    <button
                      type="button"
                      className="workspace-room-overlay-admin-button"
                      onClick={() => {
                        setIsOverlayExpanded(false);
                        onRoomRename();
                      }}
                    >
                      {t("名前変更")}
                    </button>
                  ) : null}
                  {onRoomDelete && canDeleteRoom ? (
                    <button
                      type="button"
                      className="workspace-room-overlay-admin-button is-danger"
                      onClick={() => {
                        setIsOverlayExpanded(false);
                        onRoomDelete();
                      }}
                    >
                      {t("解体")}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </aside>
          ) : null}

          {/* 入室トースト。新規入室を 3 秒だけ知らせる。aria-live で SR にも伝える。 */}
          {arrivalToast ? (
            <div
              className="workspace-arrival-toast"
              role="status"
              aria-live="polite"
            >
              <span className="workspace-arrival-toast-dot" aria-hidden="true" />
              {arrivalToast}
            </div>
          ) : null}

          {/* 空状態 ── ステージに自分以外まだ誰もいない時の励まし表示。
              自分が入室済かつ自分しかいない場合のみ。誰もいない PRE-JOIN
              は別ビュー（room-preview）に振り分けられているのでここには来ない。 */}
          {isJoined && members.length <= 1 && presetLog.length === 0 ? (
            <div className="workspace-stage-empty" aria-hidden="true">
              <span className="workspace-stage-empty-dot" />
              <p>{t("静かな部屋。最初のひと言を残してみよう。")}</p>
            </div>
          ) : null}

          {/* Recent-message log. Floats in the top-right corner of the
              stage as a glassy semi-transparent panel so the room
              canvas and avatars remain visible behind it. Hidden when
              the log is empty so the room reads as a quiet space until
              someone speaks. */}
          {presetLog.length > 0 ? (
            <aside
              className="workspace-chat-log"
              aria-label={t("ルームの発言ログ")}
              aria-live="polite"
              aria-atomic="false"
            >
              <p className="workspace-chat-log-title">{t("最近の発言")}</p>
              <ul>
                {presetLog.map((entry, index) => (
                  <li key={entry.id} className={index === 0 ? "is-newest" : ""}>
                    <span
                      className="workspace-chat-log-dot"
                      style={{ background: entry.color || "var(--ink)" }}
                      aria-hidden="true"
                    />
                    <div className="workspace-chat-log-body">
                      <div className="workspace-chat-log-head">
                        <strong>{entry.name}</strong>
                        <span className="workspace-chat-log-time">
                          {formatChatLogTime(entry.at, t)}
                        </span>
                      </div>
                      <p>{entry.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}

          {displayMembers.map((member) => {
            const isCurrentUser = member.userId === currentUserId;
            // Drop-in animation gate: any actor whose `joinedAt` is within
            // the last ~6s gets the `is-just-joined` class, which triggers
            // the CSS `workspace-drop-in` animation on mount. Because the
            // outer element's `key` includes `joinedAt`, a fresh join
            // remounts the actor for *every* subscriber via the Firestore
            // realtime stream — so both the joiner and other members in the
            // room see the drop animation play. Computed inline (rather
            // than tracked in React state) because we don't need to clear
            // the class precisely; the CSS animation has `forwards` fill so
            // the actor settles at the same transform once it completes.
            const isJustJoined =
              Date.now() - new Date(member.joinedAt).getTime() < 6000;
            const actorStyle = {
              "--actor-x": `${member.x}%`,
              "--actor-y": `${member.y}%`,
              "--actor-color": member.characterColor || member.color,
            } as CSSProperties;

            return (
              <button
                type="button"
                key={`${member.userId}-${member.joinedAt}`}
                className={[
                  "workspace-actor",
                  isCurrentUser ? "is-player" : "is-npc",
                  member.status === "on-break" ? "is-resting" : "",
                  isCurrentUser && isPlayerWalking ? "is-walking" : "",
                  isJustJoined ? "is-just-joined" : "",
                ].filter(Boolean).join(" ")}
                style={actorStyle}
                onClick={() => {
                  buzz(12);
                  onMemberOpen(member);
                }}
                aria-label={`${member.name} ${member.currentTask}`}
              >
                {(() => {
                  // Bubble priority: the local user always sees their own
                  // bubble from the (zero-latency) `bubbleMessage` prop —
                  // it would arrive a beat later if we waited for the
                  // Firestore round-trip. For every other actor, render the
                  // synced `member.bubble` when fresh (TTL safety drops
                  // anything older than ~6s in case the originator's
                  // clear-write never lands. The TTL is intentionally
                  // wider than the 3.6s clear-write schedule so a
                  // slow round-trip never drops the bubble before it
                  // had a chance to render — the clear-write itself
                  // is what normally retires the bubble on remote
                  // clients).
                  if (isCurrentUser) {
                    return bubbleMessage ? (
                      <span className="workspace-bubble">{bubbleMessage}</span>
                    ) : null;
                  }
                  if (!member.bubble || !member.bubbleAt) return null;
                  const bubbleMs = new Date(member.bubbleAt).getTime();
                  if (!Number.isFinite(bubbleMs)) return null;
                  if (Date.now() - bubbleMs > 6000) return null;
                  return <span className="workspace-bubble">{member.bubble}</span>;
                })()}
                {member.status === "on-break" ? <span className="actor-rest-mark" aria-hidden="true">Zz</span> : null}
                {(() => {
                  // Focus ring: a calm 12-hour session progress halo at the
                  // actor's feet. Fills clockwise from the top, empty at join.
                  // Hidden only for a member who just joined and is already on
                  // break with no accrued focus.
                  const ring = getActorFocusRing(member);
                  if (ring.progress <= 0 && member.status === "on-break") {
                    return null;
                  }
                  return (
                    <span
                      className={[
                        "actor-focus-ring",
                        member.status === "on-break" ? "is-paused" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={{ "--focus-progress": ring.progress } as CSSProperties}
                      aria-hidden="true"
                    />
                  );
                })()}
                <span className="actor-shadow" />
                <span
                  className={`actor-sprite ${member.tone} shape-${member.characterShape || "default"}`}
                >
                  {member.characterShape === "ghost" ? (
                    /* Ghost shape is drawn as an inline SVG line-art
                       spectre (matches ProfileCharacterPreview). The
                       legacy .sprite-body / .sprite-ghost-hat markup
                       has no CSS under .shape-ghost anymore, so we must
                       NOT emit it here — otherwise the body disappears
                       and only the stray dots/mouth remain visible. */
                    <svg
                      className="ghost-svg"
                      viewBox="0 0 128 140"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <ellipse className="ghost-aura" cx="62" cy="78" rx="52" ry="54" />
                      <path className="ghost-arm" d="M18 86 q-12 2 -16 9 q9 1 17 -2 Z" />
                      <path className="ghost-arm" d="M110 86 q12 2 16 9 q-9 1 -17 -2 Z" />
                      <path
                        className="ghost-body"
                        d="M64 14 C40 14 18 32 17 60 C16 74 16 86 19 98 C21 107 24 116 31 116 C37 116 39 108 45 108 C51 108 53 118 60 118 C66 118 68 107 75 109 C90 113 104 120 116 108 C124 100 121 86 112 88 C106 89 106 96 100 94 C109 86 113 73 112 60 C110 32 88 14 64 14 Z"
                      />
                      <ellipse className="ghost-eye" cx="48" cy="64" rx="5.2" ry="7.4" />
                      <ellipse className="ghost-eye" cx="78" cy="64" rx="5.2" ry="7.4" />
                      <path className="ghost-mouth" d="M52 80 q4 -6 8 0 t8 0" />
                      <g className="ghost-hat" transform="rotate(20 96 30)">
                        <path className="ghost-hat-brim" d="M80 40 h36 v5 h-36 Z" />
                        <path className="ghost-hat-crown" d="M88 14 h20 v26 h-20 Z" />
                        <rect className="ghost-hat-band" x="88" y="33" width="20" height="4" />
                      </g>
                    </svg>
                  ) : member.characterShape === "owl" ? (
                    /* 宵 (Yoi) は朧と同じ line-art 語彙で統一済みの共有
                       renderer を呼ぶ。CSS sprite 版を撤去して
                       preview / atelier / room すべてで同じ絵にする。 */
                    renderOwlSvg(member.color || "#7667a8")
                  ) : member.characterShape === "robo" ? (
                    /* 煌 (Kō) — 共有 SVG。固定パレットなのでカラーは無視。 */
                    renderRoboSvg(member.color || "#7667a8")
                  ) : member.characterShape === "angel" ? (
                    /* 凜 (Rin) — 共有 SVG。固定パレットなのでカラーは無視。 */
                    renderAngelSvg(member.color || "#7667a8")
                  ) : (
                    /* "default" (相 / 緑キューブ + face panel + 足):
                       preview と同じ共有 SVG を出して見た目を統一する。
                       stage の sprite サイズは @media で clamp(44, 13vw, 68)
                       に拡張済みなので識別可能。 */
                    <>
                      {renderDefaultCharacterSvg(member.color || "#7667a8", { showEdges: false })}
                      {/* 残り (旧 span 構造) は dummy で出さない。
                          以下のコメントは将来別 shape を足す時の場所取り。 */}
                      {/* SVG の morph
                          見え方は profile / shop / settings preview に
                          限定する。 */}
                    </>
                  )}
                </span>
                <span className="actor-name">{member.name}</span>
                <span className="actor-task">
                  <strong>{member.currentTask}</strong>
                  <small>{getActorStayLabel(member, t)}</small>
                </span>
              </button>
            );
          })}

          {/* Milestone monuments — small stones standing in the room as a
              quiet record of members' achievements. Rendered behind actors
              via CSS z-index so they read as part of the scenery. */}
          {monuments.map((monument) => (
            <button
              type="button"
              key={monument.id}
              className="workspace-monument"
              style={
                {
                  "--actor-x": `${monument.x}%`,
                  "--actor-y": `${monument.y}%`,
                  "--actor-color": monument.color || "var(--ink)",
                } as CSSProperties
              }
              onClick={() => {
                buzz(10);
                onMonumentOpen?.(monument.id);
              }}
              aria-label={monument.label}
              title={monument.label}
            >
              <span className="workspace-monument-stone" aria-hidden="true">
                <span className="workspace-monument-icon">{monument.icon}</span>
              </span>
            </button>
          ))}

          {/* Floor notes — 置き手紙 left on the floor. Unread ones glow so
              the next person to enter notices them. */}
          {floorNotes.map((note) => (
            <button
              type="button"
              key={note.id}
              className={[
                "workspace-floor-note",
                note.isUnread ? "is-unread" : "",
                note.isMine ? "is-mine" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={
                {
                  "--actor-x": `${note.x}%`,
                  "--actor-y": `${note.y}%`,
                  "--actor-color": note.color || "var(--ink)",
                } as CSSProperties
              }
              onClick={() => {
                buzz(10);
                onFloorNoteOpen?.(note.id);
              }}
              aria-label={t("{name}さんの置き手紙", { name: note.name })}
              title={t("{name}さんの置き手紙", { name: note.name })}
            >
              <span className="workspace-floor-note-icon" aria-hidden="true">
                ✉
              </span>
              {note.isUnread ? (
                <span className="workspace-floor-note-badge" aria-hidden="true" />
              ) : null}
            </button>
          ))}

          {/* In-stage compact profile popover. Anchored near the tapped
              actor so the room context stays visible behind it.
              重要：popover は React Portal で document.body 直下に
              レンダーする。stage 内の overflow:hidden / z-index 競合 /
              stacking context の不整合の影響を完全に排除でき、Android
              系の端末でも popover 内のタップが確実に届く。 */}
          {selectedMemberId && memberPanel
            ? (() => {
                const target = members.find((m) => m.userId === selectedMemberId);
                const popoverContent = !target ? (
                  <>
                    <button
                      type="button"
                      className="workspace-popover-backdrop"
                      aria-label={t("閉じる")}
                      onClick={onPanelClose}
                    />
                    <div
                      className="workspace-stage-popover workspace-member-popover is-centered"
                      role="dialog"
                      aria-modal="true"
                    >
                      {memberPanel}
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="workspace-popover-backdrop"
                      aria-label={t("閉じる")}
                      onClick={onPanelClose}
                    />
                    <div
                      className={[
                        "workspace-stage-popover",
                        "workspace-member-popover",
                        target.x > 55 ? "anchor-right" : "",
                        target.y < 42 ? "anchor-below" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={
                        {
                          "--anchor-x": `${target.x}%`,
                          "--anchor-y": `${target.y}%`,
                        } as CSSProperties
                      }
                      role="dialog"
                      aria-modal="true"
                    >
                      {memberPanel}
                    </div>
                  </>
                );
                return typeof document !== "undefined"
                  ? createPortal(popoverContent, document.body)
                  : popoverContent;
              })()
            : null}

          {/* Floor-note detail / compose popover (centered, Portal化). */}
          {floorNotePanel && typeof document !== "undefined"
            ? createPortal(
                <>
                  <button
                    type="button"
                    className="workspace-popover-backdrop"
                    aria-label={t("閉じる")}
                    onClick={onPanelClose}
                  />
                  <div
                    className="workspace-stage-popover workspace-note-popover is-centered"
                    role="dialog"
                    aria-modal="true"
                  >
                    {floorNotePanel}
                  </div>
                </>,
                document.body,
              )
            : null}

          {/* Monument detail popover (centered, Portal化). */}
          {monumentPanel && typeof document !== "undefined"
            ? createPortal(
                <>
                  <button
                    type="button"
                    className="workspace-popover-backdrop"
                    aria-label={t("閉じる")}
                    onClick={onPanelClose}
                  />
                  <div
                    className="workspace-stage-popover workspace-monument-popover is-centered"
                    role="dialog"
                    aria-modal="true"
                  >
                    {monumentPanel}
                  </div>
                </>,
                document.body,
              )
            : null}

          {/* 分身の着替えポップオーバー (centered, Portal化). */}
          {appearancePanel && typeof document !== "undefined"
            ? createPortal(
                <>
                  <button
                    type="button"
                    className="workspace-popover-backdrop"
                    aria-label={t("閉じる")}
                    onClick={onPanelClose}
                  />
                  <div
                    className="workspace-stage-popover workspace-appearance-popover is-centered"
                    role="dialog"
                    aria-modal="true"
                  >
                    {appearancePanel}
                  </div>
                </>,
                document.body,
              )
            : null}
        </div>

        {/* モバイル「みんな」タブ：在室者を縦カードで一覧 + チャット。
            自分の状態 / 操作は「自分」タブに分離。 */}
        <div className="workspace-mobile-panel workspace-mobile-people" role="tabpanel" aria-label={t("在室者")}>
          <div className="workspace-mobile-panel-head">
            {isEditingRoomName && canRenameRoom && onRenameRoom ? (
              <form
                className="workspace-room-rename-form"
                onSubmit={handleSubmitRenameRoom}
              >
                <input
                  autoFocus
                  value={roomNameDraft}
                  onChange={(event) => setRoomNameDraft(event.target.value)}
                  maxLength={32}
                  aria-label={t("新しい部屋名を入力")}
                  placeholder={t("新しい部屋名を入力")}
                />
                <button type="submit" className="workspace-room-rename-save">
                  {t("保存")}
                </button>
                <button
                  type="button"
                  className="workspace-room-rename-cancel"
                  onClick={handleCancelRenameRoom}
                >
                  {t("取消")}
                </button>
              </form>
            ) : (
              <>
                <div className="workspace-mobile-panel-head-title">
                  <strong>{roomName}</strong>
                  {canRenameRoom && onRenameRoom ? (
                    <button
                      type="button"
                      className="workspace-room-rename-btn"
                      onClick={handleStartRenameRoom}
                      aria-label={t("部屋名を変更")}
                      title={t("部屋名を変更")}
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                        <path
                          d="M4 20h4l10-10-4-4L4 16v4Z M14 6l4 4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  ) : null}
                </div>
                <span>{members.length > 0 ? t("{count}人が作業中", { count: members.length }) : t("まだ誰もいません")}</span>
              </>
            )}
          </div>
          <ul className="workspace-people-list">
            {members.length === 0 ? (
              <li className="workspace-people-empty">
                {t("まだ誰もいません。最初の一人になりましょう。")}
              </li>
            ) : (
              members.map((member) => {
                const isMe = member.userId === currentUserId;
                const onBreak = member.status === "on-break";
                const task = member.currentTask?.trim();
                return (
                  <li key={member.id}>
                    <button
                      type="button"
                      className="workspace-people-card"
                      onClick={() => onMemberOpen(member)}
                    >
                      <span
                        className={`workspace-people-avatar shape-${member.characterShape || "default"}`}
                        style={{ "--people-color": member.characterColor || member.color } as CSSProperties}
                        aria-hidden="true"
                      >
                        {/* 投稿カード avatar と統一: キャラ shape + カラーで描画。
                            default / morph / ghost / owl すべて共有 SVG
                            renderer で出すので、文字 initial への fallback は
                            shape が予期外の値だった時の最終手段としてだけ残す。 */}
                        {member.characterShape === "default" ? (
                          renderDefaultCharacterSvg(member.characterColor || member.color, {
                            showEdges: false,
                          })
                        ) : member.characterShape === "ghost" ? (
                          renderGhostSvg(member.characterColor || member.color)
                        ) : member.characterShape === "owl" ? (
                          renderOwlSvg(member.characterColor || member.color)
                        ) : (
                          <span className="workspace-people-avatar-initial">
                            {member.name.slice(0, 1)}
                          </span>
                        )}
                      </span>
                      <span className="workspace-people-text">
                        <span className="workspace-people-name">
                          {member.name}
                          {isMe ? t("（あなた）") : ""}
                        </span>
                        <span className="workspace-people-task">{task || "—"}</span>
                      </span>
                      <span className="workspace-people-meta">
                        <span className={`workspace-people-status${onBreak ? " is-break" : ""}`}>
                          {onBreak ? t("休憩中") : t("集中")}
                        </span>
                        <span className="workspace-people-stay">{getActorStayLabel(member, t)}</span>
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          {/* 「みんな」タブのリスト直下にルームチャット。
              不適切ワードは送信前に親側でブロック。 */}
          {onChatSend ? (
            <RoomChatPanel
              messages={chatMessages}
              error={chatError}
              onSend={onChatSend}
              currentUserId={currentUserId}
            />
          ) : null}
        </div>

        {/* モバイル「自分」タブ。大人らしい集中空間として再設計。
            上から: 在室時計 (display) → 取り組み入力 → ポモドーロ →
            募集ステータス/CTA → 退出。アイコンは絵文字を使わず line-art SVG。 */}
        <div className="workspace-mobile-panel workspace-mobile-me" role="tabpanel" aria-label={t("自分の操作")}>
          {/* ── 在室時計カード ───────────────────────────────────── */}
          <div className="me-card me-card--clock" data-state={isCurrentUserOnBreak ? "break" : isJoined ? "focus" : "idle"}>
            <div className="me-card-head">
              <span className="me-card-eyebrow">{roomName}</span>
              <span className={`me-status-pill${isCurrentUserOnBreak ? " is-break" : ""}`}>
                <span className="me-status-pill-dot" aria-hidden="true" />
                {isJoined
                  ? isCurrentUserOnBreak
                    ? t("休憩中")
                    : t("集中")
                  : t("未入室")}
              </span>
            </div>
            <div className="me-clock-main">
              <span className="me-clock-time">
                {isJoined ? currentStayLabel : "—"}
              </span>
              {isJoined ? (
                <span className="me-clock-from">
                  {t("入室")} {joinedAtLabel}
                </span>
              ) : null}
            </div>
            {isJoined ? (
              <button
                type="button"
                className={`me-pill-button${isCurrentUserOnBreak ? " is-active" : ""}`}
                onClick={() =>
                  onPresetMessage(isCurrentUserOnBreak ? "集中します" : "休憩します")
                }
                aria-pressed={isCurrentUserOnBreak}
              >
                {isCurrentUserOnBreak ? t("集中に戻る") : t("休憩する")}
              </button>
            ) : null}
          </div>

          {/* ── 取り組みカード ───────────────────────────────────── */}
          <div className="me-card">
            <label className="me-field">
              <span className="me-card-eyebrow">{t("今、取り組んでいること")}</span>
              <input
                className="me-field-input"
                value={taskValue}
                onChange={handleTaskChange}
                placeholder={t("例: 認可ロジックの設計")}
                maxLength={48}
                aria-label={t("今やってること")}
              />
            </label>
            {showGhostHint ? (
              <button
                type="button"
                className="me-ghost-hint"
                onClick={() => onLearningItemRegister?.(trimmedTask)}
              >
                {t("「{task}」を記録に追加", { task: trimmedTask })}
              </button>
            ) : null}

            {/* 募集 — タスクカードの中に sub-action として埋める。
                タスクと意味的に近い (今やってる事に共感する人を呼ぶ) ので
                ここが自然な置き場所。slim な row 1 行で重さを出さない。 */}
            {activeRecruitmentSummary ? (
              <div className="me-recruit-row me-recruit-row--active" role="status">
                <span className="me-recruit-row-icon" aria-hidden="true">
                  <PeopleIcon />
                </span>
                <span className="me-recruit-row-text">
                  <strong>{t("募集中")}</strong>
                  <small>
                    {activeRecruitmentSummary.stateLabel} ·{" "}
                    {t("{count}人", { count: activeRecruitmentSummary.joinedCount })}
                  </small>
                </span>
                <button
                  type="button"
                  className="me-recruit-row-cancel"
                  onClick={activeRecruitmentSummary.onCancel}
                >
                  {t("取消")}
                </button>
              </div>
            ) : isJoined && onOpenRecruitmentModal ? (
              <button
                type="button"
                className="me-recruit-row"
                onClick={onOpenRecruitmentModal}
              >
                <span className="me-recruit-row-icon" aria-hidden="true">
                  <PeopleIcon />
                </span>
                <span className="me-recruit-row-text">
                  <strong>{t("仲間を募集")}</strong>
                  <small>{t("同じ作業に共感する人を呼ぶ")}</small>
                </span>
                <span className="me-recruit-row-arrow" aria-hidden="true">→</span>
              </button>
            ) : null}
          </div>

          {/* ── ポモドーロカード ────────────────────────────────── */}
          {isJoined ? (
            <div className="me-card me-card--pomo" data-pomo-mode={pomoMode}>
              <div className="me-card-head">
                <span className="me-card-eyebrow">{t("ポモドーロ")}</span>
                <span className="me-pomo-meta">
                  {pomoMode === "work" ? t("集中フェーズ") : t("休息フェーズ")} · {t("{n}周目", { n: pomoSet })}
                </span>
              </div>
              <div className="me-pomo-main">
                <svg className="me-pomo-ring" viewBox="0 0 100 100" aria-hidden="true">
                  <circle
                    className="me-pomo-ring-track"
                    cx="50"
                    cy="50"
                    r="44"
                  />
                  <circle
                    className="me-pomo-ring-fill"
                    cx="50"
                    cy="50"
                    r="44"
                    style={{
                      strokeDasharray: `${2 * Math.PI * 44}`,
                      strokeDashoffset: `${2 * Math.PI * 44 * (1 - pomoProgress)}`,
                    }}
                  />
                </svg>
                <div className="me-pomo-time">
                  <span>{pomoMM}</span>
                  <span className="me-pomo-time-sep">:</span>
                  <span>{pomoSS}</span>
                </div>
              </div>
              <div className="me-pomo-actions">
                <button
                  type="button"
                  className="me-pill-button me-pill-button--primary"
                  onClick={handlePomoToggle}
                >
                  {pomoRunning ? t("一時停止") : t("開始")}
                </button>
                <button
                  type="button"
                  className="me-pill-button me-pill-button--ghost"
                  onClick={handlePomoReset}
                >
                  {t("リセット")}
                </button>
              </div>
            </div>
          ) : null}

          {/* ── 退出 (subtle) ───────────────────────────────────── */}
          {isJoined ? (
            <button type="button" className="me-leave-ghost" onClick={onLeave}>
              {t("退出する")}
            </button>
          ) : null}
        </div>

        {/* 下部 HUD：FAB スピードダイヤル + 定型文トレイ。
            通常時は右下に "+" 1 つだけ。タップで「定型文・置き手紙・着替え」
            が縦に展開。各アクション選択で HUD は自動で閉じる。
            重要：popover 開放中は HUD 自体を DOM から消し、その他の時は
            React Portal で document.body 直下にレンダーする。
            これにより：
            1) popover との重なりを完全防止
            2) 祖先の overflow:clip / transform / contain による
               position:fixed の "containing block" 変更を回避し、
               viewport 相対の右下固定を確実にする */}
        {hasOpenPopover || typeof document === "undefined"
          ? null
          : createPortal(
              <div
                className={[
                  "preset-message-panel",
                  "hud-fab",
                  isHudOpen ? "is-hud-open" : "",
                  isPresetTrayOpen ? "is-open" : "",
                  // モバイルで「みんな/自分」タブは常に FAB を隠す
                  // (操作は「自分」タブに集約)。PC では mobileTab は
                  // どのみち使わないので no-op。
                  isPhone ? "is-hidden-by-tab" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
          {/* HUD 展開時のバックドロップ。タップで HUD を閉じる。 */}
          {isHudOpen ? (
            <button
              type="button"
              className="hud-fab-backdrop"
              aria-label={t("メニューを閉じる")}
              onClick={() => {
                setIsHudOpen(false);
                setIsPresetTrayOpen(false);
                setIsPresetEditorOpen(false);
              }}
            />
          ) : null}

          {/* スピードダイヤル展開時に上に出現する 3 アクション。
              閉じた状態では DOM に存在するが CSS で hidden + scale 0。
              展開時のみ visible + scale 1 + 順にフェードイン。 */}
          <div className="hud-fab-actions" aria-hidden={!isHudOpen}>
            <button
              type="button"
              className="hud-fab-action hud-fab-action-preset"
              onClick={() => {
                setIsPresetTrayOpen((isOpen) => !isOpen);
              }}
              aria-pressed={isPresetTrayOpen}
              aria-label={isPresetTrayOpen ? t("定型文を閉じる") : t("定型文を開く")}
              tabIndex={isHudOpen ? 0 : -1}
            >
              <span className="hud-fab-action-icon" aria-hidden="true">💬</span>
              <span>{isPresetTrayOpen ? t("定型文を閉じる") : t("定型文")}</span>
            </button>
            {canDropFloorNote && isJoined && onComposeFloorNote ? (
              <button
                type="button"
                className="hud-fab-action hud-fab-action-note"
                onClick={() => {
                  setIsHudOpen(false);
                  onComposeFloorNote();
                }}
                aria-label={t("置き手紙を残す")}
                tabIndex={isHudOpen ? 0 : -1}
              >
                <span className="hud-fab-action-icon" aria-hidden="true">✉</span>
                <span>{t("置き手紙を残す")}</span>
              </button>
            ) : null}
            {onComposeAppearance ? (
              <button
                type="button"
                className="hud-fab-action hud-fab-action-appearance"
                onClick={() => {
                  setIsHudOpen(false);
                  onComposeAppearance();
                }}
                aria-label={t("分身の見た目を変える")}
                tabIndex={isHudOpen ? 0 : -1}
              >
                <span className="hud-fab-action-icon" aria-hidden="true">✦</span>
                <span>{t("着替え")}</span>
              </button>
            ) : null}
          </div>

          {/* 本体の FAB ボタン（右下）。アイコン「+」+ ラベル「メニュー」を
              並べたピル型。閉じた時は「+ メニュー」、開いた時は CSS で
              「+」が 45 度回転して「×」に見え、ラベルは「閉じる」に変わる
              （::after で切替）。 */}
          <button
            type="button"
            className="hud-fab-toggle"
            onClick={() => setIsHudOpen((open) => !open)}
            aria-expanded={isHudOpen}
            aria-label={isHudOpen ? t("メニューを閉じる") : t("操作メニューを開く")}
          >
            <span aria-hidden="true" className="hud-fab-toggle-icon">
              +
            </span>
          </button>

          {/* 定型文展開エリア。HUD action から開かれる。
              PC でも従来どおり表示されるが、モバイルでは FAB の上に
              スライドアップする ボトムシート風に CSS 側で再配置。 */}
          {isPresetTrayOpen ? (
            <div className="preset-message-bar" aria-label={t("定型コミュニケーション")}>
              {visiblePresetMessages.map((message, index) => (
                <button
                  type="button"
                  key={`${message}-${index}`}
                  onClick={() => onPresetMessage(message)}
                  disabled={!isJoined}
                  title={t("{message} ({key} キーで送信)", { message: t(message), key: index + 1 })}
                >
                  <kbd className="preset-key-hint" aria-hidden="true">{index + 1}</kbd>
                  <span className="preset-message-text">{t(message)}</span>
                </button>
              ))}
              <button
                type="button"
                className="preset-edit-button"
                onClick={() => setIsPresetEditorOpen((isOpen) => !isOpen)}
              >
                {isPresetEditorOpen ? t("閉じる") : t("定型文編集")}
              </button>
            </div>
          ) : null}

          {isPresetTrayOpen && isPresetEditorOpen ? (
            <div className="preset-message-editor" aria-label={t("定型文編集")}>
              {presetSlots.map((message, index) => (
                <label key={`preset-slot-${index}`}>
                  <span>{index + 1}</span>
                  <input
                    value={message}
                    onChange={(event) => handlePresetChange(index, event.target.value)}
                    placeholder={t("定型文を入力")}
                    maxLength={24}
                  />
                </label>
              ))}
            </div>
          ) : null}
        </div>,
              document.body,
            )}
      </div>

    </div>
  );
}
