import { useEffect, useState, type CSSProperties, type ChangeEvent } from "react";

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
  lastSessionLabel: string;
  totalLearnedLabel: string;
  contributionLabel: string;
  learningItemSuggestions?: LearningItemSuggestion[];
  recentLearningItemIds?: string[];
  onLearningItemRegister?: (presetName: string) => void;
  onOpenRecruitmentModal?: () => void;
  activeRecruitmentSummary?: ActiveRecruitmentSummary | null;
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

function getActorStayLabel(member: RoomActor) {
  if (member.status === "on-break") {
    return "休憩中";
  }

  const minutes =
    typeof member.accumulatedActiveMinutes === "number"
      ? Math.max(
          1,
          Math.floor(
            member.accumulatedActiveMinutes +
              (member.activeStartedAt ? (Date.now() - new Date(member.activeStartedAt).getTime()) / 60000 : 0),
          ),
        )
      : Math.max(1, Math.floor((Date.now() - new Date(member.joinedAt).getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours <= 0) {
    return `${restMinutes}m`;
  }

  return restMinutes > 0 ? `${hours}h ${restMinutes}m` : `${hours}h`;
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
  lastSessionLabel,
  contributionLabel,
  learningItemSuggestions = [],
  recentLearningItemIds = [],
  onLearningItemRegister,
  onOpenRecruitmentModal,
  activeRecruitmentSummary = null,
}: SilentWorkspaceRoomProps) {
  const isFocusPresentation = presentation === "focus";
  const [isPresetEditorOpen, setIsPresetEditorOpen] = useState(false);
  const [isPresetTrayOpen, setIsPresetTrayOpen] = useState(false);
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
            <aside className="workspace-room-overlay" aria-label="ルーム情報">
              <div className="workspace-room-overlay-head">
                <strong className="workspace-room-overlay-name">{roomName}</strong>
                <span className="workspace-room-overlay-meta">
                  {isJoined ? `${joinedAtLabel}〜 ${currentStayLabel}` : "未入室"}
                </span>
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
                <span className="actor-shadow" />
                <span
                  className={`actor-sprite ${member.tone} shape-${member.characterShape || "default"}`}
                >
                  <span className="sprite-body" />
                  <span className="sprite-leg sprite-leg-left" />
                  <span className="sprite-leg sprite-leg-right" />
                  {/* Ghost-only face elements. Rendered for every shape
                      but only made visible via CSS for .shape-ghost. */}
                  <span className="sprite-eye sprite-eye-left" />
                  <span className="sprite-eye sprite-eye-right" />
                  <span className="sprite-tail" />
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
                  {/* Ghost extras (hat + arm nubs + wavy mouth) — only
                      rendered for the ghost shape so they don't sit
                      invisibly inside every other sprite. */}
                  {member.characterShape === "ghost" ? (
                    <>
                      <span className="sprite-ghost-hat" aria-hidden="true">
                        <span className="sprite-ghost-hat-crown" />
                        <span className="sprite-ghost-hat-brim" />
                        <span className="sprite-ghost-hat-band" />
                      </span>
                      <span className="sprite-ghost-arm sprite-ghost-arm-left" />
                      <span className="sprite-ghost-arm sprite-ghost-arm-right" />
                      <svg
                        className="sprite-ghost-mouth"
                        viewBox="0 0 24 8"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <path
                          d="M2 4 Q 6 0.5 10 4 T 18 4 L 22 4"
                          stroke="#3b2218"
                          strokeWidth="1.6"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </>
                  ) : null}
                </span>
                <span className="actor-name">{member.name}</span>
                <span className="actor-task">
                  <strong>{member.currentTask}</strong>
                  <small>{getActorStayLabel(member)}</small>
                </span>
              </button>
            );
          })}
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
