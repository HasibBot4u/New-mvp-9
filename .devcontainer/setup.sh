#!/usr/bin/env bash
# Non-blocking setup. Never freezes the build.
{
  npm install -g opencode-ai 2>/dev/null || true
  if ! grep -q "NEXUSEDU OPENCODE BLOCK" "$HOME/.bashrc" 2>/dev/null; then
cat >> "$HOME/.bashrc" << 'EOF'

# ===================== NEXUSEDU OPENCODE BLOCK =====================
export PATH="$HOME/.opencode/bin:$PATH"
alias oc="opencode"
alias gp="git pull origin dev --no-rebase"
save(){ git add -A && git commit -m "${1:-wip: save}" && git pull origin dev --no-rebase 2>/dev/null; git push origin dev; }
# ===================== END NEXUSEDU OPENCODE BLOCK =================
EOF
  fi
} || true
echo "setup done"
