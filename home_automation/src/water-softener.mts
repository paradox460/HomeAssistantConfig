import { is, TServiceParams } from "@digital-alchemy/core";
import { hydrolinkAuth } from "./secrets.mts";

export function WaterSoftener({ context, lifecycle, logger, scheduler, synapse }: TServiceParams) {
  let authCookie = new Bun.CookieMap();

  const device_id = synapse.device.register("water_softener", {
    name: "Water Softener",
  });

  const sensors = {
    average_exhaustion_percent: synapse.sensor({
      context,
      name: "Average Exhaustion Percent",
      unit_of_measurement: "%",
      device_id,
    }),
    avg_daily_use_gals: synapse.sensor({
      context,
      name: "Avg Daily Use Gals",
      unit_of_measurement: "gal",
      device_id,
    }),
    avg_days_between_regens: synapse.sensor({
      context,
      name: "Avg Days Between Regens",
      device_id,
    }),
    avg_salt_per_regen_lbs: synapse.sensor({
      context,
      name: "Avg Salt Per Regen Lbs",
      unit_of_measurement: "lbs",
      device_id,
    }),
    backwash_secs: synapse.sensor({
      context,
      name: "Backwash Secs",
      unit_of_measurement: "seconds",
      device_id,
    }),
    capacity_remaining_percent: synapse.sensor({
      context,
      name: "Capacity Remaining Percent",
      unit_of_measurement: "%",
      device_id,
    }),
    current_valve_position_enum: synapse.sensor({
      context,
      name: "Current Valve Position Enum",
      device_id,
    }),
    current_water_flow_gpm: synapse.sensor({
      context,
      name: "Current Water Flow Gpm",
      unit_of_measurement: "gpm",
      device_id,
    }),
    daily_avg_rock_removed_lbs: synapse.sensor({
      context,
      name: "Daily Avg Rock Removed Lbs",
      unit_of_measurement: "lbs",
      device_id,
    }),
    days_in_operation: synapse.sensor({
      context,
      name: "Days In Operation",
      unit_of_measurement: "days",
      device_id,
    }),
    days_since_last_regen: synapse.sensor({
      context,
      name: "Days Since Last Regen",
      unit_of_measurement: "days",
      device_id,
    }),
    days_since_last_time_loss: synapse.sensor({
      context,
      name: "Days Since Last Time Loss",
      unit_of_measurement: "days",
      device_id,
    }),
    depletion_alert: synapse.sensor({
      context,
      name: "Depletion Alert",
      device_id,
    }),
    error_code: synapse.sensor({
      context,
      name: "Error Code",
      device_id,
    }),
    error_code_alert: synapse.sensor({
      context,
      name: "Error Code Alert",
      device_id,
    }),
    excessive_water_use_alert: synapse.sensor({
      context,
      name: "Excessive Water Use Alert",
      device_id,
    }),
    floor_leak_detector_alert: synapse.sensor({
      context,
      name: "Floor Leak Detector Alert",
      device_id,
    }),
    flow_monitor_alert: synapse.sensor({
      context,
      name: "Flow Monitor Alert",
      device_id,
    }),
    gallons_used_today: synapse.sensor({
      context,
      name: "Gallons Used Today",
      unit_of_measurement: "gal",
      device_class: "water",
      state_class: "total_increasing",
      device_id,
    }),
    low_salt_alert: synapse.sensor({
      context,
      name: "Low Salt Alert",
      device_id,
    }),
    manual_regens: synapse.sensor({
      context,
      name: "Manual Regens",
      device_id,
    }),
    max_days_between_regens: synapse.sensor({
      context,
      name: "Max Days Between Regens",
      unit_of_measurement: "days",
      device_id,
    }),
    peak_water_flow_gpm: synapse.sensor({
      context,
      name: "Peak Water Flow Gpm",
      unit_of_measurement: "gpm",
      device_id,
    }),
    power_outage_count: synapse.sensor({
      context,
      name: "Power Outage Count",
      device_id,
    }),
  };

  async function login() {
    const response = await fetch("https://api.hydrolinkhome.com/v1/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(hydrolinkAuth),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      logger.warn(`Login failed, status ${response.status}`);
      throw new Error(`Network response was not ok, status ${response.status}`);
    }

    response.headers.getSetCookie().find(cookieString => {
      let cookies = new Bun.CookieMap(cookieString);
      let maybeAuthCookie = cookies.get("hhfoffoezyzzoeibwv");
      if (maybeAuthCookie) {
        authCookie.set("hhfoffoezyzzoeibwv", maybeAuthCookie);
        return true;
      }
    });
    return;
  }

  async function fetchDevices() {
    if (authCookie.size === 0) {
      await login();
    }

    const response = await fetch(
      "https://api.hydrolinkhome.com/v1/devices?all=false&per_page=200",
      {
        method: "GET",
        headers: {
          Cookie: `hhfoffoezyzzoeibwv=${authCookie.get("hhfoffoezyzzoeibwv")}`,
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      // Force Reauth next time
      authCookie = new Bun.CookieMap();
      logger.warn(`Failed to fetch devices, status ${response.status}`);
      throw new Error(`Network response was not ok, status ${response.status}`);
    }
    const json: any = await response.json();
    json?.data?.forEach((device) => {
      if (device.system_type !== "demand_softener") {
        return;
      }

      for (const [key, sensor] of Object.entries(sensors)) {
        if (!is.undefined(device.properties[key]?.value)) {
          let value;
          switch (key) {
            case "capacity_remaining_percent":
              value = device.properties[key].value / 10.0;
              break;
            default:
              value = device.properties[key].value;
              break;
          }
          sensor.state = value;
        }
      }
    });
  }

  lifecycle.onReady(async () => {
    await fetchDevices();
  });
  scheduler.cron({
    schedule: "*/5 * * * *",
    exec: async () => await fetchDevices(),
  });
}
