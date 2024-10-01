import { LIB_MOCK_ASSISTANT } from "@digital-alchemy/hass/mock-assistant";
import { HOME_AUTOMATION } from "./home-automation";

import { TestRunner } from "@digital-alchemy/core";

export const createTestRunner = () =>
  TestRunner({ target: HOME_AUTOMATION }).appendLibrary(LIB_MOCK_ASSISTANT);

export const hassTestRunner = createTestRunner();
