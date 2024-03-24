import { CreateApplication } from "@digital-alchemy/core";
import { LIB_HASS } from "@digital-alchemy/hass";

import { ElectricityTariffs } from "./electricity-tariffs";

// define your application, doesn't do anything productive without services
const HOME_AUTOMATION = CreateApplication({
  /**
   * keep your secrets out of the code!
   * these variables will be loaded from your configuration file
   */
  configuration: {
    EXAMPLE_CONFIGURATION: {
      default: "foo",
      description: "A configuration defined as an example",
      type: "string",
    },
  },

  /**
   * @digital-alchemy/core also provides:
   *
   * - LIB_SYNAPSE: entity generation tools (requires custom component)
   * - LIB_AUTOMATION: higher level automation functions (requires synapse)
   */
  libraries: [
    /**
     * LIB_HASS provides basic interactions for Home Assistant
     *
     * Will automatically start websocket as part of bootstrap
     */
    LIB_HASS,

    /**
     * Un comment to enable the synapse library
     *
     */
    // LIB_SYNAPSE,
  ],

  /**
   * must match key used in LoadedModules
   * affects:
   *  - import name in TServiceParams
   *  - and files used for configuration
   *  - log context
   */
  name: "typescript",

  /**
   * Need a service to be loaded first? Add to this list
   */
  priorityInit: [],

  /**
   * Add additional services here
   * No guaranteed loading order unless added to priority list
   *
   * context: ServiceFunction
   */
  services: {
    ElectricityTariffs
  },
});

// Add module to library internals
declare module "@digital-alchemy/core" {
  export interface LoadedModules {
    typescript: typeof HOME_AUTOMATION;
  }
}

// Kick off the application!
setImmediate(
  async () =>
    await HOME_AUTOMATION.bootstrap({
      /**
       * override library defined defaults
       * not a substitute for config files
       */
      configuration: {
        // default value: trace
        boilerplate: { LOG_LEVEL: "debug" },
      },
    }),
);
