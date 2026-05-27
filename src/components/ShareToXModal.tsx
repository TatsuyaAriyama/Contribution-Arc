import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildShareTweet,
  generateShareImagePng,
  type ShareImageInput,
} from "../services/shareImage";

type ShareToXModalProps = {
  open: boolean;
  onClose: () => void;
  input: ShareImageInput;
};

const INTENT_URL = "https://twitter.com/intent/tweet";

export function ShareToXModal({ open, onClose, input }: ShareToXModalProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [text, setText] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const generationToken = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Keyboard a11y: ESC closes the modal. Focus the textarea when the
  // modal opens so keyboard users land on the editable field instead of
  // having to tab past the backdrop.
  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    const focusTimer = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  // Regenerate the image whenever the modal opens with fresh input data.
  // The token guards against late resolutions overwriting a newer render.
  useEffect(() => {
    if (!open) {
      return;
    }
    const token = ++generationToken.current;
    setError("");
    setStatus("");
    setText(buildShareTweet(input));
    generateShareImagePng(input)
      .then((generated) => {
        if (generationToken.current !== token) return;
        setBlob(generated);
        setImageUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(generated);
        });
      })
      .catch((err: unknown) => {
        if (generationToken.current !== token) return;
        setError(err instanceof Error ? err.message : "画像の生成に失敗しました。");
      });
  }, [open, input]);

  // Clean up the object URL when the modal unmounts or closes.
  useEffect(() => {
    if (!open && imageUrl) {
      URL.revokeObjectURL(imageUrl);
      setImageUrl(null);
      setBlob(null);
    }
  }, [open, imageUrl]);

  const charCount = text.length;
  const isOverLimit = charCount > 280;

  const intentHref = useMemo(() => {
    const params = new URLSearchParams({ text });
    return `${INTENT_URL}?${params.toString()}`;
  }, [text]);

  if (!open) {
    return null;
  }

  const handleDownload = () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `contribution-arc-${input.date}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setStatus("画像をダウンロードしました。");
  };

  const handleCopyImage = async () => {
    if (!blob) return;
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
      setError("このブラウザは画像のクリップボードコピーに対応していません。ダウンロードしてからご利用ください。");
      return;
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setStatus("画像をコピーしました。Xの投稿画面で貼り付けてください。");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "クリップボードへのコピーに失敗しました。");
    }
  };

  const handleOpenX = () => {
    window.open(intentHref, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="share-x-modal" role="dialog" aria-modal="true" aria-label="Xでシェア">
      <button
        type="button"
        className="share-x-backdrop"
        aria-label="閉じる"
        onClick={onClose}
      />
      <div className="share-x-panel">
        <header className="share-x-head">
          <div>
            <p className="card-kicker">Share to X</p>
            <h2>今日の作業時間をXでシェア</h2>
          </div>
          <button type="button" className="share-x-close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </header>

        <div className="share-x-body">
          <div className="share-x-preview" aria-label="シェア画像プレビュー">
            {imageUrl ? (
              <img src={imageUrl} alt="シェア画像プレビュー" />
            ) : (
              <div className="share-x-preview-placeholder">画像を生成中…</div>
            )}
          </div>

          <div className="share-x-form">
            <label className="share-x-field">
              <span>投稿文</span>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={5}
                maxLength={280}
                placeholder="投稿内容を編集できます"
              />
              <small
                className={isOverLimit ? "over-limit" : ""}
                aria-live="polite"
                aria-label={`投稿文 ${charCount} / 280 文字`}
              >
                {charCount}/280
              </small>
            </label>

            <p className="share-x-hint">
              ※ X の Web 投稿画面は画像の自動添付に対応していないため、
              先に「画像をコピー」してから「X を開く」を押し、投稿画面でペースト（Cmd+V / Ctrl+V）してください。
            </p>

            <div className="share-x-actions">
              <button
                type="button"
                className="share-x-secondary"
                onClick={handleDownload}
                disabled={!blob}
              >
                画像をダウンロード
              </button>
              <button
                type="button"
                className="share-x-secondary"
                onClick={handleCopyImage}
                disabled={!blob}
              >
                画像をコピー
              </button>
              <button
                type="button"
                className="share-x-primary"
                onClick={handleOpenX}
                disabled={!text.trim() || isOverLimit}
              >
                Xを開く
              </button>
            </div>

            {status ? <p className="share-x-status" role="status">{status}</p> : null}
            {error ? <p className="share-x-error" role="alert">{error}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
