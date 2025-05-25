import { sleep, CronExpression, TServiceParams } from "@digital-alchemy/core";

export function BedHeater({ context, hass, scheduler, synapse }: TServiceParams) {
  const bedHeaterSwitch = hass.refBy.id("switch.bed_heater");

  const bedHeaterButton = synapse.button({
    context,
    name: "Bed Heater",
    unique_id: "bed_heater_button",
    icon: "mdi:bed",
  });

  const bedHeaterAutomation = synapse.switch({
    context,
    name: "Bed Heater Automation"
  })

  bedHeaterButton.onPress(() => {
    bedHeaterSwitch.toggle();
  });

  scheduler.cron({
    exec() {
      if (hass.refBy.id("binary_sensor.home_presence").state === "on" && bedHeaterAutomation.is_on) {
        bedHeaterSwitch.toggle();
      }
    },
    schedule: CronExpression.EVERY_DAY_AT_MIDNIGHT,
  });
}
