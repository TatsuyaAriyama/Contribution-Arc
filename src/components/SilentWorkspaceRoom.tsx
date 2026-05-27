import { useState, type CSSProperties, type ChangeEvent } from "react";

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

export type CharacterShape = "default" | "ghost";

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
                {onOpenRecruitmentModal && isJoined && !activeRecruitmentSummary ? (
                  <button
                    type="button"
                    className="workspace-room-overlay-recruit"
                    onClick={onOpenRecruitmentModal}
                  >
                    📣 募集
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
                {isCurrentUser && bubbleMessage ? <span className="workspace-bubble">{bubbleMessage}</span> : null}
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
            {isJoined ? (
              <button
                type="button"
                className="preset-break-toggle preset-break-toggle-standalone"
                onClick={() => onPresetMessage(isCurrentUserOnBreak ? "集中します" : "休憩します")}
              >
                {isCurrentUserOnBreak ? "休憩終了" : "休憩"}
              </button>
            ) : null}
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
