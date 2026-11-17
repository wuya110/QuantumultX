/*
[rewrite_local]
^https:\/\/api\.revenuecat\.com\/v1\/(subscribers\/[^\/]+$|receipts$) url script-response-body cf.js

[mitm]
hostname = api.revenuecat.com
*/

let obj = JSON.parse($response.body);
if (obj.subscriber) {
  obj.subscriber.entitlements = {
    "subscription": {
      "expires_date": "2099-12-31T23:59:59Z",
      "product_identifier": "cloudflare_remote_sub",
      "purchase_date": "2023-01-01T00:00:00Z"
    }
  };
  obj.subscriber.subscriptions = {
    "cloudflare_remote_sub": {
      "expires_date": "2099-12-31T23:59:59Z",
      "original_purchase_date": "2023-01-01T00:00:00Z",
      "purchase_date": "2023-01-01T00:00:00Z",
      "store": "app_store"
    }
  };
}
$done({ body: JSON.stringify(obj) });
