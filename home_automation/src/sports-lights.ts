import { TServiceParams } from "@digital-alchemy/core";

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
export function SportsLights({ hass, context, synapse }: TServiceParams) {
  const sportsLightsSwitch = synapse.switch({
    context,
    icon: "mdi:football",
    name: "Sports Win LED automation",
    is_on: true,
  });

  const roofTrimMain = hass.refBy.id("light.roof_trim_main");
  const roofTrimPreset = hass.refBy.id("select.roof_trim_preset");

  for (const team of hass.refBy.platform("teamtracker")) {
    team.onUpdate((current, old) => {
      if (!sportsLightsSwitch.is_on) return;
      if (current.state == "IN" && old.state == "PRE" && roofTrimMain.state != "on") {
        roofTrimPreset.select_option({ option: "Utah" });
      } else if (
        current.state == "POST" &&
        old.state == "IN" &&
        roofTrimMain.state == "on" &&
        roofTrimPreset.state == "Utah" &&
        current.attributes.opponent_winner
      ) {
        roofTrimPreset.select_option({ option: "Default" });
      }
    });
  }
}
