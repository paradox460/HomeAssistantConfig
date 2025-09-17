import { sleep, TServiceParams } from "@digital-alchemy/core";
import dayjs from "dayjs";

export function Office({ hass, lifecycle }: TServiceParams) {
  const officeSwitch = hass.refBy.id("light.office_ceiling");
  const officeWled = hass.refBy.id("light.office_wled_dig2go");

  officeSwitch.onUpdate(async ({ state: state }) => {
    if (state === "on") {
      officeWled.turn_on();
    } else if (officeWled.state === "on") {
      await sleep(dayjs.duration(1, "minute").asMilliseconds());
      officeWled.turn_off();
    }
  });

  lifecycle.onReady(async () => {
    if (officeSwitch.state === "on") {
      officeWled.turn_on();
    } else {
      await sleep(dayjs.duration(1, "minute").asMilliseconds());
      officeWled.turn_off();
    }
  });
}
