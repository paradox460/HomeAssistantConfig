import { CronExpression, TServiceParams } from "@digital-alchemy/core";
import dayjs from "dayjs";
import { toggleIcons } from "./utils";

export function HolidayLights({
  automation,
  context,
  hass,
  lifecycle,
  scheduler,
  synapse,
}: TServiceParams) {
  const holidayLights = hass.refBy.label("holiday_lights");
  const roofTrimLights = hass.refBy.id("light.roof_trim_main");
  const roofStripAutomation = synapse.switch({
    context,
    name: "Roof Light Automation",
  });

  toggleIcons(roofStripAutomation, "mdi:led-strip-variant", "mdi:led-strip-variant-off");

  const holidayLightSwitch = synapse.switch({
    context,
    name: "Holiday Lights",
    turn_on() {
      for (const light of holidayLights) light.turn_on();

      if (roofStripAutomation.is_on) {
        roofTrimLights.turn_on();
      }
    },
    turn_off() {
      for (const light of holidayLights) light.turn_off();

      if (roofStripAutomation.is_on) {
        roofTrimLights.turn_off();
      }
    },
  });

  toggleIcons(holidayLightSwitch, "mdi:string-lights", "mdi:string-lights-off");

  automation.solar.onEvent({
    eventName: "sunsetStart",
    exec: () => {
      holidayLightSwitch.is_on = true;
    },
  });

  scheduler.sliding({
    exec: () => {
      holidayLightSwitch.is_on = false;
    },
    next() {
      const offset = Math.random() * 30 * 60 * 1000;
      return dayjs().add(1, "d").startOf("day").add(offset);
    },
    reset: CronExpression.EVERY_DAY_AT_1AM,
  });

  automation.solar.onEvent({
    eventName: "nightEnd",
    exec: () => {
      holidayLightSwitch.is_on = true;
    },
    offset: "-1H",
  });

  automation.solar.onEvent({
    eventName: "sunriseEnd",
    exec: () => {
      holidayLightSwitch.is_on = false;
    },
    offset: "1H",
  });

  // Slightly more resillient state syncs at boot
  lifecycle.onReady(() => {
    if (holidayLights.some(light => light.state === "on")) holidayLightSwitch.is_on = true;
  });
}