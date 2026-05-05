import type { PlaybackController, PlaybackSpeed } from "@/replay/usePlayback";

const SPEEDS: PlaybackSpeed[] = [1, 4, 16, 64];

export function PlaybackBar({ ctrl, simTime }: { ctrl: PlaybackController; simTime?: string }) {
  return (
    <div
      data-testid="playback-bar"
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        right: 16,
        padding: 12,
        background: "rgba(0,0,0,0.65)",
        color: "white",
        display: "flex",
        gap: 12,
        alignItems: "center",
        borderRadius: 8,
        fontFamily: "monospace",
        zIndex: 30,
      }}
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
