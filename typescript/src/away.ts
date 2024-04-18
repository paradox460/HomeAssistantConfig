import { TServiceParams } from "@digital-alchemy/core";

// 1 mile = 5,280 feet.
const HOME_RADIUS = 5_280;

export function Away({ hass, context, synapse }: TServiceParams) {
  const awaySwitch = synapse.switch({
    context,
    name: "Automatic Away",
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
    // trigger HVAC away
    hass.call.switch.turn_on({ entity_id: "switch.sandberg_system_manual_away_mode" });

    hass.call.light.turn_off({ entity_id: hass.entity.byLabel("awayable") });

    // Confusing because this is an occupany sensor, so awayMode true == home and false == away
    awayMode.on = false;
  }

  function triggerHomeMode() {
    const { state: direction } = hass.entity.byId("sensor.home_nearest_direction_of_travel");
    // If away switch is off, we manually turned off awayMode, and likely want to
    // force the system back into home mode
    if (!["towards", "arrived"].includes(direction) && awaySwitch.on) { return; }

    hass.call.switch.turn_off({ entity_id: "switch.sandberg_system_manual_away_mode" });

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

