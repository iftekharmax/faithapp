import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export interface PhotoCropDialogProps {
  open: boolean;
  imageSrc: string | null;
  aspect?: number;
  onCancel: () => void;
  onCropped: (blob: Blob) => Promise<void> | void;
}

async function cropToBlob(imageSrc: string, area: Area, rotation: number): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = imageSrc;
  });
  const size = Math.round(Math.min(area.width, area.height));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  const rad = (rotation * Math.PI) / 180;
  // Draw with rotation
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(rad);
  ctx.drawImage(
    img,
    area.x, area.y, area.width, area.height,
    -size / 2, -size / 2, size, size,
  );
  ctx.restore();
  return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.92));
}

export function PhotoCropDialog({ open, imageSrc, aspect = 1, onCancel, onCropped }: PhotoCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onComplete = useCallback((_a: Area, pixels: Area) => setArea(pixels), []);

  const handleSave = async () => {
    if (!imageSrc || !area) return;
    setSaving(true);
    try {
      const blob = await cropToBlob(imageSrc, area, rotation);
      await onCropped(blob);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adjust your photo</DialogTitle>
          <DialogDescription>Zoom, drag, and rotate to frame your face.</DialogDescription>
        </DialogHeader>
        <div className="relative h-72 w-full overflow-hidden rounded-xl border bg-muted">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onComplete}
            />
          )}
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <ZoomOut aria-hidden className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[zoom]}
              min={1}
              max={4}
              step={0.05}
              onValueChange={(v) => setZoom(v[0])}
              aria-label="Zoom"
              className="flex-1"
            />
            <ZoomIn aria-hidden className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={() => setRotation((r) => (r + 90) % 360)}>
              <RotateCw className="mr-2 h-4 w-4" /> Rotate
            </Button>
            <span className="text-xs text-muted-foreground">Preview is round; image saves square.</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !area}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
