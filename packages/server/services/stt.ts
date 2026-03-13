import { tmpdir } from 'os'
import { join } from 'path'
import { unlinkSync, existsSync } from 'fs'
import { nanoid } from 'nanoid'

const DATA_DIR = process.env.DATA_DIR || './data'
const WHISPER_BIN = `${DATA_DIR}/bin/whisper-cpp`
const WHISPER_MODEL = `${DATA_DIR}/models/ggml-base.en.bin`

export async function transcribe(audioBuffer: ArrayBuffer): Promise<{ text: string; language: string; duration: number }> {
  if (!existsSync(WHISPER_BIN)) throw new Error('whisper.cpp not installed. Run scripts/setup-models.sh')
  if (!existsSync(WHISPER_MODEL)) throw new Error('Whisper model not found. Run scripts/setup-models.sh')

  const id = nanoid(8)
  const inputPath = join(tmpdir(), `magpie-stt-${id}.webm`)
  const wavPath = join(tmpdir(), `magpie-stt-${id}.wav`)
  const jsonPath = join(tmpdir(), `magpie-stt-${id}.json`)

  try {
    // Write input audio
    await Bun.write(inputPath, audioBuffer)

    // Convert to 16kHz mono WAV
    const ffmpeg = Bun.spawn(['ffmpeg', '-y', '-i', inputPath, '-ar', '16000', '-ac', '1', '-f', 'wav', wavPath], {
      stdout: 'ignore', stderr: 'ignore',
    })
    const ffmpegExit = await ffmpeg.exited
    if (ffmpegExit !== 0) throw new Error('FFmpeg audio conversion failed')

    // Run whisper.cpp
    const whisper = Bun.spawn([
      WHISPER_BIN, '-m', WHISPER_MODEL, '-f', wavPath,
      '--output-json', '--output-file', jsonPath.replace('.json', ''),
      '--no-prints',
    ], { stdout: 'ignore', stderr: 'ignore' })

    const timeoutId = setTimeout(() => whisper.kill(), 10000)
    const exitCode = await whisper.exited
    clearTimeout(timeoutId)

    if (exitCode !== 0) throw new Error('whisper.cpp transcription failed')

    // Parse result
    const result = await Bun.file(jsonPath).json() as {
      transcription: Array<{ text: string }>
      result?: { language?: string }
    }
    const text = result.transcription?.map(s => s.text).join(' ').trim() || ''
    return { text, language: result.result?.language || 'en', duration: 0 }
  } finally {
    // Cleanup temp files
    for (const f of [inputPath, wavPath, jsonPath]) {
      try { unlinkSync(f) } catch {}
    }
  }
}
