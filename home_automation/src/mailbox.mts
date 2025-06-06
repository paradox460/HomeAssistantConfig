import { TServiceParams } from "@digital-alchemy/core";
import {
  AndroidNotificationData,
  AppleNotificationData,
  NotificationData,
} from "@digital-alchemy/hass";
import { turnedOn } from "./utils.mts";
import { throttle } from "es-toolkit";

export function Mailbox({ hass, logger }: TServiceParams) {
  const new_mail = hass.refBy.id("binary_sensor.mailbox_abe59c_new_mail");
  let notified = false;

  const notifier = throttle(
    () => {
      logger.info("Notification ran");
      hass.call.notify.all({
        message: "You've got mail!",
        data: {
          channel: "mailbox",
          tag: "mailbox",
          notification_icon: "mdi:mailbox-up",
          push: {
            sound: "none",
          },
        },
      });
      notified = true;
    },
    10 * 60 * 1000,
    {
      edges: ["leading"],
    },
  );

  const clearNotifier = throttle(
    () => {
      hass.call.notify.all({
        message: "clear_notification",
        data: {
          channel: "mailbox",
          tag: "mailbox",
        },
      });
    },
    10 * 60 * 1000,
    { edges: ["leading", "trailing"] },
  );

  new_mail.onUpdate(({ state: newState }, { state: oldState }) => {
    logger.info(`Mailbox state changed: ${newState} -> ${oldState}`);
    if (turnedOn(newState, oldState)) {
      logger.info("Mailbox has new mail, attempting notification");
      notifier();
    } else if (newState == "off" && notified) {
      logger.info("Mailbox cleared, notification state was set to true, sending notification");
      clearNotifier();
    }
  });
}
