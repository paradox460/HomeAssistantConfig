import { CreateApplication } from "@digital-alchemy/core";
import { LIB_HASS } from "@digital-alchemy/hass";
import { LIB_SYNAPSE } from "@digital-alchemy/synapse";
import { LIB_AUTOMATION } from "@digital-alchemy/automation";

import { Away } from "./away";
import { CoolChickens } from "./cool-chickens";
import { KidsLighting } from "./kids-lighting";
import { UtilityTariffs } from "./utility-tariffs";

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

  libraries: [
    LIB_HASS,
    LIB_SYNAPSE,
    LIB_AUTOMATION,
  ],

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
    Away,
    CoolChickens,
    KidsLighting,
    UtilityTariffs
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
        boilerplate: { LOG_LEVEL: "info" },
      },
    }),
);
