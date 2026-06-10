import { Dispatch, MutableRefObject, SetStateAction, useEffect, useState } from "react";
import { DEFAULT_POWER_DISTRIBUTION } from "../../data/ships";
import { GameState } from "../../types";

type AutopilotMode = "none" | "match-speed" | "circularize" | "align-target" | "approach-target";

export interface PressedKeysState {
  thrust: boolean;
  steerLeft: boolean;
  steerRight: boolean;
  circMode: boolean;
  matchMode: boolean;
}

interface UseCockpitControlsInput {
  autopilotMode: AutopilotMode;
  selectedBodyExists: boolean;
  setAutopilotMode: Dispatch<SetStateAction<AutopilotMode>>;
  setGameState: Dispatch<SetStateAction<GameState>>;
  setIsThrusting: Dispatch<SetStateAction<boolean>>;
  addConsoleLog: (text: string, type?: "info" | "success" | "warning") => void;
  stateRef: MutableRefObject<GameState>;
}

export function useCockpitControls({
  autopilotMode,
  selectedBodyExists,
  setAutopilotMode,
  setGameState,
  setIsThrusting,
  addConsoleLog,
  stateRef,
}: UseCockpitControlsInput) {
  const [pressedKeys, setPressedKeys] = useState<PressedKeysState>({
    thrust: false,
    steerLeft: false,
    steerRight: false,
    circMode: false,
    matchMode: false,
  });

  const handleRotateShip = (amount: number) => {
    setAutopilotMode("none");
    setGameState((prev) => ({
      ...prev,
      ship: {
        ...prev.ship,
        heading: (prev.ship.heading + amount) % (Math.PI * 2),
      },
    }));
  };

  const setShipHeading = (heading: number) => {
    const normalized = ((heading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    setAutopilotMode("none");
    setGameState((prev) => ({
      ...prev,
      ship: {
        ...prev.ship,
        heading: normalized,
      },
    }));
  };

  const setThrottlePercent = (value: number) => {
    if (stateRef.current.isDocked) {
      setAutopilotMode("none");
      setIsThrusting(false);
      setGameState((prev) => ({ ...prev, ship: { ...prev.ship, throttlePercent: 0 } }));
      return;
    }

    const next = Math.max(-100, Math.min(100, Math.round(value)));
    setGameState((prev) => ({
      ...prev,
      ship: {
        ...prev.ship,
        throttlePercent: next,
      },
    }));
    setIsThrusting(next !== 0);
  };

  const setPowerDistribution = (channel: "shields" | "engines" | "weapons", value: number) => {
    const nextValue = Math.max(0, Math.min(100, Math.round(value)));
    setGameState((prev) => ({
      ...prev,
      ship: (() => {
        const current = prev.ship.powerDistribution ?? DEFAULT_POWER_DISTRIBUTION;
        const otherChannels = (["shields", "engines", "weapons"] as const).filter((key) => key !== channel);
        const remaining = 100 - nextValue;
        const currentOtherTotal = otherChannels.reduce((sum, key) => sum + current[key], 0);
        const firstOther = currentOtherTotal > 0
          ? Math.round((current[otherChannels[0]] / currentOtherTotal) * remaining)
          : Math.round(remaining / 2);

        return {
          ...prev.ship,
          powerDistribution: {
            ...current,
            [channel]: nextValue,
            [otherChannels[0]]: firstOther,
            [otherChannels[1]]: remaining - firstOther,
          },
        };
      })(),
    }));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return;

      const key = e.key.toLowerCase();

      if (key === "arrowleft" || key === "a") {
        handleRotateShip(-Math.PI / 36);
        setPressedKeys((prev) => ({ ...prev, steerLeft: true }));
      } else if (key === "arrowright" || key === "d") {
        handleRotateShip(Math.PI / 36);
        setPressedKeys((prev) => ({ ...prev, steerRight: true }));
      } else if (key === "arrowup" || key === "w") {
        e.preventDefault();
        if (autopilotMode === "none" || autopilotMode === "align-target") {
          setThrottlePercent(stateRef.current.ship.throttlePercent + 10);
        }
        setPressedKeys((prev) => ({ ...prev, thrust: true }));
      } else if (key === "arrowdown" || key === "s") {
        e.preventDefault();
        if (autopilotMode === "none" || autopilotMode === "align-target") {
          setThrottlePercent(stateRef.current.ship.throttlePercent - 10);
        }
        setPressedKeys((prev) => ({ ...prev, thrust: true }));
      } else if (e.key === " ") {
        e.preventDefault();
        if (autopilotMode === "none" || autopilotMode === "align-target") {
          setThrottlePercent(0);
        }
        setPressedKeys((prev) => ({ ...prev, thrust: true }));
      } else if (key === "c") {
        setPressedKeys((prev) => ({ ...prev, circMode: true }));
        if (selectedBodyExists) {
          setAutopilotMode((prev) => (prev === "circularize" ? "none" : "circularize"));
        } else {
          addConsoleLog("Guidance: Select planetary orbit target before circularization request.", "warning");
        }
      } else if (key === "m") {
        setPressedKeys((prev) => ({ ...prev, matchMode: true }));
        if (selectedBodyExists) {
          setAutopilotMode((prev) => (prev === "match-speed" ? "none" : "match-speed"));
        } else {
          addConsoleLog("Guidance: Select orbit target before match-speed request.", "warning");
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return;

      const key = e.key.toLowerCase();
      if (key === "arrowleft" || key === "a") {
        setPressedKeys((prev) => ({ ...prev, steerLeft: false }));
      } else if (key === "arrowright" || key === "d") {
        setPressedKeys((prev) => ({ ...prev, steerRight: false }));
      } else if (key === "arrowup" || key === "w" || key === "arrowdown" || key === "s" || e.key === " ") {
        setPressedKeys((prev) => ({ ...prev, thrust: false }));
      } else if (key === "c") {
        setPressedKeys((prev) => ({ ...prev, circMode: false }));
      } else if (key === "m") {
        setPressedKeys((prev) => ({ ...prev, matchMode: false }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [addConsoleLog, autopilotMode, selectedBodyExists]);

  return {
    pressedKeys,
    handleRotateShip,
    setShipHeading,
    setThrottlePercent,
    setPowerDistribution,
  };
}
