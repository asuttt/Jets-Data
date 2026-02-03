import { BrowserMultiFormatReader } from "@zxing/browser";
import heic2any from "heic2any";
import type { Area } from "react-easy-crop";

export const KEYTAG_FORMATS = [
  { value: "CODE_128", label: "Code 128" },
  { value: "EAN_13", label: "EAN-13" },
  { value: "EAN_8", label: "EAN-8" },
  { value: "UPC_A", label: "UPC-A" },
  { value: "UPC_E", label: "UPC-E" },
  { value: "CODE_39", label: "Code 39" },
  { value: "ITF", label: "ITF" },
  { value: "CODABAR", label: "Codabar" },
  { value: "MSI", label: "MSI" },
];

export const DEFAULT_KEYTAG_FORMAT = "CODE_128";

const isHeicFile = (file: File) => {
  const type = file.type.toLowerCase();
  if (type.includes("heic") || type.includes("heif")) return true;
  return /\.(heic|heif)$/i.test(file.name);
};

export async function normalizeImageFile(file: File): Promise<File> {
  if (!isHeicFile(file)) return file;
  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92,
  });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  const nextName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
  return new File([blob], nextName, { type: blob.type || "image/jpeg" });
}

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = (event) => reject(event);
    img.src = url;
  });

export async function decodeBarcodeFromFile(file: File) {
  const reader = new BrowserMultiFormatReader();
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const result = await reader.decodeFromImageElement(image);
    return {
      text: result.getText(),
      format: result.getBarcodeFormat().toString(),
    };
  } finally {
    URL.revokeObjectURL(url);
    reader.reset();
  }
}

export async function decodeBarcodeFromBlob(blob: Blob, filename = "crop.jpg") {
  const file = blob instanceof File ? blob : new File([blob], filename, { type: blob.type || "image/jpeg" });
  return decodeBarcodeFromFile(file);
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

const createImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

export async function getCroppedImage(imageSrc: string, crop: Area): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const pixelRatio = window.devicePixelRatio || 1;

  canvas.width = Math.floor(crop.width * scaleX * pixelRatio);
  canvas.height = Math.floor(crop.height * scaleY * pixelRatio);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get canvas context");
  }

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    crop.width * scaleX,
    crop.height * scaleY
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to create image blob"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.95
    );
  });
}

export async function ocrKeytagDigits(blob: Blob) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker();
  try {
    await worker.loadLanguage("eng");
    await worker.initialize("eng");
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789",
      tessedit_pageseg_mode: "7",
    });
    const { data } = await worker.recognize(blob);
    const raw = data.text || "";
    const digitsOnly = raw.replace(/\D+/g, "");
    return {
      digits: digitsOnly,
      confidence: data.confidence,
    };
  } finally {
    await worker.terminate();
  }
}

export function mapFormatToJsBarcode(format?: string | null) {
  switch (format) {
    case "CODE_128":
      return "CODE128";
    case "CODE_39":
      return "CODE39";
    case "EAN_13":
      return "EAN13";
    case "EAN_8":
      return "EAN8";
    case "UPC_A":
      return "UPC";
    case "UPC_E":
      return "UPCE";
    case "ITF":
      return "ITF";
    case "CODABAR":
      return "codabar";
    case "MSI":
      return "msi";
    default:
      return "CODE128";
  }
}

export function validateKeytagValue(value: string, format?: string | null) {
  const trimmed = value.trim();
  if (!trimmed) return "Enter a keytag value.";
  if (trimmed.length < 6 || trimmed.length > 32) {
    return "Value must be between 6 and 32 characters.";
  }

  const normalizedFormat = format || DEFAULT_KEYTAG_FORMAT;
  const digitsOnly = /^\d+$/.test(trimmed);

  if (["EAN_13", "EAN_8", "UPC_A", "UPC_E"].includes(normalizedFormat)) {
    if (!digitsOnly) return "This format only allows digits.";
    if (normalizedFormat === "EAN_13" && trimmed.length !== 13) {
      return "EAN-13 requires exactly 13 digits.";
    }
    if (normalizedFormat === "EAN_8" && trimmed.length !== 8) {
      return "EAN-8 requires exactly 8 digits.";
    }
    if (normalizedFormat === "UPC_A" && trimmed.length !== 12) {
      return "UPC-A requires exactly 12 digits.";
    }
    if (normalizedFormat === "UPC_E" && trimmed.length !== 8) {
      return "UPC-E requires exactly 8 digits.";
    }
  }

  if (normalizedFormat === "CODE_128") {
    if (!/^[\x20-\x7E]+$/.test(trimmed)) {
      return "Code 128 allows printable ASCII characters only.";
    }
  }

  if (normalizedFormat === "CODE_39") {
    if (!/^[0-9A-Z \-\.\$/+%]+$/.test(trimmed)) {
      return "Code 39 allows A-Z, 0-9, space, and - . $ / + % only.";
    }
  }

  if (normalizedFormat === "ITF" && !digitsOnly) {
    return "ITF allows digits only.";
  }

  return null;
}
