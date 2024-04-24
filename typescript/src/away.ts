import { TServiceParams } from "@digital-alchemy/core";
import { stringify } from "js-yaml";

// 1 mile = 5,280 feet.
const HOME_RADIUS = 5_280;

/**
 * Automated away and return home states
 * 
 * Turns off my furnace, and all entities with the `awayable` label applied.
 * Saves a snapshot of the state of entities upon leaving, and restores it when
 * returning home 
 */
export function Away({ hass, context, synapse }: TServiceParams) {
  const awaySwitch = synapse.switch({
    context,
    name: "Away Automations",
    defaultState: "on",
    icon: "mdi:home-map-marker"
  });

  const awayMode = synapse.binary_sensor({
    context,
    name: "Away Mode",
    defaultState: "on",
    icon: "mdi:location-exit"
  })

  function triggerAwayMode() {
    if (!awaySwitch.on) { return; }

    const awayableEntities = hass.entity.byLabel("awayable");

    // trigger HVAC away
    hass.call.switch.turn_on({ entity_id: "switch.sandberg_system_manual_away_mode" });

    // Take snapshot of all awayable entities current state
    hass.call.scene.create({
      scene_id: "awayable_restore",
      snapshot_entities: stringify(awayableEntities)
    })


    // Use the generic homeassistant.turn_off service because we might have a variety of things in the label
    // i.e. lights and fans and so forth
    hass.call.homeassistant.turn_off({ entity_id: awayableEntities });

    // Confusing because this is an occupany sensor, so awayMode true == home and false == away
    awayMode.on = false;
  }

  function triggerHomeMode() {
    const { state: direction } = hass.entity.byId("sensor.home_nearest_direction_of_travel");
    // If away switch is off, we manually turned off awayMode, and likely want to
    // force the system back into home mode
    if (!["towards", "arrived"].includes(direction) && awaySwitch.on) { return; }

    // We have to cast the dynamically generated scene to a known, preconfigured scene, so the type checker passes
    const awayableScene = "scene.awayable_restore" as "scene.enclosure_device_001_away_scene"

    hass.call.switch.turn_off({ entity_id: "switch.sandberg_system_manual_away_mode" });

    // Restore the previous scene state
    hass.call.scene.turn_on({
      entity_id: awayableScene,
      transition: 30
    })
    // And delete it so its not floating around
    hass.call.scene.delete({ entity_id: awayableScene })

    awayMode.on = true;
  }

  hass.entity.byId("zone.home").onUpdate(({ state: newState }, { state: oldState }) => {
    if (parseInt(newState) == 0) {
      triggerAwayMode();
    } else if (parseInt(oldState) == 0 && parseInt(newState) > 0) {
      triggerHomeMode();
    }
  })

  hass.entity.byId("sensor.home_nearest_distance").onUpdate(({ state }) => {
    if (parseInt(state) >= HOME_RADIUS) {
      triggerAwayMode();
    } else {
      triggerHomeMode();
    }
  })

  // For manually disabling away automations
  awaySwitch.onUpdate((state) => {
    if (state) { return; }
    triggerHomeMode();
  });
}

