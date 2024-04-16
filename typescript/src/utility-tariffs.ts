import { Logger, TServiceParams } from "@digital-alchemy/core";
import { select } from "async";

function isElectricitySummer(): Boolean {
  const month = new Date().getMonth() + 1;
  return month >= 6 && month <= 9;
}

function isGasSummer(): Boolean {
  const month = new Date().getMonth() + 1;
  return month >= 4 && month <= 11;
}


export function UtilityTariffs({ hass, scheduler, lifecycle, logger }: TServiceParams) {
  const electricityImports = [
    hass.entity.byId("select.electricity_import_day"),
    hass.entity.byId("select.electricity_import_month")
  ];
  const electricityExports = [
    hass.entity.byId("select.electricity_export_day"),
    hass.entity.byId("select.electricity_export_month")
  ];

  const gasImports = [
    hass.entity.byId("select.gas_import_day"),
    hass.entity.byId("select.gas_import_month")
  ]

  function setElectricityImports(value: string) {
    for (const i of electricityImports) {
      i.state = value
    }
  };
  function setElectricityExports(value: string) {
    for (const i of electricityExports) {
      i.state = value
    }
  };

  function setGasImports(value: string) {
    for (const i of gasImports) {
      i.state = value
    }
  };

  function updateElectricityImports(newState) {
    const season = isElectricitySummer() ? "summer" : "winter";
    const threshold = parseFloat(newState.state) >= 400 ? "gt" : "lt";
    setElectricityImports(`${season}_${threshold}_400`)
  }

  function updateElectricityExports() {
    const exportTariff = isElectricitySummer() ? "summer" : "winter";
    setElectricityExports(exportTariff);
  }

  function updateGasImports(entity) {
    const season = isGasSummer() ? "summer" : "winter";
    const dth = parseFloat(entity.state) * 0.088728;
    const threshold = dth >= 45 ? "gt" : "lt";
    logger.info(`therms for month: ${dth}, which is ${threshold} 45`)
    setGasImports(`${season}_${threshold}_45`);
  }

  hass.entity.byId("sensor.electricity_import_month_total").onUpdate(updateElectricityImports);
  hass.entity.byId("sensor.gas_import_month_total").onUpdate(updateGasImports);

  scheduler.cron({
    schedule: "0 0 1 6,10 *",
    exec: () => {
      updateElectricityImports(hass.entity.byId("sensor.electricity_import_month_total"));
      updateElectricityExports();
    }
  });
  scheduler.cron({
    schedule: "0 0 1 4,11 *",
    exec: () => {
      updateGasImports(hass.entity.byId("sensor.gas_import_month_total"))
    }
  })

  lifecycle.onReady(() => {
    const electricity = hass.entity.byId("sensor.electricity_import_month_total");
    const gas = hass.entity.byId("sensor.gas_import_month_total");
    updateElectricityImports(electricity);
    updateGasImports(gas);
    updateElectricityExports();
  });

  return;
}
