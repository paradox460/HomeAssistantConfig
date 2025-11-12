import { sleep, TServiceParams } from "@digital-alchemy/core";
import dayjs from "dayjs";

import { setup, createActor } from "xstate";

export function Office({ hass, lifecycle, logger }: TServiceParams) {
  const officeSwitch = hass.refBy.id("light.office_ceiling");
  const officeWled = hass.refBy.id("light.office_wled_dig2go");
  const homePresence = hass.refBy.id("binary_sensor.home_presence");

  // occupancySensor is a HomeAssistant Group helper, as that neatly encapsulates the logic for multiple sensors OR'd together
  const occupancySensor = hass.refBy.id("binary_sensor.office_occupancy");

  officeSwitch.onUpdate(async ({ state: state }) => {
    if (state === "on") {
      officeWled.turn_on();
    } else if (officeWled.state === "on") {
      await sleep(dayjs.duration(1, "minute").asMilliseconds());
      officeWled.turn_off();
    }
  });

  // Motion control below

  const machine = setup({
    actions: {
      turnOn: () => {
        officeSwitch.turn_on();
      },
      turnOff: () => {
        officeSwitch.turn_off();
      },
    },
    delays: {
      occupancyTimeout: 1000 * 60 * 10,
    },
  }).createMachine({
    id: "Office Vacancy",
    initial: "vacant",

    on: {
      away: ".away",
    },

    states: {
      vacant: {
        on: {
          motion: {
            target: "occupied",
            actions: ["turnOn"],
          },
        },
      },
      occupied: {
        on: {
          noMotion: {
            target: "becomingVacant",
          },
        },
      },
      becomingVacant: {
        on: {
          motion: {
            target: "occupied",
          },
        },
        after: {
          occupancyTimeout: {
            target: "vacant",
            actions: ["turnOff"],
          },
        },
      },
      away: {
        on: {
          home: "vacant",
        },
      },
    },
  });

  const actor = createActor(machine);
  actor.start();
  actor.subscribe(snapshot => {
    logger.info(`New office snapshot state: ${JSON.stringify(snapshot.value)}`);
  });


  occupancySensor.onUpdate(({ state: state }) => {
    if (state === "on") {
      actor.send({ type: "motion" });
    } else if (state === "off") {
      actor.send({ type: "noMotion" });
    }
  });

  homePresence.onUpdate(({ state: state }) => {
    if (state === "on") {
      actor.send({ type: "home" });
    } else if (state === "off") {
      actor.send({ type: "away" });
    }
  });

  lifecycle.onReady(async () => {
    if (officeSwitch.state === "on") {
      officeWled.turn_on();
    } else {
      await sleep(dayjs.duration(1, "minute").asMilliseconds());
      officeWled.turn_off();
    }
    if (homePresence.state === "off") {
      actor.send({ type: "away" });
    }
  });
}
