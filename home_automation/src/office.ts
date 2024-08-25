import { TServiceParams, sleep } from "@digital-alchemy/core";
import dayjs from "dayjs";

export function Office({ hass }: TServiceParams) {
  const officeSwitch = hass.refBy.id("light.office_ceiling");
  const officeWled = hass.refBy.id("light.office_wled_dig_uno");

  officeSwitch.onUpdate(async ({ state: state }) => {
    if (state === "on") {
      officeWled.turn_on();
    } else if (officeWled.state === "on") {
      await sleep(dayjs.duration(1, "minute").asMilliseconds());
      officeWled.turn_off();
    }
  });
}
