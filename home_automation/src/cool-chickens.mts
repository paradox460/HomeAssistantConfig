import { TServiceParams } from "@digital-alchemy/core";
import dayjs from "dayjs";

// When it gets above 90 degrees outside, activate two sprinkler zones for a
// short period of time, to create a little bit of cool dirt for them to "bathe"
// in. Latched to run no more frequently than 4 hours from the last sprinkler run.

const THRESHOLD = 90;

export function CoolChickens({ automation, hass }: TServiceParams) {
  const tempSensor = hass.refBy.id("sensor.weather_station_temperature");
  const lastRunSensor = hass.refBy.id("sensor.rainmachine_zone_1_run_completion_time");
  function isDaytime() {
    return automation.solar.isBetween("dawn", "dusk");
  }

  let lastRunTime = dayjs(lastRunSensor.state);
  lastRunSensor.onUpdate(({ state: lastRun }) => {
    lastRunTime = dayjs(lastRun);
  });

  tempSensor.onUpdate(({ state: temp }) => {
    if (temp < THRESHOLD) return;
    if (lastRunTime.diff(dayjs(), "hours") < -4 && isDaytime()) {
      hass.call.rainmachine.start_zone({
        entity_id: ["switch.rainmachine_patio_sprayers", "switch.rainmachine_farthest_backyard"],
        zone_run_time: 120,
      });
    }
  });
}
