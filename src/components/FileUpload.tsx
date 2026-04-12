"use client";

import { useState, useRef } from "react";
import { Upload } from "lucide-react";

interface Attachment {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

interface FileUploadProps {
  entityType: "note" | "todo" | "calendarEvent" | "inboxItem";
  entityId: string;
  onUploadComplete?: (attachment: Attachment) => void;
}

export default function FileUpload({
  entityType,
  entityId,
  onUploadComplete,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", entityType);
      formData.append("entityId", entityId);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const attachment = await res.json();
      onUploadComplete?.(attachment);
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        onChange={handleUpload}
        accept="image/*,.pdf,.txt,.md,.json"
        className="hidden"
        id="file-upload"
      />
      <label
        htmlFor="file-upload"
        className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg cursor-pointer transition-colors ${
          uploading
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "bg-card border border-border text-foreground hover:bg-muted"
        }`}
      >
        <Upload className="w-4 h-4" />
        {uploading ? "Uploading..." : "Attach file"}
      </label>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}