import { existsSync, writeFileSync, unlinkSync } from 'fs'
import type { Subprocess } from 'bun'

const DATA_DIR = process.env.DATA_DIR || './data'
const VENV_DIR = `${DATA_DIR}/kokoro-venv`
const PID_FILE = `${DATA_DIR}/kokoro.pid`
const KOKORO_PORT = 8880
const KOKORO_URL = `http://localhost:${KOKORO_PORT}`

let kokoroProcess: Subprocess | null = null

async function isRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${KOKORO_URL}/health`, { signal: AbortSignal.timeout(1000) })
    return res.ok
  } catch { return false }
}

async function startKokoro(): Promise<void> {
  if (await isRunning()) return
  if (!existsSync(`${VENV_DIR}/bin/python3`)) throw new Error('Kokoro not installed. Run scripts/setup-models.sh')

  // Create a minimal FastAPI TTS server script
  const serverScript = `${DATA_DIR}/kokoro-server.py`
  if (!existsSync(serverScript)) {
    writeFileSync(serverScript, `
import io, uvicorn
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from kokoro_onnx import Kokoro

app = FastAPI()
kokoro = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")

class TTSReq(BaseModel):
    text: str
    language: str = "en"

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/tts")
async def tts(req: TTSReq):
    voice = "af_heart" if req.language == "en" else "af_heart"
    samples, sr = kokoro.create(req.text, voice=voice, speed=1.0)
    buf = io.BytesIO()
    import soundfile as sf
    sf.write(buf, samples, sr, format="WAV")
    buf.seek(0)
    return StreamingResponse(buf, media_type="audio/wav")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=${KOKORO_PORT})
`)
  }

  kokoroProcess = Bun.spawn([`${VENV_DIR}/bin/python3`, serverScript], {
    stdout: 'ignore', stderr: 'ignore',
  })
  writeFileSync(PID_FILE, String(kokoroProcess.pid))

  // Wait for startup (max 15 seconds)
  for (let i = 0; i < 30; i++) {
    await Bun.sleep(500)
    if (await isRunning()) return
  }
  throw new Error('Kokoro TTS failed to start within 15 seconds')
}

export async function synthesize(text: string, language: string = 'en'): Promise<Response> {
  await startKokoro()
  const res = await fetch(`${KOKORO_URL}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language }),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`Kokoro TTS error: ${res.status}`)
  return res
}

export function shutdownTts() {
  if (kokoroProcess) {
    kokoroProcess.kill()
    kokoroProcess = null
  }
  try { unlinkSync(PID_FILE) } catch {}
}

// Cleanup on exit
process.on('exit', shutdownTts)
process.on('SIGTERM', () => { shutdownTts(); process.exit(0) })
process.on('SIGINT', () => { shutdownTts(); process.exit(0) })
