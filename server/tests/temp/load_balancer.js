import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "https://mfs-wheat-eta.vercel.app/";

export const options = {
  scenarios: {
    upay_load_test: {
      executor: "ramping-vus",

      startVUs: 0,

      stages: [
        // Warm up
        { duration: "30s", target: 10 },

        // 100 users
        { duration: "30s", target: 100 },

        // 1,000 users
        { duration: "1m", target: 1000 },

        // 5,000 users
        { duration: "2m", target: 5000 },

        // 10,000 users
        { duration: "3m", target: 10000 },

        // Keep 10k for 2 minutes
        { duration: "2m", target: 10000 },

        // Ramp down
        { duration: "1m", target: 0 },
      ],

      gracefulRampDown: "30s",
    },
  },

  thresholds: {
    // Less than 1% requests should fail
    http_req_failed: ["rate<0.01"],

    // 95% requests should complete within 1 second
    http_req_duration: ["p(95)<1000"],

    // 99% requests should complete within 2 seconds
    "http_req_duration{expected_response:true}": ["p(99)<2000"],
  },
};

export default function () {
  const response = http.get(`${BASE_URL}/health`, {
    tags: {
      endpoint: "health",
    },
  });

  check(response, {
    "status is 200": (r) => r.status === 200,
    "response received": (r) => r.body && r.body.length > 0,
  });

  sleep(1);
}