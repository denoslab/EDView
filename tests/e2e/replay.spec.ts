/**
 * End-to-end smoke test for the replay feature.
 *
 * Exercises the three core user interactions:
 *   1. Load — navigate with ?replay= param, confirm playback bar appears
 *   2. Play — click play, poll until step counter advances
 *   3. Scrub — pause, drag scrub to step 500, confirm counter updates
 *
 * Three.js renders agents to a WebGL canvas; agent positions are not
 * DOM-queryable so we only assert the playback-bar DOM controls.
 */

import { test, expect } from "@playwright/test";

test("replay loads, plays, scrubs", async ({ page }) => {
  // Load page with both map and replay URL params so the replay auto-loads.
  await page.goto(
    "/?map=small_ed_layout&replay=/replays/small_ed_demo.json"
  );

  // Playback bar appears once the replay JSON has been fetched and parsed.
  await expect(page.getByTestId("playback-bar")).toBeVisible({
    timeout: 15_000,
  });

  // Step counter starts at 0.
  const stepCounter = page.getByTestId("step-counter");
  await expect(stepCounter).toContainText("0 /");

  // --- Play ---
  // Button has testid="play" when paused, testid="pause" when playing.
  await page.getByTestId("play").click();

  // Poll until the step counter leaves 0. Using expect() with a timeout is
  // more reliable than a fixed waitForTimeout because headless Chromium may
  // throttle requestAnimationFrame delivery.
  await expect(stepCounter).not.toContainText(/^0 \//, { timeout: 10_000 });

  // --- Pause ---
  // The pause button only exists in DOM while playing; click it.
  await page.getByTestId("pause").click();
  // After pausing the button label reverts to "Play".
  await expect(page.getByTestId("play")).toBeVisible({ timeout: 3_000 });

  // --- Scrub ---
  // Range inputs require special handling: Playwright's fill() does not fire
  // React's synthetic onChange for range inputs. We use the native value
  // descriptor setter (which React hooks into via its internal event system)
  // followed by a nativeInputValueSetter-style dispatch.
  const scrub = page.getByTestId("scrub");
  await scrub.evaluate((el: HTMLInputElement) => {
    // Use the native value setter so React's property trap fires.
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, "500");
    } else {
      el.value = "500";
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });

  // Step counter should now read "500 / 599".
  await expect(stepCounter).toContainText("500 /");

  // --- Speed switch ---
  // Just verify the 16x button is clickable without throwing.
  await page.getByTestId("speed-16x").click();
  // No further assertion: if the click threw, Playwright would surface the error.
});
