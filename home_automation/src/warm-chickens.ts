import { TServiceParams } from "@digital-alchemy/core";
import { debounce } from "es-toolkit";

// When its below 35º outside, turn on the hen house heater
const THRESHOLD = 35;

export function WarmChickens({ hass, logger }: TServiceParams) {
  const tempSensor = hass.refBy.id("sensor.weather_station_temperature");

  const controlFunc = debounce(
    ({ state: temp }) => {
      const heater = hass.refBy.id("switch.plug_in_outdoor_switch_300s");
      if (temp > THRESHOLD && heater.state === "on") {
        logger.info(`Turning off coop heater, ${temp} > ${THRESHOLD}`);
        heater.turn_off();
      } else if (temp <= THRESHOLD && heater.state === "off") {
        logger.info(`Turning on coop heater, ${temp} <= ${THRESHOLD}`);
        heater.turn_on();
      }
    },
    5 * 60 * 1000, // 5 min
    { edges: ["leading"] },
  );

  tempSensor.onUpdate(controlFunc);
}
