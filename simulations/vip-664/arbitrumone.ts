import * as arb from "../../vips/vip-664/data/arbitrumone";
import { runRemoteCfSuite } from "./utils/remoteSuite";

runRemoteCfSuite("arbitrumone", 478630000, {
  COMPTROLLER: arb.COMPTROLLER,
  cfChanges: arb.cfChanges,
});
