import React, { useEffect, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { TrafficReport, TrafficReportType } from '../../types/traffic';
import { TrafficReportInput } from '../../lib/apiClient';
import { Account } from '../../types/traffic';

interface TrafficReportDialogProps {
  backendConnected: boolean;
  currentUser: Account | null;
  reportTtlSeconds: number;
  reportMaxDistanceKm: number;
  onClose: () => void;
  onSubmit: (report: TrafficReportInput) => Promise<TrafficReport>;
  onSubmitted: (report: TrafficReport) => void;
  onSignIn: () => void;
}

const reportOptions: { value: TrafficReportType; label: string }[] = [
  { value: 'congestion', label: 'Heavy traffic' },
  { value: 'accident', label: 'Accident' },
  { value: 'roadwork', label: 'Roadwork' },
  { value: 'hazard', label: 'Road hazard' },
  { value: 'closure', label: 'Road closure' },
];

function locationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === 1) return 'Location permission was denied. Allow location access and try again.';
  if (error.code === 2) return 'Your device could not determine its location. Try again or move outdoors.';
  if (error.code === 3) return 'Location lookup timed out. Check GPS and try again.';
  return 'Unable to get your device location.';
}

export const TrafficReportDialog: React.FC<TrafficReportDialogProps> = ({
  backendConnected,
  currentUser,
  reportTtlSeconds,
  reportMaxDistanceKm,
  onClose,
  onSubmit,
  onSubmitted,
  onSignIn,
}) => {
  const [type, setType] = useState<TrafficReportType>('accident');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const submitWithLocation = () => {
    if (!backendConnected) {
      setErrorMessage('Connect the Python API to save and share reports.');
      return;
    }
    if (!currentUser) {
      setErrorMessage('Sign in or create an account before submitting a report.');
      return;
    }
    if (!navigator.geolocation) {
      setErrorMessage('This browser does not support device location.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const report = await onSubmit({
            type,
            description: description.trim(),
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
          onSubmitted(report);
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : 'The traffic report could not be saved.');
          setIsSubmitting(false);
        }
      },
      (error) => {
        setErrorMessage(locationErrorMessage(error));
        setIsSubmitting(false);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="traffic-report-title"
        className="w-full max-w-md rounded-xl bg-bg-panel border border-border shadow-2xl p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="traffic-report-title" className="text-base font-bold text-text-primary">
              Report traffic
            </h2>
            <p className="text-xs text-text-secondary mt-1">
              Your GPS location will be matched to the nearest intersection.
            </p>
          </div>
          <button
            aria-label="Close report form"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded text-text-muted hover:text-text-primary disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block mt-4 text-xs font-medium text-text-secondary" htmlFor="traffic-report-type">
          What is happening?
        </label>
        <select
          id="traffic-report-type"
          value={type}
          onChange={(event) => setType(event.target.value as TrafficReportType)}
          className="w-full mt-1 bg-[#0E1726] border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cyan"
        >
          {reportOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <label className="block mt-3 text-xs font-medium text-text-secondary" htmlFor="traffic-report-description">
          Details <span className="text-text-muted">(optional, 300 characters max)</span>
        </label>
        <textarea
          id="traffic-report-description"
          value={description}
          onChange={(event) => setDescription(event.target.value.slice(0, 300))}
          rows={3}
          maxLength={300}
          placeholder="For example: two lanes blocked after a minor collision"
          className="w-full mt-1 resize-none bg-[#0E1726] border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-cyan"
        />

        <p className="mt-3 text-[11px] text-text-muted">
          Accident reports appear as pending until an admin reviews them. Reports expire after {reportTtlSeconds / 3600} hours. Only locations within {reportMaxDistanceKm} km of this demo network are accepted.
        </p>
        {errorMessage && (
          <p role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger-dark/40 px-3 py-2 text-xs text-danger">
            {errorMessage}
          </p>
        )}
        {!currentUser && (
          <button
            type="button"
            onClick={onSignIn}
            className="w-full mt-3 rounded-lg border border-cyan/40 px-4 py-2 text-sm font-semibold text-cyan hover:bg-cyan/10"
          >
            Sign in or create account
          </button>
        )}
        <button
          onClick={submitWithLocation}
          disabled={isSubmitting || !currentUser || !backendConnected}
          className="w-full mt-4 flex items-center justify-center gap-2 rounded-lg bg-cyan px-4 py-2.5 text-sm font-semibold text-[#080F1B] hover:bg-cyan-hover disabled:opacity-60 disabled:cursor-wait"
        >
          <MapPin className="w-4 h-4" />
          {isSubmitting ? 'Getting location and submitting…' : 'Use my location and submit'}
        </button>
      </section>
    </div>
  );
};
