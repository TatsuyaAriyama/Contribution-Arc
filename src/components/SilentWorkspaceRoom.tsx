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

export type RoomActor = {
  id: string;
  userId: string;
  name: string;
  avatar?: string;
  characterColor?: string;
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

  return (
    <div className={`workspace-2d-shell ${isFocusPresentation ? "focus-presentation" : ""}`}>
      <div className="workspace-2d-main">
        {!isFocusPresentation ? (
          <div className="workspace-session-panel">
            <div className="workspace-session-header">
              <div className="workspace-session-title">
                <strong>{roomName}</strong>
                <span className="workspace-session-status">
                  {isJoined
                    ? `入室中 · ${joinedAtLabel} から ${currentStayLabel}`
                    : "未入室"}
                </span>
              </div>
              <div className="workspace-session-actions">
                {isJoined ? (
                  <button type="button" className="room-leave-button" onClick={onLeave}>
                    退出する
                  </button>
                ) : (
                  <button type="button" className="room-join-button" onClick={onJoin}>
                    入室する
                  </button>
                )}
              </div>
            </div>

            <label className="workspace-task-field">
              <span>今やってること</span>
              {(() => {
                const trimmed = taskValue.trim();
                const matchedItem = learningItemSuggestions.find(
                  (item) => item.name.toLowerCase() === trimmed.toLowerCase(),
                );
                const showGhostHint = trimmed.length > 0 && !matchedItem && Boolean(onLearningItemRegister);
                const recentChips = recentLearningItemIds
                  .map((id) => learningItemSuggestions.find((item) => item.id === id))
                  .filter((item): item is LearningItemSuggestion => Boolean(item))
                  .slice(0, 3);
                return (
                  <>
                    {recentChips.length > 0 ? (
                      <div className="study-subject-chips" aria-label="最近使った学習対象">
                        {recentChips.map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            className={matchedItem?.id === item.id ? "active" : ""}
                            onClick={() => onTaskChange(item.name)}
                            style={{ "--chip-color": item.color } as CSSProperties}
                          >
                            {item.name}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <input
                      value={taskValue}
                      onChange={handleTaskChange}
                      placeholder="作業内容を入力"
                      maxLength={48}
                      list="workspace-learning-items-datalist"
                    />
                    <datalist id="workspace-learning-items-datalist">
                      {learningItemSuggestions.map((item) => (
                        <option key={item.id} value={item.name} />
                      ))}
                    </datalist>
                    {showGhostHint ? (
                      <button
                        type="button"
                        className="subject-ghost-hint"
                        onClick={() => onLearningItemRegister?.(trimmed)}
                      >
                        + 「{trimmed}」を記録に追加
                      </button>
                    ) : null}
                  </>
                );
              })()}
            </label>
          </div>
        ) : null}

        <div className="workspace-stage" aria-label="Silent workspace">
          <div className="workspace-floor-grid" aria-hidden="true" />

          {members.map((member) => {
            const isCurrentUser = member.userId === currentUserId;
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
                ].join(" ")}
                style={actorStyle}
                onClick={() => onMemberOpen(member)}
                aria-label={`${member.name} ${member.currentTask}`}
              >
                {isCurrentUser && bubbleMessage ? <span className="workspace-bubble">{bubbleMessage}</span> : null}
                {member.status === "on-break" ? <span className="actor-rest-mark" aria-hidden="true">Zz</span> : null}
                <span className="actor-shadow" />
                <span className={`actor-sprite ${member.tone}`}>
                  <span className="sprite-body" />
                  <span className="sprite-leg sprite-leg-left" />
                  <span className="sprite-leg sprite-leg-right" />
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

          {isPresetTrayOpen ? (
            <div className="preset-message-bar" aria-label="定型コミュニケーション">
              {visiblePresetMessages.map((message, index) => (
                <button type="button" key={`${message}-${index}`} onClick={() => onPresetMessage(message)} disabled={!isJoined}>
                  {message}
                </button>
              ))}
              {isJoined ? (
                <button
                  type="button"
                  className="preset-break-toggle"
                  onClick={() => onPresetMessage(isCurrentUserOnBreak ? "集中します" : "休憩します")}
                >
                  {isCurrentUserOnBreak ? "休憩終了" : "休憩"}
                </button>
              ) : null}
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
