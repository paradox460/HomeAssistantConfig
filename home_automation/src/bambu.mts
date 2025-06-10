import { sleep, TServiceParams, is } from "@digital-alchemy/core";
import {
  AndroidNotificationData,
  AppleNotificationData,
  NotificationData,
} from "@digital-alchemy/hass";
import dayjs from "dayjs";

function printing(stateValue: string): boolean {
  return ["init", "pause", "prepare", "running", "slicing"].includes(stateValue.toLowerCase());
}

export function Bambu({ hass }: TServiceParams) {
  // const printerLight = hass.refBy.id("light.x1c_00m09c440501390_chamber_light");
  const printStatus = hass.refBy.id("sensor.h2d_0948ad532300342_print_status");
  const taskName = hass.refBy.id("sensor.h2d_0948ad532300342_task_name");
  const hmsErrors = hass.refBy.id("binary_sensor.h2d_0948ad532300342_hms_errors");
  const printerPower = hass.refBy.id("switch.3d_printer");
  const ams2_dry_time = hass.refBy.id("sensor.h2d_0948ad532300342_ams_1_remaining_drying_time");
  const ams_drying = hass.refBy.id("binary_sensor.3d_printer_ams_drying");
  let powerSleep: SleepReturn;

  printStatus.onUpdate(async ({ state: newState }, { state: oldState }) => {
    if (printing(newState) && !printing(oldState)) {
      powerSleep?.kill("stop");
      hass.call.utility_meter.reset({ entity_id: ["sensor.3d_printer_last_job_energy_usage"] });
    }

    if (!printing(newState) && printing(oldState)) {
      // Turn off after a print finishes
      scheduleTurnOffPrinter(dayjs.duration(2, "hours").asMilliseconds());
    }

    // notify if print finished successfully
    if (newState === "finish") {
      notify("Print Success", `The print job "${taskName.state}" has finished successfully.`, {
        push: { sound: "none" },
      });
    } else if (["pause", "failed"].includes(newState)) {
      const title = newState === "pause" ? "Print Paused" : "Print Failed";
      const notificationState = newState === "pause" ? "paused" : "failed";
      let printerMessages: string | Array<string> = [];
      for (let i = 1; i <= hmsErrors.attributes.Count; i++) {
        printerMessages.push(hmsErrors.attributes[`${i}-Error`]);
      }
      printerMessages = "\n" + printerMessages.join("\n");
      notify(
        title,
        `The print job "${taskName.state}" has ${notificationState}.${printerMessages}`,
        { importance: "high" },
      );
    }
  });

  ams_drying.onUpdate(async ({ state: newState }) => {
    if (newState === "on") {
      powerSleep?.kill("stop");
    }
    if (is.number(ams2_dry_time.state)) {
      scheduleTurnOffPrinter(dayjs.duration(ams2_dry_time.state + 1, "hours").asMilliseconds());
    }
  });

  function notify(
    title: string,
    message: string,
    data: NotificationData & (AndroidNotificationData | AppleNotificationData) = {},
  ) {
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
      },
    });
  }

  async function scheduleTurnOffPrinter(sleepMS) {
    powerSleep = sleep(sleepMS);
    await powerSleep;
    if (!printing(printStatus.state) && printerPower.state === "on" && ams_drying.state != "on")
      printerPower.turn_off();
  }
}
