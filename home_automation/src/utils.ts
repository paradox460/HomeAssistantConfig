import dayjs from "dayjs";

import advancedFormat from "dayjs/plugin/advancedFormat";
import dayOfYear from "dayjs/plugin/dayOfYear";
import isBetween from "dayjs/plugin/isBetween";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import weekOfYear from "dayjs/plugin/weekOfYear";

dayjs.extend(advancedFormat);
dayjs.extend(dayOfYear);
dayjs.extend(isBetween);
dayjs.extend(timezone);
dayjs.extend(utc);
dayjs.extend(weekOfYear);
