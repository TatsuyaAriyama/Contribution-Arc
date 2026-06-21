#!/usr/bin/env bash
#
# verify.sh — Contribution Arc スマホ版 自動受け入れチェック
#
# 使い方:
#   ./verify.sh            # web 層 + ネイティブの「事前検出」まで（重いネイティブ実行はスキップ）
#   ./verify.sh web        # web 層のみ
#   ./verify.sh native     # ネイティブ層のみ（RUN_NATIVE=1 と同義）
#   RUN_NATIVE=1 ./verify.sh   # web + ネイティブ重ステップ（cap sync / simulator build / maestro）も実行
#
# 状態: PASS / FAIL(赤) / SKIP(ツール未導入・未配線で判定不能)
# 終了コード: FAIL の件数（0 なら全て緑 or スキップのみ）
#
# 注意: このスクリプトは「機能実装」も「署名 / archive / App Store 提出」も一切行わない。
#       acceptance-criteria.md のチェック ID と 1:1 で対応する。

set -u

# ---- 予算（acceptance-criteria.md と同期させること） -----------------------
MAX_LISTENERS=14          # 同時 onSnapshot リスナー数の上限
# 読み/書き回数の実測予算は F-RUNTIME-BUDGET（Playwright 配線後）で評価する。

# ---- モード ---------------------------------------------------------------
MODE="${1:-all}"
case "$MODE" in
  web)    DO_WEB=1; DO_NATIVE=0 ;;
  native) DO_WEB=0; DO_NATIVE=1; RUN_NATIVE=1 ;;
  all|"") DO_WEB=1; DO_NATIVE=1 ;;
  *) echo "unknown mode: $MODE (use web|native|all)"; exit 2 ;;
esac
RUN_NATIVE="${RUN_NATIVE:-0}"   # ネイティブの重い実ステップを走らせるか

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# ---- 集計 -----------------------------------------------------------------
PASS_N=0; FAIL_N=0; SKIP_N=0
declare -a FAILS=()
declare -a SKIPS=()

c_pass() { PASS_N=$((PASS_N+1)); printf "  \033[32mPASS\033[0m  %-22s %s\n" "$1" "${2:-}"; }
c_fail() { FAIL_N=$((FAIL_N+1)); FAILS+=("$1"); printf "  \033[31mFAIL\033[0m  %-22s %s\n" "$1" "${2:-}"; }
c_skip() { SKIP_N=$((SKIP_N+1)); SKIPS+=("$1"); printf "  \033[33mSKIP\033[0m  %-22s %s\n" "$1" "${2:-}"; }

section() { printf "\n\033[1m== %s ==\033[0m\n" "$1"; }
have()    { command -v "$1" >/dev/null 2>&1; }

# 一時ログ
LOG_DIR="$(mktemp -d)"
trap 'rm -rf "$LOG_DIR"' EXIT

# ===========================================================================
# WEB 層
# ===========================================================================
run_web() {
  section "WEB: 静的・ビルド"

  # TYPECHECK
  if npx --no-install tsc --noEmit >"$LOG_DIR/tsc.log" 2>&1; then
    c_pass "TYPECHECK" "tsc --noEmit"
  else
    c_fail "TYPECHECK" "tsc --noEmit 失敗 → $LOG_DIR/tsc.log"
  fi

  # LINT
  if [ -f "eslint.config.js" ] || [ -f "eslint.config.mjs" ] || [ -f ".eslintrc.cjs" ] || [ -f ".eslintrc.json" ]; then
    if npx --no-install eslint . >"$LOG_DIR/eslint.log" 2>&1; then
      c_pass "LINT" "eslint"
    else
      c_fail "LINT" "eslint 失敗 → $LOG_DIR/eslint.log"
    fi
  else
    c_skip "LINT" "eslint 未設定（設定ファイルなし）"
  fi

  # BUILD
  if npx --no-install vite build >"$LOG_DIR/build.log" 2>&1; then
    c_pass "BUILD" "vite build"
  else
    c_fail "BUILD" "vite build 失敗 → $LOG_DIR/build.log"
  fi

  # UNIT
  if [ -f "vitest.config.ts" ] && have npx && npx --no-install vitest --version >/dev/null 2>&1; then
    if npx --no-install vitest run >"$LOG_DIR/unit.log" 2>&1; then
      c_pass "UNIT" "vitest run"
    else
      c_fail "UNIT" "vitest 失敗 → $LOG_DIR/unit.log"
    fi
  else
    c_skip "UNIT" "vitest 未導入"
  fi

  section "WEB: Firestore データ管理（静的）"
  run_firestore_static

  section "WEB: e2e / 体験品質"

  # Playwright e2e（HOME-POST, HOME-SCROLL, RECORD-CRUD, RECORD-PERSIST, SCROLL-LONGTASK, RUNTIME-BUDGET）
  if [ -f "playwright.config.ts" ] && npx --no-install playwright --version >/dev/null 2>&1; then
    if npx --no-install playwright test >"$LOG_DIR/e2e.log" 2>&1; then
      c_pass "W-E2E"            "playwright test（全 e2e）"
    else
      c_fail "W-E2E"            "playwright 失敗 → $LOG_DIR/e2e.log"
    fi
  else
    c_skip "W-E2E-HOME-POST"    "playwright 未導入"
    c_skip "W-E2E-HOME-SCROLL"  "playwright 未導入"
    c_skip "W-SCROLL-LONGTASK"  "playwright 未導入"
    c_skip "W-E2E-RECORD-CRUD"  "playwright 未導入"
    c_skip "W-E2E-RECORD-PERSIST" "playwright 未導入"
    c_skip "F-RUNTIME-BUDGET"   "playwright + Firestore計測 未配線"
  fi

  # Firestore rules test
  if [ -d "tests/firestore" ] && npx --no-install vitest --version >/dev/null 2>&1 && have firebase \
     && node -e "require.resolve('@firebase/rules-unit-testing/package.json')" >/dev/null 2>&1; then
    if firebase emulators:exec --only firestore \
         "npx --no-install vitest run --config tests/firestore/vitest.config.ts" \
         >"$LOG_DIR/rules.log" 2>&1; then
      c_pass "RULES"            "firestore rules test"
    else
      c_fail "RULES"            "rules test 失敗 → $LOG_DIR/rules.log"
    fi
  else
    c_skip "RULES-RECORD-OWNER" "rules test 未配線（vitest/emulator）"
    c_skip "RULES-DENY-DEFAULT" "rules test 未配線（vitest/emulator）"
  fi

  # Lighthouse 予算
  if [ -f "lighthouse-budget.json" ] && npx --no-install lhci --version >/dev/null 2>&1; then
    if npx --no-install lhci autorun >"$LOG_DIR/lh.log" 2>&1; then
      c_pass "W-LH-PERF-BUDGET" "lighthouse budget"
    else
      c_fail "W-LH-PERF-BUDGET" "lighthouse 予算超過 → $LOG_DIR/lh.log"
    fi
  else
    c_skip "W-LH-PERF-BUDGET"   "@lhci/cli 未導入"
  fi
}

# ---- Firestore 静的チェック（今すぐ実行可能） ------------------------------
run_firestore_static() {
  # F-LISTENER-LEAK: onSnapshot(...) を文の先頭で呼んでいる（戻り値を捨てている）箇所
  local leaks
  leaks="$(grep -rnE '^[[:space:]]*\.?onSnapshot\(' src 2>/dev/null | grep -v 'import' || true)"
  if [ -z "$leaks" ]; then
    c_pass "F-LISTENER-LEAK" "解除されない onSnapshot は検出されず"
  else
    c_fail "F-LISTENER-LEAK" "戻り値未捕捉の onSnapshot あり:"$'\n'"$leaks"
  fi

  # F-LISTENER-BUDGET: onSnapshot( 呼び出し数 <= MAX_LISTENERS
  local listeners
  listeners="$(grep -rnE 'onSnapshot\(' src 2>/dev/null | grep -v 'import' | grep -v 'firebaseGuard' | wc -l | tr -d ' ')"
  if [ "$listeners" -le "$MAX_LISTENERS" ]; then
    c_pass "F-LISTENER-BUDGET" "onSnapshot 呼び出し ${listeners} / 上限 ${MAX_LISTENERS}"
  else
    c_fail "F-LISTENER-BUDGET" "onSnapshot 呼び出し ${listeners} が上限 ${MAX_LISTENERS} を超過"
  fi
}

# ===========================================================================
# ネイティブ層（iOS）
#   ※ archive / 署名 / App Store 提出は一切行わない。シミュレータ build まで。
# ===========================================================================
run_native() {
  section "NATIVE(iOS): 事前検出"

  have xcodebuild && c_pass "N-TOOL-XCODE" "xcodebuild あり" || c_fail "N-TOOL-XCODE" "xcodebuild なし"
  have xcrun     && c_pass "N-TOOL-SIMCTL" "xcrun(simctl) あり" || c_fail "N-TOOL-SIMCTL" "xcrun なし"
  if have maestro; then c_pass "N-TOOL-MAESTRO" "maestro あり"; else c_skip "N-TOOL-MAESTRO" "maestro 未導入"; fi

  if [ "$RUN_NATIVE" != "1" ]; then
    c_skip "N-CAP-SYNC"       "RUN_NATIVE=1 で実行"
    c_skip "N-IOS-BUILD"      "RUN_NATIVE=1 で実行"
    c_skip "N-MAESTRO-SCROLL" "RUN_NATIVE=1 で実行"
    c_skip "N-MAESTRO-KEYBOARD" "RUN_NATIVE=1 で実行"
    return
  fi

  section "NATIVE(iOS): 実ステップ"

  # N-CAP-SYNC: web ビルド → cap sync ios
  if CAPACITOR_BUILD=true npx --no-install vite build >"$LOG_DIR/capbuild.log" 2>&1 \
     && npx --no-install cap sync ios >"$LOG_DIR/capsync.log" 2>&1; then
    c_pass "N-CAP-SYNC" "cap sync ios"
  else
    c_fail "N-CAP-SYNC" "cap sync 失敗 → $LOG_DIR/capsync.log"
  fi

  # N-IOS-BUILD: シミュレータ向けビルド（scheme: App, SPM 構成・workspace なし）
  if have xcodebuild; then
    if xcodebuild \
         -project ios/App/App.xcodeproj \
         -scheme App \
         -configuration Debug \
         -destination 'generic/platform=iOS Simulator' \
         build CODE_SIGNING_ALLOWED=NO >"$LOG_DIR/xcodebuild.log" 2>&1; then
      c_pass "N-IOS-BUILD" "xcodebuild (simulator, 署名なし)"
    else
      c_fail "N-IOS-BUILD" "xcodebuild 失敗 → $LOG_DIR/xcodebuild.log"
    fi
  else
    c_skip "N-IOS-BUILD" "xcodebuild なし"
  fi

  # Maestro フロー（スクロール / キーボード）
  if have maestro && [ -d ".maestro" ]; then
    if maestro test .maestro >"$LOG_DIR/maestro.log" 2>&1; then
      c_pass "N-MAESTRO-SCROLL"   "maestro scroll/keyboard flow"
      c_pass "N-MAESTRO-KEYBOARD" "（同上フローに含む）"
    else
      c_fail "N-MAESTRO-SCROLL"   "maestro 失敗 → $LOG_DIR/maestro.log"
      c_fail "N-MAESTRO-KEYBOARD" "maestro 失敗 → $LOG_DIR/maestro.log"
    fi
  else
    c_skip "N-MAESTRO-SCROLL"   "maestro 未導入 or .maestro なし"
    c_skip "N-MAESTRO-KEYBOARD" "maestro 未導入 or .maestro なし"
  fi
}

# ===========================================================================
printf "\033[1mContribution Arc — verify.sh\033[0m  (mode=%s, RUN_NATIVE=%s)\n" "$MODE" "$RUN_NATIVE"
[ "$DO_WEB" = 1 ]    && run_web
[ "$DO_NATIVE" = 1 ] && run_native

section "サマリ"
printf "  PASS=%d  FAIL=%d  SKIP=%d\n" "$PASS_N" "$FAIL_N" "$SKIP_N"
if [ "$FAIL_N" -gt 0 ]; then
  printf "  \033[31m赤 (FAIL):\033[0m %s\n" "${FAILS[*]}"
fi
if [ "$SKIP_N" -gt 0 ]; then
  printf "  \033[33m未配線 (SKIP):\033[0m %s\n" "${SKIPS[*]}"
fi

exit "$FAIL_N"
