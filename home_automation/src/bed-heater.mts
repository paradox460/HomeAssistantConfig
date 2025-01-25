import { sleep, CronExpression, TServiceParams } from "@digital-alchemy/core";

export function BedHeater({ context, hass, scheduler, synapse }: TServiceParams) {
  const bedHeaterSwitch = hass.refBy.id("switch.bed_heater");

  const bedHeaterButton = synapse.button({
    context,
    name: "Bed Heater",
    unique_id: "bed_heater_button",
    icon: "mdi:bed",
  });

  bedHeaterButton.onPress(() => {
    bedHeaterSwitch.turn_on();
  });

  bedHeaterSwitch.onUpdate(async ({ state }) => {
    if (state === "on") {
      await sleep(500);
      bedHeaterSwitch.turn_off();
    }
  });

  scheduler.cron({
    exec() {
      if (hass.refBy.id("binary_sensor.home_presence").state === "on") {
        bedHeaterSwitch.turn_on();
      }
    },
    schedule: CronExpression.EVERY_DAY_AT_MIDNIGHT,
  });
}
