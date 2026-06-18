#!/usr/bin/env bash
# .devcontainer/setup.sh - runs once when the Codespace is built.
set -e
echo ">>> NexusEdu OpenCode setup starting..."

# 1) Install OpenCode (this is real glibc Linux, so the official installer works perfectly)
curl -fsSL https://opencode.ai/install | bash || npm install -g opencode-ai
# make sure its bin is on PATH for this + future shells
echo 'export PATH="$HOME/.opencode/bin:$PATH"' >> "$HOME/.bashrc"
export PATH="$HOME/.opencode/bin:$PATH"
opencode --version || echo "WARN: opencode --version failed (check after build / open a new terminal)"

# 2) Install project deps if a package.json exists
if [ -f package.json ]; then npm install || true; fi

# 3) Helpful aliases + a 'save' helper that pushes to dev (never main)
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

echo ">>> Done. Open a NEW terminal, then run: opencode"
echo ">>> Pick a model with /models. Providers: openrouter, cloudflare, bluesminds."
