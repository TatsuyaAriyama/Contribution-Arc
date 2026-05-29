import { useEffect, useState, type CSSProperties, type ChangeEvent, type ReactNode } from "react";

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

export type CharacterShape = "default" | "ghost" | "owl";

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
  onResetPresence: () => void;
  presetMessages: string[];
  onPresetMessagesChange: (messages: string[]) => void;
  onPresetMessage: (message: string) => void;
  bubbleMessage: string;
  /* Recent-bubble log surfaced next to the stage. Lets the user catch
     up on what was said even after the per-actor bubbles have faded.
     Newest entry first; the parent caps the list (~12). */
  presetLog?: PresetLogEntry[];
  isPlayerWalking: boolean;
  activityItems: RoomActivityItem[];
  onMemberOpen: (member: RoomActor) => void;
  onActivityOpen: (item: RoomActivityItem) => void;
  /* In-stage compact profile popover. When `selectedMemberId` matches a
     member, `memberPanel` is rendered as a small card anchored near that
     member's avatar (instead of navigating to the full profile screen).
     `onMemberPanelClose` dismisses it; the backdrop calls it too. */
  selectedMemberId?: string | null;
  memberPanel?: ReactNode;
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
  lastSessionLabel: string;
  totalLearnedLabel: string;
  contributionLabel: string;
  learningItemSuggestions?: LearningItemSuggestion[];
  recentLearningItemIds?: string[];
  onLearningItemRegister?: (presetName: string) => void;
  onOpenRecruitmentModal?: () => void;
  activeRecruitmentSummary?: ActiveRecruitmentSummary | null;
  /* Mobile overlay menu actions. The parent owns the rename form +
     delete confirmation; this component just surfaces the buttons
     inside the in-stage overlay so mobile users have a single
     place to manage the room. */
  onRoomRename?: () => void;
  onRoomDelete?: () => void;
  canDeleteRoom?: boolean;
};

function formatChatLogTime(atMs: number) {
  const diffSec = Math.max(0, Math.floor((Date.now() - atMs) / 1000));
  if (diffSec < 5) return "今";
  if (diffSec < 60) return `${diffSec}秒前`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}時間前`;
  return `${Math.floor(diffHr / 24)}日前`;
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

function getActorStayLabel(member: RoomActor) {
  if (member.status === "on-break") {
    return "休憩中";
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
  onResetPresence,
  presetMessages,
  onPresetMessagesChange,
  onPresetMessage,
  bubbleMessage,
  presetLog = [],
  isPlayerWalking,
  activityItems,
  onMemberOpen,
  onActivityOpen,
  selectedMemberId = null,
  memberPanel,
  floorNotes = [],
  onFloorNoteOpen,
  onComposeFloorNote,
  canDropFloorNote = false,
  floorNotePanel,
  monuments = [],
  onMonumentOpen,
  monumentPanel,
  onPanelClose,
  lastSessionLabel,
  contributionLabel,
  learningItemSuggestions = [],
  recentLearningItemIds = [],
  onLearningItemRegister,
  onOpenRecruitmentModal,
  activeRecruitmentSummary = null,
  onRoomRename,
  onRoomDelete,
  canDeleteRoom = false,
}: SilentWorkspaceRoomProps) {
  const isFocusPresentation = presentation === "focus";
  const [isPresetEditorOpen, setIsPresetEditorOpen] = useState(false);
  const [isPresetTrayOpen, setIsPresetTrayOpen] = useState(false);
  // Mobile-only expand toggle for the in-stage room overlay. Desktop
  // CSS ignores this and always shows the full overlay; on phones the
  // overlay starts collapsed to a single-line pill (room name + meta)
  // and expands to show the task input + actions when ⋯ is tapped.
  const [isOverlayExpanded, setIsOverlayExpanded] = useState(false);
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
    const id = window.setInterval(() => setRingTick((t) => t + 1), 60000);
    return () => window.clearInterval(id);
  }, [members.length]);
  const presetSlots = [...presetMessages, "", "", "", "", "", ""].slice(0, 6);
  const visiblePresetMessages = presetSlots.map((message) => message.trim()).filter(Boolean);
  const currentMember = members.find((member) => member.userId === currentUserId);
  const isCurrentUserOnBreak = currentMember?.status === "on-break";

  const handleTaskChange = (event: ChangeEvent<HTMLInputElement>) => {
    onTaskChange(event.target.value);
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
            <p className="room-preview-kicker">作業部屋</p>
            <h3 className="room-preview-title">{roomName}</h3>
          </header>

          <div className="room-preview-members" aria-label="作業中のメンバー">
            {previewMembers.length > 0 ? (
              <div className="room-preview-avatar-stack">
                {previewMembers.map((member) => (
                  <span
                    key={member.userId}
                    className="room-preview-avatar"
                    style={{ "--actor-color": member.characterColor || member.color } as CSSProperties}
                    title={member.name}
                  >
                    {member.avatar ? (
                      <img src={member.avatar} alt="" />
                    ) : (
                      <span>{(member.name?.charAt(0) || "?").toUpperCase()}</span>
                    )}
                  </span>
                ))}
                {extraMembers > 0 ? (
                  <span className="room-preview-avatar room-preview-avatar-more">
                    +{extraMembers}
                  </span>
                ) : null}
              </div>
            ) : null}
            <span className="room-preview-count">
              {members.length > 0 ? `${members.length}人が作業中` : "まだ誰もいません"}
            </span>
          </div>

          <label className="room-preview-task-field">
            <span>今やってること</span>
            <input
              value={taskValue}
              onChange={handleTaskChange}
              placeholder="作業内容を入力"
              maxLength={48}
            />
          </label>

          <button type="button" className="room-preview-join" onClick={onJoin}>
            入室する
          </button>
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

  return (
    <div className={`workspace-2d-shell ${isFocusPresentation ? "focus-presentation" : ""}`}>
      <div className="workspace-2d-main">
        <div className="workspace-stage" aria-label="Silent workspace">
          <div className="workspace-floor-grid" aria-hidden="true" />

          {!isFocusPresentation ? (
            <aside
              className={`workspace-room-overlay ${isOverlayExpanded ? "is-expanded" : "is-collapsed"}`}
              aria-label="ルーム情報"
            >
              <div className="workspace-room-overlay-head">
                <div className="workspace-room-overlay-head-text">
                  <strong className="workspace-room-overlay-name">{roomName}</strong>
                  <span className="workspace-room-overlay-meta">
                    {isJoined ? `${joinedAtLabel}〜 ${currentStayLabel}` : "未入室"}
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
                  aria-label={isOverlayExpanded ? "ルームメニューを閉じる" : "ルームメニューを開く"}
                >
                  {isOverlayExpanded ? "×" : "⋯"}
                </button>
              </div>

              {activeRecruitmentSummary ? (
                <div className="workspace-room-overlay-recruitment" role="status">
                  <span>{activeRecruitmentSummary.stateLabel}</span>
                  <span className="workspace-room-overlay-recruitment-count">
                    {activeRecruitmentSummary.joinedCount}人
                  </span>
                  <button
                    type="button"
                    onClick={activeRecruitmentSummary.onCancel}
                    aria-label="募集を取り消す"
                  >
                    取消
                  </button>
                </div>
              ) : null}

              <div className="workspace-room-overlay-task">
                <input
                  value={taskValue}
                  onChange={handleTaskChange}
                  placeholder="今やってること"
                  maxLength={48}
                  list="workspace-learning-items-datalist"
                  aria-label="今やってること"
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
                    + 「{trimmedTask}」を記録に追加
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
                    {isCurrentUserOnBreak ? "休憩終了" : "休憩"}
                  </button>
                ) : null}
                {onOpenRecruitmentModal && isJoined && !activeRecruitmentSummary ? (
                  <button
                    type="button"
                    className="workspace-room-overlay-recruit"
                    onClick={onOpenRecruitmentModal}
                  >
                    募集
                  </button>
                ) : null}
                {isJoined ? (
                  <button
                    type="button"
                    className="workspace-room-overlay-leave"
                    onClick={onLeave}
                  >
                    退出
                  </button>
                ) : null}
              </div>

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
                      名前変更
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
                      解体
                    </button>
                  ) : null}
                </div>
              ) : null}
            </aside>
          ) : null}

          {/* Recent-message log. Floats in the top-right corner of the
              stage as a glassy semi-transparent panel so the room
              canvas and avatars remain visible behind it. Hidden when
              the log is empty so the room reads as a quiet space until
              someone speaks. */}
          {presetLog.length > 0 ? (
            <aside className="workspace-chat-log" aria-label="ルームの発言ログ">
              <p className="workspace-chat-log-title">最近の発言</p>
              <ul>
                {presetLog.map((entry) => (
                  <li key={entry.id}>
                    <span
                      className="workspace-chat-log-dot"
                      style={{ background: entry.color || "var(--ink)" }}
                      aria-hidden="true"
                    />
                    <div className="workspace-chat-log-body">
                      <div className="workspace-chat-log-head">
                        <strong>{entry.name}</strong>
                        <span className="workspace-chat-log-time">
                          {formatChatLogTime(entry.at)}
                        </span>
                      </div>
                      <p>{entry.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}

          {members.map((member) => {
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
                onClick={() => onMemberOpen(member)}
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
                  ) : (
                    <>
                      <span className="sprite-body" />
                      <span className="sprite-leg sprite-leg-left" />
                      <span className="sprite-leg sprite-leg-right" />
                      {/* Owl-only parts. Rendered only when the owl shape
                          is active so the head-turn animation has a target
                          to drive without affecting other silhouettes. */}
                      {member.characterShape === "owl" ? (
                        <>
                          <span className="sprite-head">
                            <span className="sprite-tuft sprite-tuft-left" />
                            <span className="sprite-tuft sprite-tuft-right" />
                            <span className="sprite-owl-eye sprite-owl-eye-left" />
                            <span className="sprite-owl-eye sprite-owl-eye-right" />
                            <span className="sprite-beak" />
                          </span>
                          <span className="sprite-wing sprite-wing-left" />
                          <span className="sprite-wing sprite-wing-right" />
                        </>
                      ) : null}
                    </>
                  )}
                </span>
                <span className="actor-name">{member.name}</span>
                <span className="actor-task">
                  <strong>{member.currentTask}</strong>
                  <small>{getActorStayLabel(member)}</small>
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
              onClick={() => onMonumentOpen?.(monument.id)}
              aria-label={monument.label}
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
              onClick={() => onFloorNoteOpen?.(note.id)}
              aria-label={`${note.name}さんの置き手紙`}
            >
              <span className="workspace-floor-note-icon" aria-hidden="true">
                ✉
              </span>
            </button>
          ))}

          {/* In-stage compact profile popover. Anchored near the tapped
              actor so the room context stays visible behind it. */}
          {selectedMemberId && memberPanel
            ? (() => {
                const target = members.find((m) => m.userId === selectedMemberId);
                const anchorX = target ? target.x : 50;
                const anchorY = target ? target.y : 50;
                return (
                  <>
                    <button
                      type="button"
                      className="workspace-popover-backdrop"
                      aria-label="閉じる"
                      onClick={onPanelClose}
                    />
                    <div
                      className={[
                        "workspace-stage-popover",
                        "workspace-member-popover",
                        anchorX > 55 ? "anchor-right" : "",
                        anchorY < 42 ? "anchor-below" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={
                        {
                          "--anchor-x": `${anchorX}%`,
                          "--anchor-y": `${anchorY}%`,
                        } as CSSProperties
                      }
                      role="dialog"
                      aria-modal="true"
                    >
                      {memberPanel}
                    </div>
                  </>
                );
              })()
            : null}

          {/* Floor-note detail / compose popover (centered). */}
          {floorNotePanel ? (
            <>
              <button
                type="button"
                className="workspace-popover-backdrop"
                aria-label="閉じる"
                onClick={onPanelClose}
              />
              <div
                className="workspace-stage-popover workspace-note-popover is-centered"
                role="dialog"
                aria-modal="true"
              >
                {floorNotePanel}
              </div>
            </>
          ) : null}

          {/* Monument detail popover (centered). */}
          {monumentPanel ? (
            <>
              <button
                type="button"
                className="workspace-popover-backdrop"
                aria-label="閉じる"
                onClick={onPanelClose}
              />
              <div
                className="workspace-stage-popover workspace-monument-popover is-centered"
                role="dialog"
                aria-modal="true"
              >
                {monumentPanel}
              </div>
            </>
          ) : null}
        </div>

        <div className={`preset-message-panel ${isPresetTrayOpen ? "is-open" : ""}`}>
          <div className="preset-toggle-row">
            {/* 休憩 toggle was moved into the in-stage room overlay
                (top-left) where it sits next to the other room actions.
                Keeping the preset-message panel for the chat-toggle and
                preset bar only. */}
            <button
              type="button"
              className="preset-chat-toggle"
              onClick={() => setIsPresetTrayOpen((isOpen) => !isOpen)}
              aria-expanded={isPresetTrayOpen}
              aria-label={isPresetTrayOpen ? "定型文を閉じる" : "定型文を開く"}
            >
              <span aria-hidden="true" />
              <strong>{isPresetTrayOpen ? "閉じる" : "定型文"}</strong>
            </button>
            {canDropFloorNote && isJoined && onComposeFloorNote ? (
              <button
                type="button"
                className="floor-note-drop-button"
                onClick={onComposeFloorNote}
                aria-label="置き手紙を残す"
              >
                <span aria-hidden="true">✉</span>
                <strong>置き手紙</strong>
              </button>
            ) : null}
          </div>

          {isPresetTrayOpen ? (
            <div className="preset-message-bar" aria-label="定型コミュニケーション">
              {visiblePresetMessages.map((message, index) => (
                <button type="button" key={`${message}-${index}`} onClick={() => onPresetMessage(message)} disabled={!isJoined}>
                  {message}
                </button>
              ))}
              <button
                type="button"
                className="preset-edit-button"
                onClick={() => setIsPresetEditorOpen((isOpen) => !isOpen)}
              >
                {isPresetEditorOpen ? "閉じる" : "定型文編集"}
              </button>
            </div>
          ) : null}

          {isPresetTrayOpen && isPresetEditorOpen ? (
            <div className="preset-message-editor" aria-label="定型文編集">
              {presetSlots.map((message, index) => (
                <label key={`preset-slot-${index}`}>
                  <span>{index + 1}</span>
                  <input
                    value={message}
                    onChange={(event) => handlePresetChange(index, event.target.value)}
                    placeholder="定型文を入力"
                    maxLength={24}
                  />
                </label>
              ))}
            </div>
          ) : null}
        </div>
      </div>

    </div>
  );
}
