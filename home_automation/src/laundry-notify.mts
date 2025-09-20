import { TServiceParams } from "@digital-alchemy/core";

export function LaundryNotify({ context, hass }: TServiceParams) {
  const washingMachine = hass.refBy.id("sensor.washing_machine_status"),
    dryer = hass.refBy.id("sensor.tumble_dryer_status");

  washingMachine.onUpdate(
    (
      { state: newState, attributes: { "Raw value": newRawValue } },
      { state: oldState, attributes: { "Raw value": oldRawValue } },
    ) => {
      if (
        oldState === "running" &&
        oldRawValue === 5 &&
        newState === "program_ended" &&
        newRawValue === 7
      ) {
        notify("Washing Machine");
      }
    },
  );

  dryer.onUpdate(
    (
      { state: newState, attributes: { "Raw value": newRawValue } },
      { state: oldState, attributes: { "Raw value": oldRawValue } },
    ) => {
      if (
        oldState === "running" &&
        oldRawValue === 5 &&
        newState === "program_ended" &&
        newRawValue === 7
      ) {
        notify("Dryer");
      }
    },
  );

  function notify(deviceName: string) {
    hass.call.notify.tvoverlaynotify({
      message: `${deviceName} has finished.`,
      title: "Laundry",
    });
    hass.call.notify.mobile_app_jeffs_macbook_pro({
      message: `${deviceName} has finished.`,
      title: "Laundry",
    });
  }
}
