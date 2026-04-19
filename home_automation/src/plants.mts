import { TServiceParams } from "@digital-alchemy/core";
import { throttle } from "es-toolkit";

export function Plants({ hass, logger }: TServiceParams) {
  const plants = hass.refBy.domain("plant");

  for (const plant of plants) {
    const name = plant.attributes.friendly_name ?? plant.entity_id;
    const tag = `plant_moisture_${plant.entity_id}`;

    const notifier = throttle(
      () => {
        logger.info(`Plant ${name} needs water`);

        hass.call.notify.all({
          title: "Plant Needs Water",
          message: `${name} has low moisture.`,
          data: {
            group: "plants",
            notification_icon: "mdi:flower-outline",
            tag,
            channel: "Plants",
            importance: "default",
          },
        });

        hass.call.persistent_notification.create({
          title: "Plant Needs Water",
          message: `${name} has low moisture.`,
          notification_id: tag,
        });
      },
      10 * 60 * 1000,
      { edges: ["leading"] },
    );

    const clearNotifier = throttle(
      () => {
        logger.info(`Plant ${name} recovered`);

        hass.call.notify.all({
          message: "clear_notification",
          data: {
            tag,
            channel: "Plants",
          },
        });

        hass.call.persistent_notification.dismiss({
          notification_id: tag,
        });
      },
      10 * 60 * 1000,
      { edges: ["leading", "trailing"] },
    );

    plant.onUpdate(({ state, attributes }, { state: oldState }) => {
      if (oldState === "none" && state === "problem") {
        if (attributes.problem === "moisture low") {
          notifier();
        }
      }
      if (oldState === "problem" && state === "none") {
        clearNotifier();
      }
    });
  }
}
