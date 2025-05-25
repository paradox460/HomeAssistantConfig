import { TServiceParams } from "@digital-alchemy/core";
import { TRawEntityIds } from "@digital-alchemy/hass";
import dayjs from "dayjs";

export function Traccar({ hass, logger }: TServiceParams) {
  const trackers = (
    ["person.jeff", "person.stephanie", "device_tracker.2023_ascent_touring"] as unknown as [
      TRawEntityIds,
    ]
  ).map(id => hass.refBy.id(id));

  for (const tracker of trackers) {
    let entity;
    if (/person/.test(tracker.entity_id)) {
      for (const device_id of tracker.attributes.device_trackers) {
        entity = hass.refBy.id(device_id);
        if ("latitude" in entity.attributes) break;
        entity = null;
      }
    } else {
      entity = tracker;
    }
    if (!entity) break;

    entity.onUpdate(({ state }) => {
      if (state in ["unknown", "unavailable"]) return;

      // This seemingly unneeded complexity is because different device trackers expose different attributes
      const data = {
        id: tracker.entity_id,
        timestamp: entity.attributes?.["Position timestamp"]
          ? dayjs(entity.attributes["Position timestamp"]).toISOString()
          : entity.last_updated.toISOString(),
        lat: entity.attributes.latitude,
        lon: entity.attributes.longitude,
        speed: entity.attributes?.speed,
        bearing: entity.attributes?.course,
        accuracy: entity.attributes.gps_accuracy > 0 ? entity.attributes.gps_accuracy : undefined,
        altitude: entity.attributes?.altitude,
        ...(tracker.entity_id === "device_tracker.2023_ascent_touring"
          ? {
              odometer: hass.refBy.id("sensor.2023_ascent_touring_odometer").state,
              fuel_level: hass.refBy.id("sensor.2023_ascent_touring_fuel_level").state,
            }
          : {}),
      };

      const body = new URLSearchParams();
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined) break;
        body.append(key, value);
      }

      fetch(`http://10.0.0.6:8082`, {
        method: "POST",
        body,
      });
    });
  }
}
