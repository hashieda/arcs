#!/bin/bash
# =============================================================
# arcs → GitHub アップロードスクリプト
# 使い方:
#   1. このファイルと arcs_icsi_v37.zip を同じフォルダに置く
#   2. ターミナルで実行: bash upload_to_github.sh
# =============================================================

set -e

REPO_URL="https://github.com/hashieda/arcs.git"
ZIP_FILE="arcs_icsi_v37.zip"
COMMIT_MSG="feat: ICSI自動化スケジュール v37対応（45ヶ月・6WS・D/Aゲート）"

echo "========================================"
echo " arcs GitHub アップロードスクリプト"
echo "========================================"
echo ""

# --- ZIPファイル確認 ---
if [ ! -f "$ZIP_FILE" ]; then
  echo "❌ $ZIP_FILE が見つかりません"
  echo "   このスクリプトと同じフォルダに置いてください"
  exit 1
fi

# --- 作業ディレクトリ ---
WORK_DIR=$(mktemp -d)
echo "📁 作業ディレクトリ: $WORK_DIR"

# --- clone ---
echo ""
echo "⬇️  リポジトリをクローン中..."
git clone "$REPO_URL" "$WORK_DIR/repo"
cd "$WORK_DIR/repo"

# --- ZIP解凍して上書き ---
echo ""
echo "📦 ZIPを解凍して上書き中..."
unzip -o "$(pwd)/../../$ZIP_FILE" -d "$WORK_DIR/extracted" 2>/dev/null || \
  unzip -o "$OLDPWD/$ZIP_FILE" -d "$WORK_DIR/extracted"

# ZIPの中は arcs/ フォルダ構成
cp -r "$WORK_DIR/extracted/arcs/." "$WORK_DIR/repo/"

echo ""
echo "📋 変更ファイル一覧:"
git status --short

# --- コミット ---
echo ""
echo "✅ コミット中..."
git add -A
git commit -m "$COMMIT_MSG"

# --- push ---
echo ""
echo "⬆️  GitHubにプッシュ中..."
git push origin main

echo ""
echo "========================================"
echo "✅ アップロード完了！"
echo "   https://github.com/hashieda/arcs"
echo "========================================"

# --- クリーンアップ ---
cd /
rm -rf "$WORK_DIR"
