import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { mapFormatToJsBarcode } from "@/lib/keytag";
import { cn } from "@/lib/utils";

interface FullScreenKeytagProps {
  value: string;
  format?: string | null;
  className?: string;
}

export default function FullScreenKeytag({ value, format, className }: FullScreenKeytagProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      const jsFormat = mapFormatToJsBarcode(format);
      JsBarcode(svgRef.current, value, {
        format: jsFormat,
        displayValue: false,
        height: 200,
        width: 3,
        margin: 0,
        lineColor: "#000000",
        background: "#ffffff",
      });
      setRenderError(null);
    } catch (error) {
      console.warn("Failed to render barcode", error);
      setRenderError("Unable to render this barcode format.");
    }
  }, [value, format]);

  return (
    <div className={cn("rounded-2xl border border-border bg-white p-3 shadow-sm", className)}>
      {renderError ? (
        <div className="text-sm text-destructive">{renderError}</div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="w-full">
            <svg ref={svgRef} className="w-full h-52" aria-label="Barcode" />
          </div>
          <div className="text-sm font-mono tracking-widest text-foreground">
            {value}
          </div>
        </div>
      )}
    </div>
  );
}
