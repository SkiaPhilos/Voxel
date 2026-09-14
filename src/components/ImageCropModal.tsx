import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, Check, X, RotateCcw } from 'lucide-react';

interface ImageCropModalProps {
  imageSrc: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob, croppedDataUrl: string) => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  imageSrc,
  isOpen,
  onClose,
  onCropComplete,
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Load image when imageSrc changes
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setImageLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Redraw canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !imageLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width; // 320x320 target
    ctx.clearRect(0, 0, size, size);

    ctx.save();
    // Fill background
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(0, 0, size, size);

    // Calculate aspect fit & zoom
    const imgAspect = img.naturalWidth / img.naturalHeight;
    let baseW = size;
    let baseH = size;

    if (imgAspect > 1) {
      baseW = size * imgAspect;
      baseH = size;
    } else {
      baseW = size;
      baseH = size / imgAspect;
    }

    const drawW = baseW * zoom;
    const drawH = baseH * zoom;

    const centerX = size / 2 + pan.x;
    const centerY = size / 2 + pan.y;

    const drawX = centerX - drawW / 2;
    const drawY = centerY - drawH / 2;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();
  }, [zoom, pan, imageLoaded]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  if (!isOpen || !imageSrc) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPan({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create a high-res output canvas (400x400)
    const outCanvas = document.createElement('canvas');
    outCanvas.width = 400;
    outCanvas.height = 400;
    const outCtx = outCanvas.getContext('2d');
    const img = imageRef.current;
    if (!outCtx || !img) return;

    const scaleFactor = 400 / 320;
    const imgAspect = img.naturalWidth / img.naturalHeight;
    let baseW = 320;
    let baseH = 320;

    if (imgAspect > 1) {
      baseW = 320 * imgAspect;
      baseH = 320;
    } else {
      baseW = 320;
      baseH = 320 / imgAspect;
    }

    const drawW = baseW * zoom * scaleFactor;
    const drawH = baseH * zoom * scaleFactor;

    const centerX = 200 + pan.x * scaleFactor;
    const centerY = 200 + pan.y * scaleFactor;

    const drawX = centerX - drawW / 2;
    const drawY = centerY - drawH / 2;

    outCtx.drawImage(img, drawX, drawY, drawW, drawH);

    outCanvas.toBlob(
      (blob) => {
        if (blob) {
          const dataUrl = outCanvas.toDataURL('image/jpeg', 0.92);
          onCropComplete(blob, dataUrl);
          onClose();
        }
      },
      'image/jpeg',
      0.92
    );
  };

  return (
    <div className="fixed inset-0 z-60 bg-stone-900/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-[#FAF8F5]">
          <div>
            <h3 className="text-sm font-bold text-stone-900">Frame &amp; Position Profile Photo</h3>
            <p className="text-xs text-stone-500">Drag to reposition, use slider to zoom</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 flex flex-col items-center">
          {/* Crop Viewport with Circular Mask */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="relative w-80 h-80 rounded-2xl bg-stone-950 overflow-hidden shadow-inner cursor-grab active:cursor-grabbing select-none"
          >
            <canvas ref={canvasRef} width={320} height={320} className="w-full h-full block" />

            {/* Circular Preview Cutout Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-64 rounded-full border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
            </div>

            <div className="absolute bottom-2 left-0 right-0 text-center pointer-events-none">
              <span className="text-[10px] text-white/75 bg-stone-900/60 px-2 py-0.5 rounded-full backdrop-blur-xs">
                Drag photo to center face
              </span>
            </div>
          </div>

          {/* Zoom Slider Controls */}
          <div className="w-full space-y-2">
            <div className="flex items-center justify-between text-xs text-stone-600 font-medium">
              <span className="flex items-center gap-1">
                <ZoomOut className="w-3.5 h-3.5 text-stone-400" />
                <span>Zoom</span>
              </span>
              <span className="font-mono text-[11px] text-stone-500">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-700"
              />
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                title="Reset zoom & position"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full flex items-center justify-end gap-3 pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Apply &amp; Save Photo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
