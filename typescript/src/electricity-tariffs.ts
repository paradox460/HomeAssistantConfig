import { TServiceParams } from "@digital-alchemy/core";

function isSummer(): Boolean {
  const month = new Date().getMonth() + 1;
  return month >= 6 && month <= 9;
}
export function ElectricityTariffs({ hass, scheduler, lifecycle, logger }: TServiceParams) {
  const electricityImports = [
    hass.entity.byId("select.electricity_import_day"),
    hass.entity.byId("select.electricity_import_month")
  ];
  const electricityExports = [
    hass.entity.byId("select.electricity_export_day"),
    hass.entity.byId("select.electricity_export_month")
  ];

  function setImports(value: string) {
    for (const i of electricityImports) {
      i.state = value
    }
  };
  function setExports(value: string) {
    for (const i of electricityExports) {
      i.state = value
    }
  };

  const importMonthTotal = hass.entity.byId("sensor.electricity_import_month_total");

  function updateImports(entity) {
    if (parseFloat(entity.state) >= 400) {
      if (isSummer()) {
        setImports("summer_gt_400");
        logger.info("set electricity_import_* to summer gt 400")
      } else {
        setImports("winter_gt_400");
        logger.info("set electricity_import_* to winter gt 400")

      }
    } else {
      if (isSummer()) {
        setImports("summer_lt_400");
        logger.info("set electricity_import_* to summer lt 400")
      } else {
        setImports("winter_lt_400");
        logger.info("set electricity_import_* to winter lt 400")
      }
    }
  }

  function updateExports() {
    const exportTariff = isSummer() ? "summer" : "winter";
    logger.info(`updating electricity_export_* to ${exportTariff}`);
    setExports(exportTariff);
  }

  importMonthTotal.onUpdate(updateImports);

  scheduler.cron({
    schedule: "0 0 1 6,10 *",
    exec: updateExports
  });

  lifecycle.onReady(() => {
    const entity = hass.entity.byId("sensor.electricity_import_month_total");
    updateImports(entity);
    updateExports();
  });

  return;
}
