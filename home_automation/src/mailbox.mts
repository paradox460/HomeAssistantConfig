import { TServiceParams } from "@digital-alchemy/core";
import { throttle } from "es-toolkit";
import { setup, createActor } from "xstate";

export function Mailbox({ context, hass, logger, synapse }: TServiceParams) {
  synapse.switch({
    context,
    name: "Mailbox Prevent Deep Sleep",
    unique_id: "mailbox_prevent_deep_sleep",
    icon: "mdi:sleep-off",
  });
  const new_mail = synapse.binary_sensor({
    context,
    name: "New Mail",
    unique_id: "mailbox_new_mail",
    icon: "mdi:mailbox-up",
  });
  const reset_mail = synapse.button({
    context,
    name: "Reset Mail",
    unique_id: "mailbox_reset_mail",
    icon: "mdi:refresh",
  });
  const top_door = hass.refBy.id("binary_sensor.mailbox_4559ac_top_door");
  const bottom_door = hass.refBy.id("binary_sensor.mailbox_4559ac_bottom_door");
  const top_door_boot = hass.refBy.id("binary_sensor.mailbox_4559ac_top_door_opened_this_boot");
  const bottom_door_boot = hass.refBy.id(
    "binary_sensor.mailbox_4559ac_bottom_door_opened_this_boot",
  );

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

  const machine = setup({
    types: {
      context: {} as {},
      events: {} as
        | { type: "Top Door Opened" }
        | { type: "Bottom Door Opened" }
        | { type: "Reset" },
    },
    actions: {
      notify: () => {
        notifier();
      },
      clearNotify: () => {
        clearNotifier();
      },
      indicatorOn: () => {
        new_mail.is_on = true;
      },
      indicatorOff: () => {
        new_mail.is_on = false;
      },
    },
  }).createMachine({
    context: {},
    id: "Mailbox",
    initial: new_mail.is_on ? "New Mail" : "No Mail",
    states: {
      "No Mail": {
        on: {
          "Top Door Opened": {
            target: "New Mail",
          },
        },
        entry: [{ type: "clearNotify" }, { type: "indicatorOff" }],
      },
      "New Mail": {
        on: {
          "Bottom Door Opened": {
            target: "No Mail",
          },
          Reset: {
            target: "No Mail",
          },
        },
        entry: [{ type: "notify" }, { type: "indicatorOn" }],
      },
    },
  });

  const mailboxActor = createActor(machine);
  mailboxActor.start();

  const topDoorAction = ({ state: newState }) => {
    if (newState == "on") {
      mailboxActor.send({ type: "Top Door Opened" });
    }
  };

  top_door.onUpdate(topDoorAction);
  top_door_boot.onUpdate(topDoorAction);

  const bottomDoorAction = ({ state: newState }) => {
    if (newState == "on") {
      mailboxActor.send({ type: "Bottom Door Opened" });
    }
  };

  bottom_door.onUpdate(bottomDoorAction);
  bottom_door_boot.onUpdate(bottomDoorAction);

  reset_mail.onUpdate(() => {
    mailboxActor.send({ type: "Reset" });
  });
}
