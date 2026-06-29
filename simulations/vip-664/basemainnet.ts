import * as base from "../../vips/vip-664/data/basemainnet";
import { runRemoteCfSuite } from "./utils/remoteSuite";

runRemoteCfSuite("basemainnet", 47980000, {
  COMPTROLLER: base.COMPTROLLER,
  cfChanges: base.cfChanges,
});
