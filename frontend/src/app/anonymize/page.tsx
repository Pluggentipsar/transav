"use client";

import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { anonymizeText } from "@/services/api";

export default function AnonymizePage() {
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [enableNer, setEnableNer] = useState(true);
  const [enablePatterns, setEnablePatterns] = useState(true);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: anonymizeText,
    onSuccess: (data) => {
      setOutputText(data.anonymized_text);
    },
  });

  const handleAnonymize = useCallback(() => {
    if (!inputText.trim()) return;
    mutation.mutate({
      text: inputText,
      enable_ner: enableNer,
      enable_patterns: enablePatterns,
    });
  }, [inputText, enableNer, enablePatterns, mutation]);

  const handleCopy = useCallback(async () => {
    if (!outputText) return;
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }, [outputText]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        handleAnonymize();
      }
    },
    [handleAnonymize]
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck className="h-6 w-6 text-primary-400" />
          <h2 className="text-2xl font-bold text-white">Anonymisera text</h2>
        </div>
        <p className="text-gray-400">
          Anonymisera fristaende text med AI-baserad NER och monstermatching.
          Personuppgifter som namn, personnummer, telefonnummer och adresser
          ersatts med platshallare.
        </p>
      </div>

      {/* Settings */}
      <div className="bg-dark-900 border border-dark-800 rounded-lg p-5 mb-6 space-y-4">
        <Toggle
          checked={enableNer}
          onChange={setEnableNer}
          label="AI-baserad NER"
          description="Anvand maskininlarning for att identifiera namngivna entiteter (namn, platser, organisationer)"
          disabled={mutation.isPending}
        />
        <Toggle
          checked={enablePatterns}
          onChange={setEnablePatterns}
          label="Monstermatching"
          description="Anvand regex-monster for att hitta personnummer, telefonnummer, e-post och andra monster"
          disabled={mutation.isPending}
        />
      </div>

      {/* Input / Output grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Input */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Originaltext
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Skriv eller klistra in text har...&#10;&#10;Exempel: Johan Andersson bor pa Storgatan 12 i Stockholm. Hans personnummer ar 850101-1234."
            className="w-full h-64 bg-dark-900 border border-dark-800 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-all"
            disabled={mutation.isPending}
          />
          <p className="text-xs text-gray-600 mt-1">
            {inputText.length} tecken &middot; Ctrl+Enter for att anonymisera
          </p>
        </div>

        {/* Output */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">
              Anonymiserad text
            </label>
            {outputText && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary-400 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" />
                    Kopierad
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Kopiera
                  </>
                )}
              </button>
            )}
          </div>
          <div className="w-full h-64 bg-dark-900 border border-dark-800 rounded-lg px-4 py-3 text-sm overflow-y-auto">
            {mutation.isPending ? (
              <div className="flex items-center gap-2 text-gray-500 h-full justify-center">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Anonymiserar...
              </div>
            ) : outputText ? (
              <p className="text-gray-200 whitespace-pre-wrap">{outputText}</p>
            ) : (
              <p className="text-gray-600 italic">
                Anonymiserad text visas har...
              </p>
            )}
          </div>
          {mutation.data && (
            <p className="text-xs text-gray-600 mt-1">
              {mutation.data.entities_found} entitet
              {mutation.data.entities_found !== 1 ? "er" : ""} hittade och
              ersatta
            </p>
          )}
        </div>
      </div>

      {/* Error */}
      {mutation.isError && (
        <div className="mt-4 bg-red-600/10 border border-red-600/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-400">
              Anonymiseringen misslyckades
            </p>
            <p className="text-xs text-red-400/70 mt-1">
              Kontrollera att backend-servern ar igang och att NER-modellen ar
              tillganglig.
            </p>
          </div>
        </div>
      )}

      {/* Action */}
      <div className="mt-6">
        <Button
          onClick={handleAnonymize}
          disabled={!inputText.trim() || (!enableNer && !enablePatterns)}
          loading={mutation.isPending}
          icon={<ShieldCheck className="h-5 w-5" />}
          size="lg"
          className="w-full md:w-auto"
        >
          Anonymisera
        </Button>
        {!enableNer && !enablePatterns && (
          <p className="text-xs text-yellow-400 mt-2">
            Aktivera minst en anonymiseringsmetod.
          </p>
        )}
      </div>
    </div>
  );
}
