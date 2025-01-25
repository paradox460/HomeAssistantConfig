import { TServiceParams } from "@digital-alchemy/core";

export function KidsLighting({ automation, hass, scheduler }: TServiceParams) {
  function isAway(): boolean {
    return hass.refBy.id("binary_sensor.home_presence").state !== "on";
  }

  const kidsLights = hass.idBy.label("kids");
  // Sunset

  automation.solar.onEvent({
    eventName: "sunsetStart",
    exec() {
      if (isAway()) {
        return;
      }
      if (new Date().getHours() >= 21) {
        return;
      }

      hass.call.light.turn_on({
        brightness_pct: 50,
        entity_id: kidsLights,
        transition: 30,
      });
    },
    offset: "-30M",
  });

  // Sunrise
  // Turn off kids lights after sunrise
  automation.solar.onEvent({
    eventName: "sunriseEnd",
    exec() {
      hass.call.light.turn_off({
        entity_id: kidsLights,
      });
    },
    offset: "1H",
  });

  // Bedtime
  scheduler.cron({
    exec() {
      if (isAway()) {
        return;
      }
      hass.call.scene.turn_on({
        entity_id: ["scene.virtual_ede_s_bedtime", "scene.virtual_ferrins_bedtime"],
      });
    },
    schedule: "0 21 * * *",
  });
}
