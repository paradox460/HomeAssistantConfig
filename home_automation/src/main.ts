import { HOME_AUTOMATION } from "./home-automation";

setImmediate(
  async () =>
    await HOME_AUTOMATION.bootstrap({
      bootLibrariesFirst: true,
      configuration: {
        boilerplate: { LOG_LEVEL: "info" },
      },
    }),
);
