

import http from 'k6/http'
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
//Trend

const pizzaResponseTime = new Trend('pizza_response_time') // Track response times
const pizzaRequestTime = new Trend('pizza_request_time') // Track request times

export const options = {
    stages: [
        { duration: '5s', target: 2 }, // Ramp up to 2 VU's 5 seconds
        { duration: '6s', target: 6 }, // Stay at 5 VUs for 6 seconds
        { duration: '3s', target: 0 } // Ramp down to 0 VUs over 3 seconds
    ],

    thresholds: {
        'http_req_duration': ['p(95) < 400'],
        'http_req_failed': ['rate < 0.1'],
        'checks': ['rate>0.9'],
        'http_req_duration{name:api}': ['p(95)<500'],
        'http_req_failed{name:api}': ['rate < 0.1'],
        'pizza_response_time': ['p(95)< 305'],
        'pizza_request_time': ['p(95)< 200']
    }


}

export default function () {
    const response = http.get("https://quickpizza.grafana.com/");

    pizzaResponseTime.add(response.timings.waiting);
    pizzaRequestTime.add(response.timings.sending);
    // response.timings.duration = DNS lookup + TCP connection+ TLS handshake(if HTTPS) +
    // waiting for response(server processing) + Receiving response(HTTP response download)

    check(response, {
        'status is 200': (r) => r.status === 200,
        'page contains pizza': (r) => {

            r.body.includes("Pizza, Please!")
        }
    })

    http.get("https://quickpizza.grafana.com/api/pizza", {
        tags: { name: 'api' }
    });

    sleep(1)
}

