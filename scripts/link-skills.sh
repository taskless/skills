#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS_SRC="$REPO_ROOT/skills"
SKILLS_DST="$REPO_ROOT/.claude/skills"

if [ ! -d "$SKILLS_SRC" ]; then
  echo "Error: skills directory not found at $SKILLS_SRC" >&2
  exit 1
fi

mkdir -p "$SKILLS_DST"

for dir in "$SKILLS_SRC"/*/; do
  [ -d "$dir" ] || continue
  name="$(basename "$dir")"
  target="$SKILLS_DST/$name"

  if [ -L "$target" ]; then
    existing="$(readlink -f "$target")"
    expected="$(readlink -f "$dir")"
    if [ "$existing" = "$expected" ]; then
      echo "ok: $name (already linked)"
    else
      echo "CONFLICT: $name -> symlink exists pointing to $existing (expected $expected)" >&2
      exit 1
    fi
  elif [ -e "$target" ]; then
    echo "CONFLICT: $name -> $target already exists and is not a symlink" >&2
    exit 1
  else
    ln -s "$dir" "$target"
    echo "linked: $name -> $dir"
  fi
done
