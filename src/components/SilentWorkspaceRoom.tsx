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
  color: string;
  tone: "deep" | "green" | "soft" | "blue";
};

type SilentWorkspaceRoomProps = {
  presentation?: "full" | "focus";
  roomName: string;
  onlineCount: number;
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
};

const statusLabels: Record<RoomActorStatus, string> = {
  working: "working",
  "deep-work": "deep work",
  "on-break": "break",
};

export function SilentWorkspaceRoom({
  presentation = "full",
  roomName,
  onlineCount,
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
  totalLearnedLabel,
  contributionLabel,
}: SilentWorkspaceRoomProps) {
  const isFocusPresentation = presentation === "focus";
  const [isPresetEditorOpen, setIsPresetEditorOpen] = useState(false);
  const presetSlots = [...presetMessages, "", "", "", "", "", ""].slice(0, 6);
  const visiblePresetMessages = presetSlots.map((message) => message.trim()).filter(Boolean);

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
          <div className="workspace-2d-topbar">
            <div>
              <p className="card-kicker">Room</p>
              <h3>{roomName}</h3>
            </div>
            <div className="workspace-online-pill">
              <span>{onlineCount}</span>
              online
            </div>
          </div>
        ) : null}

        {!isFocusPresentation ? (
          <div className="workspace-session-panel">
            <label className="workspace-task-field">
              <span>現在の作業</span>
              <input
                value={taskValue}
                onChange={handleTaskChange}
                placeholder="React / Java / AWS"
                maxLength={48}
              />
            </label>

            <div className="room-actions">
              <span className={`room-presence-state ${isJoined ? "joined" : "outside"}`}>
                {isJoined ? "現在: 入室中" : "現在: 未入室"}
              </span>
              {isJoined ? (
                <>
                  <button type="button" className="room-rejoin-button" onClick={onJoin}>
                    入室し直す
                  </button>
                  <button type="button" className="room-leave-button" onClick={onLeave}>
                    退出する
                  </button>
                  <button type="button" className="room-reset-button" onClick={onResetPresence}>
                    入室状態をリセット
                  </button>
                </>
              ) : (
                <button type="button" className="room-join-button" onClick={onJoin}>
                  入室する
                </button>
              )}
              <span>{isJoined ? `入室 ${joinedAtLabel} / ${currentStayLabel}` : "入室すると滞在時間を記録します"}</span>
              {lastSessionLabel ? <strong>{lastSessionLabel}</strong> : null}
            </div>
          </div>
        ) : null}

        <div className="workspace-stage" aria-label="2D silent workspace">
          <div className="workspace-floor-grid" aria-hidden="true" />
          <div className="workspace-light light-a" aria-hidden="true" />
          <div className="workspace-light light-b" aria-hidden="true" />
          <div className="workspace-whiteboard" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="workspace-desk desk-a" aria-hidden="true">
            <span />
          </div>
          <div className="workspace-desk desk-b" aria-hidden="true">
            <span />
          </div>
          <div className="workspace-desk desk-c" aria-hidden="true">
            <span />
          </div>
          <div className="workspace-chair chair-a" aria-hidden="true" />
          <div className="workspace-chair chair-b" aria-hidden="true" />
          <div className="workspace-chair chair-c" aria-hidden="true" />
          <div className="workspace-plant plant-a" aria-hidden="true" />
          <div className="workspace-plant plant-b" aria-hidden="true" />
          <div className="workspace-rug" aria-hidden="true" />

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
                  isCurrentUser && isPlayerWalking ? "is-walking" : "",
                ].join(" ")}
                style={actorStyle}
                onClick={() => onMemberOpen(member)}
                aria-label={`${member.name} ${member.currentTask}`}
              >
                {isCurrentUser && bubbleMessage ? <span className="workspace-bubble">{bubbleMessage}</span> : null}
                <span className="actor-shadow" />
                <span className={`actor-sprite ${member.tone}`}>
                  <span className="sprite-head" aria-hidden="true" />
                  <span className="sprite-body" />
                  <span className="sprite-leg sprite-leg-left" />
                  <span className="sprite-leg sprite-leg-right" />
                </span>
                <span className="actor-name">{member.name}</span>
                <span className="actor-task">
                  {statusLabels[member.status]} / {member.currentTask}
                </span>
              </button>
            );
          })}
        </div>

        <div className="preset-message-panel">
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

          {isPresetEditorOpen ? (
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

      {!isFocusPresentation ? (
        <aside className="workspace-activity-panel">
          <div>
            <p className="card-kicker">Room Activity</p>
            <strong>{totalLearnedLabel}</strong>
            <span>{contributionLabel}</span>
          </div>
          <div className="workspace-activity-list">
            {activityItems.map((item) => (
              <button type="button" key={item.id} onClick={() => onActivityOpen(item)}>
                <span className="workspace-activity-avatar">
                  {item.avatar ? <img src={item.avatar} alt="" /> : item.userName.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <p>{item.text}</p>
                  <small>{item.meta}</small>
                </span>
              </button>
            ))}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
