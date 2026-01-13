import { TServiceParams } from "@digital-alchemy/core";
import { isRealEvent } from "./utils.mts";

type EventType = "click" | "double_click" | "hold";

type HvacMode = "heat" | "cool" | "off";

type EntityState = "on" | "off" | string;

interface ButtonEntity {
  onUpdate: (callback: (current: any, previous: any) => void) => void;
}

interface ToggleableEntity {
  toggle: () => void;
  turn_on: () => void;
  turn_off: () => void;
  state: EntityState;
  onUpdate: (callback: (update: any) => void) => void;
}

type rgb_color = [number, number, number];

interface LedEntity {
  turn_on: (options?: { brightness_pct?: number; color_name?: string; rgb_color?: rgb_color }) => void;
  turn_off: () => void;
}

interface ClimateEntity {
  state: HvacMode;
  set_hvac_mode: (options: { hvac_mode: HvacMode }) => void;
  onUpdate: (callback: () => void) => void;
}

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

  const syncLedState = (deviceState: EntityState, led: LedEntity, color?: rgb_color, brightness?: number): void => {
    if (deviceState === "on") {
      led.turn_on(color ? { brightness_pct: brightness ?? 30, rgb_color: color } : undefined);
    } else {
      led.turn_off();
    }
  };

  const createSimpleToggleButton = (
    button: ButtonEntity,
    device: ToggleableEntity,
    led: LedEntity,
    ledColor?: rgb_color,
    ledBrightness?: number,
  ): (() => void) => {
    button.onUpdate(({ state, attributes: { event_type } }, { state: oldState }) => {
      if (!isRealEvent(state, oldState)) return;
      if (event_type === "click") {
        device.toggle();
      }
    });

    device.onUpdate(({ state }) => {
      syncLedState(state, led, ledColor, ledBrightness);
    });

    return () => syncLedState(device.state, led, ledColor, ledBrightness); // Return init function
  };

  const updateDysonLed = (dysonState: EntityState): void => {
    if (dysonState === "on") {
      const climateState = dysonClimate.state as HvacMode;
      switch (climateState) {
        case "heat":
          btn1_led.turn_on({ brightness_pct: 30, rgb_color: [255, 0, 0] });
          break;
        case "cool":
          btn1_led.turn_on({ brightness_pct: 30, rgb_color: [0, 0, 255] });
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
  btn1.onUpdate(({ state, attributes: { event_type } }, { state: oldState }) => {
    if (!isRealEvent(state, oldState)) return;

    const eventType = event_type as EventType;
    switch (eventType) {
      case "click":
        dyson.toggle();
        break;
      case "double_click":
        // Ensure fan is on and toggle heating/cooling mode
        dyson.turn_on();
        const currentMode = dysonClimate.state as HvacMode;
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

  // Setup simple toggle buttons (Buttons 2-4)
  const simpleButtons: Array<{
    button: ButtonEntity;
    device: ToggleableEntity;
    led: LedEntity;
    ledColor: rgb_color;
    ledBrightness: number;
    name: string;
  }> = [
      { button: btn2, device: printer, led: btn2_led, ledColor: [0, 255, 0], ledBrightness: 30, name: "3D Printer" },
      { button: btn3, device: workbench, led: btn3_led, ledColor: [255, 200, 0], ledBrightness: 35, name: "Workbench Light" },
      { button: btn4, device: officeLifx, led: btn4_led, ledColor: [255, 0, 255], ledBrightness: 30, name: "Accent Light" },
    ];

  const ledInitializers: Array<() => void> = [];

  simpleButtons.forEach(({ button, device, led, ledColor, ledBrightness }) => {
    const init = createSimpleToggleButton(button, device, led, ledColor, ledBrightness);
    ledInitializers.push(init);
  });

  // Sync LEDs on startup
  lifecycle.onReady(() => {
    ledInitializers.forEach(init => init());
    updateDysonLed(dyson.state);
  });
}
