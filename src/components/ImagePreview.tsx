import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type ImagePreviewProps = {
  src: string;
  alt: string;
  triggerClassName?: string;
  imageClassName?: string;
  previewClassName?: string;
  title?: string;
  description?: string;
};

export function ImagePreview({
  src,
  alt,
  triggerClassName,
  imageClassName,
  previewClassName,
  title = "圖片預覽",
  description = "點擊外部即可關閉",
}: ImagePreviewProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={triggerClassName} aria-label={`預覽 ${alt}`}>
          <img src={src} alt={alt} className={imageClassName} />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl border-border bg-background p-4 sm:p-6">
        <DialogHeader className="text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-2xl border border-border bg-muted/20">
          <img src={src} alt={alt} className={previewClassName ?? "max-h-[70vh] w-full object-contain"} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
