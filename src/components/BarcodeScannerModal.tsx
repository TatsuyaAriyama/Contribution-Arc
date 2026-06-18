import { useEffect, useRef, useState } from "react";

/**
 * 本 / 教本のバーコード (ISBN = EAN-13) をカメラで読み取るモーダル。
 *
 * - ネイティブの `BarcodeDetector` が使える環境 (Android Chrome など) では
 *   背面カメラの映像から ISBN を検出して即 `onDetected` を呼ぶ。
 * - 非対応 (iOS Safari など) / カメラ拒否時は ISBN 手入力にフォールバック。
 *   どちらの経路でも返すのは「数字列の ISBN」だけ。書誌情報の取得 (Google
 *   Books) と学習項目への反映は呼び出し側 (App) が行う。
 */

type Props = {
  onClose: () => void;
  onDetected: (isbn: string) => void;
};

type ScanStatus = "starting" | "scanning" | "unsupported" | "error";

const sanitizeIsbn = (raw: string) => raw.replace(/[^0-9Xx]/g, "");

export function BarcodeScannerModal({ onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  // onDetected を ref 経由で参照し、effect は一度だけ走らせる
  // (毎レンダーでカメラが再起動して点滅するのを防ぐ)。
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [status, setStatus] = useState<ScanStatus>("starting");
  const [manual, setManual] = useState("");

  useEffect(() => {
    let cancelled = false;
    const win = window as unknown as { BarcodeDetector?: new (opts?: unknown) => { detect: (src: CanvasImageSource) => Promise<Array<{ rawValue: string }>> } };
    const BD = win.BarcodeDetector;

    const stop = () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };

    if (!BD || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return stop;
    }

    let detector: { detect: (src: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };
    try {
      detector = new BD({ formats: ["ean_13", "ean_8", "upc_a"] });
    } catch {
      setStatus("unsupported");
      return stop;
    }

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setStatus("scanning");

        const tick = async () => {
          if (cancelled) return;
          const video = videoRef.current;
          try {
            if (video && video.readyState >= 2) {
              const codes = await detector.detect(video);
              const value = codes?.[0]?.rawValue ? sanitizeIsbn(codes[0].rawValue) : "";
              if (value) {
                stop();
                onDetectedRef.current(value);
                return;
              }
            }
          } catch {
            // フレーム単位の検出失敗は無視して次のフレームへ。
          }
          rafRef.current = requestAnimationFrame(() => void tick());
        };
        rafRef.current = requestAnimationFrame(() => void tick());
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return stop;
  }, []);

  const submitManual = () => {
    const code = sanitizeIsbn(manual);
    if (code) onDetectedRef.current(code);
  };

  return (
    <div
      className="barcode-scan-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="バーコードで本を追加"
      onClick={onClose}
    >
      <div className="barcode-scan-card" onClick={(event) => event.stopPropagation()}>
        <div className="barcode-scan-head">
          <strong>バーコードで本を追加</strong>
          <button
            type="button"
            className="barcode-scan-close"
            onClick={onClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        {status === "starting" || status === "scanning" ? (
          <div className="barcode-scan-viewport">
            <video ref={videoRef} playsInline muted className="barcode-scan-video" />
            <div className="barcode-scan-reticle" aria-hidden="true" />
          </div>
        ) : null}

        <p className="barcode-scan-hint">
          {status === "scanning"
            ? "本の裏表紙にあるバーコード (ISBN) を枠に合わせてください"
            : status === "starting"
              ? "カメラを起動中…"
              : status === "unsupported"
                ? "このブラウザはカメラ読み取りに未対応です。ISBN を手入力してください。"
                : "カメラを起動できませんでした。ISBN を手入力してください。"}
        </p>

        <div className="barcode-scan-manual">
          <input
            type="text"
            inputMode="numeric"
            placeholder="ISBN を手入力 (例: 9784…)"
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitManual();
              }
            }}
          />
          <button type="button" onClick={submitManual} disabled={!sanitizeIsbn(manual)}>
            検索
          </button>
        </div>
      </div>
    </div>
  );
}
