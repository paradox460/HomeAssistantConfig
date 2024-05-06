import { TServiceParams } from "@digital-alchemy/core";
import { ENTITY_STATE, PICK_ENTITY } from "@digital-alchemy/hass";

/**
 * Service that turns on the lights whenever a teamtracker team wins
 *
 * Rather simple now, as I'm only tracking a local collegiate team, but you
 * could expand it to do things like take the color(s) from the TeamTracker
 * attributes
 */
export function SportsLights({ hass, context, synapse }: TServiceParams) {
  const sportsLightsSwitch = synapse.switch({
    context,
    defaultState: "on",
    icon: "mdi:football",
    name: "Sports Win LED automation",
  });

  function updateHandler(
    {
      state,
      attributes: { team_winner: win },
    }: NonNullable<ENTITY_STATE<"sensor.team_tracker_utes_football">>,
    {
      state: oldState,
    }: NonNullable<ENTITY_STATE<"sensor.team_tracker_utes_football">>,
  ) {
    if (
      !sportsLightsSwitch.on ||
      !(state == "POST" && oldState == "IN") ||
      !win ||
      hass.entity.getCurrentState("light.roof_trim_main").state == "on"
    ) {
      return;
    }

    const lights = hass.entity.byDevice(
      "472b85724d32602711e6e74a02d6d2ff",
      "light",
    );

    hass.call.light.turn_on({
      color_name: "red",
      entity_id: lights,
    });
  }
  for (const team in hass.entity.byPlatform("teamtracker")) {
    const entityId = team as PICK_ENTITY<"sensor">;
    hass.entity.byId(entityId).onUpdate(updateHandler);
  }
}
