import { cn } from "@/lib/utils";

interface FacilityPhotoGridProps {
  images: string[];
  className?: string;
}

export default function FacilityPhotoGrid({ images, className }: FacilityPhotoGridProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
        {images.map((src, index) => (
          <div
            key={`${src}-${index}`}
            className="relative overflow-hidden rounded-2xl border border-black/5 shadow-sm aspect-[4/3]"
          >
            <img
              src={src}
              alt="BeFitNYC facility"
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
