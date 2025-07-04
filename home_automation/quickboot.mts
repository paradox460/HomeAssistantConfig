import { QuickBoot } from "@digital-alchemy/hass";
const { hass } = await QuickBoot("home_automation");
import repl from 'node:repl';

repl.start().context.hass = hass;