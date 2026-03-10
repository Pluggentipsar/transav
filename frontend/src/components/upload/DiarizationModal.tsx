"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Key,
  ExternalLink,
  Check,
  AlertTriangle,
  X,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import type { DiarizationStatus } from "@/types";
import { getDiarizationStatus, setHfToken } from "@/services/api";
import { Button } from "@/components/ui/Button";

interface DiarizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSkip: () => void;
}

type ModalState = "loading" | "ready" | "setup" | "error";

export function DiarizationModal({
  isOpen,
  onClose,
  onSkip,
}: DiarizationModalProps) {
  const [modalState, setModalState] = useState<ModalState>("loading");
  const [status, setStatus] = useState<DiarizationStatus | null>(null);
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchStatus = useCallback(async () => {
    setModalState("loading");
    try {
      const result = await getDiarizationStatus();
      setStatus(result);
      setModalState(result.ready ? "ready" : "setup");
    } catch {
      setModalState("error");
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setToken("");
      setShowToken(false);
      setSaveError(null);
      setSaveSuccess(false);
      fetchStatus();
    }
  }, [isOpen, fetchStatus]);

  const handleSaveToken = async () => {
    if (!token.trim()) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const result = await setHfToken(token.trim());
      if (result.is_set) {
        setSaveSuccess(true);
        // Re-check status after saving
        setTimeout(() => {
          fetchStatus();
        }, 1000);
      } else {
        setSaveError("Token kunde inte sparas. Kontrollera att den ar giltig.");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setSaveError(err.message);
      } else {
        setSaveError("Ett fel uppstod vid sparande av token.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-[480px] bg-dark-900 border border-dark-800 rounded-xl shadow-2xl">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors"
          aria-label="Stang"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary-600/10">
            <Users className="h-5 w-5 text-primary-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">
            Talaridentifiering
          </h3>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          {/* Loading state */}
          {modalState === "loading" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 text-primary-400 animate-spin" />
              <p className="text-sm text-gray-400">Kontrollerar status...</p>
            </div>
          )}

          {/* Error state */}
          {modalState === "error" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-red-600/10 border border-red-600/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-400">
                    Kunde inte kontrollera status
                  </p>
                  <p className="text-xs text-red-400/70 mt-1">
                    Servern svarar inte. Kontrollera att backend-servern ar
                    igang.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={onSkip} className="flex-1">
                  Hoppa over
                </Button>
                <Button onClick={fetchStatus} className="flex-1">
                  Forsok igen
                </Button>
              </div>
            </div>
          )}

          {/* Ready state */}
          {modalState === "ready" && status && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-green-600/10 border border-green-600/20 rounded-lg">
                <Check className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-400">
                    Talaridentifiering ar redo!
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {status.model_local
                      ? "Pyannote-modellen finns lokalt \u2013 inget extra kravs."
                      : "HuggingFace-token ar konfigurerad."}
                  </p>
                </div>
              </div>
              <Button onClick={onClose} className="w-full">
                Stang
              </Button>
            </div>
          )}

          {/* Setup state */}
          {modalState === "setup" && (
            <div className="space-y-5">
              {/* Description */}
              <div className="space-y-2">
                <p className="text-sm text-gray-300">
                  Talaridentifiering identifierar vem som pratar i en
                  inspelning. Funktionen anvander pyannote.audio, en AI-modell
                  som kraver en gratis HuggingFace-token.
                </p>
                <div className="flex items-start gap-2 p-2.5 bg-dark-800/50 border border-dark-800 rounded-lg">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-400">
                    Detta ar valfritt &ndash; transkription fungerar utan detta.
                  </p>
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Steg-for-steg
                </p>

                {/* Step 1 */}
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary-600/20 text-primary-400 text-xs font-semibold flex-shrink-0">
                    1
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <a
                      href="https://huggingface.co/join"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary-400 hover:text-primary-300 transition-colors"
                    >
                      Skapa ett gratis konto pa HuggingFace
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary-600/20 text-primary-400 text-xs font-semibold flex-shrink-0">
                    2
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <a
                      href="https://huggingface.co/pyannote/speaker-diarization-community-1"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary-400 hover:text-primary-300 transition-colors"
                    >
                      Godkann modellens anvandarvillkor
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary-600/20 text-primary-400 text-xs font-semibold flex-shrink-0">
                    3
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <a
                      href="https://huggingface.co/settings/tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary-400 hover:text-primary-300 transition-colors"
                    >
                      Skapa en access token
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary-600/20 text-primary-400 text-xs font-semibold flex-shrink-0">
                    4
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm text-gray-300 mb-2">
                      Klistra in din token har:
                    </p>

                    {/* Token input */}
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
                      <input
                        type={showToken ? "text" : "password"}
                        value={token}
                        onChange={(e) => {
                          setToken(e.target.value);
                          setSaveError(null);
                          setSaveSuccess(false);
                        }}
                        placeholder="hf_..."
                        className="w-full bg-dark-950 border border-dark-800 rounded-lg pl-10 pr-10 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                        aria-label={showToken ? "Dolj token" : "Visa token"}
                      >
                        {showToken ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    {/* Save error */}
                    {saveError && (
                      <div className="flex items-start gap-2 mt-2 p-2 bg-red-600/10 border border-red-600/20 rounded-lg">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-400">{saveError}</p>
                      </div>
                    )}

                    {/* Save success */}
                    {saveSuccess && (
                      <div className="flex items-center gap-2 mt-2 p-2 bg-green-600/10 border border-green-600/20 rounded-lg">
                        <Check className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                        <p className="text-xs text-green-400">
                          Token sparad! Kontrollerar status...
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  onClick={onSkip}
                  className="flex-1"
                >
                  Hoppa over
                </Button>
                <Button
                  onClick={handleSaveToken}
                  disabled={!token.trim() || saving}
                  loading={saving}
                  className="flex-1"
                  icon={<Key className="h-4 w-4" />}
                >
                  {saving ? "Sparar..." : "Spara token"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
