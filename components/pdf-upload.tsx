"use client";

import { useRef, useState } from "react";
import { Upload, X, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/toast";

export interface PDFUploadState {
  documentId: string | null;
  filename: string | null;
  chunkCount: number | null;
  isLoading: boolean;
  error: string | null;
}

interface PDFUploadProps {
  onUploadSuccess: (documentId: string, filename: string) => void;
  disabled?: boolean;
}

export function PDFUpload({ onUploadSuccess, disabled = false }: PDFUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<PDFUploadState>({
    documentId: null,
    filename: null,
    chunkCount: null,
    isLoading: false,
    error: null,
  });

  const handleFileSelect = async (file: File) => {
    if (!file.type.includes("pdf")) {
      setUploadState((prev) => ({
        ...prev,
        error: "Please select a valid PDF file",
      }));
      toast({
        type: "error",
        description: "Only PDF files are allowed",
      });
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      // 50MB limit
      setUploadState((prev) => ({
        ...prev,
        error: "File is too large (max 50MB)",
      }));
      toast({
        type: "error",
        description: "File is too large (max 50MB)",
      });
      return;
    }

    setUploadState({
      documentId: null,
      filename: null,
      chunkCount: null,
      isLoading: true,
      error: null,
    });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/pdf/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload PDF");
      }

      setUploadState({
        documentId: data.documentId,
        filename: data.filename,
        chunkCount: data.chunkCount,
        isLoading: false,
        error: null,
      });

      onUploadSuccess(data.documentId, data.filename);

      toast({
        type: "success",
        description: `PDF uploaded successfully! (${data.chunkCount} chunks)`,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to upload PDF";

      setUploadState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      toast({
        type: "error",
        description: errorMessage,
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleClear = () => {
    setUploadState({
      documentId: null,
      filename: null,
      chunkCount: null,
      isLoading: false,
      error: null,
    });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  if (uploadState.documentId) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 dark:border-green-900 dark:bg-green-950">
        <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
        <div className="flex-1 text-sm">
          <p className="font-medium text-green-900 dark:text-green-100">
            {uploadState.filename}
          </p>
          <p className="text-xs text-green-700 dark:text-green-300">
            {uploadState.chunkCount} chunks extracted
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={disabled}
          className="h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="space-y-2"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleInputChange}
        disabled={disabled || uploadState.isLoading}
        className="hidden"
      />

      <button
        onClick={handleUploadClick}
        disabled={disabled || uploadState.isLoading}
        className="w-full rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 px-4 py-6 transition-colors hover:border-muted-foreground/50 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <Upload className="h-6 w-6 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {uploadState.isLoading ? "Uploading..." : "Upload PDF"}
            </p>
            <p className="text-xs text-muted-foreground">
              Click to upload or drag and drop (max 50MB)
            </p>
          </div>
        </div>
      </button>

      {uploadState.error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-800 dark:text-red-200">
            {uploadState.error}
          </p>
        </div>
      )}
    </div>
  );
}
