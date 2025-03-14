import { sleep, TServiceParams } from "@digital-alchemy/core";
import { AndroidNotificationData, NotificationData } from "@digital-alchemy/hass";
import dayjs from "dayjs";

function printing(stateValue: string): boolean {
  return ["init", "pause", "prepare", "running", "slicing"].includes(stateValue.toLowerCase());
}

export function Bambu({ hass }: TServiceParams) {
  const printerLight = hass.refBy.id("light.x1c_00m09c440501390_chamber_light");
  const printStatus = hass.refBy.id("sensor.x1c_00m09c440501390_print_status");
  const taskName = hass.refBy.id("sensor.x1c_00m09c440501390_task_name");
  const hmsErrors = hass.refBy.id("binary_sensor.x1c_00m09c440501390_hms_errors");
  const printerPower = hass.refBy.id("switch.3d_printer");
  let lightSleep: SleepReturn, powerSleep: SleepReturn;

  printStatus.onUpdate(async ({ state: newState }, { state: oldState }) => {
    // Turn on light when we start a print
    if (printing(newState) && !printing(oldState)) {
      lightSleep?.kill("stop");
      powerSleep?.kill("stop");
      printerLight.turn_on();
    }

    if (!printing(newState) && printing(oldState)) {
    // Turn off after a print finishes
      scheduleTurnOffLight();
      scheduleTurnOffPrinter();
    }

    // notify if print finished successfully
    if (newState === "finish") {
      notify("Print Success", `The print job "${taskName.state}" has finished successfully.`)
    } else if (["pause", "failed"].includes(newState)) {
      const title = newState === "pause" ? "Print Paused" : "Print Failed"
      const notificationState = newState === "pause" ? "paused" : "failed"
      let printerMessages: string | Array<string> = []
      for (let i = 1; i <= hmsErrors.attributes.Count; i++) {
        printerMessages.push(hmsErrors.attributes[`${i}-Error`])
      }
      printerMessages = "\n" + printerMessages.join("\n")
      notify(title, `The print job "${taskName.state}" has ${notificationState}.${printerMessages}`, {importance: "high"})
    }
  });

  function notify(title: string, message: string, data: NotificationData & AndroidNotificationData = {}) {
      hass.call.notify.jeff({
        title,
        message,
        data: {
          group: "3dprinter",
          url: "/lovelace/3d-printing",
          clickAction: "/lovelace/3d-printing",
          channel: "3d Printer",
          notification_icon: "mdi:printer-3d",
          ...data,
      }})

  }

  async function scheduleTurnOffLight() {
    lightSleep = sleep(dayjs.duration(10, "minutes").asMilliseconds());
    await lightSleep;
    if (!printing(printStatus.state)) printerLight.turn_off();
  }
  async function scheduleTurnOffPrinter() {
    powerSleep = sleep(dayjs.duration(3, "hours").asMilliseconds());
    await powerSleep;
    if (!printing(printStatus.state) && printerPower.state === "on") printerPower.turn_off();
  }
}
