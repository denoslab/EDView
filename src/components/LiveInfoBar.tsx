import type { MetaMovementFile } from "@/liveMap/types";


export function LiveInfoBar({ meta, step }: { meta?: MetaMovementFile, step?: number }) {
  return (
    <div
    className='bottomBar'
      data-testid="bottom-bar"

    >
      {/* <button
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
      </span> */}
      Simulation Time:
      <span data-testid="sim-time">{meta?.curr_time ? meta.curr_time : 'null'}</span> | 
      Step:
      <span data-testid="step">{step ? step : 'null'}</span> |
      Percentage Completed:
      <span data-testid="Percent">{meta?.total_steps && step ? `${((step / meta.total_steps)*100).toFixed(2)}%` : 'null'}</span>
    </div>
  );
}
