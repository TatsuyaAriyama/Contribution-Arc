import { useRef, useState } from "react";
import { useTranslation } from "../i18n/LanguageContext";

/**
 * ライブラリの学習対象から開く「記録の入力」フォーム。
 *
 * 単に時間を積むだけでなく、学習時間・学習量(ページ/問題など)・要点メモ・
 * 画像をまとめて残せる。デザインは日報(Handcrafted layer)に寄せた紙＋明朝。
 */

type LearningRecordValues = {
  minutes: number;
  amount?: number;
  amountUnit?: string;
  note?: string;
  photo?: string;
};

type Props = {
  itemName: string;
  itemColor: string;
  category: "book" | "stack";
  initialMinutes?: number;
  onClose: () => void;
  onSubmit: (values: LearningRecordValues) => void;
  onEdit: () => void;
};

// 画像を ~1024px / JPEG 0.7 に縮小して dataURL 化（Firestore doc サイズ対策）。
const fileToCompressedDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("image decode failed"));
      img.onload = () => {
        const max = 1024;
        let { width, height } = img;
        if (width > max || height > max) {
          const scale = max / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

export function LearningRecordModal({
  itemName,
  itemColor,
  category,
  initialMinutes,
  onClose,
  onSubmit,
  onEdit,
}: Props) {
  const { t } = useTranslation();
  const hasInitialMinutes = initialMinutes !== undefined;
  const initialHoursPart = hasInitialMinutes ? Math.floor(initialMinutes! / 60) : 0;
  const initialMinutesPart = hasInitialMinutes ? initialMinutes! % 60 : 0;
  const [hours, setHours] = useState(initialHoursPart > 0 ? String(initialHoursPart) : "");
  const [minutes, setMinutes] = useState(() => {
    if (initialMinutesPart > 0) return String(initialMinutesPart);
    if (initialHoursPart > 0) return "";
    // 両方 0（initialMinutes を明示的に 0 指定）なら 1 分へ繰り上げる。
    return hasInitialMinutes ? "1" : "";
  });
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState(category === "book" ? t("ページ") : "");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const totalMinutes =
    (Number(hours) > 0 ? Math.floor(Number(hours)) * 60 : 0) +
    (Number(minutes) > 0 ? Math.floor(Number(minutes)) : 0);
  const amountValue = Number(amount) > 0 ? Math.floor(Number(amount)) : 0;
  const canSubmit = totalMinutes > 0;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPhoto(await fileToCompressedDataUrl(file));
    } catch {
      /* noop — 画像なしで続行 */
    }
  };

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      minutes: totalMinutes,
      amount: amountValue > 0 ? amountValue : undefined,
      amountUnit: amountValue > 0 ? unit.trim() || undefined : undefined,
      note: note.trim() || undefined,
      photo: photo || undefined,
    });
  };

  return (
    <div
      className="learning-record-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t("記録の入力")}
      onClick={onClose}
    >
      <section
        className="learning-record-card daily-screen"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="learning-record-head">
          <button
            type="button"
            className="learning-record-close"
            onClick={onClose}
            aria-label={t("閉じる")}
          >
            ×
          </button>
          <h2 className="learning-record-title daily-editor-title">{t("記録の入力")}</h2>
          <button
            type="button"
            className="learning-record-save"
            onClick={submit}
            disabled={!canSubmit}
          >
            {t("記録する")}
          </button>
        </header>

        <button
          type="button"
          className="learning-record-item"
          data-testid="learning-record-edit-link"
          onClick={onEdit}
          style={{ ["--learning-card-color" as string]: itemColor }}
        >
          <span className="learning-record-item-bar" aria-hidden="true" />
          <span className="learning-record-item-name">{itemName}</span>
          <span className="learning-record-item-edit">{t("詳細・編集")} ›</span>
        </button>

        <div className="learning-record-field">
          <span className="learning-record-label">{t("学習時間")}</span>
          <div className="learning-record-time">
            <input
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="0"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
              aria-label={t("時間")}
            />
            <span>{t("時間")}</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="59"
              placeholder="0"
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
              aria-label={t("分")}
            />
            <span>{t("分")}</span>
          </div>
        </div>

        <div className="learning-record-field">
          <span className="learning-record-label">{t("学習量（任意）")}</span>
          <div className="learning-record-amount">
            <input
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-label={t("学習量")}
            />
            <input
              type="text"
              className="learning-record-unit"
              placeholder={category === "book" ? t("ページ") : t("問題 / 章 など")}
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              aria-label={t("単位")}
            />
          </div>
        </div>

        <div className="learning-record-field">
          <span className="learning-record-label">{t("要点・ひとことメモ（任意）")}</span>
          <textarea
            className="learning-record-note"
            rows={3}
            placeholder={t("今日やったこと / 気づき")}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

        <div className="learning-record-field">
          <span className="learning-record-label">{t("画像（任意）")}</span>
          {photo ? (
            <div className="learning-record-photo">
              <img src={photo} alt="" />
              <button type="button" onClick={() => setPhoto("")} aria-label={t("画像を削除")}>
                ×
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="learning-record-photo-add"
              onClick={() => fileRef.current?.click()}
            >
              ＋ {t("画像を追加")}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </div>
      </section>
    </div>
  );
}
