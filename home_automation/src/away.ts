import { TServiceParams } from "@digital-alchemy/core";
import { PICK_ENTITY } from "@digital-alchemy/hass";
import { toggleIcons } from "./utils";

// 1 mile = 5,280 feet.
const HOME_RADIUS = 5280;

const awayableScene = "scene.awayable_restore" as PICK_ENTITY<"scene">;

/**
 * Automated away and return home states
 *
 * Turns off my furnace, and all entities with the `awayable` label applied.
 * Saves a snapshot of the state of entities upon leaving, and restores it when
 * returning home
 */
export function Away({ hass, context, synapse, logger, lifecycle }: TServiceParams) {
  const awaySwitch = synapse.switch({
    context,
    name: "Away Automations",
    icon: "mdi:home-map-marker",
  });

  // In HomeAssistant, I've changed the type of this switch to be `presence`,
  // which means that `on` is Home and `off` is Away. Slightly confusing with
  // its name being AwayMode, but w/e
  const homePresence = synapse.binary_sensor({
    context,
    device_class: "presence",
    name: "Home Presence",
  });

  toggleIcons(homePresence, "mdi:home", "mdi:home-off");

  const awayableEntities = hass.refBy.label("awayable");
  const hvacAway = hass.refBy.id("switch.sandberg_system_manual_away_mode");
  const homeZone = hass.refBy.id("zone.home");

  function createScene() {
    return hass.call.scene.create({
      scene_id: "awayable_restore",
      snapshot_entities: awayableEntities.map(entity => entity.entity_id),
    });
  }

  async function triggerAwayMode() {
    // Disable if awaySwitch is off, for manually turning off automations
    // Also return early if we're already away
    if (!awaySwitch.is_on || !homePresence.is_on) {
      return;
    }

    // trigger HVAC away
    hvacAway.turn_on();

    await createScene();

    // Use the generic homeassistant.turn_off service because we might have a
    // variety of things in the label i.e. lights and fans and so forth
    for (const entity of awayableEntities) entity.turn_off();

    // Confusing because this is an occupany sensor, so awayMode true == home
    // and false == away
    homePresence.is_on = false;
  }

  async function triggerHomeMode() {
    // return early if we're already home
    if (homePresence.is_on) {
      return;
    }

    const { state: direction } = hass.refBy.id("sensor.home_nearest_direction_of_travel");

    // If away switch is off, we manually turned off awayMode, and likely want to
    // force the system back into home mode
    if (!["towards", "arrived"].includes(direction) && awaySwitch.is_on) {
      return;
    }

    await hvacAway.turn_off();

    // Restore the previous scene state
    await hass.call.scene.turn_on({ entity_id: awayableScene });

    homePresence.is_on = true;
  }

  homeZone.onUpdate(({ state: newState }, { state: oldState }) => {
    if (newState == 0) {
      triggerAwayMode();
    } else if (oldState == 0 && newState > 0) {
      triggerHomeMode();
    }
  });

  hass.refBy.id("sensor.home_nearest_distance").onUpdate(({ state }) => {
    if (state >= HOME_RADIUS) {
      triggerAwayMode();
    } else {
      triggerHomeMode();
    }
  });

  // For manually disabling away automations
  awaySwitch.onTurnOff(triggerHomeMode);

  lifecycle.onReady(() => {
    homePresence.is_on = homeZone.state > 0;
  });
}
