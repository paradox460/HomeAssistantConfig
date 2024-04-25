import { TServiceParams } from "@digital-alchemy/core";
import dayjs from 'dayjs';
import dayOfyear from 'dayjs/plugin/dayOfYear';

dayjs.extend(dayOfyear);

export function CatfoodConsume({ hass, scheduler }: TServiceParams) {

  scheduler.cron({
    schedule: "0 11 * * *",
    exec() {
      if (dayjs().dayOfYear() % 2 != 0) { return }
      hass.call.grocy.open_product({
        product_id: "59",
        amount: 1
      })
    }
  })

  scheduler.cron({
    schedule: "0 21 * * *",
    exec() {
      if (dayjs().dayOfYear() % 2 == 0) { return }
      hass.call.grocy.consume_product_from_stock({
        product_id: "59",
        amount: 1,
        transaction_type: "CONSUME"
      })
    }
  })
}
