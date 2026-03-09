"use client";

import { useState, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
  Download,
  FileText,
  FileType,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { CustomWordsInput } from "@/components/anonymize/CustomWordsInput";
import { AnonymizedOutput } from "@/components/anonymize/AnonymizedOutput";
import { EntityStats } from "@/components/anonymize/EntityStats";
import { anonymizeText, listTemplates } from "@/services/api";
import { NER_ENTITY_TYPES, PATTERN_CATEGORIES } from "@/utils/format";
import type { WordReplacement, TemplateResponse } from "@/types";

export default function AnonymizePage() {
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [enableNer, setEnableNer] = useState(true);
  const [enablePatterns, setEnablePatterns] = useState(true);
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<string[]>(
    NER_ENTITY_TYPES.map((e) => e.id)
  );
  const [selectedPatternTypes, setSelectedPatternTypes] = useState<string[]>(
    PATTERN_CATEGORIES.map((p) => p.id)
  );
  const [customWords, setCustomWords] = useState<WordReplacement[]>([]);
  const [templates, setTemplates] = useState<TemplateResponse[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    listTemplates()
      .then((res) => setTemplates(res.templates))
      .catch(() => {});
  }, []);

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
      use_ner: enableNer,
      use_patterns: enablePatterns,
      entity_types: enableNer ? selectedEntityTypes : undefined,
      pattern_types: enablePatterns ? selectedPatternTypes : undefined,
      custom_words: customWords.length > 0 ? customWords : undefined,
    });
  }, [
    inputText,
    enableNer,
    enablePatterns,
    selectedEntityTypes,
    selectedPatternTypes,
    customWords,
    mutation,
  ]);

  const handleSelectTemplate = useCallback(
    (template: TemplateResponse) => {
      const existing = new Set(
        customWords.map((w) => w.original.toLowerCase())
      );
      const newWords = template.words.filter(
        (w) => !existing.has(w.original.toLowerCase())
      );
      setCustomWords([...customWords, ...newWords]);
    },
    [customWords]
  );

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

  const handleDownloadTxt = useCallback(() => {
    if (!outputText) return;
    const blob = new Blob([outputText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "anonymiserad-text.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [outputText]);

  const handleDownloadDoc = useCallback(() => {
    if (!outputText) return;
    const htmlContent = outputText
      .split("\n")
      .map((line) => `<p>${line || "&nbsp;"}</p>`)
      .join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Anonymiserad text</title></head><body style="font-family: Calibri, sans-serif; font-size: 11pt;">${htmlContent}</body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "anonymiserad-text.doc";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [outputText]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        handleAnonymize();
      }
    },
    [handleAnonymize]
  );

  const toggleEntityType = useCallback(
    (id: string) => {
      setSelectedEntityTypes((prev) =>
        prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
      );
    },
    []
  );

  const togglePatternType = useCallback(
    (id: string) => {
      setSelectedPatternTypes((prev) =>
        prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
      );
    },
    []
  );

  const hasAnyMethod = enableNer || enablePatterns || customWords.length > 0;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck className="h-6 w-6 text-primary-400" />
          <h2 className="text-2xl font-bold text-white">Anonymisera text</h2>
        </div>
        <p className="text-gray-400">
          Anonymisera fristående text med AI-baserad NER och mönstermatchning.
          Personuppgifter som namn, personnummer, telefonnummer och adresser
          ersätts med platshållare.
        </p>
      </div>

      {/* Settings */}
      <div className="bg-dark-900 border border-dark-800 rounded-lg p-5 mb-6 space-y-4">
        {/* NER section */}
        <div>
          <Toggle
            checked={enableNer}
            onChange={setEnableNer}
            label="AI-baserad NER"
            description="Använd maskininlärning för att identifiera namngivna entiteter"
            disabled={mutation.isPending}
          />
          {enableNer && (
            <div className="mt-3 ml-14">
              <div className="flex flex-wrap gap-2 mb-1.5">
                {NER_ENTITY_TYPES.map((etype) => {
                  const selected = selectedEntityTypes.includes(etype.id);
                  return (
                    <button
                      key={etype.id}
                      onClick={() => toggleEntityType(etype.id)}
                      disabled={mutation.isPending}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                        selected
                          ? "bg-primary-600/20 text-primary-300 border-primary-600/40"
                          : "bg-dark-800 text-gray-500 border-dark-700 hover:text-gray-300"
                      } disabled:opacity-50`}
                      title={etype.description}
                    >
                      {etype.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() =>
                    setSelectedEntityTypes(NER_ENTITY_TYPES.map((e) => e.id))
                  }
                  className="text-gray-500 hover:text-primary-400 transition-colors"
                >
                  Alla
                </button>
                <span className="text-gray-700">|</span>
                <button
                  onClick={() => setSelectedEntityTypes([])}
                  className="text-gray-500 hover:text-primary-400 transition-colors"
                >
                  Inga
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Patterns section */}
        <div>
          <Toggle
            checked={enablePatterns}
            onChange={setEnablePatterns}
            label="Mönstermatchning"
            description="Använd regex-mönster för att hitta personnummer, telefonnummer, e-post m.m."
            disabled={mutation.isPending}
          />
          {enablePatterns && (
            <div className="mt-3 ml-14">
              <div className="flex flex-wrap gap-2 mb-1.5">
                {PATTERN_CATEGORIES.map((cat) => {
                  const selected = selectedPatternTypes.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => togglePatternType(cat.id)}
                      disabled={mutation.isPending}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                        selected
                          ? "bg-primary-600/20 text-primary-300 border-primary-600/40"
                          : "bg-dark-800 text-gray-500 border-dark-700 hover:text-gray-300"
                      } disabled:opacity-50`}
                      title={cat.description}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() =>
                    setSelectedPatternTypes(
                      PATTERN_CATEGORIES.map((p) => p.id)
                    )
                  }
                  className="text-gray-500 hover:text-primary-400 transition-colors"
                >
                  Alla
                </button>
                <span className="text-gray-700">|</span>
                <button
                  onClick={() => setSelectedPatternTypes([])}
                  className="text-gray-500 hover:text-primary-400 transition-colors"
                >
                  Inga
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Custom words */}
        <div className="pt-2 border-t border-dark-800">
          <label className="block text-sm font-medium text-gray-200 mb-2">
            Egna ord att avidentifiera
          </label>
          <CustomWordsInput
            words={customWords}
            onChange={setCustomWords}
            templates={templates}
            onSelectTemplate={handleSelectTemplate}
            disabled={mutation.isPending}
          />
        </div>
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
            placeholder={
              "Skriv eller klistra in text här...\n\nExempel: Johan Andersson bor på Storgatan 12 i Stockholm. Hans personnummer är 850101-1234."
            }
            className="w-full h-64 bg-dark-900 border border-dark-800 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-all"
            disabled={mutation.isPending}
          />
          <p className="text-xs text-gray-600 mt-1">
            {inputText.length} tecken &middot; Ctrl+Enter för att anonymisera
          </p>
        </div>

        {/* Output */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">
              Anonymiserad text
            </label>
            {outputText && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary-400 transition-colors"
                  title="Kopiera till urklipp"
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
                <button
                  onClick={handleDownloadTxt}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary-400 transition-colors"
                  title="Ladda ner som textfil"
                >
                  <FileText className="h-3 w-3" />
                  .txt
                </button>
                <button
                  onClick={handleDownloadDoc}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary-400 transition-colors"
                  title="Ladda ner som Word-dokument"
                >
                  <FileType className="h-3 w-3" />
                  .doc
                </button>
              </div>
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
              <AnonymizedOutput
                text={outputText}
                className="text-gray-200 leading-relaxed"
              />
            ) : (
              <p className="text-gray-600 italic">
                Anonymiserad text visas här...
              </p>
            )}
          </div>
          {mutation.data && (
            <div>
              <p className="text-xs text-gray-600 mt-1">
                {mutation.data.entities_found} entitet
                {mutation.data.entities_found !== 1 ? "er" : ""} hittade och
                ersatta
              </p>
              <EntityStats entityCounts={mutation.data.entity_counts} />
            </div>
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
              Kontrollera att backend-servern är igång och att NER-modellen är
              tillgänglig.
            </p>
          </div>
        </div>
      )}

      {/* Action */}
      <div className="mt-6">
        <Button
          onClick={handleAnonymize}
          disabled={!inputText.trim() || !hasAnyMethod}
          loading={mutation.isPending}
          icon={<ShieldCheck className="h-5 w-5" />}
          size="lg"
          className="w-full md:w-auto"
        >
          Anonymisera
        </Button>
        {!hasAnyMethod && (
          <p className="text-xs text-yellow-400 mt-2">
            Aktivera minst en anonymiseringsmetod eller lägg till egna ord.
          </p>
        )}
      </div>
    </div>
  );
}
