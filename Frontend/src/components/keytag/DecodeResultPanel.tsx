import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KEYTAG_FORMATS } from "@/lib/keytag";

interface DecodeResultPanelProps {
  decodedValue?: string | null;
  decodedFormat?: string | null;
  value: string;
  format: string;
  onValueChange: (value: string) => void;
  onFormatChange: (value: string) => void;
  onConfirm: () => void;
  isSaving: boolean;
  validationError?: string | null;
  showFormat?: boolean;
}

export default function DecodeResultPanel({
  decodedValue,
  decodedFormat,
  value,
  format,
  onValueChange,
  onFormatChange,
  onConfirm,
  isSaving,
  validationError,
  showFormat = true,
}: DecodeResultPanelProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="keytag-value">Keytag #</Label>
        <Input
          id="keytag-value"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder="Enter barcode value"
          className="font-mono"
        />
      </div>
      {showFormat && (
        <div className="space-y-2">
          <Label htmlFor="keytag-format">Barcode format</Label>
          <Select value={format} onValueChange={onFormatChange}>
            <SelectTrigger id="keytag-format">
              <SelectValue placeholder="Choose a format" />
            </SelectTrigger>
            <SelectContent>
              {KEYTAG_FORMATS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {validationError && (
        <div className="text-sm text-destructive">{validationError}</div>
      )}

      <Button onClick={onConfirm} disabled={isSaving || !value.trim() || Boolean(validationError)}>
        {isSaving ? "Saving..." : "Confirm & Save"}
      </Button>
    </div>
  );
}
