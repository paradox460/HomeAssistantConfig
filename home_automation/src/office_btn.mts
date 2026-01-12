import { TServiceParams } from "@digital-alchemy/core";

type EventType = "click" | "double_click" | "hold" | string;

export function OfficeBtn({ hass, lifecycle, logger }: TServiceParams) {
  // Button entities
  const btn1 = hass.refBy.id("event.office_btn_1_button_1");
  const btn2 = hass.refBy.id("event.office_btn_1_button_2");
  const btn3 = hass.refBy.id("event.office_btn_1_button_3");
  const btn4 = hass.refBy.id("event.office_btn_1_button_4");

  // LED entities
  const btn1_led = hass.refBy.id("light.office_btn_1_btn_1_light");
  const btn2_led = hass.refBy.id("light.office_btn_1_btn_2_light");
  const btn3_led = hass.refBy.id("light.office_btn_1_btn_3_light");
  const btn4_led = hass.refBy.id("light.office_btn_1_btn_4_light");

  // Controlled entities
  const dyson = hass.refBy.id("fan.office");
  const dysonClimate = hass.refBy.id("climate.office");
  const workbench = hass.refBy.id("switch.office_workbench");
  const officeLifx = hass.refBy.id("light.office_lifx_accent");
  const printer = hass.refBy.id("switch.3d_printer");

  // Helper function to sync LED state with device state
  const syncLedState = (deviceState: string, led: any) => {
    deviceState === "on" ? led.turn_on() : led.turn_off();
  };

  // Helper function to update Dyson LED based on climate mode
  const updateDysonLed = (dysonState: string) => {
    if (dysonState === "on") {
      const climateState = dysonClimate.state;
      switch (climateState) {
        case "heat":
          btn1_led.turn_on({ brightness_pct: 30, color_name: "red" });
          break;
        case "cool":
          btn1_led.turn_on({ brightness_pct: 30, color_name: "blue" });
          break;
        default:
          btn1_led.turn_on();
          break;
      }
    } else {
      btn1_led.turn_off();
    }
  };

  // Button 1: Dyson Fan Control
  btn1.onUpdate(({ attributes: { event_type } }) => {
    logger.info(`btn1 update: ${event_type}`);

    switch (event_type as EventType) {
      case "click":
        dyson.toggle();
        break;
      case "double_click":
        // Ensure fan is on and toggle heating/cooling mode
        dyson.turn_on();
        const currentMode = dysonClimate.state;
        if (currentMode === "heat") {
          dysonClimate.set_hvac_mode({ hvac_mode: "cool" });
        } else if (currentMode === "cool") {
          dysonClimate.set_hvac_mode({ hvac_mode: "heat" });
        }
        break;
    }
  });

  dyson.onUpdate(({ state }) => {
    updateDysonLed(state);
  });

  dysonClimate.onUpdate(() => {
    updateDysonLed(dyson.state);
  });

  // Button 2: 3D Printer Control
  btn2.onUpdate(({ attributes: { event_type } }) => {
    if (event_type === "click") {
      printer.toggle();
    }
  });

  printer.onUpdate(({ state }) => {
    syncLedState(state, btn2_led);
  });

  // Button 3: Workbench Light Control
  btn3.onUpdate(({ attributes: { event_type } }) => {
    if (event_type === "click") {
      workbench.toggle();
    }
  });

  workbench.onUpdate(({ state }) => {
    syncLedState(state, btn3_led);
  });

  // Button 4: Accent Light Control
  btn4.onUpdate(({ attributes: { event_type } }) => {
    if (event_type === "click") {
      officeLifx.toggle();
    }
  });

  officeLifx.onUpdate(({ state }) => {
    syncLedState(state, btn4_led);
  });

  // Sync LEDs on startup
  lifecycle.onReady(() => {
    syncLedState(printer.state, btn2_led);
    syncLedState(workbench.state, btn3_led);
    syncLedState(officeLifx.state, btn4_led);
    updateDysonLed(dyson.state);
  });
}