import type { PlaybackController, PlaybackSpeed } from "@/replay/usePlayback";

const SPEEDS: PlaybackSpeed[] = [8, 16, 64];

export function PlaybackBar({ ctrl, simTime }: { ctrl: PlaybackController; simTime?: string }) {
  return (
    <div
    className="bottomBar"
      data-testid="playback-bar"
    >
      <button
        data-testid={ctrl.isPlaying ? "pause" : "play"}
        onClick={() => (ctrl.isPlaying ? ctrl.pause() : ctrl.play())}
        style={{ minWidth: 64 }}
      >
        {ctrl.isPlaying ? "Pause" : "Play"}
      </button>

      {SPEEDS.map((s) => (
        <button
          key={s}
          data-testid={`speed-${s}x`}
          onClick={() => ctrl.setSpeed(s)}
          style={{ fontWeight: ctrl.speed === s ? "bold" : "normal" }}
        >
          {s}×
        </button>
      ))}

      <input
        data-testid="scrub"
        type="range"
        min={0}
        max={Math.max(0, ctrl.totalSteps - 1)}
        value={ctrl.currentStep}
        onChange={(e) => ctrl.seek(Number(e.target.value))}
        style={{ flex: 1 }}
      />

      <span data-testid="step-counter">
        {ctrl.currentStep} / {ctrl.totalSteps - 1}
      </span>
      {simTime && <span data-testid="sim-time">{simTime}</span>}
    </div>
  );
}
