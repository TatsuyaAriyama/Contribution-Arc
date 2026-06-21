import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { useTranslation } from "../i18n/LanguageContext";

/**
 * 本 / 教本のバーコード (ISBN = EAN-13) をカメラで読み取るモーダル。
 *
 * - Android Chrome 等: ネイティブの `BarcodeDetector` で背面カメラから読む
 *   (高速・省電力)。
 * - iOS Safari / WKWebView 等 `BarcodeDetector` 非対応環境: ZXing
 *   (@zxing/browser) の JS デコーダで読む。getUserMedia さえ通れば iOS
 *   でもスキャンできる (App Store 提出版が動く要件)。
 * - カメラが一切使えない場合は ISBN 手入力にフォールバック。
 *
 * どの経路でも返すのは「数字列の ISBN」だけ。書誌情報の取得 (Google Books)
 * と学習項目への反映は呼び出し側 (App) が行う。
 */

type Props = {
  onClose: () => void;
  onDetected: (isbn: string) => void;
};

type ScanStatus = "starting" | "scanning" | "unsupported" | "error";

const sanitizeIsbn = (raw: string) => raw.replace(/[^0-9Xx]/g, "");

export function BarcodeScannerModal({ onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // onDetected を ref 経由で参照し、effect は一度だけ走らせる
  // (毎レンダーでカメラが再起動して点滅するのを防ぐ)。
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [status, setStatus] = useState<ScanStatus>("starting");
  const [manual, setManual] = useState("");
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let zxingControls: { stop: () => void } | null = null;

    const stopAll = () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      try {
        zxingControls?.stop();
      } catch {
        /* noop */
      }
      zxingControls = null;
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    };

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return stopAll;
    }

    const handle = (value: string) => {
      const code = sanitizeIsbn(value);
      if (!code) return;
      stopAll();
      onDetectedRef.current(code);
    };

    const win = window as unknown as {
      BarcodeDetector?: new (opts?: unknown) => {
        detect: (src: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
      };
    };
    const BD = win.BarcodeDetector;

    // --- Path A: ネイティブ BarcodeDetector (Android 等) ---
    if (BD) {
      let detector: { detect: (src: CanvasImageSource) => Promise<Array<{ rawValue: string }>> } | null;
      try {
        detector = new BD({ formats: ["ean_13", "ean_8", "upc_a"] });
      } catch {
        detector = null;
      }
      if (detector) {
        const activeDetector = detector;
        void (async () => {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: { ideal: "environment" } },
            });
            if (cancelled) {
              stream.getTracks().forEach((track) => track.stop());
              return;
            }
            const video = videoRef.current;
            if (!video) return;
            video.srcObject = stream;
            await video.play();
            setStatus("scanning");
            const tick = async () => {
              if (cancelled) return;
              try {
                const video = videoRef.current;
                if (video && video.readyState >= 2) {
                  const codes = await activeDetector.detect(video);
                  if (codes?.[0]?.rawValue) {
                    handle(codes[0].rawValue);
                    return;
                  }
                }
              } catch {
                /* per-frame failure ignored */
              }
              raf = requestAnimationFrame(() => void tick());
            };
            raf = requestAnimationFrame(() => void tick());
          } catch {
            if (!cancelled) setStatus("error");
          }
        })();
        return stopAll;
      }
    }

    // --- Path B: ZXing (iOS / BarcodeDetector 非対応) ---
    void (async () => {
      try {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
        ]);
        const reader = new BrowserMultiFormatReader(hints);
        const video = videoRef.current;
        if (!video) return;
        setStatus("scanning");
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          video,
          (result) => {
            if (result) handle(result.getText());
          },
        );
        zxingControls = controls;
        if (cancelled) controls.stop();
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return stopAll;
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
      aria-label={t("バーコードで本を追加")}
      onClick={onClose}
    >
      <div className="barcode-scan-card" onClick={(event) => event.stopPropagation()}>
        <div className="barcode-scan-head">
          <strong>{t("バーコードで本を追加")}</strong>
          <button
            type="button"
            className="barcode-scan-close"
            onClick={onClose}
            aria-label={t("閉じる")}
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
            ? t("本の裏表紙にあるバーコード (ISBN) を枠に合わせてください")
            : status === "starting"
              ? t("カメラを起動中…")
              : status === "unsupported"
                ? t("このブラウザはカメラを利用できません。ISBN を手入力してください。")
                : t("カメラを起動できませんでした。権限を許可するか、ISBN を手入力してください。")}
        </p>

        <div className="barcode-scan-manual">
          <input
            type="text"
            inputMode="numeric"
            placeholder={t("ISBN を手入力 (例: 9784…)")}
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
            {t("検索")}
          </button>
        </div>
      </div>
    </div>
  );
}
