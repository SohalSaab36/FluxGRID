import React, { useState, useRef, useEffect } from 'react';
import { Car, Bike, Bus, Upload, Play, Pause, RefreshCw, Eye } from 'lucide-react';
import { useTraffic } from '../../context/TrafficContext';

interface BoundingBox {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  confidence: number;
  vx: number;
  vy: number;
  color: string;
}

export const VehicleDetectionPanel: React.FC = () => {
  const { detection, selectedIntersection, setCurrentView, analyzeUploadedVideo } = useTraffic();
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [userVideoUrl, setUserVideoUrl] = useState<string | null>(null);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Simulated vehicle tracking bounding boxes on camera view
  const boxesRef = useRef<BoundingBox[]>([
    { id: 1, x: 80, y: 70, width: 65, height: 40, label: 'BUS', confidence: 0.97, vx: 0.3, vy: 0.15, color: '#31D7E8' },
    { id: 2, x: 190, y: 80, width: 38, height: 26, label: 'CAR', confidence: 0.95, vx: -0.4, vy: -0.1, color: '#31D7E8' },
    { id: 3, x: 235, y: 110, width: 44, height: 28, label: 'CAR', confidence: 0.98, vx: -0.3, vy: -0.1, color: '#31D7E8' },
    { id: 4, x: 150, y: 140, width: 32, height: 20, label: 'BIKE', confidence: 0.92, vx: 0.5, vy: 0.2, color: '#39D9A5' },
    { id: 5, x: 290, y: 75, width: 42, height: 28, label: 'CAR', confidence: 0.94, vx: 0.2, vy: 0.1, color: '#31D7E8' },
    { id: 6, x: 50, y: 135, width: 40, height: 26, label: 'CAR', confidence: 0.96, vx: 0.4, vy: 0.1, color: '#31D7E8' },
  ]);

  // Handle local video selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setUserVideoUrl(url);
      setIsPlaying(true);
      void analyzeUploadedVideo(file);
    }
  };

  // Canvas rendering loop for simulated camera perspective
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let tick = 0;

    const render = () => {
      tick++;

      // If user uploaded a video, let HTML5 video render below canvas
      if (!userVideoUrl) {
        // Draw synthetic dark road intersection camera angle
        const w = canvas.width;
        const h = canvas.height;

        // Dark asphalt gradient
        const bgGrad = ctx.createLinearGradient(0, 0, w, h);
        bgGrad.addColorStop(0, '#151D28');
        bgGrad.addColorStop(1, '#0C131D');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // Cross street diagonal perspective lines
        ctx.strokeStyle = '#233246';
        ctx.lineWidth = 1.5;

        // Curbs
        ctx.beginPath();
        ctx.moveTo(0, 50);
        ctx.lineTo(w, 140);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, 150);
        ctx.lineTo(w, 200);
        ctx.stroke();

        // Crosswalk stripes
        ctx.fillStyle = '#202E42';
        for (let i = 0; i < 7; i++) {
          ctx.fillRect(160 + i * 16, 55 + i * 8, 10, 32);
        }

        // Road lane center dashed lines
        ctx.strokeStyle = '#2D3E54';
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(30, 95);
        ctx.lineTo(340, 165);
        ctx.stroke();
        ctx.setLineDash([]);

        // Streetlamp / lens vignetting
        const vig = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w / 1.4);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(6,11,18,0.7)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, w, h);
      } else {
        // User video active: clear canvas transparently for bounding boxes
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      // Draw bounding boxes if enabled
      if (showBoundingBoxes) {
        boxesRef.current.forEach((box) => {
          if (isPlaying) {
            box.x += box.vx;
            box.y += box.vy;

            // Bounce gently in frame
            if (box.x < 30 || box.x > canvas.width - box.width - 20) box.vx *= -1;
            if (box.y < 30 || box.y > canvas.height - box.height - 20) box.vy *= -1;
          }

          // Box border
          ctx.strokeStyle = box.color;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(box.x, box.y, box.width, box.height);

          // Subtle corner brackets
          const bracketLen = 5;
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          // Top-left corner
          ctx.beginPath();
          ctx.moveTo(box.x, box.y + bracketLen);
          ctx.lineTo(box.x, box.y);
          ctx.lineTo(box.x + bracketLen, box.y);
          ctx.stroke();

          // Label pill on top of box
          ctx.fillStyle = 'rgba(11, 20, 34, 0.85)';
          ctx.fillRect(box.x, box.y - 13, 56, 12);
          ctx.fillStyle = box.color;
          ctx.font = 'bold 8px monospace';
          ctx.fillText(`${box.label} ${(box.confidence * 100).toFixed(0)}%`, box.x + 3, box.y - 4);
        });
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [userVideoUrl, isPlaying, showBoundingBoxes]);

  return (
    <section aria-labelledby="overview-ai-detection-title" className="bg-bg-panel border border-border rounded-xl p-4 flex flex-col justify-between">
      {/* Video Viewport Frame */}
      <div className="relative w-full h-[210px] rounded-lg overflow-hidden border border-border bg-[#0B1422] flex items-center justify-center" aria-describedby="overview-ai-feed-description">
        <span id="overview-ai-feed-description" className="sr-only">
          Simulated AI traffic-camera preview with vehicle detections. Detection counts are listed below.
        </span>
        {/* User uploaded HTML5 Video */}
        {userVideoUrl && (
          <video
            ref={videoRef}
            src={userVideoUrl}
            autoPlay
            loop
            muted
            playsInline
            aria-label="Uploaded traffic video"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Dynamic Simulation / Bounding Box Canvas */}
        <canvas
          ref={canvasRef}
          width={380}
          height={210}
          aria-hidden="true"
          className="w-full h-full object-cover relative z-10"
        />

        {/* Top-Left Camera ID Overlay (matches screenshot) */}
        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0A1320]/80 border border-border text-[10px] font-mono text-text-primary backdrop-blur-md">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan animate-pulse" />
          <span>{detection.cameraId || `CAN 04 / ${selectedIntersection.name.toUpperCase()}`}</span>
        </div>

        {/* Top-Right Playback & Upload Controls */}
        <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1">
          <button
            onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
            type="button"
            aria-label={showBoundingBoxes ? 'Hide AI detection overlays' : 'Show AI detection overlays'}
            aria-pressed={showBoundingBoxes}
            className={`p-1 rounded bg-[#0A1320]/80 border text-[10px] backdrop-blur-md transition-colors ${
              showBoundingBoxes ? 'border-cyan/40 text-cyan' : 'border-border text-text-muted'
            }`}
            title="Toggle AI Bounding Box Overlays"
          >
            <Eye className="w-3 h-3" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            type="button"
            aria-label={isPlaying ? 'Pause AI detection feed' : 'Resume AI detection feed'}
            className="p-1 rounded bg-[#0A1320]/80 border border-border text-text-secondary hover:text-text-primary backdrop-blur-md transition-colors"
            title={isPlaying ? 'Pause Feed' : 'Resume Feed'}
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            type="button"
            aria-label="Upload traffic video for AI analysis"
            className="p-1 rounded bg-[#0A1320]/80 border border-border text-text-secondary hover:text-cyan backdrop-blur-md transition-colors"
            title="Upload local traffic video"
          >
            <Upload className="w-3 h-3" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            aria-label="Select traffic video for AI analysis"
            onChange={handleFileChange}
          />
        </div>

        {/* Bottom-Left Overlay Badge (matches screenshot) */}
        <div className="absolute bottom-2.5 left-2.5 z-20 px-2 py-0.5 rounded bg-[#0A1320]/80 border border-border text-[9px] font-mono text-text-muted uppercase tracking-wider backdrop-blur-md">
          RECORDED DEMO FEED · AI OVERLAY
        </div>

        {/* DEMO DATA badge */}
        <div className="absolute bottom-2.5 right-2.5 z-20 px-1.5 py-0.5 rounded bg-[#0E2433] border border-cyan/30 text-cyan text-[9px] font-bold">
          DEMO DATA
        </div>
      </div>

      {/* Under Video: Header with Confidence */}
      <div className="pt-3 flex items-center justify-between border-t border-border/50 mt-3">
        <h2 id="overview-ai-detection-title" className="text-xs font-semibold text-text-primary">
          AI Vehicle Detection
        </h2>
        <span className="text-xs font-semibold font-mono text-cyan" aria-label={`Detection confidence ${detection.confidence.toFixed(1)} percent`}>
          {detection.confidence.toFixed(1)}% confidence
        </span>
      </div>

      {/* 3 Metric Columns: Cars, Bikes, Buses (matches screenshot) */}
      <dl className="grid grid-cols-3 gap-2 pt-2" aria-label="AI detected vehicle counts">
        {/* Cars */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#0E1726] border border-border/60">
          <Car className="w-4 h-4 text-text-muted" />
          <div className="flex flex-col leading-none">
            <dd className="text-sm font-bold text-text-primary">{detection.cars}</dd>
            <dt className="text-[10px] text-text-muted">Cars</dt>
          </div>
        </div>

        {/* Bikes */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#0E1726] border border-border/60">
          <Bike className="w-4 h-4 text-text-muted" />
          <div className="flex flex-col leading-none">
            <dd className="text-sm font-bold text-text-primary">{detection.bikes}</dd>
            <dt className="text-[10px] text-text-muted">Bikes</dt>
          </div>
        </div>

        {/* Buses */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#0E1726] border border-border/60">
          <Bus className="w-4 h-4 text-text-muted" />
          <div className="flex flex-col leading-none">
            <dd className="text-sm font-bold text-text-primary">{detection.buses}</dd>
            <dt className="text-[10px] text-text-muted">Buses</dt>
          </div>
        </div>
      </dl>
    </section>
  );
};
