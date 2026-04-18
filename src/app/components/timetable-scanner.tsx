"use client";

import { Camera, ImageIcon, Loader2, X, Bus, MapPin } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import type { TimetableAnalysis } from "~/app/api/analyze-timetable/route";
import type { Target } from "~/timetable/models";

interface TimetableScannerProps {
  targets: Target[];
  onStopDetected: (target: Target) => void;
}

export function TimetableScanner({
  targets,
  onStopDetected,
}: TimetableScannerProps) {
  const [open, setOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<TimetableAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matchedTarget, setMatchedTarget] = useState<Target | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setImagePreview(null);
    setAnalysis(null);
    setError(null);
    setMatchedTarget(null);
    setIsAnalyzing(false);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  const findMatchingTarget = useCallback(
    (stopName: string | null): Target | null => {
      if (!stopName) return null;

      const normalizedSearch = stopName.toLowerCase().trim();

      // Try exact match first
      let match = targets.find(
        (t) =>
          t.Name.toLowerCase() === normalizedSearch ||
          t.Label.toLowerCase() === normalizedSearch
      );

      if (match) return match;

      // Try partial match
      match = targets.find(
        (t) =>
          t.Name.toLowerCase().includes(normalizedSearch) ||
          normalizedSearch.includes(t.Name.toLowerCase()) ||
          t.Label.toLowerCase().includes(normalizedSearch) ||
          normalizedSearch.includes(t.Label.toLowerCase())
      );

      if (match) return match;

      // Try word-based matching
      const searchWords = normalizedSearch.split(/\s+/);
      match = targets.find((t) => {
        const targetWords = t.Name.toLowerCase().split(/\s+/);
        return searchWords.some((sw) =>
          targetWords.some((tw) => tw.includes(sw) || sw.includes(tw))
        );
      });

      return match ?? null;
    },
    [targets]
  );

  const analyzeImage = useCallback(
    async (base64Image: string) => {
      setIsAnalyzing(true);
      setError(null);
      setAnalysis(null);
      setMatchedTarget(null);

      try {
        const response = await fetch("/api/analyze-timetable", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64Image }),
        });

        if (!response.ok) {
          throw new Error("Failed to analyze image");
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        const analysisResult = data.analysis as TimetableAnalysis;
        setAnalysis(analysisResult);

        // Try to match the detected stop name
        const matched = findMatchingTarget(analysisResult.stopName);
        setMatchedTarget(matched);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Errore durante l'analisi"
        );
      } finally {
        setIsAnalyzing(false);
      }
    },
    [findMatchingTarget]
  );

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Reset previous state
      reset();

      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        setImagePreview(base64);

        // Extract just the base64 data (remove data:image/...;base64, prefix)
        const base64Data = base64.split(",")[1];
        await analyzeImage(base64Data);
      };
      reader.readAsDataURL(file);

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [analyzeImage, reset]
  );

  const handleSelectStop = useCallback(() => {
    if (matchedTarget) {
      onStopDetected(matchedTarget);
      handleClose();
    }
  }, [matchedTarget, onStopDetected, handleClose]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full hover:bg-muted"
          aria-label="Scansiona tabellone"
        >
          <Camera className="h-5 w-5 text-primary" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-primary">
            Scansiona Tabellone
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Image selection */}
          {!imagePreview && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground text-center">
                Scatta una foto o seleziona un&apos;immagine del tabellone TPL
                per riconoscere automaticamente la fermata
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Galleria
                </Button>
                <Button
                  variant="default"
                  className="flex-1 bg-primary text-primary-foreground"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.capture = "environment";
                      fileInputRef.current.click();
                    }
                  }}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Fotocamera
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {/* Image preview */}
          {imagePreview && (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Tabellone"
                className="w-full rounded-lg border border-border"
              />
              {!isAnalyzing && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 bg-background/80 hover:bg-background"
                  onClick={reset}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {/* Loading state */}
          {isAnalyzing && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                Analisi in corso...
              </span>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          {/* Analysis results */}
          {analysis && !isAnalyzing && (
            <div className="flex flex-col gap-3">
              {/* Detected stop */}
              {analysis.stopName && (
                <div className="bg-card rounded-lg p-3 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-accent" />
                    <span className="text-sm font-medium text-foreground">
                      Fermata rilevata
                    </span>
                  </div>
                  <p className="font-semibold text-primary">
                    {analysis.stopName}
                  </p>
                  {analysis.stopLabel && (
                    <p className="text-xs text-muted-foreground">
                      {analysis.stopLabel}
                    </p>
                  )}
                </div>
              )}

              {/* Matched target */}
              {matchedTarget && (
                <div className="bg-accent/10 rounded-lg p-3 border border-accent/20">
                  <p className="text-sm text-accent font-medium mb-2">
                    Fermata trovata nel sistema:
                  </p>
                  <p className="font-semibold text-foreground">
                    {matchedTarget.Name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {matchedTarget.Label}
                  </p>
                </div>
              )}

              {/* No match found */}
              {analysis.stopName && !matchedTarget && (
                <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground">
                  Fermata non trovata nel sistema. Prova a cercare manualmente.
                </div>
              )}

              {/* Detected buses */}
              {analysis.buses.length > 0 && (
                <div className="bg-card rounded-lg p-3 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Bus className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">
                      Bus rilevati ({analysis.buses.length})
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                    {analysis.buses.map((bus, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 text-sm"
                      >
                        <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded font-mono font-semibold min-w-[2.5rem] text-center">
                          {bus.lineNumber}
                        </span>
                        <span className="flex-1 truncate text-foreground">
                          {bus.destination}
                        </span>
                        <span className="text-accent font-medium">
                          {bus.departureTime}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confidence indicator */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Affidabilita: {Math.round(analysis.confidence * 100)}%
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={reset}>
                  Nuova foto
                </Button>
                {matchedTarget && (
                  <Button
                    className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={handleSelectStop}
                  >
                    Vai alla fermata
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
