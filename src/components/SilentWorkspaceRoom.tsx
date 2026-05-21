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
  onSeatSelect: (task: string) => void;
  seatLabels: Record<string, string>;
  canEditSeatLabels?: boolean;
  onSeatLabelsChange: (labels: Record<string, string>) => void;
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

const workspaceSeats = [
  {
    id: "frontend",
    name: "作業",
    task: "React",
    note: "React",
  },
  {
    id: "java",
    name: "仕事",
    task: "Java",
    note: "Java",
  },
  {
    id: "deep",
    name: "休憩",
    task: "Deep Work",
    note: "Deep Work",
  },
  {
    id: "cloud",
    name: "学習",
    task: "AWS",
    note: "AWS",
  },
];

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
  onSeatSelect,
  seatLabels,
  canEditSeatLabels = false,
  onSeatLabelsChange,
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
}: SilentWorkspaceRoomProps) {
  const isFocusPresentation = presentation === "focus";
  const [isPresetEditorOpen, setIsPresetEditorOpen] = useState(false);
  const [isSeatEditorOpen, setIsSeatEditorOpen] = useState(false);
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

  const handleSeatLabelChange = (seatId: string, value: string) => {
    onSeatLabelsChange({
      ...seatLabels,
      [seatId]: value.slice(0, 10),
    });
  };

  return (
    <div className={`workspace-2d-shell ${isFocusPresentation ? "focus-presentation" : ""}`}>
      <div className="workspace-2d-main">
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
                    接続を整える
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

        <div className="workspace-stage" aria-label="2.5D silent workspace">
          <div className="workspace-floor-grid" aria-hidden="true" />
          <div className="workspace-ambient-glow" aria-hidden="true" />
          <div className="workspace-ambient-dust" aria-hidden="true" />
          <div className="workspace-back-wall" aria-hidden="true">
            <span />
            <span />
          </div>
          <div className="workspace-light light-a" aria-hidden="true" />
          <div className="workspace-light light-b" aria-hidden="true" />
          <div className="workspace-window" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="workspace-whiteboard" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          {workspaceSeats.map((seat) => {
            const seatName = (seatLabels[seat.id] || seat.name).trim() || seat.name;

            return (
              <button
                type="button"
                key={seat.id}
                className={`workspace-seat seat-${seat.id}`}
                onClick={() => onSeatSelect(seat.task)}
                aria-label={`${seatName}席に着席して${seat.task}を開始`}
              >
                <span className="seat-desk">
                  <span className="seat-screen" />
                  <span className="seat-mug" />
                </span>
                <span className="seat-chair" />
                <span className="seat-caption">
                  <strong>{seatName}</strong>
                  <small>{seat.note}</small>
                </span>
              </button>
            );
          })}
          <div className="workspace-plant plant-a" aria-hidden="true" />
          <div className="workspace-plant plant-b" aria-hidden="true" />
          <div className="workspace-plant plant-c" aria-hidden="true" />
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
                  <span className="sprite-head" aria-hidden="true" />
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

        <div className="preset-message-panel">
          {!isFocusPresentation && canEditSeatLabels ? (
            <div className="seat-label-editor" aria-label="席名編集">
              <button
                type="button"
                className="seat-label-editor-toggle"
                onClick={() => setIsSeatEditorOpen((isOpen) => !isOpen)}
              >
                {isSeatEditorOpen ? "席名編集を閉じる" : "席名編集"}
              </button>

              {isSeatEditorOpen ? (
                <div className="seat-label-editor-grid">
                  {workspaceSeats.map((seat) => (
                    <label key={`seat-label-${seat.id}`}>
                      <span>{seat.note}</span>
                      <input
                        value={seatLabels[seat.id] || seat.name}
                        onChange={(event) => handleSeatLabelChange(seat.id, event.target.value)}
                        placeholder={seat.name}
                        maxLength={10}
                      />
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

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

    </div>
  );
}
