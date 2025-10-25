import { TServiceParams } from "@digital-alchemy/core";

import { setup, createActor, stateIn, not, assign } from "xstate";

export function Theater({ context, hass, lifecycle, synapse }: TServiceParams) {
  // Motion Sensor entities
  const motionSensorLight = hass.refBy.id("light.apollo_r_pro_1_w_352144_rgb_light");
  const binaryPresence = hass.refBy.id("binary_sensor.apollo_r_pro_1_w_352144_ld2412_presence");
  const countPresence = hass.refBy.id(
    "sensor.apollo_r_pro_1_w_352144_ld2450_presence_target_count",
  );

  const stairsOccupancy = hass.refBy.id("binary_sensor.lower_stairs_motion_sensor_occupancy");

  // Couch Sensor
  const couchPresence = hass.refBy.id("binary_sensor.bed_presence_2d1e78_couch_occupied_either");

  // TV entity
  const tv = hass.refBy.id("media_player.theater_screen");

  // Controlled entities
  const theaterMode = hass.refBy.id("select.harmony_hub_activities");
  const theaterLights = hass.refBy.id("light.theater_floor_lamps");

  // Synapse entities
  const subDevice = synapse.device.register("theater_vacancy_automation", {
    name: "Theater Vacancy Automation",
  });
  const stateMachineState = synapse.sensor({
    context,
    name: "Theater vacancy state machine state",
    entity_category: "diagnostic",
    device_id: subDevice,
  });
  const enableAutomation = synapse.switch({
    context,
    name: "Theater Vacancy Automation",
    device_id: subDevice,
  });
  const stateMachineSynced = synapse.binary_sensor({
    context,
    name: "Theater state machine synced",
    entity_category: "diagnostic",
    device_id: subDevice,
  });
  const stateMachineBecomingVacant = synapse.binary_sensor({
    context,
    name: "Theater state machine becoming vacant",
    entity_category: "diagnostic",
    device_id: subDevice,
  });

  // Misc entities
  const homePresence = hass.refBy.id("binary_sensor.home_presence");

  let previousBrightness: number;

  const machine = setup({
    actions: {
      savePreviousBrightness: ({ context }) => {
        if (context.becomingVacant) return;
        previousBrightness = Math.round((theaterLights.attributes.brightness / 255) * 100);
      },
      turnAllOff: () => {
        motionSensorLight.turn_off();
        theaterLights.turn_off();
        theaterMode.select_option({ option: "power_off" });
      },
      turnOn: ({ context }) => {
        if (context.becomingVacant) {
          theaterLights.turn_on({
            brightness_pct: previousBrightness,
          });
          motionSensorLight.turn_off();
        } else if (context.previouslyVacant && theaterLights.state === "off") {
          theaterLights.turn_on({
            transition: 3,
          });
        }
      },
    },
    delays: {
      vacantTimeout: 1000 * 60 * 15,
      vacantAfterAlert: 1000 * 30,
    },
    guards: {
      disabled: () => !enableAutomation.is_on,
      hasPresence: () => binaryPresence.state === "on" || countPresence.state > 0,
      away: () => homePresence.state === "off",
      idle: stateIn({
        active: {
          tv: "idle",
          binaryOccupancy: "unoccupied",
          countOccupancy: "unoccupied",
          couchOccupancy: "unoccupied",
        },
      }),
    },
    types: {} as {
      context: {
        synced: boolean;
        becomingVacant: boolean;
        previouslyVacant: boolean;
      };
    },
  }).createMachine({
    context: {
      synced: false,
      becomingVacant: false,
      previouslyVacant: false,
    },

    id: "Theater Vacancy",
    initial: "idle",
    on: {
      away: {
        target: ".vacant",
        guard: not("disabled"),
      },

      disable: {
        target: ".disabled",
        actions: [assign({ synced: false })],
      },
    },

    states: {
      disabled: {
        on: {
          enable: [
            {
              target: "vacant",
              guard: "away",
            },
            {
              target: "idle",
              actions: [assign({ synced: false })],
            },
          ],
        },
      },

      active: {
        type: "parallel",
        always: {
          target: "idle",
          guard: "idle",
        },
        entry: ["turnOn", assign({ becomingVacant: false, previouslyVacant: false })],
        states: {
          tv: {
            initial: "idle",
            states: {
              idle: {
                on: {
                  tvActive: "watching",
                },
              },
              watching: {
                on: {
                  tvIdle: "idle",
                },
              },
            },
          },
          binaryOccupancy: {
            initial: "unoccupied",
            states: {
              unoccupied: {
                on: {
                  binaryOccupied: "occupied",
                },
              },
              occupied: {
                on: {
                  binaryUnoccupied: "unoccupied",
                },
              },
            },
          },
          countOccupancy: {
            initial: "unoccupied",
            states: {
              unoccupied: {
                on: {
                  countOccupied: "occupied",
                },
              },
              occupied: {
                on: {
                  countUnoccupied: "unoccupied",
                },
              },
            },
          },
          couchOccupancy: {
            initial: "unoccupied",
            states: {
              unoccupied: {
                on: {
                  couchOccupied: "occupied",
                },
              },
              occupied: {
                on: {
                  couchUnoccupied: "unoccupied",
                },
              },
            },
          },
        },
      },

      idle: {
        after: {
          vacantTimeout: {
            target: "idle",
            reenter: true,
            actions: [
              assign({ becomingVacant: true }),
              () => {
                if (theaterLights.state === "on") {
                  theaterLights.turn_on({
                    brightness_pct: Math.max(50, Math.min(previousBrightness / 2, 10)),
                    transition: 5,
                  });
                }
                motionSensorLight.turn_on({
                  rgb_color: [255, 0, 0],
                  brightness_pct: 100,
                  effect: "Slow Pulse",
                });
              },
            ],
            guard: ({ context }) => !context.becomingVacant,
          },

          vacantAfterAlert: {
            target: "vacant",
            reenter: true,
            guard: ({ context }) => context.becomingVacant,
          },
        },

        entry: [
          ({ context }) => {
            if (!context.synced) {
              sync();
            }
          },
          assign({ synced: true }),
          "savePreviousBrightness",
        ],

        on: {
          countOccupied: "active.countOccupancy.occupied",
          binaryOccupied: "active.binaryOccupancy.occupied",
          tvActive: "active.tv.watching",
          couchOccupied: "active.couchOccupancy.occupied",
        },
      },

      vacant: {
        entry: ["turnAllOff", assign({ becomingVacant: false, previouslyVacant: true })],

        on: {
          binaryOccupied: "active.binaryOccupancy.occupied",
          countOccupied: "active.countOccupancy.occupied",
          tvActive: "active.tv.watching",
          couchOccupied: "active.couchOccupancy.occupied",
        },
      },
    },
  });

  const actor = createActor(machine);
  actor.start();
  actor.subscribe(snapshot => {
    stateMachineState.state = JSON.stringify(snapshot.value);
    stateMachineSynced.is_on = snapshot.context.synced;
    stateMachineBecomingVacant.is_on = snapshot.context.becomingVacant;
  });

  function sync() {
    // Sync disabled (and exit early if we're disabled)
    if (!enableAutomation.is_on) {
      actor.send({ type: "disable" });
      return;
    }
    // Sync away (and return early since away turns everything off)
    if (homePresence.state === "off") {
      actor.send({ type: "away" });
      return;
    }

    // Sync binary occupancy
    if (binaryPresence.state === "on") {
      actor.send({ type: "binaryOccupied" });
    } else if (binaryPresence.state === "off") {
      actor.send({ type: "binaryUnoccupied" });
    }

    // Sync count occupancy
    if (countPresence.state > 0) {
      actor.send({ type: "countOccupied" });
    } else if (countPresence.state === 0) {
      actor.send({ type: "countUnoccupied" });
    }

    // Sync TV status
    if (tv.state === "playing") {
      actor.send({ type: "tvActive" });
    } else if (["paused", "idle", "off"].includes(tv.state)) {
      actor.send({ type: "tvIdle" });
    }

    // Sync couch occupancy
    if (couchPresence.state === "on") {
      actor.send({ type: "couchOccupied" });
    } else if (couchPresence.state === "off") {
      actor.send({ type: "couchUnoccupied" });
    }
  }

  lifecycle.onReady(() => {
    sync();
  });

  binaryPresence.onUpdate(({ state }) => {
    switch (state) {
      case "on":
        actor.send({ type: "binaryOccupied" });
        break;
      case "off":
        actor.send({ type: "binaryUnoccupied" });
        break;
    }
  });

  // Note that we don't care about the stairs occupancy for initial sync, only
  // as a reactive change.
  // This makes it so someone coming down the stairs will turn the lights in the
  // theater on before they get there, so you don't have to walk into a dark
  // room.
  stairsOccupancy.onUpdate(({ state }) => {
    if (state === "on") {
      actor.send({ type: "binaryOccupied" });
    } else if (state === "off") {
      actor.send({ type: "binaryUnoccupied" });
    }
  });

  countPresence.onUpdate(({ state }) => {
    if (state > 0) {
      actor.send({ type: "countOccupied" });
    } else {
      actor.send({ type: "countUnoccupied" });
    }
  });

  tv.onUpdate(({ state }) => {
    if (state === "playing") {
      actor.send({ type: "tvActive" });
    } else if (["paused", "idle", "off"].includes(state)) {
      actor.send({ type: "tvIdle" });
    }
  });

  couchPresence.onUpdate(({ state }) => {
    if (state === "on") {
      actor.send({ type: "couchOccupied" });
    } else if (state === "off") {
      actor.send({ type: "couchUnoccupied" });
    }
  });

  enableAutomation.onUpdate(({ state }) => {
    if (state === "on") {
      actor.send({ type: "enable" });
    } else if (state === "off") {
      actor.send({ type: "disable" });
    }
  });

  homePresence.onUpdate(({ state }) => {
    if (state === "off") {
      actor.send({ type: "away" });
    }
  });
}
