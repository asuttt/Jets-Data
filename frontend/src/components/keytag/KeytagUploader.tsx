import { Label } from "@/components/ui/label";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface KeytagUploaderProps {
  onFileSelected: (file: File) => void;
  isDecoding: boolean;
}

export default function KeytagUploader({ onFileSelected, isDecoding }: KeytagUploaderProps) {
  const [fileName, setFileName] = useState("No file selected");

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      onFileSelected(file);
    } else {
      setFileName("No file selected");
    }
    event.target.value = "";
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="keytag-upload">Upload a keytag photo</Label>
      <input
        id="keytag-upload"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        disabled={isDecoding}
        className="sr-only"
      />
      <label
        htmlFor="keytag-upload"
        className={cn(
          "flex h-10 w-full items-center gap-3 rounded-md border border-input bg-background px-3 text-sm text-foreground",
          isDecoding && "cursor-not-allowed opacity-60"
        )}
      >
        <span className="inline-flex h-7 items-center rounded-md bg-muted px-3 text-sm font-medium text-foreground">
          Choose File
        </span>
        <span className="truncate text-muted-foreground">{fileName}</span>
      </label>
    </div>
  );
}
