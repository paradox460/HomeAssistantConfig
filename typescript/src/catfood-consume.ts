import { TServiceParams } from "@digital-alchemy/core";
import dayjs from "dayjs";
import dayOfyear from "dayjs/plugin/dayOfYear";

dayjs.extend(dayOfyear);

export function CatfoodConsume({ hass, scheduler }: TServiceParams) {
  scheduler.cron({
    exec() {
      if (dayjs().dayOfYear() % 2 != 0) {
        return;
      }
      hass.call.grocy.open_product({
        amount: 1,
        product_id: "59",
      });
    },
    schedule: "0 11 * * *",
  });

  scheduler.cron({
    exec() {
      if (dayjs().dayOfYear() % 2 == 0) {
        return;
      }
      hass.call.grocy.consume_product_from_stock({
        amount: 1,
        product_id: "59",
        transaction_type: "CONSUME",
      });
    },
    schedule: "0 21 * * *",
  });
}
