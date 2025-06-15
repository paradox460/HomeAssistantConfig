import { sleep, TServiceParams } from "@digital-alchemy/core";
import { createActor, raise, setup, stateIn } from "xstate";

/**
 * Service that turns on the lights whenever a teamtracker team has a game in
 * progress, and then changes the profile if the team loses
 *
 * # Setup
 *
 * You'll need to install
 * [TeamTracker](https://github.com/vasqued2/ha-teamtracker). The setup for this
 * addon is straightforwards, but you have to be careful with your setup,
 * otherwise it just wont work. I'd recommend reading their readme fully, and
 * then starting with this automation.
 *
 * You'll also need to have some form of color-changeable lights. I have a set
 * of LED pixels around the edge of my roof, controlled by
 * [WLED](https://github.com/Aircoookie/WLED) running on a
 * [Dig-Octa](https://quinled.info/quinled-dig-octa/). There's a quite good
 * HomeAssistant integration for WLED, and its what I'm using here.
 *
 * Once all that is ready, you should be able to edit this script pretty easily
 * to do what you want.
 *
 * TeamTracker exposes a _ton_ of entries, so if you are so inclined, you can do
 * things like showing odds for your team to win, or even information as
 * frequent as who has posession of the ball. I'm just content with wins, so
 * thats all I've got here.
 *
 * Also of note, this doesn't have a turn off function; my outdoor lights are
 * switched off automatically by my Holiday Lights automation
 * (holiday-lights.ts), so I don't need it.
 */
export function SportsLights({
  hass,
  context,
  lifecycle,
  synapse,
}: TServiceParams) {
  const sun = hass.refBy.id("sun.sun");
  const sportsLightsSwitch = synapse.switch({
    context,
    icon: "mdi:football",
    name: "Sports Win LED automation",
    is_on: false,
  });
  const roofTrimSwitch = hass.refBy.id("light.roof_trim_main");
  const roofTrimPreset = hass.refBy.id("select.roof_trim_preset");
  const team = hass.refBy.id("sensor.team_tracker_utes_football");

  const machine = setup({
    types: {
      context: {} as {},
      events: {} as
        | { type: "turnOffAutomation" }
        | { type: "turnOnAutomation" }
        | { type: "gameStart" }
        | { type: "win" }
        | { type: "sunset" }
        | { type: "sunrise" }
        | { type: "turnOffLights" }
        | { type: "loss" }
        | { type: "turnOnLights" }
        | { type: "reset" },
    },
    actions: {
      turnOnLights: function () {
        roofTrimPreset.select_option({ option: "Utah" });
      },
      turnOffLights: function () {
        roofTrimSwitch.turn_off();
      },
    },
  }).createMachine({
    context: {},
    id: "SportsLights",
    initial: "automationOff",
    on: {
      turnOffAutomation: {
        target: "#SportsLights.automationOff",
      },
    },
    states: {
      automationOff: {
        on: {
          turnOnAutomation: "automationOn",
        },
      },

      automationOn: {
        type: "parallel",

        states: {
          gameState: {
            initial: "pre",
            states: {
              pre: {
                on: {
                  gameStart: {
                    target: "inGame",
                  },
                },
                entry: raise({ type: "turnOffLights" }),
              },
              inGame: {
                on: {
                  win: {
                    target: "win",
                  },
                  loss: {
                    target: "pre",
                  },
                },
                entry: raise({ type: "turnOnLights" }),
              },
              win: {
                on: {
                  reset: {
                    target: "pre",
                  },
                },
                entry: raise({ type: "turnOnLights" }),
              },
            },
          },

          sunState: {
            initial: "aboveHorizon",
            states: {
              aboveHorizon: {
                on: {
                  sunset: {
                    target: "belowHorizon",
                  },
                },
              },
              belowHorizon: {
                on: {
                  sunrise: {
                    target: "aboveHorizon",
                  },
                },
                entry: raise({ type: "turnOnLights" }),
              },
            },
          },

          lighting: {
            initial: "lightsOff",

            states: {
              lightsOff: {
                on: {
                  turnOnLights: [
                    {
                      target: "scheduledLightsOn",
                      guard: stateIn({
                        automationOn: { sunState: "aboveHorizon" },
                      }),
                    },
                    {
                      target: "lightsOn",
                    },
                  ],
                },
                entry: [{ type: "turnOffLights" }],
              },
              scheduledLightsOn: {
                on: {
                  turnOnLights: {
                    target: "lightsOn",
                    guard: stateIn({
                      automationOn: { sunState: "belowHorizon" },
                    }),
                  },
                },
              },
              lightsOn: {
                entry: [{ type: "turnOnLights" }],
              },
            },

            on: {
              turnOffLights: ".lightsOff",
            },
          },
        },
      },
    },
  });

  const actor = createActor(machine);
  actor.start();

  lifecycle.onReady(() => {
    if (sportsLightsSwitch.is_on) {
      actor.send({ type: "turnOnAutomation" });
    }
    if (sun.state === "below_horizon") {
      actor.send({ type: "sunset" });
    }
    if (team.state === "IN" || team.state === "POST") {
      actor.send({ type: "gameStart" });
    }
    if (team.state === "POST") {
      actor.send({ type: team.attributes.team_winner ? "win" : "loss" });
    }
  });

  sportsLightsSwitch.onUpdate(({ state }) => {
    actor.send({ type: state === "on" ? "turnOnAutomation" : "turnOffAutomation" });
  });

  team.onUpdate(({ state }) => {
    switch (state) {
      case "PRE":
        actor.send({ type: "reset" });
        break;
      case "IN":
        actor.send({ type: "gameStart" });
        break;
      case "POST":
        if (team.attributes.team_winner) {
          actor.send({ type: "win" });
        } else {
          actor.send({ type: "loss" });
        }
        break;
    }
  });

  sun.onUpdate(({ state }) => {
    if (state === "below_horizon") {
      actor.send({ type: "sunset" });
    } else {
      actor.send({ type: "sunrise" });
    }
  });
}
