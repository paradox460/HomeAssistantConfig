import { TServiceParams } from "@digital-alchemy/core";
import { throttle } from "es-toolkit";
import dayjs from "dayjs";

const THRESHOLD = 40;
const THROTTLE = 10 * 60 * 1000; // 5 min

export function WarmChickens({ context, hass, synapse, logger, lifecycle }: TServiceParams) {
  const tempSensor = hass.refBy.id("sensor.weather_station_temperature");
  const heater = hass.refBy.id("switch.plug_in_outdoor_switch_300s");
  const override = synapse.select({
    context,
    name: "Coop Heater Override",
    options: ["No Override", "Off", "On"],
    select_option({ option }) {
      switch (option) {
        case "Off": {
          hass.refBy.id("switch.plug_in_outdoor_switch_300s").turn_off();
          break;
        }
        case "On": {
          hass.refBy.id("switch.plug_in_outdoor_switch_300s").turn_on();
          break;
        }
      }
    },
  });

  const controlFunc = throttle(
    ({ state: temp }) => {
      logger.info(
        `Current temperature: ${temp}. Heater state: ${heater.state}. Override: ${override.current_option}. Next execution after ${dayjs().add(THROTTLE, "ms").format("YYYY-MM-DDTHH:mm:ssZ")}`,
      );
      if (["On", "Off"].includes(override.current_option)) return;
      if (temp > THRESHOLD && heater.state === "on") {
        logger.info(`Turning off coop heater, ${temp} > ${THRESHOLD}`);
        heater.turn_off();
      } else if (temp <= THRESHOLD && heater.state === "off") {
        logger.info(`Turning on coop heater, ${temp} <= ${THRESHOLD}`);
        heater.turn_on();
      }
    },
    THROTTLE,
    { edges: ["leading"] },
  );

  tempSensor.onUpdate(controlFunc);

  lifecycle.onReady(() => {
    controlFunc({ state: tempSensor.state });
  });
}
