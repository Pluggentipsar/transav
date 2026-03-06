---
paths:
  - "backend/app/services/transcription.py"
  - "backend/app/services/diarization.py"
  - "backend/app/services/anonymization.py"
  - "backend/app/workers/**/*.py"
---

# ML Pipeline-regler

## Modeller
- **Transkription:** faster-whisper med KBLab/kb-whisper-modeller (5 storlekar)
- **Diarization:** WhisperX + pyannote.audio (kraver HuggingFace-token)
- **Anonymisering:** KB-BERT NER-pipeline (transformers)

## Prestanda
- Cacha ALLTID laddade modeller - att ladda om ar extremt dyrt
- Anvand `clear_model_cache()` for att frigora GPU-minne vid behov
- Max 2 samtida transkriptionsjobb (ThreadPoolExecutor)
- 30 min timeout per jobb

## Felhantering
- Diarization och anonymisering ar VALFRIA - graceful degradation om ej installerade
- Kontrollera om bibliotek finns med try/import fore anvandning
- HuggingFace gated models ger kryptiska fel om token saknas - ge tydligt felmeddelande

## Progress
- Transkription: 5-70%
- Diarization: 70-90%
- Anonymisering: 90-95%
- Spara till DB: 95-100%
- Rapportera via `queue.Queue` fran bakgrundstrad

## PyTorch-kompatibilitet
- Patcha `torch.load()` for weights_only=True (PyTorch 2.6+)
- Patcha i BADE main.py och workers for att tacka alla kodvagar
