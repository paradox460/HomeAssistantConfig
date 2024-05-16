import { CronExpression, TServiceParams } from "@digital-alchemy/core";

export function HolidayLights({
  automation,
  context,
  hass,
  lifecycle,
  scheduler,
  synapse,
}: TServiceParams) {
  const manualSwitch = synapse.switch({
    context,
    defaultState: "off",
    icon: "mdi:string-lights",
    name: "Holiday Lights",
  });

  function turnOn() {
    hass.call.homeassistant.turn_on({
      entity_id: hass.entity.byLabel("holiday_lights"),
    });
    manualSwitch.on = true;
  }

  function turnOff() {
    const lights = [
      ...hass.entity.byLabel("holiday_lights"),
      // Pixel controller:
      ...hass.entity.byDevice("472b85724d32602711e6e74a02d6d2ff", "light"),
    ];

    hass.call.homeassistant.turn_off({
      entity_id: lights,
    });
    manualSwitch.on = false;
  }

  manualSwitch.onUpdate(() => {
    manualSwitch.on ? turnOn() : turnOff();
  });

  automation.solar.onEvent({
    eventName: "sunsetStart",
    exec: turnOn,
  });

  scheduler.cron({
    exec: turnOff,
    schedule: CronExpression.EVERY_DAY_AT_MIDNIGHT,
  });

  automation.solar.onEvent({
    eventName: "nightEnd",
    exec: turnOn,
    offset: "-1H",
  });

  automation.solar.onEvent({
    eventName: "sunriseEnd",
    exec: turnOff,
    offset: "1H",
  });

  // Force state sync for manual control, to ensure the switch reflects reality
  // at boot
  lifecycle.onReady(() => {
    if (
      hass.entity
        .byLabel("holiday_lights")
        .some(entity => hass.entity.byId(entity).state == "on")
    ) {
      turnOn();
      manualSwitch.on = true;
    } else {
      turnOff();
      manualSwitch.on = false;
    }
  });
}
