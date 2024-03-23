import { TServiceParams } from "@digital-alchemy/core";

export function TheaterTest({logger, hass}: TServiceParams) {

  const theaterLights = hass.entity.byId("light.theater_floor_lamps");

  theaterLights.onUpdate(() => {
    logger.debug(`theater lights turned onto level ${theaterLights.attributes.brightness}`);
    });

  return;
}
