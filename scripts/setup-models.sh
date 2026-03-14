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
  echo "[1/4] Building whisper.cpp..."
  TMPDIR=$(mktemp -d)
  git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git "$TMPDIR/whisper.cpp"
  cd "$TMPDIR/whisper.cpp"
  make clean && WHISPER_METAL=1 make -j$(sysctl -n hw.ncpu) main
  cp main "$BIN_DIR/whisper-cpp"
  cd -
  rm -rf "$TMPDIR"
  echo "  whisper.cpp built successfully"
else
  echo "[1/4] whisper.cpp already installed, skipping"
fi

# 2. Whisper models (English + Multilingual for Mandarin)
if [ ! -f "$MODELS_DIR/ggml-base.en.bin" ]; then
  echo "[2/4] Downloading whisper base.en model..."
  curl -L -o "$MODELS_DIR/ggml-base.en.bin" \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin"
  echo "  English model downloaded"
else
  echo "[2/4] English whisper model already present, skipping"
fi

if [ ! -f "$MODELS_DIR/ggml-base.bin" ]; then
  echo "     Downloading whisper base (multilingual) model..."
  curl -L -o "$MODELS_DIR/ggml-base.bin" \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"
  echo "  Multilingual model downloaded"
else
  echo "     Multilingual whisper model already present, skipping"
fi

# 3. Kokoro venv
if [ ! -d "$VENV_DIR" ]; then
  echo "[3/4] Setting up Kokoro TTS venv..."
  python3 -m venv "$VENV_DIR"
  "$VENV_DIR/bin/pip" install --quiet kokoro-onnx fastapi uvicorn soundfile
  echo "  Kokoro venv created"
else
  echo "[3/4] Kokoro venv already exists, skipping"
fi

# 4. Kokoro ONNX model
if [ ! -f "$MODELS_DIR/kokoro-v1.0.onnx" ]; then
  echo "[4/4] Downloading Kokoro ONNX model..."
  curl -L -o "$MODELS_DIR/kokoro-v1.0.onnx" \
    "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx"
  curl -L -o "$MODELS_DIR/voices-v1.0.bin" \
    "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"
  echo "  Kokoro models downloaded"
else
  echo "[4/4] Kokoro models already present, skipping"
fi

echo "=== Setup complete ==="
