import { is, TServiceParams } from "@digital-alchemy/core";

interface BatteryEntity {
  state: string | number;
  attributes: {
    friendly_name: string;
  };
}

const LOW_BATTERY_THRESHOLD = 10;

export function BatteryMinder({ hass, scheduler }: TServiceParams) {
  function getLowBatteryEntities(): BatteryEntity[] {
    return hass.refBy.label("battery").filter(entity => {
      if (entity.state === "on") return true; // Battery needs attention
      if (is.number(entity.state) && entity.state < LOW_BATTERY_THRESHOLD) return true;
      return false;
    });
  }

  function notify(entities: BatteryEntity[]) {
    if (!entities || entities.length === 0) {
      return;
    }

    try {
      let message = entities
        .map(e => {
          if (is.number(e.state)) {
            return `• ${e.attributes.friendly_name}: ${Math.round(e.state)}%`;
          } else {
            return `• ${e.attributes.friendly_name} is low`;
          }
        })
        .join("\n");

      hass.call.notify.jeff({
        title: "Battery Alerts",
        message,
        data: {
          group: "battery_minder",
          notification_icon: "mdi:battery-alert",
          tag: "battery_minder",
          url: "/dashboard-maintenance",
          channel: "Battery Minder",
          importance: "low",
        },
      });

      hass.call.persistent_notification.create({
        title: "Battery Alerts",
        message,
        notification_id: "battery_minder",
      });
    } catch (error) {
      console.error("Failed to send battery notification:", error);
    }
  }

  scheduler.cron({
    exec() {
      const entities = getLowBatteryEntities();
      notify(entities);
    },
    schedule: "0 0 * * *", // Every day at midnight
  });
}
