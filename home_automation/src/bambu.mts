import { TServiceParams } from "@digital-alchemy/core";
import {
  AndroidNotificationData,
  AppleNotificationData,
  NotificationData,
} from "@digital-alchemy/hass";
import dayjs from "dayjs";
import { setup, createActor, stateIn } from "xstate";

export function Bambu({ context, hass, lifecycle, logger, synapse }: TServiceParams) {
  const printStatus = hass.refBy.id("sensor.h2d_0948ad532300342_print_status");
  const taskName = hass.refBy.id("sensor.h2d_0948ad532300342_task_name");
  const hmsErrors = hass.refBy.id("binary_sensor.h2d_0948ad532300342_hms_errors");
  const printerPower = hass.refBy.id("switch.3d_printer");
  const ams_drying = hass.refBy.id("binary_sensor.3d_printer_ams_drying");

  const stateMachineState = synapse.sensor({
    context,
    name: "3D Printer State Machine State",
    icon: "mdi:state-machine",
  });
  const printerAutoOffTime = synapse.sensor({
    context,
    name: "3D Printer Auto Off Time",
    icon: "mdi:timer-cog",
  });

  const automationToggle = synapse.switch({
    context,
    name: "3D Printer Automation",
    icon: "mdi:printer-3d",
  });

  const delayOff = dayjs.duration(2, "hours");

  // MARK: Utility Functions
  function notify(
    title: string,
    message: string,
    data: NotificationData & (AndroidNotificationData | AppleNotificationData) = {},
  ) {
    hass.call.notify.jeff({
      title,
      message,
      data: {
        group: "3dprinter",
        url: "/lovelace/3d-printing",
        clickAction: "/lovelace/3d-printing",
        channel: "3d Printer",
        notification_icon: "mdi:printer-3d",
        ...data,
      },
    });
  }
  const amsMessages = () => {
    let printerMessages: string | Array<string> = [];
    for (let i = 1; i <= hmsErrors.attributes.Count; i++) {
      printerMessages.push(hmsErrors.attributes[`${i}-Error`]);
    }
    printerMessages = "\n" + printerMessages.join("\n");
    return printerMessages;
  };

  function printing(stateValue: string): boolean {
    return ["init", "prepare", "running", "slicing"].includes(stateValue.toLowerCase());
  }

  // MARK: State Machine
  const machine = setup({
    types: {
      context: {} as {},
    },
    actions: {
      notifyPause: function () {
        notify(
          "Print Paused",
          `The print job "${taskName.state}" has been paused.${amsMessages()}`,
          { importance: "high" },
        );
      },
      notifyFinish: function (_, { success }: { success: boolean }) {
        if (success) {
          notify("Print Success", `The print job "${taskName.state}" has finished successfully.`, {
            push: { sound: "none" },
          });
        } else {
          notify("Print Failed", `The print job "${taskName.state}" has failed.${amsMessages()}`, {
            importance: "high",
          });
        }
      },
      resetPowerMeter: function () {
        hass.call.utility_meter.reset({ entity_id: ["sensor.3d_printer_last_job_energy_usage"] });
      },
    },
    delays: {
      idleTimeout: delayOff.asMilliseconds(),
    },
  }).createMachine({
    context: {},
    id: "3D Printer",
    initial: "unsynced",
    states: {
      unsynced: {
        on: {
          running: "idle",
          off: "power_off",
        },
      },

      power_off: {
        on: {
          turnOn: {
            target: "idle",
            actions: {
              type: "resetPowerMeter",
            },
          },
        },
      },

      idle: {
        on: {
          startPrinting: {
            target: "#3D Printer.active.printing.printing",
            actions: {
              type: "resetPowerMeter",
            },
          },

          startDrying: {
            target: "#3D Printer.active.drying.drying",
          },
        },

        entry: [
          () => {
            printerAutoOffTime.state = dayjs().add(delayOff).format();
          },
        ],
        exit: [
          () => {
            printerAutoOffTime.state = "";
          },
        ],
        after: {
          idleTimeout: {
            target: "power_off",
            actions: [
              () => {
                logger.info("Printer idle for too long, turning off");
                if (automationToggle.is_on) {
                  printerPower.turn_off();
                } else {
                  logger.info("Automation turned off, not turning off printer");
                }
              },
            ],
          },
        },
      },

      active: {
        type: "parallel",
        always: {
          target: "idle",
          guard: stateIn({ active: { printing: "idle", drying: "idle" } }),
        },
        states: {
          drying: {
            initial: "idle",
            states: {
              idle: {
                on: {
                  startDrying: {
                    target: "drying",
                  },
                },
              },
              drying: {
                on: {
                  stopDrying: {
                    target: "idle",
                  },
                },
              },
            },
          },
          printing: {
            initial: "idle",
            states: {
              idle: {
                on: {
                  startPrinting: {
                    target: "printing",
                    actions: {
                      type: "resetPowerMeter",
                    },
                  },
                },
              },
              printing: {
                on: {
                  pausePrinting: {
                    target: "paused",
                    actions: {
                      type: "notifyPause",
                    },
                  },
                  successfulPrint: {
                    target: "idle",
                    actions: {
                      type: "notifyFinish",
                      params: {
                        success: true,
                      },
                    },
                  },
                  failedPrint: {
                    target: "idle",
                    actions: {
                      type: "notifyFinish",
                      params: {
                        success: false,
                      },
                    },
                  },
                },
              },
              paused: {
                on: {
                  startPrinting: {
                    target: "printing",
                  },
                },
              },
            },
          },
        },
      },
    },
    on: {
      turnOff: {
        target: ".power_off",
        description: "Global power off event,resets state machine",
      },
    },
  });

  const actor = createActor(machine);
  actor.start();
  actor.subscribe(snapshot => {
    stateMachineState.state = JSON.stringify(snapshot.value);
    logger.info(`New snapshot state: ${snapshot.value}`);
  });

  // MARK: Initial State Setup
  // Bit of a hack to get initial state loaded into the stateMachine, since things could be in progress as we start up
  lifecycle.onReady(() => {
    if (printerPower.state === "on") {
      logger.info("Printer is powered on, setting state machine to 'running'");
      actor.send({ type: "running" });
      if (printing(printStatus.state) || printStatus.state === "pause") {
        logger.info("Printer is printing, setting state machine to 'startPrinting'");
        actor.send({ type: "startPrinting" });
      }
      if (ams_drying.state === "on") {
        logger.info("Printer is drying, setting state machine to 'startDrying'");
        actor.send({ type: "startDrying" });
      }
    } else {
      actor.send({ type: "off" });
    }
  });

  // MARK: Event Handlers

  printerPower.onUpdate(({ state: newState }) => {
    logger.info(`Printer power updated: ${newState}`);
    switch (newState) {
      case "on":
        actor.send({ type: "turnOn" });
        break;
      case "off":
        actor.send({ type: "turnOff" });
        break;
      default:
        // Do nothing for other states
        break;
    }
  });

  printStatus.onUpdate(({ state: newState }) => {
    logger.info(`Print status updated: ${newState}`);
    switch (newState) {
      case "init":
      case "prepare":
      case "running":
      case "slicing":
        actor.send({ type: "startPrinting" });
        break;
      case "pause":
        actor.send({ type: "pausePrinting" });
        break;
      case "finish":
        actor.send({ type: "successfulPrint" });
        break;
      case "failed":
        actor.send({ type: "failedPrint" });
        break;
      default:
        // Do nothing for other states
        break;
    }
  });

  ams_drying.onUpdate(({ state: newState }) => {
    switch (newState) {
      case "on":
        logger.info("AMS Drying started");
        actor.send({ type: "startDrying" });
        break;
      case "off":
        logger.info("AMS Drying stopped");
        actor.send({ type: "stopDrying" });
        break;
      default:
        // Do nothing
        break;
    }
  });
}
