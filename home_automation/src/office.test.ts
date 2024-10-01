import { hassTestRunner } from "./test-helper";

afterEach(async () => {
  await hassTestRunner.teardown();
  jest.restoreAllMocks();
});

test("turns on office wled when main lights go on", async () => {
  await hassTestRunner
    .bootLibrariesFirst()
    .setup(({ mock_assistant }) => {
      mock_assistant.entity.setupState({
        "light.office_ceiling": { state: "off" },
        "light.office_wled_dig_uno": { state: "off" },
      });
    })
    .run(async ({ hass, mock_assistant }) => {
      const spy = jest.spyOn(hass.call.light, "turn_on");

      await mock_assistant.entity.emitChange("light.office_ceiling", { state: "on" });

      expect(spy).toHaveBeenCalledWith({ entity_id: "light.office_wled_dig_uno" });
    });
});
