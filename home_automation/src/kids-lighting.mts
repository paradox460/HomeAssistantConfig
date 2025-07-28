import { TServiceParams } from "@digital-alchemy/core";

export function KidsLighting({ automation, hass, logger, scheduler }: TServiceParams) {
  function isAway(): boolean {
    return hass.refBy.id("binary_sensor.home_presence").state !== "on";
  }

  // Sunset

  automation.solar.onEvent({
    eventName: "sunsetStart",
    exec() {
      logger.info("Kids lighting: Sunset event triggered");
      if (isAway()) {
        return;
      }
      if (new Date().getHours() >= 21) {
        return;
      }

      hass.call.light.turn_on({
        brightness_pct: 50,
        label_id: "kids",
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
      logger.info("Kids lighting: Sunrise event triggered");
      hass.call.light.turn_off({
        label_id: "kids"
      });
    },
    offset: "1H",
  });

  // Bedtime
  scheduler.cron({
    exec() {
      logger.info("Kids lighting: Bedtime event triggered");
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
