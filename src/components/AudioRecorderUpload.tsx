import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Upload, Trash2, CheckCircle2, AlertCircle, Music, RefreshCw } from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';

interface AudioData {
  audio_url: string;
  audio_duration: number;
  audio_name: string;
}

interface AudioRecorderUploadProps {
  initialAudio?: AudioData | null;
  onAudioChange: (audio: AudioData | null) => void;
  className?: string;
}

export const AudioRecorderUpload: React.FC<AudioRecorderUploadProps> = ({
  initialAudio,
  onAudioChange,
  className = '',
}) => {
  const [currentAudio, setCurrentAudio] = useState<AudioData | null>(initialAudio || null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    setErrorMsg(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access is not supported by this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          const duration = recordingSeconds;
          const audioName = `VoiceMemo_${new Date().toLocaleTimeString().replace(/:/g, '-')}.webm`;
          const newAudio: AudioData = {
            audio_url: base64Data,
            audio_duration: duration,
            audio_name: audioName,
          };
          setCurrentAudio(newAudio);
          onAudioChange(newAudio);
        };
        reader.readAsDataURL(audioBlob);

        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(200); // 200ms slice
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Failed to start microphone recording:', err);
      setErrorMsg(err?.message || 'Could not access microphone.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 12MB limit for base64
    if (file.size > 12 * 1024 * 1024) {
      setErrorMsg('Audio file is too large. Please select a recording under 12MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      // Get audio duration via temporary Audio element
      const tempAudio = new Audio(base64Data);
      tempAudio.addEventListener('loadedmetadata', () => {
        const duration = Math.round(tempAudio.duration) || 0;
        const newAudio: AudioData = {
          audio_url: base64Data,
          audio_duration: duration,
          audio_name: file.name,
        };
        setCurrentAudio(newAudio);
        onAudioChange(newAudio);
      });
      tempAudio.addEventListener('error', () => {
        // Fallback without duration
        const newAudio: AudioData = {
          audio_url: base64Data,
          audio_duration: 0,
          audio_name: file.name,
        };
        setCurrentAudio(newAudio);
        onAudioChange(newAudio);
      });
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read audio file.');
    };
    reader.readAsDataURL(file);

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAudio = () => {
    setCurrentAudio(null);
    onAudioChange(null);
    setErrorMsg(null);
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {errorMsg && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {currentAudio ? (
        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <Music className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-stone-900 truncate">
                  {currentAudio.audio_name}
                </p>
                <p className="text-[11px] text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Ready to attach to call log</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={removeAudio}
              className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
              title="Remove audio attachment"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <AudioPlayer
            src={currentAudio.audio_url}
            title={currentAudio.audio_name}
            duration={currentAudio.audio_duration}
          />
        </div>
      ) : isRecording ? (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
            <div>
              <p className="text-xs font-bold text-rose-900">Recording Voice Note / Call Memo...</p>
              <p className="text-xs font-mono text-rose-700 font-semibold">{formatTimer(recordingSeconds)}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-white" />
            <span>Stop &amp; Attach</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button
            type="button"
            onClick={startRecording}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-800 text-xs font-semibold border border-stone-200 transition-colors cursor-pointer"
          >
            <Mic className="w-4 h-4 text-rose-600" />
            <span>Record Voice Memo</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
            id="audio-upload-input"
          />

          <label
            htmlFor="audio-upload-input"
            className="flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-800 text-xs font-semibold border border-stone-200 transition-colors cursor-pointer text-center"
          >
            <Upload className="w-4 h-4 text-amber-700" />
            <span>Upload Audio File</span>
          </label>
        </div>
      )}
    </div>
  );
};
