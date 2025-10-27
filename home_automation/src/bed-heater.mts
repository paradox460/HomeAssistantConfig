import { TServiceParams } from "@digital-alchemy/core";
import { ByIdProxy } from "@digital-alchemy/hass";
import { SynapseSensor, SynapseSwitch, TSynapseDeviceId } from "@digital-alchemy/synapse";

import { setup, createActor, stateIn, Actor, StateMachine } from "xstate";

export function BedHeater(service_params: TServiceParams) {
  const { hass, synapse } = service_params;
  const jeffsHeater = hass.refBy.id("switch.jeff_s_bed_heater");
  const jeffsOccupancy = hass.refBy.id("binary_sensor.bed_presence_2bd9d8_bed_occupied_left");
  const stephsHeater = hass.refBy.id("switch.stephanie_s_bed_heater");
  const stephsOccupancy = hass.refBy.id("binary_sensor.bed_presence_2bd9d8_bed_occupied_right");

  const bedAutomationsDevice = synapse.device.register("bed_heater_automations", {
    name: "Bed Heater Automations",
  });

  const jeffs_bed_automation = new BedAutomation({
    service_params,
    heater: jeffsHeater,
    sensor: jeffsOccupancy,
    device: bedAutomationsDevice,
  });
  const stephs_bed_automation = new BedAutomation({
    service_params,
    heater: stephsHeater,
    sensor: stephsOccupancy,
    device: bedAutomationsDevice,
  });
}

class BedAutomation {
  private service_params: TServiceParams;
  private heater: ByIdProxy<any>;
  private sensor: ByIdProxy<any>;
  private device: TSynapseDeviceId;
  private automationSwitch: SynapseSwitch<any>;
  private automationStatus: SynapseSensor<any>;
  private machine: StateMachine<
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any
  >;
  private actor: Actor<any>;

  constructor({
    service_params,
    heater,
    sensor,
    device,
  }: {
    service_params: TServiceParams;
    heater: ByIdProxy<any>;
    sensor: ByIdProxy<any>;
    device: TSynapseDeviceId;
  }) {
    this.service_params = service_params;
    this.heater = heater;
    this.sensor = sensor;
    this.device = device;

    this.setupStateMachine();
    this.setupSynapse();
    this.setupActor();
    this.setupCrons();
    this.setupListeners();
  }

  setupStateMachine() {
    this.machine = setup({
      delays: {
        bedTimeout: 1000 * 60 * 60 * 2, // 2 hours
      },
      actions: {
        turnOff: () => {
          this.heater.turn_off();
        },
        turnOn: () => {
          this.heater.turn_on();
        },
      },
      guards: {
        occupied: () => this.sensor.state === "on",
      },
    }).createMachine({
      id: "bed_heater_automation",

      initial: "idle",
      on: {
        disable: ".disabled",
      },

      states: {
        disabled: {
          on: {
            enable: "idle",
          },
        },
        idle: {
          on: {
            heat: [
              {
                target: "occupiedHeating",
                guard: "occupied",
              },
              {
                target: "heating",
              },
            ],
          },
          entry: "turnOff",
        },

        heating: {
          on: {
            stopHeat: "idle",
            occupied: "occupiedHeating",
          },
          entry: "turnOn",
        },

        occupiedHeating: {
          on: {
            stopHeat: "idle",
          },
          after: {
            bedTimeout: "idle",
          },
          entry: "turnOn",
        },
      },
    });
  }

  setupActor() {
    this.actor = createActor(this.machine);
    this.actor.start();

    this.actor.subscribe(snapshot => {
      this.service_params.logger.debug(`New snapshot state: ${snapshot.value}`);
      this.automationStatus.state = JSON.stringify(snapshot.value);
    });
  }

  setupCrons() {
    const actor = this.actor;
    this.service_params.scheduler.cron({
      exec() {
        actor.send({ type: "heat" });
      },
      schedule: "0 0 * * *",
    });
    this.service_params.automation.solar.onEvent({
      eventName: "sunriseEnd",
      exec: () => {
        actor.send({ type: "stopHeat" });
      },
    });
  }

  setupSynapse() {
    const name = this.heater.entity_id.replace("switch\.", "");
    this.automationSwitch = this.service_params.synapse.switch({
      context: this.service_params.context,
      name: name + "_automation",
      device_id: this.device,
    });

    this.automationStatus = this.service_params.synapse.sensor({
      context: this.service_params.context,
      name: name + "_state",
      entity_category: "diagnostic",
      device_id: this.device,
    }) as SynapseSensor<any>;
  }

  setupListeners() {
    this.sensor.onUpdate(({ state }) => {
      if (state === "on") {
        this.actor.send({ type: "occupied" });
      }
    });

    this.automationSwitch.onUpdate(({ state }) => {
      if (state === "on") {
        this.actor.send({ type: "enable" });
      } else if (state === "off") {
        this.actor.send({ type: "disable" });
      }
    });
  }
}
