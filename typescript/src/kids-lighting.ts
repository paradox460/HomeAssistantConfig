import { TServiceParams } from "@digital-alchemy/core";

export function KidsLighting({ automation, hass, scheduler }: TServiceParams) {
  function isAway(): boolean {
    return hass.entity.byId("binary_sensor.away_mode").state != "on";
  }

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
        entity_id: hass.entity.byLabel("kids"),
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
        entity_id: hass.entity.byLabel("kids"),
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
        entity_id: [
          "scene.virtual_ede_s_bedtime",
          "scene.virtual_ferrins_bedtime",
        ],
      });
    },
    schedule: "0 21 * * *",
  });
}
