import { sleep, TServiceParams } from "@digital-alchemy/core";
import dayjs from "dayjs";
function printing(stateValue: string): boolean {
  return ["init", "pause", "prepare", "running", "slicing"].includes(stateValue.toLowerCase());
}
export function Bambu({ hass }: TServiceParams) {
  const printerLight = hass.refBy.id("light.x1c_00m09c440501390_chamber_light");
  const printStatus = hass.refBy.id("sensor.x1c_00m09c440501390_print_status");
  const printerPower = hass.refBy.id("switch.3d_printer");
  let lightSleep: SleepReturn, powerSleep: SleepReturn;

  printStatus.onUpdate(async ({ state: newState }, { state: oldState }) => {
    // Turn on light when we start a print
    if (printing(newState) && !printing(oldState)) {
      lightSleep?.kill("stop");
      powerSleep?.kill("stop");
      printerLight.turn_on();
    }

    // Turn off 10 minutes after a print finishes
    if (!printing(newState) && printing(oldState)) {
      scheduleTurnOffLight();
      scheduleTurnOffPrinter();
    }
  });

  async function scheduleTurnOffLight() {
    lightSleep = sleep(dayjs.duration(10, "minutes").asMilliseconds());
    await lightSleep;
    if (!printing(printStatus.state)) printerLight.turn_off();
  }
  async function scheduleTurnOffPrinter() {
    powerSleep = sleep(dayjs.duration(6, "hours").asMilliseconds());
    await powerSleep;
    if (!printing(printStatus.state) && printerPower.state === "on") printerPower.turn_off();
  }
}
