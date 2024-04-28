import { TServiceParams } from "@digital-alchemy/core";
import { PICK_ENTITY } from "@digital-alchemy/hass";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

// Configure the floor of when a delay should be considered a "smart delay", in
// minutes
const LOWER_DELAY_THRESHOLD = 60 * 4;

/**
 * Generate a name and an icon for notifications
 */
function name_and_icon(type) {
  const machine = type === "washing_machine" ? "Washer" : "Dryer";
  const icon =
    type === "washing_machine" ? "mdi:washing-machine" : "mdi:tumble-dryer";

  return { icon, machine };
}

/**
 * Execute a function for both the washing machine and the dryer
 *
 * @param function_ Function to call for both washer and dryer. Takes string of
 * `washing_machine` or `tumble_dryer`
 */
function forBoth(function_: (machine: string) => void) {
  for (const machine of ["washing_machine", "tumble_dryer"]) {
    Reflect.apply(function_, null, [machine]);
  }
}

/**
 * Service that attempts to automatically trigger delayed start for washer/dryer
 * when my solar power system is generating more than 1kWh
 */
export function WasherDryerSolar({ hass }: TServiceParams): void {
  function notifyWait(minsTillStart, type) {
    const { machine, icon } = name_and_icon(type);
    const start_ts = dayjs().add(minsTillStart, "minutes").format("h:mm a");
    return hass.call.notify.all({
      data: {
        channel: "laundry",
        group: "laundry",
        notification_icon: icon,
      },
      message: `${machine} will start when solar generation is significant, or at ${start_ts}`,
      title: `${machine} SmartStart scheduled`,
    });
  }

  function notifyStarted(type) {
    const { machine, icon } = name_and_icon(type);
    return hass.call.notify.all({
      data: {
        channel: "laundry",
        group: "laundry",
        notification_icon: icon,
      },
      message: `${machine} started due to significant solar generation`,
      title: `${machine} SmartSkart`,
    });
  }

  /**
   * Checks if the washer/dryer is "waiting"
   *
   * Machine is defined as waiting if its got a `waiting_to_start` state, and a
   * delayed start time greater than 1 hour
   */
  function isWaiting(machine: string) {
    return (
      hass.entity
        .byId(`sensor.${machine}_status` as PICK_ENTITY<"sensor">)
        .state.toString() === "waiting_to_start" &&
      Number.parseInt(
        hass.entity.byId(
          `sensor.${machine}_start_time` as PICK_ENTITY<"sensor">,
        ).state,
      ) > LOWER_DELAY_THRESHOLD
    );
  }

  const solarSensor = hass.entity.byId("sensor.powerwall_solar_now");
  const scheduledStarts = {
    tumble_dryer: null,
    washing_machine: null,
  };

  function registerSolarListenerForMachine(machine: string) {
    const { remove: rawRemoveHandler } = solarSensor.onUpdate(
      async ({ state }, { state: oldState }, remove) => {
        if (
          Number.parseFloat(state) > 1 &&
          Number.parseFloat(oldState) <= 1 && // Last minute sanity check, don't want to issue a start command
          // if someone manually started the machine
          isWaiting(machine)
        ) {
          await Promise.allSettled([
            hass.call.button.press({
              entity_id: `button.${machine}_start` as PICK_ENTITY<"button">,
            }),
            notifyStarted(machine),
          ]);
          remove();
          scheduledStarts[machine] = null;
        }
      },
    );

    const removeHandler = () => {
      rawRemoveHandler();
      scheduledStarts[machine] = null;
    };

    scheduledStarts[machine] = removeHandler;
  }

  // Set up onUpdate calls for washer and dryer, to tell phone when they're
  // going to start at the latest
  forBoth(machine => {
    hass.entity
      .byId(`sensor.${machine}_status` as PICK_ENTITY<"sensor">)
      .onUpdate(({ state }) => {
        const minsTillStart = Number.parseInt(
          hass.entity.byId(
            `sensor.${machine}_start_time` as PICK_ENTITY<"sensor">,
          ).state,
        );
        if (
          state == "waiting_to_start" &&
          minsTillStart > LOWER_DELAY_THRESHOLD
        ) {
          notifyWait(minsTillStart, machine);
          registerSolarListenerForMachine(machine);
        } else {
          scheduledStarts[machine]?.call();
        }
      });
  });
}
