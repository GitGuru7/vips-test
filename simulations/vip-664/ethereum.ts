import * as eth from "../../vips/vip-664/data/ethereum";
import { runRemoteCfSuite } from "./utils/remoteSuite";

runRemoteCfSuite("ethereum", 25424000, {
  COMPTROLLER: eth.COMPTROLLER,
  cfChanges: eth.cfChanges,
  crvUSDOffboard: eth.crvUSDOffboard,
});
