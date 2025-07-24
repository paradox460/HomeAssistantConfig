import { CronExpression, TServiceParams } from "@digital-alchemy/core";
import dayjs from "dayjs";
import { toggleIcons } from "./utils.mts";

export function HolidayLights({
  automation,
  context,
  hass,
  lifecycle,
  logger,
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
        hass.call.homeassistant.turn_on({ label_id: "holiday_lights" });
        break;
      }
      case "off": {
        hass.call.homeassistant.turn_off({ label_id: "holiday_lights" });
        break;
      }
    }
  });

  toggleIcons(holidayLightSwitch, "mdi:string-lights", "mdi:string-lights-off");

  function maybeTurnOnLEDs() {
    if (ledAutomation.is_on) {
      hass.call.homeassistant.turn_on({ label_id: "holiday_leds" });
    }
  }

  function automationTurnOff() {
    logger.info("Turning off all holiday lights and LEDs");
    holidayLightSwitch.is_on = false;
    hass.call.homeassistant.turn_off({ label_id: "holiday_leds" });
  }

  automation.solar.onEvent({
    eventName: "sunsetStart",
    exec: () => {
      logger.info(`Turning on Holiday LEDs at sunset`);
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

  // Slightly more resillient state syncs at boot
  lifecycle.onReady(() => {
    const holidayLights = hass.refBy.label("holiday_lights");
    if (holidayLights.some(light => light.state === "on")) {
      holidayLightSwitch.is_on = true;
    }
  });
}
