#!/usr/bin/env bash
set -euo pipefail

# Known here-doc end tokens we used in scaffolding
TOKENS=("TSX" "TS" "JS" "JSON" "CSS" "SVG" "PRISMA" "YML" "MD" "DOCKER")

dry_run=0
if [[ "${1:-}" == "--dry-run" ]]; then dry_run=1; fi

# Function: returns 0 if last line equals any known token
is_closing_token() {
  local last="$1"
  for t in "${TOKENS[@]}"; do
    [[ "$last" == "$t" ]] && return 0
  done
  return 1
}

changed=0
while IFS= read -r f; do
  # skip binaries or large files
  if file -b --mime "$f" | grep -qE 'charset=binary'; then
    continue
  fi

  # read first and last line
  first="$(head -n1 "$f" || true)"
  last="$(tail -n1 "$f" || true)"

  # match openers like: cat > path <<'TSX'
  if [[ "$first" =~ ^cat\ \>\ .*\ \<\<\'[A-Z0-9_]+\'$ ]] || is_closing_token "$last"; then
    if (( dry_run )); then
      echo "[DRY] would clean: $f"
      continue
    fi

    cp "$f" "$f.bak"

    # awk:
    #  - drop line 1 if it matches the opener
    #  - drop last line if it equals any token
    awk -v first_pat="^cat > .*<<'\''[A-Z0-9_]+'\''$" -v tokens="$(IFS=,; echo "${TOKENS[*]}")" '
      BEGIN{
        nTok=split(tokens, Toks, /,/)
      }
      { lines[NR]=$0 }
      END{
        dropFirst=0
        dropLast=0
        if (lines[1] ~ first_pat) dropFirst=1
        last=lines[NR]
        for (i=1; i<=nTok; i++){
          if (last == Toks[i]) { dropLast=1; break }
        }
        start = dropFirst ? 2 : 1
        end   = dropLast ? NR-1 : NR
        for (i=start; i<=end; i++) print lines[i]
      }
    ' "$f" > "$f.clean" && mv "$f.clean" "$f"

    echo "[CLEANED] $f"
    ((changed++))
  fi
done < <(git ls-files)

echo "Done. Files cleaned: $changed"
echo "Backups were saved alongside as *.bak (you can delete them after verifying)."
