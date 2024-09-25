import { TServiceParams, sleep } from "@digital-alchemy/core";
import dayjs from "dayjs";
function printing(stateVal: string): boolean {
  return ["init", "pause", "prepare", "running", "slicing"].includes(stateVal.toLowerCase());
}
export function Bambu({ hass }: TServiceParams) {
  const printerLight = hass.refBy.id("light.x1c_00m09c440501390_chamber_light");
  const printStatus = hass.refBy.id("sensor.x1c_00m09c440501390_print_status");

  printStatus.onUpdate(async ({ state: newState }, { state: oldState }) => {
    // Turn on light when we start a print
    if (printing(newState) && !printing(oldState)) {
      printerLight.turn_on();
    }

    // Turn off 10 minutes after a print finishes
    if (!printing(newState) && printing(oldState)) {
      await sleep(dayjs.duration(10, "minutes").asMilliseconds());
      if (!printing(printStatus.state)) printerLight.turn_off();
    }
  });
}
