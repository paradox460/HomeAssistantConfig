import { TServiceParams } from "@digital-alchemy/core";
import {
  AndroidNotificationData,
  AppleNotificationData,
  NotificationData,
} from "@digital-alchemy/hass";
import { turnedOn } from "./utils.mts";
import { throttle } from "es-toolkit";

export function Mailbox({ hass }: TServiceParams) {
  const new_mail = hass.refBy.id("binary_sensor.mailbox_abe59c_new_mail");
  let notified = false;

  new_mail.onUpdate(({ state: newState }, { state: oldState }) => {
    if (turnedOn(newState, oldState)) {
      throttle(() => {
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
      edges: ["leading"]
    });
    } else if (turnedOn(oldState, newState) && notified) {
      hass.call.notify.all({
        message: "clear_notification",
        data: {
          channel: "mailbox",
          tag: "mailbox",
        },
      });
    }
  });
}
