#!/bin/bash
set -euo pipefail

DATA_DIR="${DATA_DIR:-./data}"
BIN_DIR="$DATA_DIR/bin"
MODELS_DIR="$DATA_DIR/models"
VENV_DIR="$DATA_DIR/kokoro-venv"

mkdir -p "$BIN_DIR" "$MODELS_DIR"

echo "=== Magpie Voice Setup ==="

# 1. whisper.cpp
if [ ! -f "$BIN_DIR/whisper-cpp" ]; then
  echo "[1/3] Building whisper.cpp..."
  TMPDIR=$(mktemp -d)
  git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git "$TMPDIR/whisper.cpp"
  cd "$TMPDIR/whisper.cpp"
  make clean && WHISPER_METAL=1 make -j$(sysctl -n hw.ncpu) main
  cp main "$BIN_DIR/whisper-cpp"
  cd -
  rm -rf "$TMPDIR"
  echo "  whisper.cpp built successfully"
else
  echo "[1/3] whisper.cpp already installed, skipping"
fi

# 2. Whisper model
if [ ! -f "$MODELS_DIR/ggml-base.en.bin" ]; then
  echo "[2/3] Downloading whisper base.en model..."
  curl -L -o "$MODELS_DIR/ggml-base.en.bin" \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin"
  echo "  Model downloaded"
else
  echo "[2/3] Whisper model already present, skipping"
fi

# 3. Kokoro venv
if [ ! -d "$VENV_DIR" ]; then
  echo "[3/3] Setting up Kokoro TTS venv..."
  python3 -m venv "$VENV_DIR"
  "$VENV_DIR/bin/pip" install --quiet kokoro-onnx fastapi uvicorn soundfile
  echo "  Kokoro venv created"
else
  echo "[3/3] Kokoro venv already exists, skipping"
fi

echo "=== Setup complete ==="
