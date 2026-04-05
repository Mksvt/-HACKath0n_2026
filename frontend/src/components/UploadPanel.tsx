'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';

import {
  fetchAISummary,
  fetchAnalysis,
  fetchMetrics,
  fetchTelemetry,
  fetchTrajectory,
  fetchTrajectoryWithAttitude,
  uploadLog,
} from '@/lib/api';
import { useFlightStore } from '@/store/useFlightStore';

export function UploadPanel() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    setFlightId,
    setMetrics,
    setTelemetry,
    setTrajectory,
    setTrajectoryWithAttitude,
    setAnalysis,
    setOrigin,
    setAiSummary,
  } = useFlightStore();

  const mutation = useMutation({
    mutationFn: async () => {
      setError(null);
      if (!selectedFile) throw new Error('Select a .BIN file first');
      if (!selectedFile.name.toLowerCase().endsWith('.bin')) {
        throw new Error('Only .BIN files are supported');
      }

      console.log('Uploading file:', selectedFile.name, selectedFile.size);
      const upload = await uploadLog(selectedFile);
      console.log('Upload response:', upload);
      setFlightId(upload.flight_id);

      const [
        metrics,
        telemetryRes,
        trajectoryRes,
        trajectoryWithAttitudeRes,
        analysisRes,
        aiRes,
      ] = await Promise.all([
        fetchMetrics(upload.flight_id),
        fetchTelemetry(upload.flight_id),
        fetchTrajectory(upload.flight_id),
        fetchTrajectoryWithAttitude(upload.flight_id),
        fetchAnalysis(upload.flight_id),
        fetchAISummary(
          upload.flight_id,
          'Provide a short human-friendly flight summary.',
        ),
      ]);

      setMetrics(metrics);
      setTelemetry(telemetryRes.telemetry);
      setTrajectory(trajectoryRes.trajectory);
      setTrajectoryWithAttitude(trajectoryWithAttitudeRes);
      setOrigin({
        lat: trajectoryRes.origin_lat,
        lon: trajectoryRes.origin_lon,
        alt: trajectoryRes.origin_alt,
      });
      setAnalysis(analysisRes);
      setAiSummary(aiRes.summary);
    },
    onError: (err) => setError((err as Error).message),
  });

  return (
    <div className="rounded-3xl border border-white/10 bg-linear-to-br from-slate-900/85 via-slate-900/75 to-slate-950/80 p-6 shadow-2xl backdrop-blur md:p-7">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-300/90">
            Крок 1: Завантаження BIN-логу
          </p>
          <h2 className="text-xl font-semibold">
            Імпорт телеметрії (GPS + IMU + ATT)
          </h2>
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-slate-800/80 px-4 py-2 text-sm font-medium transition hover:border-cyan-300/40 hover:bg-slate-700">
          <input
            type="file"
            accept=".bin,.BIN"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setSelectedFile(file ?? null);
              setError(null);
            }}
          />
          <span>{selectedFile ? selectedFile.name : 'Choose log'}</span>
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !selectedFile}
          className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-900/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
        >
          {mutation.isPending ? 'Обробка...' : 'Завантажити й проаналізувати'}
        </button>
        {mutation.isSuccess && (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Готово</span>
          </span>
        )}
        {error && <span className="text-sm text-rose-400">{error}</span>}
      </div>
      <p className="mt-3 text-xs text-slate-400">
        We parse GPS, IMU, and ATT (attitude/orientation) data, compute metrics,
        convert WGS-84 to ENU (east/north/up) using the first valid GPS point.
        The 3D drone visualization uses Three.js with interpolated position and
        attitude for smooth animation. Distance and integration use Haversine
        per the challenge requirements.
      </p>
      <p className="mt-2 text-xs text-cyan-300/80">
        Після успішної обробки карта польоту (Cesium) відкривається автоматично.
      </p>
    </div>
  );
}
