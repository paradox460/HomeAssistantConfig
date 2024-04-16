import { TServiceParams } from "@digital-alchemy/core";

// When it gets above 90 degrees outside, activate two sprinkler zones for a
// short period of time, to create a little bit of cool dirt for them to "bathe"
// in. Latched to run once a day, so I don't have it going off all the time.

const THRESHOLD = 90

export function CoolChickens({ context, scheduler, hass, logger }: TServiceParams) {
  let ranToday = false;

  hass.entity.byId("sensor.weather_station_temperature").onUpdate(({ state: temp }) => {
    if (ranToday) { return; }
    if (parseFloat(temp) < THRESHOLD) { return }

    ranToday = true;
    hass.call.rainmachine.start_zone({
      entity_id: "switch.rainmachine_patio_sprayers",
      zone_run_time: 120
    })
    hass.call.rainmachine.start_zone({
      entity_id: "switch.rainmachine_farthest_backyard",
      zone_run_time: 120
    })
  })

  scheduler.cron({
    schedule: "0 0 * * *",
    exec() {
      ranToday = false;
    }
  })
}