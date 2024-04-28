import { TServiceParams } from "@digital-alchemy/core";
import { PICK_ENTITY } from "@digital-alchemy/hass";

// 1 mile = 5,280 feet.
const HOME_RADIUS = 5280;

/**
 * Automated away and return home states
 *
 * Turns off my furnace, and all entities with the `awayable` label applied.
 * Saves a snapshot of the state of entities upon leaving, and restores it when
 * returning home
 */
export function Away({ hass, context, logger, synapse }: TServiceParams) {
  const awaySwitch = synapse.switch({
    context,
    defaultState: "on",
    icon: "mdi:home-map-marker",
    name: "Away Automations",
  });

  // In HomeAssistant, I've changed the type of this switch to be `presence`,
  // which means that `on` is Home and `off` is Away. Slightly confusing with
  // its name being AwayMode, but w/e
  const awayMode = synapse.binary_sensor({
    context,
    defaultState: "on",
    icon: "mdi:location-exit",
    name: "Away Mode",
  });

  async function triggerAwayMode() {
    // Disable if awaySwitch is off, for manually turning off automations
    // Also return early if we're already away
    if (!awaySwitch.on || !awayMode.on) {
      return;
    }

    const awayableEntities = hass.entity.byLabel("awayable");

    // trigger HVAC away
    hass.call.switch.turn_on({
      entity_id: "switch.sandberg_system_manual_away_mode",
    });

    await hass.call.scene.create({
      scene_id: "awayable_restore",
      snapshot_entities: awayableEntities,
    });

    // Use the generic homeassistant.turn_off service because we might have a
    // variety of things in the label i.e. lights and fans and so forth
    hass.call.homeassistant.turn_off({ entity_id: awayableEntities });

    // Confusing because this is an occupany sensor, so awayMode true == home
    // and false == away
    awayMode.on = false;
  }

  async function triggerHomeMode() {
    // return early if we're already home
    if (awayMode.on) {
      return;
    }

    const { state: direction } = hass.entity.byId(
      "sensor.home_nearest_direction_of_travel",
    );
    // If away switch is off, we manually turned off awayMode, and likely want to
    // force the system back into home mode
    if (!["towards", "arrived"].includes(direction) && awaySwitch.on) {
      return;
    }

    // We have to lie to the type checker again, this time because the generated
    // types don't know about our dynamic type
    const awayableScene = "scene.awayable_restore" as PICK_ENTITY<"scene">;

    hass.call.switch.turn_off({
      entity_id: "switch.sandberg_system_manual_away_mode",
    });

    // Restore the previous scene state
    await hass.call.scene.turn_on({ entity_id: awayableScene });
    // And delete it so its not floating around
    hass.call.scene.delete({ entity_id: awayableScene });

    awayMode.on = true;
  }

  hass.entity
    .byId("zone.home")
    .onUpdate(({ state: newState }, { state: oldState }) => {
      if (Number.parseInt(newState) == 0) {
        triggerAwayMode();
      } else if (
        Number.parseInt(oldState) == 0 &&
        Number.parseInt(newState) > 0
      ) {
        triggerHomeMode();
      }
    });

  hass.entity.byId("sensor.home_nearest_distance").onUpdate(({ state }) => {
    if (Number.parseInt(state) >= HOME_RADIUS) {
      triggerAwayMode();
    } else {
      triggerHomeMode();
    }
  });

  // For manually disabling away automations
  awaySwitch.onUpdate(state => {
    if (state) {
      return;
    }
    triggerHomeMode();
  });
}
