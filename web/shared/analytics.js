import { initDataFast } from "datafast";

const PRODUCTION_HOSTS = new Set(["timeonx.com", "www.timeonx.com"]);

if (PRODUCTION_HOSTS.has(window.location.hostname)) {
  void initDataFast({
    websiteId: "dfid_9gNnnCfCuF997NF3DxbQP",
    autoCapturePageviews: true,
  }).catch(() => {
    // Analytics must never interfere with the website experience.
  });
}
