import {
  createAsyncIterableInstrumenter,
  type InstrumentAsyncIterable,
} from "@gitlode/internal-foundation/otel-support";

import { STREAM_COMPLETION_ATTRIBUTE } from "./conventions.js";

export const instrumentAsyncIterable: InstrumentAsyncIterable = createAsyncIterableInstrumenter(
  (span, completion) => {
    span.setAttribute(STREAM_COMPLETION_ATTRIBUTE, completion);
  },
);
