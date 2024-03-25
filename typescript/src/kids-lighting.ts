import { TServiceParams, sleep } from "@digital-alchemy/core";


export function KidsLighting({ automation, context, hass, scheduler, logger }: TServiceParams) {

  function isAway(): Boolean {
    return hass.entity.byId("binary_sensor.away_mode").state != "on";
  }

  // Sunset

  automation.solar.onEvent({
    context,
    eventName: "sunsetStart",
    exec() {
      if (isAway()) { return }
      if (new Date().getHours() >= 21) { return }
      logger.info("triggering kids lights on")
      hass.call.light.turn_on({
        brightness_pct: 50,
        entity_id: [
          "light.kids_lights"
        ]
      })
    }
  });

  // Sunrise
  // Turn off kids lights after sunrise
  automation.solar.onEvent({
    context,
    eventName: "sunriseEnd",
    async exec() {
      await sleep(60*60*1000)
      logger.info("turning off kids lights")
      hass.call.light.turn_off({
        entity_id: [
          "light.kids_lights"
        ]
      })
    }
  })

  // Bedtime
  scheduler.cron({
    schedule: "0 21 * * *",
    exec() {
      if (isAway()) { return }
      logger.info("kids bedtime")
      hass.call.scene.turn_on({
        entity_id: [
          "scene.equipment_room_virtual_ede_s_bedtime",
          "scene.equipment_room_virtual_nursery_bedtime"
        ]
      })
    },
  })
}
