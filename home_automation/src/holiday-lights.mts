import { CronExpression, TServiceParams } from "@digital-alchemy/core";
import dayjs from "dayjs";
import { toggleIcons } from "./utils.mts";

export function HolidayLights({
  automation,
  context,
  hass,
  lifecycle,
  scheduler,
  synapse,
}: TServiceParams) {
  const ledAutomation = synapse.switch({
    context,
    name: "Holiday LED Automation",
  });

  toggleIcons(ledAutomation, "mdi:led-strip-variant", "mdi:led-strip-variant-off");

  const holidayLightSwitch = synapse.switch({
    context,
    name: "Holiday Lights",
  });

  holidayLightSwitch.onUpdate(({ state }) => {
    switch (state) {
      case "on": {
        for (const light of hass.refBy.label("holiday_lights")) light.turn_on();
        break;
      }
      case "off": {
        for (const light of hass.refBy.label("holiday_lights")) light.turn_off();
        break;
      }
    }
  });

  toggleIcons(holidayLightSwitch, "mdi:string-lights", "mdi:string-lights-off");

  function maybeTurnOnLEDs() {
    if (ledAutomation.is_on) {
      const holidayLEDs = hass.refBy.label("holiday_leds");
      for (const l of holidayLEDs) {
        l.turn_on();
      }
    }
  }

  function automationTurnOff() {
    const holidayLEDs = hass.refBy.label("holiday_leds");
    holidayLightSwitch.is_on = false;
    for (const l of holidayLEDs) {
      l.turn_off();
    }
  }

  automation.solar.onEvent({
    eventName: "sunsetStart",
    exec: () => {
      holidayLightSwitch.is_on = true;
      maybeTurnOnLEDs();
    },
  });

  scheduler.sliding({
    exec: () => {
      automationTurnOff();
    },
    next() {
      const offset = Math.random() * 30 * 60 * 1000;
      const n = dayjs().add(1, "d").startOf("day").add(offset);
      return n;
    },
    reset: CronExpression.EVERY_DAY_AT_3AM,
  });

  automation.solar.onEvent({
    eventName: "nightEnd",
    exec: () => {
      holidayLightSwitch.is_on = true;
      maybeTurnOnLEDs();
    },
    offset: "-1H",
  });

  automation.solar.onEvent({
    eventName: "sunriseEnd",
    exec: () => {
      automationTurnOff();
    },
    offset: "1H",
  });

  // Slightly more resillient state syncs at boot
  lifecycle.onReady(() => {
    const holidayLights = hass.refBy.label("holiday_lights");
    if (holidayLights.some(light => light.state === "on")) {
      holidayLightSwitch.is_on = true;
    }
  });
}
