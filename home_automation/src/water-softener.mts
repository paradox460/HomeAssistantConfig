import { is, TServiceParams } from "@digital-alchemy/core";
import { throttle } from "es-toolkit";
import { hydrolinkAuth } from "./secrets.mts";

export function WaterSoftener({ context, lifecycle, logger, scheduler, synapse }: TServiceParams) {
  let authCookie = new Bun.CookieMap();

  class WaterSoftenerSocket {
    private messageCount = 0;
    private url: string;
    private open = false;
    private closedPromise: {
      promise: Promise<void>;
      resolve: () => void;
      reject: (reason?: any) => void;
    };
    private ws: WebSocket;

    constructor(url: string) {
      this.url = url;
      this.closedPromise = Promise.withResolvers();
      this.open = true;
      this.closedPromise.promise.finally(() => {
        this.open = false;
      });
      this.ws = new WebSocket(this.url);
      // Close the promise and socket after 20 seconds
      setTimeout(() => {
        if (this.open) {
          logger.warn("WebSocket timeout, closing connection");
          this.ws.close();
          this.closedPromise.resolve();
        }
      }, 20_000);
      this.ws.addEventListener("open", () => {
        logger.debug("WebSocket connection opened");
      });
      this.ws.addEventListener("close", event => {
        logger.debug(`WebSocket connection closed, code=${event.code}, reason=${event.reason}`);
        this.closedPromise.resolve();
      });
      this.ws.addEventListener("message", event => {
        logger.debug(`WebSocket message received: ${event.data}`);
        this.messageCount += 1;
        if (this.messageCount >= 17) {
          this.ws.close();
          this.closedPromise.resolve();
        }
      });
      this.ws.addEventListener("error", error => {
        logger.error(`WebSocket error: ${error}`);
      });
    }

    async waitForClose() {
      return this.closedPromise.promise;
    }
  }

  const device_id = synapse.device.register("water_softener", {
    name: "Water Softener",
  });

  const sensors = {
    avg_daily_use_gals: synapse.sensor({
      context,
      name: "Avg Daily Use Gals",
      unit_of_measurement: "gal",
      icon: "mdi:water-circle",
      device_id,
    }),
    avg_days_between_regens: synapse.sensor({
      context,
      name: "Avg Days Between Regens",
      device_id,
      icon: "mdi:timelapse",
      attributes: {
        factor: 100.0,
      },
    }),
    avg_salt_per_regen_lbs: synapse.sensor({
      context,
      name: "Avg Salt Per Regen Lbs",
      unit_of_measurement: "lbs",
      device_id,
      icon: "mdi:shaker",
      attributes: {
        factor: 10000.0,
      },
    }),
    capacity_remaining_percent: synapse.sensor({
      context,
      name: "Capacity Remaining Percent",
      unit_of_measurement: "%",
      device_id,
      icon: "mdi:water-percent",
      attributes: {
        factor: 10.0,
      },
    }),
    rock_removed_since_rech_lbs: synapse.sensor({
      context,
      name: "Rock Removed Since Last Recharge",
      unit_of_measurement: "lbs",
      device_id,
      icon: "mdi:delete-clock-outline",
      state_class: "total_increasing",
      attributes: {
        factor: 1000.0,
      },
    }),
    total_rock_removed_lbs: synapse.sensor({
      context,
      name: "Total Rock Removed Lbs",
      unit_of_measurement: "lbs",
      state_class: "total",
      icon: "mdi:delete-outline",
      device_id,
    }),
    daily_avg_rock_removed_lbs: synapse.sensor({
      context,
      name: "Daily Avg Rock Removed Lbs",
      unit_of_measurement: "lbs",
      icon: "mdi:delete-clock",
      device_id,
      attributes: {
        factor: 1000.0,
      },
    }),
    days_since_last_regen: synapse.sensor({
      context,
      name: "Days Since Last Regen",
      unit_of_measurement: "days",
      icon: "mdi:calendar-today",
      device_id,
    }),
    depletion_alert: synapse.sensor({
      context,
      name: "Depletion Alert",
      icon: "mdi:alert-decagram",
      device_id,
    }),
    error_code: synapse.sensor({
      context,
      name: "Error Code",
      icon: "mdi:alert-decagram",
      device_id,
    }),
    error_code_alert: synapse.sensor({
      context,
      name: "Error Code Alert",
      icon: "mdi:alert-decagram",
      device_id,
    }),
    excessive_water_use_alert: synapse.sensor({
      context,
      name: "Excessive Water Use Alert",
      icon: "mdi:water-alert",
      device_id,
    }),
    floor_leak_detector_alert: synapse.sensor({
      context,
      name: "Floor Leak Detector Alert",
      icon: "mdi:pipe-leak",
      device_id,
    }),
    flow_monitor_alert: synapse.sensor({
      context,
      name: "Flow Monitor Alert",
      icon: "mdi:waves-arrow-right",
      device_id,
    }),
    gallons_used_today: synapse.sensor({
      context,
      name: "Gallons Used Today",
      unit_of_measurement: "gal",
      device_class: "water",
      state_class: "total_increasing",
      icon: "mdi:water-pump",
      device_id,
    }),
    low_salt_alert: synapse.sensor({
      context,
      icon: "mdi:alert-decagram",
      name: "Low Salt Alert",
      device_id,
    }),
    manual_regens: synapse.sensor({
      context,
      name: "Manual Regens",
      icon: "mdi:water-sync",
      device_id,
    }),
    total_regens: synapse.sensor({
      context,
      name: "Total Regens",
      icon: "mdi:water-sync",
      device_id,
    }),
    max_days_between_regens: synapse.sensor({
      context,
      name: "Max Days Between Regens",
      unit_of_measurement: "days",
      icon: "mdi:calendar-range",
      device_id,
    }),
    peak_water_flow_gpm: synapse.sensor({
      context,
      name: "Peak Water Flow Gpm",
      unit_of_measurement: "gpm",
      icon: "mdi:water-alert",
      device_id,
    }),
    water_counter_gals: synapse.sensor({
      context,
      name: "Water Counter Gals",
      unit_of_measurement: "gal",
      device_class: "water",
      state_class: "total_increasing",
      icon: "mdi:water",
      device_id,
    }),
    total_salt_use_lbs: synapse.sensor({
      context,
      name: "Total Salt Use Lbs",
      unit_of_measurement: "lbs",
      icon: "mdi:shaker",
      device_id,
      attributes: {
        factor: 10.0,
      },
    }),
    total_outlet_water_gals: synapse.sensor({
      context,
      name: "Total Outlet Water Gals",
      unit_of_measurement: "gal",
      device_class: "water",
      state_class: "total_increasing",
      icon: "mdi:water",
      device_id,
    }),
    total_untreated_water_gals: synapse.sensor({
      context,
      name: "Total Untreated Water Gals",
      unit_of_measurement: "gal",
      device_class: "water",
      state_class: "total_increasing",
      icon: "mdi:water-outline",
      device_id,
    }),
    out_of_salt_estimate_days: synapse.sensor({
      context,
      name: "Out of Salt Estimate Days",
      unit_of_measurement: "days",
      icon: "mdi:shaker-outline",
      device_id,
    }),
    treated_water_avail_gals: synapse.sensor({
      context,
      name: "Treated Water Available",
      unit_of_measurement: "gal",
      device_class: "water",
      icon: "mdi:water-check",
      device_id,
    })
  };

  async function login() {
    const auth = structuredClone(hydrolinkAuth);
    delete auth.deviceId;
    const response = await fetch("https://api.hydrolinkhome.com/v1/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(auth),
      signal: AbortSignal.timeout(10_000),
    }).then(response => handleFailure(response, "login"));

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

  async function fetchWebsocket() {
    // The HydroLink backend seems to only update from devices (water softeners)
    // when a WebSocket has been opened and received 17 messages.
    // So we do that here.
    const response = await fetch(
      `https://api.hydrolinkhome.com/v1/devices/${hydrolinkAuth.deviceId}/live`,
      {
        method: "GET",
        headers: {
          Cookie: `hhfoffoezyzzoeibwv=${authCookie.get("hhfoffoezyzzoeibwv")}`,
        },
        signal: AbortSignal.timeout(10_000),
      },
    ).then(response => handleFailure(response, "fetch live"));

    const { websocket_uri } = await response.json();
    const ws = new WaterSoftenerSocket(`wss://api.hydrolinkhome.com${websocket_uri}`);
    await ws.waitForClose();
  }

  async function fetchDevices() {
    try {
      if (authCookie.size === 0) {
        await login();
      }

      await fetchWebsocket();

      const response = await fetch(
        `https://api.hydrolinkhome.com/v1/devices/${hydrolinkAuth.deviceId}/detail-or-summary`,
        {
          method: "GET",
          headers: {
            Cookie: `hhfoffoezyzzoeibwv=${authCookie.get("hhfoffoezyzzoeibwv")}`,
          },
          signal: AbortSignal.timeout(10_000),
        },
      ).then(response => handleFailure(response, "fetch detail-or-summary"));

      const json: any = await response.json();
      if (json.device.system_type !== "demand_softener") {
        return;
      }

      for (const [key, sensor] of Object.entries(sensors)) {
        if (!is.undefined(json.device.properties[key]?.value)) {
          let value = json.device.properties[key].value;
          if (is.number(sensor?.attributes?.["factor"])) {
            value /= sensor.attributes["factor"];
          }
          sensor.state = value;
        }
      }
    } catch (error) {
      // Force Reauth next time
      authCookie = new Bun.CookieMap();
      logger.error(`Error fetching devices: ${error.message}`);
    }
  }

  function handleFailure(response, name) {
    if (!response.ok) {
      // Force Reauth next time
      authCookie = new Bun.CookieMap();
      logger.warn(`${name} failed, status ${response.status}`);
      throw new Error(`Network response was not ok, status ${response.status}`);
    }
    return response;
  }

  const throttledFetchDevices = throttle(fetchDevices, 60_000, { edges: ["leading"] });

  lifecycle.onReady(async () => {
    await throttledFetchDevices();
  });
  scheduler.cron({
    schedule: "*/5 * * * *",
    exec: async () => await throttledFetchDevices(),
  });
}
