import { TServiceParams } from "@digital-alchemy/core";
import dayjs from "dayjs";

export function UtilityTariffs({ context, hass, synapse }: TServiceParams) {
  const waterCurrentCost = synapse.sensor({
    context,
    name: "Water Current Monthly Cost",
    unique_id: "utility_water_current_month_cost",
    icon: "mdi:water",
    unit_of_measurement: "USD",
  });

  const waterUsageCounter = hass.refBy.id("sensor.water_usage");

  waterUsageCounter.onUpdate(async ({ state: state }) => {
    const data = await hass.call.recorder.get_statistics({
      statistic_ids: ["sensor.water_usage"],
      start_time: dayjs().startOf("month").toISOString(),
      period: "month",
      types: ["change"],
    });
    const usage = (data as any)?.statistics["sensor.water_usage"][0].change;
    const kiloGallonsUsed = Math.ceil(usage / 1000);

    // Fixed rate per kiloGallons below 7kGal
    if (kiloGallonsUsed <= 7) {
      waterCurrentCost.state = 23.9;
      // $2.13 per kGal for 8-15kGal
    } else if (kiloGallonsUsed <= 15) {
      waterCurrentCost.state = 23.9 + (kiloGallonsUsed - 7) * 2.13;
      // $4.32 per kGal for >15kGal
    } else {
      waterCurrentCost.state = 23.9 + 2.13 * 8 + (kiloGallonsUsed - 15) * 4.32;
    }
  });

  // Water is easy to track so I track the cost of water. Electricity is far
  // more complex, because they adjust the rate with all sorts of bill
  // "smoothing" charges or credits, so I don't bother
}
