import React, { useState, useRef, useEffect } from 'react';
import { Car, Bike, Bus, Truck, Users, Upload, Play, Pause, RefreshCw, Eye, Camera, Activity } from 'lucide-react';
import { useTraffic } from '../context/TrafficContext';

export const VehicleDetection: React.FC = () => {
  const { intersections, selectedIntersection, selectIntersection, detection, analyzeUploadedVideo } = useTraffic();
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [userVideoUrl, setUserVideoUrl] = useState<string | null>(null);
  const [showBoxes, setShowBoxes] = useState<boolean>(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(85);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Dynamic simulation vehicles for computer vision canvas
  const cvObjects = useRef([
    { id: 1, x: 90, y: 80, w: 75, h: 48, cls: 'BUS', conf: 97, vx: 0.35, vy: 0.1, color: '#31D7E8' },
    { id: 2, x: 220, y: 95, w: 46, h: 32, cls: 'CAR', conf: 96, vx: -0.4, vy: -0.15, color: '#31D7E8' },
    { id: 3, x: 300, y: 130, w: 48, h: 32, cls: 'CAR', conf: 98, vx: -0.3, vy: -0.1, color: '#31D7E8' },
    { id: 4, x: 180, y: 165, w: 35, h: 22, cls: 'BIKE', conf: 93, vx: 0.5, vy: 0.2, color: '#39D9A5' },
    { id: 5, x: 380, y: 90, w: 50, h: 34, cls: 'CAR', conf: 94, vx: 0.25, vy: 0.1, color: '#31D7E8' },
    { id: 6, x: 70, y: 170, w: 60, h: 42, cls: 'TRUCK', conf: 91, vx: 0.45, vy: 0.15, color: '#F4B84A' },
    { id: 7, x: 440, y: 160, w: 20, h: 35, cls: 'PEDESTRIAN', conf: 89, vx: -0.1, vy: 0.1, color: '#FF647C' },
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let reqId: number;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;

      // Dark asphalt backdrop
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, '#151E2B');
      bgGrad.addColorStop(1, '#0C131D');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Roads & lane markers
      ctx.strokeStyle = '#223246';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 70);
      ctx.lineTo(w, 180);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, 200);
      ctx.lineTo(w, 270);
      ctx.stroke();

      // Zebra crossings
      ctx.fillStyle = '#1D2A3D';
      for (let i = 0; i < 9; i++) {
        ctx.fillRect(220 + i * 20, 75 + i * 11, 12, 45);
      }

      // Draw bounding boxes
      if (showBoxes) {
        cvObjects.current.forEach((obj) => {
          if (isPlaying) {
            obj.x += obj.vx;
            obj.y += obj.vy;
            if (obj.x < 40 || obj.x > w - obj.w - 30) obj.vx *= -1;
            if (obj.y < 40 || obj.y > h - obj.h - 30) obj.vy *= -1;
          }

          if (obj.conf < confidenceThreshold) return;

          ctx.strokeStyle = obj.color;
          ctx.lineWidth = 1.8;
          ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);

          // Header tag
          ctx.fillStyle = 'rgba(11, 20, 34, 0.9)';
          ctx.fillRect(obj.x, obj.y - 15, 66, 14);
          ctx.fillStyle = obj.color;
          ctx.font = 'bold 9px monospace';
          ctx.fillText(`${obj.cls} ${obj.conf}%`, obj.x + 3, obj.y - 4);
        });
      }

      reqId = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(reqId);
  }, [isPlaying, showBoxes, confidenceThreshold]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setUserVideoUrl(url);
      setIsPlaying(true);
      void analyzeUploadedVideo(file);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-5 gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            AI Vehicle Detection & Computer Vision Telemetry
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Real-time multi-class object detection simulation across edge camera nodes
          </p>
        </div>

        {/* Camera Selector Dropdown */}
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-cyan" />
          <label className="flex items-center gap-2">
            <Camera aria-hidden="true" className="w-4 h-4 text-cyan" />
            <span className="sr-only">Select camera intersection</span>
            <select
              value={selectedIntersection.id}
              onChange={(e) => selectIntersection(e.target.value)}
              className="bg-[#142233] border border-border text-xs rounded-lg px-3 py-1.5 text-text-primary focus:border-cyan"
            >
              {intersections.map((int) => (
                <option key={int.id} value={int.id}>
                  {int.cameraId} · {int.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Main Viewport & CV Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Large Video / Canvas Frame (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          <div className="bg-bg-panel border border-border rounded-xl p-4 flex flex-col gap-3">
            <div className="relative w-full h-[380px] rounded-lg overflow-hidden border border-border bg-[#0B1422]" aria-describedby="ai-feed-description">
              <span id="ai-feed-description" className="sr-only">
                Simulated AI traffic-camera preview. Detected vehicle counts and mean confidence are listed alongside the feed.
              </span>
              {userVideoUrl && (
                <video
                  src={userVideoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  aria-label="Uploaded traffic video"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}

              <canvas
                ref={canvasRef}
                width={640}
                height={380}
                aria-hidden="true"
                className="w-full h-full object-cover relative z-10"
              />

              {/* Overlays */}
              <div className="absolute top-3 left-3 z-20 flex items-center gap-2 px-2.5 py-1 rounded bg-[#0A1320]/80 border border-border text-xs font-mono text-text-primary backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-cyan animate-pulse" />
                <span>FEED: {selectedIntersection.cameraId} / {selectedIntersection.name.toUpperCase()}</span>
              </div>

              <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
                <button
                  onClick={() => setShowBoxes(!showBoxes)}
                  type="button"
                  aria-label={showBoxes ? 'Hide AI detection overlays' : 'Show AI detection overlays'}
                  aria-pressed={showBoxes}
                  className={`p-1.5 rounded bg-[#0A1320]/80 border text-xs backdrop-blur-md transition-colors ${
                    showBoxes ? 'border-cyan/40 text-cyan' : 'border-border text-text-muted'
                  }`}
                  title="Toggle Bounding Boxes"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  type="button"
                  aria-label={isPlaying ? 'Pause AI detection feed' : 'Resume AI detection feed'}
                  className="p-1.5 rounded bg-[#0A1320]/80 border border-border text-text-secondary hover:text-text-primary backdrop-blur-md transition-colors"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                  aria-label="Upload traffic video for AI analysis"
                  className="p-1.5 rounded bg-[#0A1320]/80 border border-border text-text-secondary hover:text-cyan backdrop-blur-md transition-colors"
                  title="Upload Video File"
                >
                  <Upload className="w-3.5 h-3.5" />
                </button>
                <input ref={fileInputRef} type="file" accept="video/*" className="hidden" aria-label="Select traffic video for AI analysis" onChange={handleFileUpload} />
              </div>

              <div className="absolute bottom-3 left-3 z-20 px-2 py-0.5 rounded bg-[#0A1320]/80 border border-border text-[10px] font-mono text-text-muted backdrop-blur-md">
                INFERENCE LATENCY: ~32 ms · 29.8 FPS · YOLOv8s Edge Model (Simulated)
              </div>

              <div className="absolute bottom-3 right-3 z-20 px-2 py-0.5 rounded bg-cyan-dark border border-cyan/30 text-cyan text-[10px] font-bold">
                DEMO DATA
              </div>
            </div>

            {/* Threshold Slider */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
              <div className="flex items-center gap-3">
                <label htmlFor="detection-confidence" className="text-text-muted">Confidence Filter:</label>
                <input
                  id="detection-confidence"
                  type="range"
                  min="50"
                  max="99"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                  aria-describedby="confidence-help"
                  aria-valuetext={`${confidenceThreshold} percent`}
                  className="w-36 accent-cyan"
                />
                <output htmlFor="detection-confidence" className="font-mono text-cyan font-bold">{confidenceThreshold}%</output>
              </div>
              <span id="confidence-help" className="text-[11px] text-text-muted">
                Detections with score below threshold are suppressed.
              </span>
            </div>
          </div>
        </div>

        {/* Right Classification Cards (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          <div className="bg-bg-panel border border-border rounded-xl p-4 flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider pb-1 border-b border-border/50">
              Vehicle Counts on Approach
            </h3>

            <dl className="space-y-2" aria-label="AI detected vehicle counts">
              <div className="p-2.5 rounded-lg bg-[#0E1726] border border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Car aria-hidden="true" className="w-4 h-4 text-cyan" />
                  <dt className="text-xs font-medium text-text-primary">Passenger Cars</dt>
                </div>
                <dd className="font-mono font-bold text-sm text-text-primary">{detection.cars}</dd>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0E1726] border border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Bike aria-hidden="true" className="w-4 h-4 text-success" />
                  <dt className="text-xs font-medium text-text-primary">Motorcycles & Bikes</dt>
                </div>
                <dd className="font-mono font-bold text-sm text-text-primary">{detection.bikes}</dd>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0E1726] border border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Bus aria-hidden="true" className="w-4 h-4 text-warning" />
                  <dt className="text-xs font-medium text-text-primary">Transit Buses</dt>
                </div>
                <dd className="font-mono font-bold text-sm text-text-primary">{detection.buses}</dd>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0E1726] border border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Truck aria-hidden="true" className="w-4 h-4 text-warning" />
                  <dt className="text-xs font-medium text-text-primary">Commercial Trucks</dt>
                </div>
                <dd className="font-mono font-bold text-sm text-text-primary">{detection.trucks}</dd>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0E1726] border border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Users aria-hidden="true" className="w-4 h-4 text-danger" />
                  <dt className="text-xs font-medium text-text-primary">Crosswalk Pedestrians</dt>
                </div>
                <dd className="font-mono font-bold text-sm text-text-primary">{detection.pedestrians}</dd>
              </div>
            </dl>

            {/* Overall Confidence Callout */}
            <div className="mt-2 p-3 rounded-lg bg-[#0E1726] border border-border text-xs">
              <div className="flex items-center justify-between text-text-secondary">
                <span>Mean Tracking Confidence</span>
                <span className="font-mono font-bold text-cyan">{detection.confidence.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-[#18273A] rounded-full h-1.5 mt-2">
                <div
                  className="bg-cyan h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${detection.confidence}%` }}
                  role="progressbar"
                  aria-label="Mean tracking confidence"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(detection.confidence)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
