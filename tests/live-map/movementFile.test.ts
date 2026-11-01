import { describe, expect, test } from "vitest";
import { validateMovment } from "@/liveMap/pollingSteps";


const VALID = {
  "agents": {
    "Bedside Nurse 1": {
      "chat": null,
      "description": "Escorting Patient 4 to room @ <waiting> 11 2",
      "pronunciatio": "\u23f3",
      "x": 11,
      "y": 2
    },
    "Bedside Nurse 2": {
      "chat": null,
      "description": "Standing by @ ed map:emergency department:major injuries zone:bed:15:2",
      "pronunciatio": "\u2601\ufe0f",
      "x": 15,
      "y": 2
    },
    "Doctor 1": {
      "chat": null,
      "description": "None @ <waiting> 27 13",
      "pronunciatio": null,
      "x": 27,
      "y": 13
    },
    "Doctor 2": {
      "chat": null,
      "description": "None @ <waiting> 19 2",
      "pronunciatio": null,
      "x": 19,
      "y": 2
    },
    "Doctor 3": {
      "chat": null,
      "description": "None @ <waiting> 27 11",
      "pronunciatio": null,
      "x": 27,
      "y": 11
    },
    "Patient 1": {
      "chat": null,
      "description": "Patient is currently in state 'WAITING_FOR_FIRST_ASSESSMENT' with CTAS 1'. @ (16, 14)",
      "pronunciatio": "\ud83d\udecc",
      "x": 16,
      "y": 14
    },
    "Patient 2": {
      "chat": null,
      "description": "Patient is currently in state 'WAITING_FOR_FIRST_ASSESSMENT' with CTAS 3'. @ (27, 13)",
      "pronunciatio": "\ud83d\udecc",
      "x": 27,
      "y": 13
    },
    "Patient 3": {
      "chat": null,
      "description": "Patient is currently in state 'WAITING_FOR_FIRST_ASSESSMENT' with CTAS 2'. @ (19, 2)",
      "pronunciatio": "\ud83d\udecc",
      "x": 19,
      "y": 2
    },
    "Patient 4": {
      "chat": [
        [
          "Triage Nurse 1",
          "Hello, my name is [Triage Nurse 1] and I'm here to help assess your condition. What brought you in today?"
        ],
        [
          "Patient 4",
          "Hi, I'm feeling a lot of tightness and pain in my chest. It's like a burning sensation and it won't go away."
        ]
      ],
      "description": "Waiting to interact with Triage Nurse 1.",
      "pronunciatio": "\ud83d\udecc",
      "x": 13,
      "y": 11
    },
    "Patient 5": {
      "chat": null,
      "description": "Patient is currently in state 'WAITING_FOR_TRIAGE' with CTAS 2'. @ ed map:emergency department:waiting room:waiting room chair",
      "pronunciatio": "\u231b",
      "x": 3,
      "y": 13
    },
    "Patient 6": {
      "chat": null,
      "description": "Patient is currently in state 'WAITING_FOR_TRIAGE' with CTAS 2'. @ ed map:emergency department:waiting room:waiting room chair",
      "pronunciatio": "\u231b",
      "x": 3,
      "y": 13
    },
    "Triage Nurse 1": {
      "chat": [
        [
          "Triage Nurse 1",
          "Hello, my name is [Triage Nurse 1] and I'm here to help assess your condition. What brought you in today?"
        ],
        [
          "Patient 4",
          "Hi, I'm feeling a lot of tightness and pain in my chest. It's like a burning sensation and it won't go away."
        ]
      ],
      "description": "conversing about the patient's chest pain and tightness, which led to a CTAS score of 2, and I have sent the patient to the trauma room for immediate evaluation. @ <waiting> 13 13",
      "pronunciatio": "\u23f3",
      "x": 13,
      "y": 13
    }
  },
  "meta": {
    "curr_time": "September 30, 2025, 06:09:55",
    "total_steps": 120
  }
}


describe("validateReplay", () => {
  test("accepts a well-formed replay", () => {
    expect(() => validateMovment(VALID)).not.toThrow();
  });

  test("rejects string step ", () => {
    expect(() => validateMovment({ ...VALID, agents: "agents" })).toThrow("agents missing or not an object");
  });

  test("rejects empty agents ", () => {
    expect(() => validateMovment({ ...VALID, agents: {} })).toThrow("agents object cannot be empty");
  });

  test("rejects missing meta", () => {
    expect(() => validateMovment({ ...VALID, meta: "meta"})).toThrow("meta missing or not an object");
  });

  test("rejects missing meta", () => {
    expect(() => validateMovment({ ...VALID, meta: {}})).toThrow("meta in movementFile missing attributes");
  });
});
