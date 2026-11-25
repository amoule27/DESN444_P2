// On-device speech-to-text for voice replies (Whisper via Transformers.js), run in a Web Worker so
// transcription never blocks the VR render loop. Audio never leaves the device: the model is downloaded
// once from Hugging Face, then served from the browser cache.
//
// Messages in:  { type: 'load' }
//               { type: 'transcribe', id, audio: Float32Array (16 kHz mono), prompt: string }
// Messages out: { type: 'progress', pct } · { type: 'ready', device } · { type: 'failed', message }
//               { type: 'result', id, text } · { type: 'error', id, message }
//
// Tested on Quest 3 (Quest Browser 157): whisper-base, WebGPU, fp16 ≈ 1.2–2 s per reply.
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js';

const MODEL = 'onnx-community/whisper-base';
let asr = null, tok = null; // tok = special token ids used for prompting

async function pickDevice() {
  try {
    const a = navigator.gpu && await navigator.gpu.requestAdapter();
    if (a) return { device: 'webgpu', dtype: a.features.has('shader-f16') ? 'fp16' : 'fp32' };
  } catch (e) { /* fall through to CPU */ }
  return { device: 'wasm', dtype: 'q8' };
}

// "Prompting": <|startofprev|> + the reply the student chose, before the normal start tokens. Whisper then
// expects that wording, which fixes most learner-accent slips ("s'il vous plaît" → "si vous pliez").
// On the headset this did not make Whisper parrot the prompt when something else was said.
// Transformers.js 4.3.2 has no prompt_ids option, so decoder_input_ids are built by hand.
async function transcribe(audio, prompt) {
  const { model, tokenizer, processor } = asr;
  const text = prompt ? tokenizer.encode(' ' + prompt.trim(), { add_special_tokens: false }) : [];
  const init = [...(text.length ? [tok.prev, ...text] : []), tok.sot, tok.fr, tok.task, tok.nots];
  const { input_features } = await processor(audio);
  // Whisper can get stuck repeating a word ("Javro, Javro, …" took 29 s on the headset). A reply is short, so cap the
  // output at about twice the expected length. (Not no_repeat_ngram_size or repetition_penalty: those would also
  // penalise the prompt's own tokens, i.e. stop Whisper from writing the expected reply.)
  const max_new_tokens = text.length ? Math.min(64, text.length * 2 + 10) : 64;
  const out = await model.generate({ inputs: input_features, decoder_input_ids: init, max_new_tokens });
  const ids = out.tolist()[0].map(Number);
  return tokenizer.decode(ids.slice(ids.lastIndexOf(tok.nots) + 1), { skip_special_tokens: true }).trim();
}

async function load() {
  const { device, dtype } = await pickDevice();
  const files = new Map(); let last = -1;
  asr = await pipeline('automatic-speech-recognition', MODEL, {
    device, dtype: { encoder_model: dtype, decoder_model_merged: dtype },
    progress_callback: (p) => {
      if (p.status !== 'progress' || !p.total) return;
      files.set(p.file, [p.loaded, p.total]);
      let l = 0, t = 0; files.forEach(([a, b]) => { l += a; t += b; });
      const pct = Math.floor((l / t) * 100);
      if (pct !== last) { last = pct; postMessage({ type: 'progress', pct }); }
    },
  });
  const [prev, sot, fr, task, nots] = asr.tokenizer.convert_tokens_to_ids(['<|startofprev|>', '<|startoftranscript|>', '<|fr|>', '<|transcribe|>', '<|notimestamps|>']);
  tok = { prev, sot, fr, task, nots };
  // Warm-up: the first run compiles GPU shaders (~1 s extra), so do it now rather than on the student's first reply.
  await transcribe(new Float32Array(16000), '');
  return device;
}

let loading = null;
onmessage = async ({ data: d }) => {
  if (d.type === 'load') {
    loading ||= load().then((device) => postMessage({ type: 'ready', device }), (e) => postMessage({ type: 'failed', message: String(e?.message || e) }));
    return;
  }
  if (d.type === 'transcribe') {
    try {
      await loading;
      postMessage({ type: 'result', id: d.id, text: await transcribe(d.audio, d.prompt) });
    } catch (e) { postMessage({ type: 'error', id: d.id, message: String(e?.message || e) }); }
  }
};
