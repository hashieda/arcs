#!/bin/bash
# ============================================================
# ARCS スケジュールパッチ適用スクリプト
# 使い方: bash apply-patch.sh <パッチファイル.json>
# 例:     bash apply-patch.sh arcs_patch_icsi_detail_2026-06-01.json
# ============================================================

set -e

PATCH_FILE="$1"
DATA_DIR="$(dirname "$0")/data"

# ── チェック ──
if [ -z "$PATCH_FILE" ]; then
  echo "使い方: bash apply-patch.sh <パッチファイル.json>"
  exit 1
fi
if [ ! -f "$PATCH_FILE" ]; then
  echo "❌ ファイルが見つかりません: $PATCH_FILE"
  exit 1
fi
if ! command -v python3 &>/dev/null; then
  echo "❌ Python3 が必要です"
  exit 1
fi

echo "======================================"
echo " ARCS パッチ適用"
echo "======================================"
echo ""

python3 << PYEOF
import json, shutil, os, sys
from datetime import datetime

patch_file = "${PATCH_FILE}"
data_dir   = "${DATA_DIR}"

with open(patch_file) as f:
    patch = json.load(f)

meta    = patch.get('_meta', {})
target  = meta.get('targetFile', '').replace('data/', '').replace('.json', '')
patches = patch.get('patches', [])
history = patch.get('historyEntries', [])

print(f"対象ファイル : data/{target}.json")
print(f"パッチ件数   : {len(patches)}")
print(f"履歴エントリ : {len(history)}")
print(f"生成日時     : {meta.get('generatedAt','—')}")
print(f"ソース       : {meta.get('source','—')}")
print()

# ── ターゲットJSONを読み込む ──
target_path = os.path.join(data_dir, f"{target}.json")
if not os.path.exists(target_path):
    print(f"❌ ターゲットファイルが見つかりません: {target_path}")
    sys.exit(1)

with open(target_path) as f:
    data = json.load(f)

# バックアップ
backup_path = target_path.replace('.json', f'_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')
shutil.copy(target_path, backup_path)
print(f"✓ バックアップ: {os.path.basename(backup_path)}")
print()

# ── パッチを適用 ──
applied = 0
skipped = 0

# テーマIDインデックスを構築
theme_index = {}
for cat in data.get('categories', []):
    for theme in cat.get('themes', []):
        theme_index[theme['id']] = theme

for p in patches:
    tid   = p.get('id')
    field = p.get('field')
    nv    = p.get('newValue')
    ct    = p.get('changeType')

    if tid == 'history':
        continue

    if ct == 'new_theme':
        # 新テーマ追加
        cat_name = p.get('category', '未分類')
        found = False
        for cat in data.get('categories', []):
            if cat.get('cat') == cat_name:
                cat['themes'].append(nv)
                found = True
                break
        if not found:
            data.setdefault('categories', []).append({'cat': cat_name, 'catClass': 'navy', 'themes': [nv]})
        print(f"  ✓ [new_theme] {tid}: 新テーマ追加")
        applied += 1
        continue

    theme = theme_index.get(tid)
    if not theme:
        print(f"  ⚠ [{ct}] {tid}: テーマが見つかりません → スキップ")
        skipped += 1
        continue

    if ct == 'phase_shift' and field == 'phases':
        # phaseのstart/endを更新
        if isinstance(nv, dict) and 'start' in nv and 'end' in nv:
            for ph in theme.get('phases', []):
                if not ph.get('baseline'):  # baselineは変更しない
                    ph['start'] = nv['start']
                    ph['end']   = nv['end']
            print(f"  ✓ [{ct}] {tid}.phases: {nv}")
            applied += 1
        else:
            print(f"  ⚠ [{ct}] {tid}: phase_shiftの形式が不正 → スキップ")
            skipped += 1
    elif field in theme:
        theme[field] = nv
        print(f"  ✓ [{ct}] {tid}.{field}: → {str(nv)[:60]}")
        applied += 1
    else:
        # 新フィールド追加
        theme[field] = nv
        print(f"  ✓ [{ct}] {tid}.{field}: 新フィールド追加")
        applied += 1

# ── 履歴エントリを追加 ──
if history:
    history_path = os.path.join(data_dir, 'history.json')
    with open(history_path) as f:
        hist_data = json.load(f)
    # 先頭に追加（新しいものが上）
    hist_data['entries'] = history + hist_data.get('entries', [])
    with open(history_path, 'w') as f:
        json.dump(hist_data, f, ensure_ascii=False, indent=2)
    print(f"  ✓ history.json: {len(history)}エントリ追加")

# ── 保存 ──
with open(target_path, 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print()
print(f"====================================")
print(f"✅ 完了: {applied}件適用, {skipped}件スキップ")
print(f"   ファイル更新: data/{target}.json")
if history:
    print(f"   履歴更新:     data/history.json")
print(f"====================================")
PYEOF
